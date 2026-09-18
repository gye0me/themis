import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '../components/BackHeader';
import { C } from '../theme/tokens';
import { CASE_TYPE_META } from '../services/responseGuideSteps';
import { askCaseAssistant } from '../services/caseAssistantService';

// 사전 예방 상담에서 고를 수 있는 상황 유형. CASE_TYPE_META 전체(5개) 중
// caseAssistantService.js에 예방용 프롬프트가 정의된 4개만 노출한다 ('기타'는 제외).
const PREVENTION_CASE_TYPES = ['전세사기', '금전사기', '괴롭힘', '신변위협'];

// 홈 화면 "사전 예방 상담" 진입점.
// 대응 퀘스트(ResponseGuideScreen)의 AI 질문창과 같은 서비스(caseAssistantService)를
// mode: 'prevention'으로 재사용한다 — 사건이 아직 없는 상태라 질문 기록은 저장하지 않고
// 화면을 나가면 휘발되는 가벼운 상담으로 유지한다.
export default function PreventionConsultScreen({ navigation }) {
  const [caseType, setCaseType] = useState('전세사기');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setAnswer('');
    try {
      const response = await askCaseAssistant({ caseType, question: trimmed, mode: 'prevention' });
      setAnswer(response);
    } catch (err) {
      setAnswer(err.message ?? '오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
      setQuestion('');
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
            </View>
          ) : null}
        </View>

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
});
