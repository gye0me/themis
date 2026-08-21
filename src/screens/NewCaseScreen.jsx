import { useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { createCase, getCasesByUser } from '../services/firebaseService';
import { CASE_TYPES, CASE_TYPE_META, SUGGESTED_TAGS } from '../services/responseGuideSteps';
import { APP_ROUTES, RECORD_ROUTES } from '../navigation/routes';

const VISIBILITY_OPTIONS = [
  { key: '나만보기', label: '나만 보기' },
  { key: '전문가공유', label: '전문가 공유' },
  { key: '공론화', label: '공론화' },
];
const TITLE_MAX = 30;

function formatCaseDate(createdAt) {
  const date = createdAt?.toDate ? createdAt.toDate() : createdAt ? new Date(createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function NewCaseScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState('나만보기');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [memo, setMemo] = useState('');

  const addTag = (raw) => {
    const t = raw.trim();
    if (!t) return;
    const normalized = t.startsWith('#') ? t : `#${t}`;
    setTags((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setTagInput('');
  };
  const removeTag = (t) => setTags((prev) => prev.filter((x) => x !== t));
  const toggleSuggestedTag = (t) => (tags.includes(t) ? removeTag(t) : addTag(t));

  const loadCases = useCallback(() => {
    if (!user) {
      setLoadingCases(false);
      return;
    }
    setLoadingCases(true);
    getCasesByUser(user.uid)
      .then((list) => {
        const sorted = [...list].sort(
          (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
        );
        setCases(sorted);
      })
      .catch((err) => console.error('사건 목록 조회 오류:', err))
      .finally(() => setLoadingCases(false));
  }, [user]);

  // 화면에 다시 돌아올 때마다(새 사건 생성 후 등) 목록 갱신
  useFocusEffect(
    useCallback(() => {
      loadCases();
    }, [loadCases])
  );

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
    setSubmitting(true);
    try {
      const caseId = await createCase({
        userId: user.uid,
        caseType: selectedType,
        title: title.trim(),
        tags,
        visibility,
        memo: memo.trim(),
      });
      setShowForm(false);
      setSelectedType(null);
      setTitle('');
      setTags([]);
      setTagInput('');
      setVisibility('나만보기');
      setMemo('');
      // 생성 직후 바로 그 사건의 증거 업로드로 진입
      navigation.navigate(RECORD_ROUTES.EVIDENCE_UPLOAD, { caseId, caseType: selectedType });
    } catch (err) {
      console.error('사건 생성 오류:', err);
      Alert.alert('오류', '사건 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.statusbar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusApp}>Themis</Text>
      </View>
      <View style={styles.appbar}>
        <View style={styles.appbarLogo}>
          <Text style={styles.appbarLogoText}>T</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{showForm ? '새 기록 시작하기' : '내 사건'}</Text>
          <Text style={styles.subtitle}>
            {showForm ? '무슨 일이 있었나요?' : (cases.length > 0 ? `${cases.length}건 진행 중` : '기록을 시작해 보세요')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowForm((v) => !v)}
        >
          <Text style={styles.newBtnText}>{showForm ? '취소' : '+ 새 사건'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 새 사건 추가 폼 (토글) */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>사건 유형 선택</Text>
            <Text style={styles.sectionCaption}>해당하는 유형을 선택하면 맞춤 대응 텍스트가 생성됩니다</Text>
            <View style={styles.typeGrid}>
              {CASE_TYPES.map((type) => {
                const meta = CASE_TYPE_META[type];
                const isSelected = selectedType === type;
                const isFullWidth = type === '기타';
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeCard, isFullWidth && styles.typeCardFull, isSelected && styles.typeCardSelected]}
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

            <View style={styles.labelRow}>
              <Text style={styles.sectionLabel}>기록 이름</Text>
              <Text style={styles.charCount}>{title.length}/{TITLE_MAX}</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="예: OO빌라 전세 계약"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX))}
              maxLength={TITLE_MAX}
            />

            <Text style={styles.sectionLabel}>공개 범위</Text>
            <View style={styles.segmentRow}>
              {VISIBILITY_OPTIONS.map((opt) => {
                const active = visibility === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => setVisibility(opt.key)}
                  >
                    <Text style={[styles.segmentBtnText, active && styles.segmentBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>태그 (직접 입력하거나 아래서 선택)</Text>
            <View style={styles.tagRow}>
              {tags.map((t) => (
                <TouchableOpacity key={t} style={styles.tagChip} onPress={() => removeTag(t)}>
                  <Text style={styles.tagChipText}>{t} ×</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={styles.tagInput}
                placeholder="태그 추가..."
                placeholderTextColor="#94A3B8"
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={() => addTag(tagInput)}
                returnKeyType="done"
              />
            </View>
            <Text style={styles.sectionLabel}>추천 태그</Text>
            <View style={styles.tagRow}>
              {SUGGESTED_TAGS.map((t) => {
                const active = tags.includes(t);
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.suggestedTag, active && styles.suggestedTagActive]}
                    onPress={() => toggleSuggestedTag(t)}
                  >
                    <Text style={[styles.suggestedTagText, active && styles.suggestedTagTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>간단 메모 (선택)</Text>
            <TextInput
              style={styles.memoInput}
              placeholder="어떤 상황인지 간략히 적어주세요"
              placeholderTextColor="#94A3B8"
              value={memo}
              onChangeText={setMemo}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.startBtn, (!selectedType || !title.trim()) && styles.startBtnDisabled]}
              onPress={handleStart}
              disabled={!selectedType || !title.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#F1F5F9" />
              ) : (
                <Text style={styles.startBtnText}>기록 시작하기</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.disclaimer}>본 앱은 법률 정보 제공이며 법률 조언이 아닙니다.</Text>
          </View>
        )}

        {/* 사건 카드 목록 */}
        {loadingCases ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1E3A5F" />
          </View>
        ) : cases.length === 0 && !showForm ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>아직 등록된 사건이 없습니다.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.emptyBtnText}>+ 첫 사건 만들기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cases.map((c) => {
            const meta = CASE_TYPE_META[c.caseType] ?? { icon: '📁', label: c.caseType ?? '기타' };
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.caseCard}
                onPress={() => navigation.navigate(RECORD_ROUTES.EVIDENCE_TIMELINE, { caseId: c.id })}
                activeOpacity={0.8}
              >
                <Text style={styles.caseIcon}>{meta.icon}</Text>
                <View style={styles.caseBody}>
                  <Text style={styles.caseTitle}>{c.title || '이름 없는 사건'}</Text>
                  <Text style={styles.caseMeta}>
                    {meta.label}{formatCaseDate(c.createdAt) ? ` · ${formatCaseDate(c.createdAt)}` : ''}
                  </Text>
                </View>
                <Text style={styles.caseArrow}>›</Text>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 하단 네비바 */}
      <View style={styles.navbar}>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIconActive}>✏️</Text>
          <Text style={styles.navLabelActive}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.EXPERTS_STACK)}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>전문가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.CHATS_STACK)}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>채팅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.HOME_STACK)}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>홈</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },
  statusbar: {
    backgroundColor: '#0F1F3D', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  statusTime: { color: '#6B84A8', fontSize: 12 },
  statusApp: { color: '#6B84A8', fontSize: 12 },
  appbar: {
    backgroundColor: '#1E3A5F', paddingHorizontal: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  appbarLogo: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#3B7DD8',
    alignItems: 'center', justifyContent: 'center',
  },
  appbarLogoText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  title: { color: '#F1F5F9', fontSize: 17, fontWeight: '600' },
  subtitle: { color: '#7B9EC5', fontSize: 11, marginTop: 2 },
  newBtn: { backgroundColor: '#3B7DD8', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  sectionLabel: { color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 8 },
  sectionCaption: { color: '#94A3B8', fontSize: 10.5, marginTop: -6, marginBottom: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { color: '#94A3B8', fontSize: 10.5, fontVariant: ['tabular-nums'] },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  typeCard: {
    width: '48%', backgroundColor: '#F8FAFC', borderRadius: 12,
    padding: 14, borderWidth: 1.5, borderColor: '#E2E8F0', gap: 4,
  },
  typeCardFull: { width: '100%' },
  typeCardSelected: { borderColor: '#1E3A5F', backgroundColor: '#EFF6FF' },
  typeIcon: { fontSize: 22 },
  typeLabel: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  typeLabelSelected: { color: '#1E3A5F' },
  typeDesc: { color: '#64748B', fontSize: 10 },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    padding: 12, fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  segmentRow: {
    flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 16, gap: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#1E3A5F' },
  segmentBtnText: { color: '#64748B', fontSize: 11.5, fontWeight: '600' },
  segmentBtnTextActive: { color: '#FFFFFF' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' },
  tagChip: { backgroundColor: '#EFF6FF', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  tagChipText: { color: '#1D4ED8', fontSize: 11.5, fontWeight: '600' },
  tagInput: {
    flexGrow: 1, minWidth: 100, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, color: '#0F172A', backgroundColor: '#F8FAFC',
  },
  suggestedTag: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  suggestedTagActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  suggestedTagText: { color: '#64748B', fontSize: 11.5 },
  suggestedTagTextActive: { color: '#FFFFFF', fontWeight: '600' },
  memoInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12,
    fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC', minHeight: 90, marginBottom: 16,
  },
  startBtn: { backgroundColor: '#1E3A5F', borderRadius: 10, padding: 15, alignItems: 'center' },
  startBtnDisabled: { backgroundColor: '#CBD5E1' },
  startBtnText: { color: '#F1F5F9', fontSize: 14, fontWeight: '600' },
  disclaimer: { color: '#94A3B8', fontSize: 10, textAlign: 'center', marginTop: 10 },
  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#94A3B8', fontSize: 13 },
  emptyBtn: { backgroundColor: '#1E3A5F', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  emptyBtnText: { color: '#F1F5F9', fontSize: 12, fontWeight: '600' },
  caseCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  caseIcon: { fontSize: 26 },
  caseBody: { flex: 1 },
  caseTitle: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  caseMeta: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  caseArrow: { color: '#CBD5E1', fontSize: 20 },
  navbar: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5, borderTopColor: '#E2E8F0',
    paddingVertical: 14, paddingHorizontal: 8, paddingBottom: 18,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  navItemActive: { backgroundColor: '#0F1F3D', borderRadius: 10, paddingVertical: 9 },
  navIcon: { fontSize: 22 },
  navIconActive: { fontSize: 22 },
  navLabel: { fontSize: 11, color: '#94A3B8' },
  navLabelActive: { fontSize: 11, color: '#FFFFFF', fontWeight: '500' },
});
