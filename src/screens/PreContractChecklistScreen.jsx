// src/screens/PreContractChecklistScreen.jsx
//
// "계약 전 필수 체크리스트" — 등기부등본 열람, 근저당 확인, 전입신고 당일 처리 등
// 계약서에 도장 찍기 전 임차인이 직접 확인해야 하는 행동 체크리스트.
// 계약서 "문구"를 검증하는 requiredClauseChecklist와 달리, 계약서 밖 행동을 다룬다.
//
// 사건(case)과 무관하게 사용자 1명당 하나의 체크리스트를 유지·저장한다 (지금 고민 중인
// 매물 하나에 집중하는 도구). 로그인하지 않은 경우 로컬 상태로만 동작하고 저장은 건너뛴다.

import { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '../components/BackHeader';
import { C } from '../theme/tokens';
import { AuthContext } from '../context/AuthContext';
import { getPreContractChecklistState, savePreContractChecklistState } from '../services/firebaseService';
import {
  mergePreContractChecklist,
  togglePreContractItem,
  toSavablePreContractChecklist,
  getPreContractProgress,
} from '../services/preContractChecklist';

const SEVERITY_LABEL = { critical: '필수', high: '중요', medium: '권장' };
const SEVERITY_COLOR = { critical: C.danger600, high: C.warn600, medium: C.ink400 };

export default function PreContractChecklistScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState(() => mergePreContractChecklist([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const saved = await getPreContractChecklistState(user.uid);
        if (!cancelled) setItems(mergePreContractChecklist(saved ?? []));
      } catch (err) {
        console.warn('체크리스트 불러오기 실패:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const progress = getPreContractProgress(items);

  const handleToggle = async (id) => {
    const next = togglePreContractItem(items, id);
    setItems(next);
    if (!user) return;
    setSaving(true);
    try {
      await savePreContractChecklistState(user.uid, toSavablePreContractChecklist(next));
    } catch (err) {
      console.warn('체크리스트 저장 실패:', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert('체크리스트 초기화', '새 매물을 확인할 때 체크 상태를 모두 초기화할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: async () => {
          const next = mergePreContractChecklist([]);
          setItems(next);
          if (user) {
            try {
              await savePreContractChecklistState(user.uid, toSavablePreContractChecklist(next));
            } catch (err) {
              console.warn('체크리스트 초기화 저장 실패:', err.message);
            }
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <BackHeader
        title="계약 전 필수 체크리스트"
        subtitle="도장 찍기 전에 꼭 확인하세요"
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.brand600} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{progress.label}</Text>
              {saving && <ActivityIndicator size="small" color={C.brand600} />}
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progress.percent}%` }]} />
            </View>
            {progress.hasUncheckedCritical && (
              <Text style={styles.criticalWarning}>
                ⚠️ 아직 확인하지 않은 필수 항목이 있어요. 계약 전 반드시 확인하세요.
              </Text>
            )}
          </View>

          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.itemCard, item.completed && styles.itemCardDone]}
              onPress={() => handleToggle(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, item.completed && styles.checkboxDone]}>
                {item.completed && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <View style={styles.itemBody}>
                <View style={styles.itemTitleRow}>
                  <Text style={[styles.itemTitle, item.completed && styles.itemTitleDone]}>{item.title}</Text>
                  <Text style={[styles.severityBadge, { color: SEVERITY_COLOR[item.severity] }]}>
                    {SEVERITY_LABEL[item.severity]}
                  </Text>
                </View>
                <Text style={styles.itemDescription}>{item.description}</Text>
                {item.legalBasis && <Text style={styles.itemLegalBasis}>근거: {item.legalBasis}</Text>}
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>새 매물 확인 시작 (초기화)</Text>
          </TouchableOpacity>

          {!user && (
            <Text style={styles.loginNotice}>로그인하면 체크한 내용이 다음에도 그대로 남아있어요.</Text>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.sky050 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16 },

  progressCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.line,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 13.5, fontWeight: '700', color: C.ink900 },
  progressBarTrack: { height: 8, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4, backgroundColor: C.brand600 },
  criticalWarning: { color: C.danger600, fontSize: 11.5, fontWeight: '600', marginTop: 10 },

  itemCard: {
    flexDirection: 'row', gap: 10, backgroundColor: C.surface, borderRadius: 14,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line,
  },
  itemCardDone: { backgroundColor: C.safe100, borderColor: C.safe600 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxDone: { backgroundColor: C.safe600, borderColor: C.safe600 },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  itemBody: { flex: 1 },
  itemTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemTitle: { fontSize: 13.5, fontWeight: '700', color: C.ink900, flexShrink: 1, marginRight: 8 },
  itemTitleDone: { textDecorationLine: 'line-through', color: C.ink500 },
  severityBadge: { fontSize: 10.5, fontWeight: '800' },
  itemDescription: { fontSize: 12, color: C.ink500, lineHeight: 17 },
  itemLegalBasis: { fontSize: 10.5, color: C.ink400, marginTop: 6 },

  resetBtn: {
    alignSelf: 'center', marginTop: 8, paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: C.line, borderRadius: 10,
  },
  resetBtnText: { color: C.ink500, fontSize: 12, fontWeight: '600' },
  loginNotice: { textAlign: 'center', color: C.ink400, fontSize: 11, marginTop: 12 },
});
