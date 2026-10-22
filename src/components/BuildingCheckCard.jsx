// 건물 확인 카드 — 주소를 검색해 건축물대장(위반건축물·사용승인일·주용도)을 신호등으로 보여준다.
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { C, SIGNAL } from '../theme/tokens';
import { searchAddress, fetchBuildingTitles, assessBuilding } from '../services/buildingRegisterService';

const LEVEL_STYLE = {
  safe: { dot: SIGNAL.dot.safe, label: '양호' },
  warning: { dot: SIGNAL.dot.warning, label: '주의' },
  danger: { dot: SIGNAL.dot.danger, label: '위험' },
  unknown: { dot: C.ink400, label: '확인 필요' },
};

export function BuildingCheckCard() {
  const [query, setQuery] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [buildings, setBuildings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async () => {
    setError('');
    setBuildings(null);
    setLoading(true);
    try {
      const found = await searchAddress(query);
      setAddresses(found);
      if (found.length === 0) setError('검색 결과가 없습니다. 도로명이나 지번을 더 정확히 입력해보세요.');
    } catch (e) {
      setAddresses([]);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pickAddress = async (address) => {
    setError('');
    setAddresses([]);
    setQuery(address.roadAddr);
    setLoading(true);
    try {
      const items = await fetchBuildingTitles(address);
      setBuildings(items.map((item) => assessBuilding(item)));
      if (items.length === 0) setError('이 주소의 건축물대장 표제부를 찾지 못했습니다.');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>
        건물 확인 <Text style={styles.titleMuted}>(국토교통부 건축물대장 연동)</Text>
      </Text>
      <Text style={styles.hint}>계약할 집 주소를 검색하면 위반건축물 여부, 사용승인일, 주용도를 확인합니다.</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          placeholder="예) 서울 관악구 신림로 123"
          placeholderTextColor={C.ink400}
          style={styles.input}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={runSearch} disabled={loading} accessibilityLabel="주소 검색">
          <Text style={styles.searchBtnText}>검색</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={C.brand600} style={styles.loading} />}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {addresses.map((a) => (
        <TouchableOpacity key={`${a.admCd}-${a.mainNo}-${a.subNo}-${a.roadAddr}`} style={styles.addressRow} onPress={() => pickAddress(a)}>
          <Text style={styles.addressMain}>{a.roadAddr}</Text>
          <Text style={styles.addressSub}>{a.jibunAddr}</Text>
        </TouchableOpacity>
      ))}

      {buildings?.map((b, idx) => (
        <View key={idx} style={styles.result}>
          <Text style={styles.buildingName}>
            {b.name}{b.households ? ` · ${b.households}세대/가구` : ''}
          </Text>
          {b.checks.map((c) => (
            <View key={c.label} style={styles.checkRow}>
              <View style={[styles.dot, { backgroundColor: LEVEL_STYLE[c.level].dot }]} />
              <View style={styles.checkBody}>
                <Text style={styles.checkLabel}>{c.label} · {LEVEL_STYLE[c.level].label}</Text>
                <Text style={styles.checkText}>{c.text}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}

      {buildings && buildings.length > 0 && (
        <Text style={styles.notice}>건축물대장 정보는 참고용입니다. 계약 전 등기부등본과 건축물대장 원본을 함께 확인하세요.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.sky050, borderRadius: 16, padding: 14, marginBottom: 16, gap: 8 },
  title: { fontSize: 12.5, fontWeight: '700', color: C.ink700 },
  titleMuted: { fontWeight: '500', color: C.ink400 },
  hint: { fontSize: 12, color: C.ink500 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: C.ink900, backgroundColor: C.surface,
  },
  searchBtn: { backgroundColor: C.brand600, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 0 },
  searchBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  loading: { marginVertical: 6 },
  error: { fontSize: 12, color: SIGNAL.text.danger },
  addressRow: { backgroundColor: C.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.line },
  addressMain: { fontSize: 13, color: C.ink900, fontWeight: '600' },
  addressSub: { fontSize: 11.5, color: C.ink500, marginTop: 2 },
  result: { backgroundColor: C.surface, borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: C.line },
  buildingName: { fontSize: 13, fontWeight: '700', color: C.ink900 },
  checkRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  checkBody: { flex: 1 },
  checkLabel: { fontSize: 12, fontWeight: '700', color: C.ink700 },
  checkText: { fontSize: 12, color: C.ink500, lineHeight: 17, marginTop: 2 },
  notice: { fontSize: 11, color: C.ink400 },
});
