// src/components/PreventionGuideModal.jsx
//
// 사건 유형별 "예방 가이드" 모달 — 사례(탭)별 예방 방법 + 체크리스트.
// - 증거 업로드 화면에 사건별로 처음 들어올 때 자동으로 한 번 뜨고
// - 타임라인 화면의 "예방" 버튼으로 언제든 다시 열 수 있다.
// 체크 상태는 사건 문서(cases.preventionChecklist)에 저장돼 두 화면에서 같이 보인다.
// caseId가 없으면(일반 기록) 체크 상태는 이 모달이 열려있는 동안만 유지된다.

import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { getCaseById, saveCasePreventionChecklist } from '../services/firebaseService';
import { getPreventionGuide, getScenarioProgress } from '../services/preventionGuides';
import { CASE_TYPE_META } from '../services/responseGuideSteps';
import { C } from '../theme/tokens';

export function PreventionGuideModal({ visible, caseId = null, caseType, onClose }) {
  // 내용은 열려 있을 때만 마운트해서, 열 때마다 저장된 상태를 새로 불러온다
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible && <PreventionGuideSheet caseId={caseId} caseType={caseType} onClose={onClose} />}
    </Modal>
  );
}

function PreventionGuideSheet({ caseId, caseType, onClose }) {
  const guide = getPreventionGuide(caseType);
  const meta = CASE_TYPE_META[caseType] ?? CASE_TYPE_META['기타'];
  const hasCase = !!caseId && caseId !== 'general';
  const [scenarioId, setScenarioId] = useState(guide.scenarios[0].id);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(hasCase);

  // 저장된 체크 상태와 마지막으로 본 사례 탭을 불러온다
  useEffect(() => {
    if (!hasCase) return;
    let active = true;
    getCaseById(caseId)
      .then((c) => {
        if (!active || !c) return;
        setChecked(c.preventionChecklist ?? {});
        if (guide.scenarios.some((sc) => sc.id === c.preventionScenario)) setScenarioId(c.preventionScenario);
      })
      .catch((err) => console.warn('예방 체크리스트 불러오기 실패:', err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [hasCase, caseId, guide]);

  const scenario = guide.scenarios.find((s) => s.id === scenarioId) ?? guide.scenarios[0];
  const progress = getScenarioProgress(scenario, checked);

  const persist = (nextChecked, nextScenarioId) => {
    if (!hasCase) return;
    saveCasePreventionChecklist(caseId, { checklist: nextChecked, scenarioId: nextScenarioId }).catch((err) =>
      console.warn('예방 체크리스트 저장 실패:', err.message)
    );
  };

  const toggleItem = (itemId) => {
    const next = { ...checked };
    if (next[itemId]) delete next[itemId];
    else next[itemId] = true;
    setChecked(next);
    persist(next, scenario.id);
  };

  const selectScenario = (id) => {
    setScenarioId(id);
    persist(checked, id);
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>{meta.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{meta.label} 예방 가이드</Text>
            <Text style={styles.subtitle}>내 상황에 맞는 사례를 골라 미리 챙겨보세요</Text>
          </View>
        </View>

        {guide.scenarios.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabs}
          >
            {guide.scenarios.map((s) => {
              const active = s.id === scenario.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => selectScenario(s.id)}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{s.icon} {s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <ScrollView style={styles.body} contentContainerStyle={{ gap: 14, paddingBottom: 6 }}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{scenario.summary}</Text>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.sectionLabel}>예방 방법</Text>
            {scenario.tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Text style={styles.tipNum}>{i + 1}</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 8 }}>
            <View style={styles.checklistHead}>
              <Text style={styles.sectionLabel}>체크리스트</Text>
              {loading ? (
                <ActivityIndicator size="small" color={C.brand600} />
              ) : (
                <Text style={styles.progressText}>{progress.done}/{progress.total} 완료</Text>
              )}
            </View>
            {scenario.checklist.map((item) => {
              const done = !!checked[item.id];
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.checkRow, done && styles.checkRowDone]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, done && styles.checkboxDone]}>
                    {done && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={[styles.checkText, done && styles.checkTextDone]}>{item.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.disclaimer}>본 안내는 일반적인 예방 정보이며 법률 조언이 아닙니다.</Text>
        </ScrollView>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>확인했어요</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, gap: 14, maxHeight: '90%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { fontSize: 28 },
  title: { fontSize: 16.5, fontWeight: '700', color: C.ink900 },
  subtitle: { fontSize: 12, color: C.ink500, marginTop: 2 },

  // 시트 내용이 길면 세로로 줄어들어 탭이 찌그러지지 않도록 탭 줄 높이를 고정한다
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: 8, paddingRight: 8, alignItems: 'center' },
  tab: {
    flexShrink: 0,
    borderWidth: 1, borderColor: C.line, borderRadius: 999, backgroundColor: C.surface,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  tabActive: { backgroundColor: C.brand600, borderColor: C.brand600 },
  tabText: { fontSize: 12.5, fontWeight: '600', color: C.ink500 },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },

  body: { flexGrow: 0 },
  summaryBox: { backgroundColor: C.sky050, borderRadius: 14, padding: 14 },
  summaryText: { fontSize: 13, color: C.brand700, fontWeight: '600', lineHeight: 19 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.ink500 },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipNum: {
    width: 20, height: 20, borderRadius: 999, backgroundColor: C.sky100, color: C.brand600,
    fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 20, overflow: 'hidden',
  },
  tipText: { flex: 1, fontSize: 12.5, color: C.ink700, lineHeight: 19 },

  checklistHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { fontSize: 11.5, fontWeight: '700', color: C.brand600 },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11,
  },
  checkRowDone: { backgroundColor: C.safe100, borderColor: C.safe100 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.ink400,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: C.safe600, borderColor: C.safe600 },
  checkMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  checkText: { flex: 1, fontSize: 12.5, color: C.ink900, lineHeight: 18 },
  checkTextDone: { color: C.ink500 },
  disclaimer: { fontSize: 10, color: C.ink400, textAlign: 'center' },

  closeBtn: { backgroundColor: C.brand600, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
