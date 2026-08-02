import { useEffect, useState } from 'react';
import { CASE_QUEST_STEPS } from '../services/responseGuideSteps';
import { callCaseAssistant } from '../services/caseAssistantService';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import {
  toggleClauseCompleted,
  addUserClause,
  removeUserClause,
  getChecklistProgress,
} from '../services/requiredClauseChecklist';
import {
  buildQuestSteps,
  toggleQuestStepCompleted,
  updateQuestStepNote,
} from '../services/responseGuideSteps';
import { getCaseById, saveCaseQuestSteps } from '../services/firebaseService';

export default function ResponseGuideScreen({ navigation, route }) {
  // 계약서 조항 체크리스트 흐름 (기존)
  const record = route?.params?.record ?? null;
  const caseType = record?.caseType ?? record?.extra?.caseType ?? null;
  const initialItems = caseType && CASE_QUEST_STEPS[caseType]
  ? CASE_QUEST_STEPS[caseType]
  : (record?.extra?.requiredClauseChecklist ?? []);

  const caseId = route?.params?.caseId ?? null;
  const routeCaseType = route?.params?.caseType ?? null;
  const isQuestMode = Boolean(caseId);

  const [items, setItems] = useState(initialItems);
  const [newTitle, setNewTitle] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [loading, setLoading] = useState(isQuestMode);
  const [expandedId, setExpandedId] = useState(null);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!isQuestMode) return;
    (async () => {
      try {
        const caseDoc = await getCaseById(caseId);
        const { items: questItems } = buildQuestSteps(
          caseDoc?.caseType ?? routeCaseType,
          caseDoc?.questSteps ?? []
        );
        setItems(questItems);
      } catch (err) {
        console.error('사건 퀘스트 조회 오류:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  const progress = getChecklistProgress(items);

  const handleToggle = (id) => {
    if (isQuestMode) {
      setItems((prev) => {
        const next = toggleQuestStepCompleted(prev, id);
        saveCaseQuestSteps(caseId, next).catch((err) => console.error('퀘스트 저장 오류:', err));
        return next;
      });
      return;
    }
    setItems((prev) => toggleClauseCompleted(prev, id));
  };
  const handleAiSend = async () => {
  if (!aiInput.trim()) return;
  setAiLoading(true);
  try {
    const response = await callCaseAssistant(caseType ?? '기타', aiInput);
    setAiResponse(response);
  } catch {
    setAiResponse('오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    setAiLoading(false);
    setAiInput('');
  }
};

  const handleNoteChange = (id, note) => {
    setItems((prev) => updateQuestStepNote(prev, id, note));
  };

  const handleNoteSave = async (id) => {
    if (!isQuestMode) return;
    setSavingId(id);
    try {
      await saveCaseQuestSteps(caseId, items);
    } catch (err) {
      console.error('메모 저장 오류:', err);
    } finally {
      setSavingId(null);
    }
  };
  

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    setItems((prev) => addUserClause(prev, { title: newTitle.trim() }));
    setNewTitle('');
    setShowInput(false);
  };

  const handleRemove = (id) => {
    setItems((prev) => removeUserClause(prev, id));
  };

  return (
    <View style={styles.wrapper}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>대응 가이드</Text>
          <Text style={styles.subtitle}>
            {isQuestMode ? `${routeCaseType ?? ''} 단계별 대응 안내` : '단계별 법적 대응 안내'}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#3B7DD8" />
        </View>
      ) : (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 진행률 */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>퀘스트 진행도</Text>
            <Text style={styles.progressCount}>{progress.label}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress.percent}%` }]} />
          </View>
        </View>

        {/* 체크리스트 */}
        <Text style={styles.sectionTitle}>대응 퀘스트</Text>

        {items.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}> 체크리스트가 생성됩니다.</Text>
          </View>
        )}

        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.questCard, item.completed && styles.questCardDone]}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            activeOpacity={0.8}
          >
            <View style={styles.questLeft}>
              <View style={[styles.checkbox, item.completed && styles.checkboxDone]}>
                {item.completed && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>
            <View style={styles.questBody}>
              <View style={styles.questTitleRow}>
                <Text style={[styles.questTitle, item.completed && styles.questTitleDone]}>
                  {item.title}
                </Text>
                {item.completed && (
                  <Text style={styles.doneBadge}>완료</Text>
                )}
              </View>
              {expandedId === item.id && (
              isQuestMode ? (
                <>
                  {(item.requiredDocs || item.duration) ? (
                    <Text style={styles.questDesc}>
                      {item.requiredDocs ? `필요 서류: ${item.requiredDocs}` : ''}
                      {item.requiredDocs && item.duration ? '  ·  ' : ''}
                      {item.duration ? `소요: ${item.duration}` : ''}
                    </Text>
                  ) : null}
                  {item.link ? <Text style={styles.questEvidence}>🔗 {item.link}</Text> : null}
                  {item.phone ? <Text style={styles.questEvidence}>📞 {item.phone}</Text> : null}
                  <TextInput
                    style={styles.noteInput}
                    placeholder="질문이나 메모를 기록해 두세요..."
                    placeholderTextColor="#94A3B8"
                    value={item.note}
                    onChangeText={(text) => handleNoteChange(item.id, text)}
                    onBlur={() => handleNoteSave(item.id)}
                    multiline
                  />
                  {savingId === item.id && (
                    <Text style={styles.savingText}>저장 중...</Text>
                  )}
                </>
              ) : (
                <>
                  {item.description ? (
                    <Text style={styles.questDesc}>{item.description}</Text>
                  ) : null}
                  {item.evidence ? (
                    <Text style={styles.questEvidence}>📄 {item.evidence}</Text>
                  ) : !item.completed ? (
                    <Text style={styles.questMissing}>⚠️ 해당 조항 없음</Text>
                  ) : null}
                  {item.legalBasis ? (
                    <Text style={styles.questLegal}>근거: {item.legalBasis}</Text>
                  ) : null}
                  {item.source === 'user' && (
                    <TouchableOpacity onPress={() => handleRemove(item.id)} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>삭제</Text>
                    </TouchableOpacity>
                  )}
                </>
              )
            )}
            </View>
          </TouchableOpacity>
        ))}

        {/* 항목 추가 (계약 체크리스트 모드에서만) */}
        {!isQuestMode && (
          showInput ? (
            <View style={styles.inputCard}>
              <TextInput
                style={styles.input}
                placeholder="추가할 항목 입력..."
                placeholderTextColor="#94A3B8"
                value={newTitle}
                onChangeText={setNewTitle}
              />
              <View style={styles.inputBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInput(false)}>
                  <Text style={styles.cancelBtnText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
                  <Text style={styles.addBtnText}>추가</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowInput(true)}>
              <Text style={styles.addItemBtnText}>+ 항목 추가하기</Text>
            </TouchableOpacity>
          )
        )}
        {/* AI 질문창 */}
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>Themis AI</Text>
          <Text style={styles.aiDesc}>현재 단계에 대해 궁금한 점을 질문하세요</Text>
          <View style={styles.aiInputRow}>
            <TextInput
              style={styles.aiInput}
              placeholder="예) 내용증명 혼자 작성할 수 있나요?"
              placeholderTextColor="#94A3B8"
              value={aiInput}
              onChangeText={setAiInput}
            />
            <TouchableOpacity style={styles.aiSendBtn} onPress={handleAiSend} disabled={aiLoading}>
              <Text style={styles.aiSendBtnText}>{aiLoading ? '...' : '→'}</Text>
            </TouchableOpacity>
          </View>
          {aiResponse ? (
            <View style={styles.aiResponse}>
              <Text style={styles.aiResponseLabel}>Themis AI</Text>
              <Text style={styles.aiResponseText}>{aiResponse}</Text>
              <Text style={styles.aiDisclaimer}>본 내용은 법률 정보이며 조언이 아닙니다. 전문가 상담을 권장합니다.</Text>
            </View>
          ) : null}
        </View>

        {/* 전문가 연결 */}
        <TouchableOpacity style={styles.expertBtn}>
          <Text style={styles.expertBtnText}>전문가 채널 연결하기 ›</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#1E3A5F', paddingTop: 44, paddingBottom: 12,
    paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: '#7B9EC5', fontSize: 24 },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#7B9EC5', fontSize: 11 },
  content: { flex: 1, padding: 16 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noteInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    padding: 8, fontSize: 11, color: '#0F172A', marginTop: 6,
    minHeight: 40, textAlignVertical: 'top',
  },
  savingText: { color: '#94A3B8', fontSize: 9, marginTop: 2 },
  progressCard: {
    backgroundColor: '#FFFFFF', borderRadius: 10,
    padding: 14, marginBottom: 16,
  },
  progressTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  progressLabel: { color: '#64748B', fontSize: 12 },
  progressCount: { color: '#1E3A5F', fontSize: 12, fontWeight: '700' },
  progressBarBg: {
    height: 6, backgroundColor: '#E2E8F0', borderRadius: 3,
  },
  progressBarFill: {
    height: 6, backgroundColor: '#3B7DD8', borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: '#64748B',
    letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase',
  },
  emptyBox: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { color: '#94A3B8', fontSize: 12, textAlign: 'center' },
  questCard: {
    backgroundColor: '#FFFFFF', borderRadius: 10,
    padding: 14, marginBottom: 8,
    flexDirection: 'row', gap: 12,
  },
  questCardDone: { opacity: 0.7 },
  questLeft: { paddingTop: 2 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  checkmark: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  questBody: { flex: 1, gap: 3 },
  questTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questTitle: { color: '#0F172A', fontSize: 13, fontWeight: '600', flex: 1 },
  questTitleDone: { color: '#94A3B8', textDecorationLine: 'line-through' },
  doneBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    color: '#15803D', fontSize: 9, fontWeight: '600',
  },
  questDesc: { color: '#64748B', fontSize: 11 },
  questEvidence: { color: '#3B7DD8', fontSize: 10 },
  questMissing: { color: '#EF4444', fontSize: 10 },
  questLegal: { color: '#94A3B8', fontSize: 9, fontStyle: 'italic' },
  removeBtn: { alignSelf: 'flex-start', marginTop: 4 },
  removeBtnText: { color: '#EF4444', fontSize: 10 },
  inputCard: {
    backgroundColor: '#FFFFFF', borderRadius: 10,
    padding: 14, marginBottom: 8, gap: 10,
  },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    padding: 10, fontSize: 13, color: '#0F172A',
  },
  inputBtnRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  cancelBtnText: { color: '#64748B', fontSize: 12 },
  addBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, backgroundColor: '#1E3A5F',
  },
  addBtnText: { color: '#FFFFFF', fontSize: 12 },
  addItemBtn: {
    borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 10,
    borderStyle: 'dashed', padding: 14,
    alignItems: 'center', marginBottom: 12,
  },
  addItemBtnText: { color: '#94A3B8', fontSize: 12 },
  expertBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  expertBtnText: { color: '#F1F5F9', fontSize: 13, fontWeight: '500' },
  aiCard: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 12 },
  aiTitle: { color: '#1E3A5F', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  aiDesc: { color: '#94A3B8', fontSize: 11, marginBottom: 10 },
  aiInputRow: { flexDirection: 'row', gap: 8 },
  aiInput: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, fontSize: 12, color: '#0F172A' },
  aiSendBtn: { backgroundColor: '#3B7DD8', borderRadius: 8, width: 40, alignItems: 'center', justifyContent: 'center' },
  aiSendBtnText: { color: '#FFFFFF', fontSize: 16 },
  aiResponse: { marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10 },
  aiResponseLabel: { color: '#3B7DD8', fontSize: 11, fontWeight: '700' },
  aiResponseText: { color: '#0F172A', fontSize: 12, lineHeight: 18 },
  aiDisclaimer: { color: '#EF4444', fontSize: 10, marginTop: 4 },
});