import { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { createCase, getCasesByUser } from '../services/firebaseService';
import { CASE_TYPES, CASE_TYPE_META } from '../services/responseGuideSteps';
import { APP_ROUTES, RECORD_ROUTES } from '../navigation/routes';

export function NewCaseScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const force = route?.params?.force ?? false; // "+새 사건" 등으로 명시적으로 들어온 경우 true
  const [selectedType, setSelectedType] = useState(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(!force);

  // 기록 탭으로 들어왔을 때, 진행 중인 사건이 있으면 그 사건 타임라인으로 바로 이동
  useEffect(() => {
    if (force || !user) {
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const cases = await getCasesByUser(user.uid);
        if (cases.length > 0) {
          const latest = [...cases].sort(
            (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
          )[0];
          navigation.replace(RECORD_ROUTES.EVIDENCE_TIMELINE, { caseId: latest.id });
          return;
        }
      } catch (err) {
        console.error('사건 조회 오류:', err);
      } finally {
        setChecking(false);
      }
    })();
  }, [user, force]);

  const handleStart = async () => {
  if (!title.trim()) {
    Alert.alert('알림', '기록 이름을 입력해주세요.');
    return;
  }
  if (!selectedType) {
    Alert.alert('알림', '사건 유형을 선택해주세요.');
    return;
  }
  if (!user) {
    Alert.alert('알림', '로그인이 필요합니다.');
    return;
  }
  try {
    setSubmitting(true);
    const caseId = await createCase({
      name: title.trim(),
      caseType: selectedType,
      userId: user.uid,
    });
    navigation.navigate(RECORD_ROUTES.EVIDENCE_UPLOAD, { caseId, caseType: selectedType });
  } catch (e) {
    Alert.alert('오류', '기록 생성에 실패했습니다.');
  } finally {
    setSubmitting(false);
  }
};

  if (checking) {
    return (
      <View style={[styles.wrapper, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#1E3A5F" />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.appbar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.getParent()?.navigate(APP_ROUTES.HOME_STACK);
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