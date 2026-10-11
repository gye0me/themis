// src/components/PreventionGuideModal.jsx
//
// 사건 유형별 "예방 가이드" 모달 — 사례(탭)별 요약 + 예방 방법 설명.
// - 증거 업로드 화면에 사건별로 처음 들어올 때 자동으로 한 번 뜨고
// - 타임라인 화면의 "예방 가이드" 버튼으로 언제든 다시 열 수 있다.

import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { getPreventionGuide } from '../services/preventionGuides';
import { CASE_TYPE_META } from '../services/responseGuideSteps';
import { C } from '../theme/tokens';
import { Icon } from './Icon';

export function PreventionGuideModal({ visible, caseType, onClose }) {
  // 내용은 열려 있을 때만 마운트해서, 열 때마다 첫 번째 사례 탭부터 보여준다
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible && <PreventionGuideSheet caseType={caseType} onClose={onClose} />}
    </Modal>
  );
}

function PreventionGuideSheet({ caseType, onClose }) {
  const guide = getPreventionGuide(caseType);
  const meta = CASE_TYPE_META[caseType] ?? CASE_TYPE_META['기타'];
  const [scenarioId, setScenarioId] = useState(guide.scenarios[0].id);
  const scenario = guide.scenarios.find((sc) => sc.id === scenarioId) ?? guide.scenarios[0];

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Icon name={meta.icon} size={24} color={C.brand600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{meta.label} 예방 가이드</Text>
            <Text style={styles.subtitle}>내 상황에 맞는 사례를 골라 미리 알아두세요</Text>
          </View>
        </View>

        {guide.scenarios.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabs}
          >
            {guide.scenarios.map((sc) => {
              const active = sc.id === scenario.id;
              return (
                <TouchableOpacity key={sc.id} style={[styles.tab, active && styles.tabActive]} onPress={() => setScenarioId(sc.id)}>
                  <Icon name={sc.icon} size={15} color={active ? '#FFFFFF' : C.ink500} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{sc.label}</Text>
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
  headerIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.sky100, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16.5, fontWeight: '700', color: C.ink900 },
  subtitle: { fontSize: 12, color: C.ink500, marginTop: 2 },

  // 시트 내용이 길면 세로로 줄어들어 탭이 찌그러지지 않도록 탭 줄 높이를 고정한다
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: 8, paddingRight: 8, alignItems: 'center' },
  tab: {
    flexShrink: 0,
    borderWidth: 1, borderColor: C.line, borderRadius: 999, backgroundColor: C.surface,
    paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
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

  disclaimer: { fontSize: 10, color: C.ink400, textAlign: 'center' },

  closeBtn: { backgroundColor: C.brand600, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
