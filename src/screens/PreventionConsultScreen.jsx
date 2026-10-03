import { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '../components/BackHeader';
import { C } from '../theme/tokens';
import { CASE_TYPE_META } from '../services/responseGuideSteps';
import { askCaseAssistant } from '../services/caseAssistantService';
import { AuthContext } from '../context/AuthContext';
import { createEvidenceRecord, getEvidenceRecords } from '../services/firebaseService';
import { PREVENTION_ROUTES } from '../navigation/routes';

// 사전 예방 상담 기록에 붙이는 제목 접두어. 'general' 버킷에는 다른 화면에서 온 잡다한
// 텍스트 기록도 섞일 수 있어서, 이 화면이 저장한 것만 구분해서 불러오기 위한 마커.
const RECORD_TITLE_PREFIX = '사전 예방 상담';

// 사전 예방 상담에서 고를 수 있는 상황 유형. CASE_TYPE_META 전체(5개) 중
// caseAssistantService.js에 예방용 프롬프트가 정의된 4개만 노출한다 ('기타'는 제외).
const PREVENTION_CASE_TYPES = ['전세사기', '금전사기', '괴롭힘', '신변위협'];

function formatDate(value) {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 홈 화면 "사전 예방 상담" 진입점.
// 대응 퀘스트(ResponseGuideScreen)의 AI 질문창과 같은 서비스(caseAssistantService)를
// mode: 'prevention'으로 재사용한다. 상담 자체는 화면을 나가면 휘발되는 게 기본이지만,
// 나중에 참고하고 싶은 답변은 "기록으로 남기기"를 눌러 텍스트 증거로 저장할 수 있다.
// 아직 사건이 없는 상태라 caseId 없이 'general' 버킷에 저장하고, 이 화면 안에서 직접
// 목록으로 보여준다(다른 화면 어디에도 'general' 버킷을 조회하는 곳이 없기 때문).
export default function PreventionConsultScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [caseType, setCaseType] = useState('전세사기');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedRecords, setSavedRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const loadSavedRecords = async () => {
    if (!user) return;
    setRecordsLoading(true);
    try {
      const all = await getEvidenceRecords(user.uid, 'general');
      setSavedRecords(all.filter((r) => r.evidenceType === 'text' && r.title?.startsWith(RECORD_TITLE_PREFIX)));
    } catch (err) {
      console.warn('상담 기록 조회 실패:', err.message);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    loadSavedRecords();
  }, [user?.uid]);

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setAnswer('');
    setSaved(false);
    try {
      const response = await askCaseAssistant({ caseType, question: trimmed, mode: 'prevention' });
      setAnswer(response);
      setAskedQuestion(trimmed);
    } catch (err) {
      setAnswer(err.message ?? '오류가 발생했습니다. 다시 시도해주세요.');
      setAskedQuestion(trimmed);
    } finally {
      setLoading(false);
      setQuestion('');
    }
  };

  const handleSaveRecord = async () => {
    if (!user) {
      Alert.alert('로그인이 필요해요', '상담 기록을 남기려면 먼저 로그인해주세요.');
      return;
    }
    if (!answer || saving) return;
    setSaving(true);
    try {
      const meta = CASE_TYPE_META[caseType];
      await createEvidenceRecord({
        userId: user.uid,
        caseId: 'general', // 아직 사건이 없는 상태의 상담이라 사건과 무관한 버킷에 저장
        title: `${RECORD_TITLE_PREFIX} · ${meta?.label ?? caseType}`,
        note: `Q. ${askedQuestion}\n\nA. ${answer}`,
        evidenceType: 'text',
        eventTime: new Date(),
        eventTimeSource: 'manual',
      });
      setSaved(true);
      loadSavedRecords();
    } catch (err) {
      Alert.alert('저장 실패', err.message ?? '상담 기록을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <BackHeader
        title="사전 예방 상담"
        subtitle="사건 터지기 전에 미리 확인해보세요"
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>어떤 상황인가요?</Text>
        <View style={styles.chipRow}>
          {PREVENTION_CASE_TYPES.map((type) => {
            const meta = CASE_TYPE_META[type];
            const active = caseType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCaseType(type)}
              >
                <Text style={styles.chipIcon}>{meta.icon}</Text>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{meta.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.checklistLinkCard}
          onPress={() => navigation.navigate(PREVENTION_ROUTES.CHECKLIST)}
          activeOpacity={0.8}
        >
          <Text style={styles.checklistLinkIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.checklistLinkTitle}>계약 전 필수 체크리스트</Text>
            <Text style={styles.checklistLinkDesc}>등기부등본 확인, 전입신고 타이밍 등 도장 찍기 전 확인할 것들</Text>
          </View>
          <Text style={styles.checklistLinkArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>Themis AI</Text>
          <Text style={styles.aiDesc}>
            {'예) "이 회사 다녀도 될까요?", "중고거래 이렇게 진행해도 안전한가요?" 처럼 자유롭게 물어보세요'}
          </Text>
          <View style={styles.aiInputRow}>
            <TextInput
              style={styles.aiInput}
              placeholder="궁금한 걸 물어보세요"
              placeholderTextColor={C.ink400}
              value={question}
              onChangeText={setQuestion}
              multiline
            />
            <TouchableOpacity style={styles.aiSendBtn} onPress={handleAsk} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.aiSendBtnText}>→</Text>}
            </TouchableOpacity>
          </View>

          {answer ? (
            <View style={styles.aiResponse}>
              <Text style={styles.aiResponseLabel}>Themis AI</Text>
              <Text style={styles.aiResponseText}>{answer}</Text>
              <Text style={styles.aiDisclaimer}>본 내용은 법률 정보이며 조언이 아닙니다. 실제 계약·거래 전에는 전문가 상담을 권장합니다.</Text>

              <TouchableOpacity
                style={[styles.saveRecordBtn, saved && styles.saveRecordBtnDone]}
                onPress={handleSaveRecord}
                disabled={saving || saved}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={C.brand600} />
                ) : (
                  <Text style={styles.saveRecordBtnText}>
                    {saved ? '✓ 기록으로 남겼어요' : '📌 이 상담 기록으로 남기기'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {savedRecords.length > 0 && (
          <View style={styles.savedSection}>
            <Text style={styles.sectionTitle}>남겨둔 상담 기록</Text>
            {savedRecords.map((record) => (
              <View key={record.id} style={styles.savedCard}>
                <Text style={styles.savedCardDate}>{formatDate(record.eventTime ?? record.capturedAt)}</Text>
                <Text style={styles.savedCardTitle}>{record.title}</Text>
                <Text style={styles.savedCardNote} numberOfLines={3}>{record.note}</Text>
              </View>
            ))}
          </View>
        )}
        {recordsLoading && savedRecords.length === 0 && (
          <ActivityIndicator size="small" color={C.brand600} style={{ marginTop: 8 }} />
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.ink900, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: C.line, backgroundColor: C.surface,
  },
  chipActive: { backgroundColor: C.brand600, borderColor: C.brand600 },
  chipIcon: { fontSize: 14 },
  chipLabel: { fontSize: 12.5, fontWeight: '600', color: C.ink700 },
  chipLabelActive: { color: '#FFFFFF' },
  aiCard: { backgroundColor: C.sky050, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14 },

  checklistLinkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.brand600, borderRadius: 14, padding: 14, marginBottom: 18,
  },
  checklistLinkIcon: { fontSize: 22 },
  checklistLinkTitle: { fontSize: 13.5, fontWeight: '700', color: C.ink900, marginBottom: 2 },
  checklistLinkDesc: { fontSize: 11, color: C.ink500 },
  checklistLinkArrow: { fontSize: 20, color: C.ink400 },
  aiTitle: { color: C.brand700, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  aiDesc: { color: C.ink400, fontSize: 11, marginBottom: 10, lineHeight: 16 },
  aiInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  aiInput: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, fontSize: 12, color: C.ink900, backgroundColor: C.surface, minHeight: 40 },
  aiSendBtn: { backgroundColor: C.brand600, borderRadius: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  aiSendBtnText: { color: '#FFFFFF', fontSize: 16 },
  aiResponse: { marginTop: 12, backgroundColor: C.surface, borderRadius: 10, padding: 10 },
  aiResponseLabel: { color: C.brand600, fontSize: 11, fontWeight: '700' },
  aiResponseText: { color: C.ink900, fontSize: 12, lineHeight: 18, marginTop: 4 },
  aiDisclaimer: { color: C.danger600, fontSize: 10, marginTop: 8 },
  saveRecordBtn: {
    marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: C.brand600,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  saveRecordBtnDone: { borderColor: C.line, opacity: 0.7 },
  saveRecordBtnText: { color: C.brand600, fontSize: 11.5, fontWeight: '700' },

  savedSection: { marginTop: 22 },
  savedCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  savedCardDate: { color: C.ink400, fontSize: 10, marginBottom: 4 },
  savedCardTitle: { color: C.ink900, fontSize: 12.5, fontWeight: '700', marginBottom: 4 },
  savedCardNote: { color: C.ink500, fontSize: 11.5, lineHeight: 16 },
});
