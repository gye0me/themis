import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import {
  toggleClauseCompleted,
  addUserClause,
  removeUserClause,
  getChecklistProgress,
} from '../services/requiredClauseChecklist';

export default function ResponseGuideScreen({ navigation, route }) {
  const record = route?.params?.record ?? null;
  const initialItems = record?.requiredClauseChecklist ?? []; // extra. 제거
  const contractType = record?.contractType ?? '전월세'; // extra. 제거

  const [items, setItems] = useState(initialItems);
  const [newTitle, setNewTitle] = useState('');
  const [showInput, setShowInput] = useState(false);

  const progress = getChecklistProgress(items);

  const handleToggle = (id) => {
    setItems((prev) => toggleClauseCompleted(prev, id));
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
          <Text style={styles.subtitle}>단계별 법적 대응 안내</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

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
            onPress={() => handleToggle(item.id)}
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
            </View>
          </TouchableOpacity>
        ))}

        {/* 항목 추가 */}
        {showInput ? (
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
        )}

        {/* 전문가 연결 */}
        <TouchableOpacity style={styles.expertBtn}>
          <Text style={styles.expertBtnText}>전문가 채널 연결하기 ›</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
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
});