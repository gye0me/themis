import { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { createCase } from '../services/firebaseService';
import { CASE_TYPES, CASE_TYPE_META } from '../services/responseGuideSteps';

export function NewCaseScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [selectedType, setSelectedType] = useState(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStart = async () => {
    if (!selectedType || submitting) return;
    setSubmitting(true);
    try {
      const caseId = await createCase({
        userId: user?.uid ?? null,
        caseType: selectedType,
        title: title.trim(),
      });
      navigation.navigate('ResponseGuide', { caseId, caseType: selectedType });
    } catch (err) {
      console.error('사건 생성 오류:', err);
      Alert.alert('오류', '사건을 생성하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.appbar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('App');
            }
          }}
        >
          <Text style={styles.back}>‹ 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>새 기록 시작하기</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>어떤 피해를 겪고 계신가요?</Text>

        <View style={styles.typeGrid}>
          {CASE_TYPES.map((type) => {
            const meta = CASE_TYPE_META[type];
            const isSelected = selectedType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                onPress={() => setSelectedType(type)}
                activeOpacity={0.8}
              >
                <Text style={styles.typeIcon}>{meta.icon}</Text>
                <Text style={[styles.typeLabel, isSelected && styles.typeLabelSelected]}>
                  {meta.label}
                </Text>
                <Text style={styles.typeDesc}>{meta.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>사건 이름 (선택)</Text>
        <TextInput
          style={styles.input}
          placeholder="예: OO빌라 전세 계약"
          placeholderTextColor="#94A3B8"
          value={title}
          onChangeText={setTitle}
        />

        <TouchableOpacity
          style={[styles.startBtn, !selectedType && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={!selectedType || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#F1F5F9" />
          ) : (
            <Text style={styles.startBtnText}>시작하기 →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },
  appbar: { backgroundColor: '#1E3A5F', padding: 16, paddingTop: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { paddingVertical: 8, paddingRight: 16 },
  back: { color: '#7B9EC5', fontSize: 16 },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  content: { flex: 1, padding: 16 },
  sectionLabel: { color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  typeCard: {
    width: '48%', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 14, borderWidth: 1.5, borderColor: '#E2E8F0', gap: 4,
  },
  typeCardSelected: { borderColor: '#1E3A5F', backgroundColor: '#EFF6FF' },
  typeIcon: { fontSize: 22 },
  typeLabel: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  typeLabelSelected: { color: '#1E3A5F' },
  typeDesc: { color: '#64748B', fontSize: 10 },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    padding: 12, fontSize: 13, color: '#0F172A', backgroundColor: '#FFFFFF',
    marginBottom: 24,
  },
  startBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    padding: 15, alignItems: 'center',
  },
  startBtnDisabled: { backgroundColor: '#CBD5E1' },
  startBtnText: { color: '#F1F5F9', fontSize: 14, fontWeight: '600' },
});