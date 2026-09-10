import { useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { AuthContext } from '../context/AuthContext';
import { createCase, getCasesByUser } from '../services/firebaseService';
import { CASE_TYPES, CASE_TYPE_META, SUGGESTED_TAGS } from '../services/responseGuideSteps';
import { APP_ROUTES, RECORD_ROUTES, CHAT_ROUTES } from '../navigation/routes';
import { getMatchingRoomForCaseType, joinRoom } from '../services/chatService';
import { ScreenTopBar } from '../components/ScreenTopBar';
import { BottomNavBar } from '../components/BottomNavBar';
import { C } from '../theme/tokens';

const VISIBILITY_OPTIONS = [
  { key: '나만보기', label: '나만 보기' },
  { key: '전문가공유', label: '전문가 공유' },
  { key: '공론화', label: '공론화' },
];
const TITLE_MAX = 30;

// 빠른 기록 타일 (사진/음성/영상/계약서) — design/themis-interactive.html의 quick-grid와 동일
const QUICK_TILES = [
  {
    key: 'image', label: '사진', bg: '#EFF6FF', color: '#1D4ED8',
    icon: (color) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
        <Path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
        <Circle cx={12} cy={13} r={3.5} />
      </Svg>
    ),
  },
  {
    key: 'audio', label: '음성', bg: '#F5F3FF', color: '#5B21B6',
    icon: (color) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
        <Rect x={9} y={2} width={6} height={12} rx={3} />
        <Path d="M5 11a7 7 0 0 0 14 0" />
        <Path d="M12 18v4" />
        <Path d="M9 22h6" />
      </Svg>
    ),
  },
  {
    key: 'video', label: '영상', bg: '#FFF7ED', color: '#C2410C',
    icon: (color) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
        <Rect x={2.5} y={6} width={14} height={12} rx={2} />
        <Path d="M21.5 9.5 16.5 12l5 2.5v-5Z" />
      </Svg>
    ),
  },
  {
    key: 'contract', label: '계약서', bg: '#F0FDF4', color: '#15803D',
    icon: (color) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
        <Path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <Path d="M14 3v5h5" />
        <Path d="M9 13h6M9 17h6" />
      </Svg>
    ),
  },
];

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink900} strokeWidth={2}>
      <Path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

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

  const openForm = () => setShowForm(true);

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

      const goToEvidenceUpload = () =>
        navigation.navigate(RECORD_ROUTES.EVIDENCE_UPLOAD, { caseId, caseType: selectedType });

      // 같은 피해 유형을 다루는 피해자 연대방이 있으면 알림으로 안내하고,
      // 선택하면 바로 그 방으로 연결한다.
      const matchedRoom = getMatchingRoomForCaseType(selectedType);
      if (matchedRoom) {
        Alert.alert(
          '같은 피해 유형의 방이 있어요',
          `"${matchedRoom.name}" 방에서 비슷한 피해를 겪은 분들과 정보를 나눌 수 있어요. 지금 참여하시겠어요?`,
          [
            { text: '나중에', style: 'cancel', onPress: goToEvidenceUpload },
            {
              text: '참여하기',
              onPress: async () => {
                try {
                  await joinRoom(matchedRoom.id, user.uid, user.displayName || user.email?.split('@')[0] || '익명');
                  navigation.navigate(APP_ROUTES.CHATS_STACK, {
                    screen: CHAT_ROUTES.ROOM,
                    params: { roomId: matchedRoom.id, roomName: matchedRoom.name },
                  });
                } catch (err) {
                  console.error('연대방 참여 오류:', err);
                  goToEvidenceUpload();
                }
              },
            },
          ],
        );
      } else {
        // 생성 직후 바로 그 사건의 증거 업로드로 진입
        goToEvidenceUpload();
      }
    } catch (err) {
      console.error('사건 생성 오류:', err);
      Alert.alert('오류', '사건 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- 새 사건 시작 폼 화면 ----
  if (showForm) {
    return (
      <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
        <View style={styles.backHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setShowForm(false)}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.backHeaderTitle}>새 사건 시작</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldLabel}>사건 유형</Text>
          <View style={styles.typeGrid}>
            {CASE_TYPES.map((type) => {
              const meta = CASE_TYPE_META[type];
              const isSelected = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeCard, isSelected && styles.typeCardActive]}
                  onPress={() => setSelectedType(type)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.typeIcon}>{meta.icon}</Text>
                  <Text style={[styles.typeLabel, isSelected && styles.typeLabelActive]}>{meta.label}</Text>
                  <Text style={styles.typeDesc}>{meta.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>기록 이름</Text>
            <Text style={styles.charCount}>{title.length}/{TITLE_MAX}</Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="예: OO빌라 전세 계약"
            placeholderTextColor={C.ink400}
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX))}
            maxLength={TITLE_MAX}
          />

          <Text style={styles.fieldLabel}>공개 범위</Text>
          <View style={styles.chipRow}>
            {VISIBILITY_OPTIONS.map((opt) => {
              const active = visibility === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setVisibility(opt.key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>태그</Text>
          <View style={styles.chipRow}>
            {tags.map((t) => (
              <TouchableOpacity key={t} style={[styles.chip, styles.chipActive]} onPress={() => removeTag(t)}>
                <Text style={styles.chipTextActive}>{t} ×</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.chipRow}>
            {SUGGESTED_TAGS.map((t) => {
              const active = tags.includes(t);
              if (active) return null;
              return (
                <TouchableOpacity key={t} style={styles.chip} onPress={() => toggleSuggestedTag(t)}>
                  <Text style={styles.chipText}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={styles.tagInput}
            placeholder="태그 직접 입력 후 완료..."
            placeholderTextColor={C.ink400}
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={() => addTag(tagInput)}
            returnKeyType="done"
          />

          <Text style={styles.fieldLabel}>간단 메모 (선택)</Text>
          <TextInput
            style={styles.memoInput}
            placeholder="어떤 상황인지 간략히 적어주세요"
            placeholderTextColor={C.ink400}
            value={memo}
            onChangeText={setMemo}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.disclaimer}>본 앱은 법률 정보 제공이며 법률 조언이 아닙니다.</Text>
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={[styles.cta, (!selectedType || !title.trim()) && styles.ctaDisabled]}
            onPress={handleStart}
            disabled={!selectedType || !title.trim() || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>시작하기</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---- 기록 탭 홈 (빠른 기록 + 내 사건 목록) ----
  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <ScreenTopBar title="기록" subtitle="사건을 기록하고 관리하세요" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>빠른 기록</Text>
        <View style={styles.quickGrid}>
          {QUICK_TILES.map((tile) => (
            <TouchableOpacity key={tile.key} style={styles.quickTile} onPress={openForm} activeOpacity={0.8}>
              <View style={[styles.quickIcon, { backgroundColor: tile.bg }]}>{tile.icon(tile.color)}</View>
              <Text style={styles.quickLabel}>{tile.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.quickHint}>눌러서 바로 새 사건 등록으로 이동해요</Text>

        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>내 사건</Text>
        {loadingCases ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.brand600} />
          </View>
        ) : cases.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>아직 등록된 사건이 없습니다.</Text>
          </View>
        ) : (
          cases.map((c) => {
            const meta = CASE_TYPE_META[c.caseType] ?? { icon: '📁', label: c.caseType ?? '기타' };
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.caseRow}
                onPress={() => navigation.navigate(RECORD_ROUTES.EVIDENCE_TIMELINE, { caseId: c.id })}
                activeOpacity={0.8}
              >
                <View style={styles.caseRowIcon}>
                  <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                </View>
                <View style={styles.caseRowBody}>
                  <Text style={styles.caseRowTitle} numberOfLines={1}>{c.title || '이름 없는 사건'}</Text>
                  <Text style={styles.caseRowMeta}>
                    {meta.label}{formatCaseDate(c.createdAt) ? ` · ${formatCaseDate(c.createdAt)}` : ''}
                  </Text>
                </View>
                <Text style={styles.caseRowArrow}>›</Text>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity style={styles.dashedRow} onPress={openForm}>
          <Text style={styles.dashedRowText}>+ 새 사건 기록 시작하기</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNavBar active="records" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },

  sectionLabel: { fontSize: 12.5, fontWeight: '700', color: C.ink500, marginBottom: 12 },

  // 빠른 기록
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickTile: {
    width: '23%', alignItems: 'center', gap: 8, backgroundColor: C.sky050,
    borderRadius: 16, paddingVertical: 16,
  },
  quickIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11.5, fontWeight: '600', color: C.ink700 },
  quickHint: { fontSize: 10.5, color: C.ink400, marginTop: 10 },

  // 내 사건 카드 행
  caseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.sky050, borderRadius: 16, padding: 14, marginBottom: 10,
  },
  caseRowIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  caseRowBody: { flex: 1 },
  caseRowTitle: { fontSize: 14, fontWeight: '700', color: C.ink900 },
  caseRowMeta: { fontSize: 11, color: C.ink400, marginTop: 2 },
  caseRowArrow: { fontSize: 20, color: C.ink400 },

  loadingBox: { alignItems: 'center', paddingVertical: 36 },
  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyText: { color: C.ink400, fontSize: 13 },

  dashedRow: {
    borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  dashedRowText: { color: C.brand600, fontSize: 13, fontWeight: '700' },

  // 뒤로가기 헤더 (새 사건 시작 폼)
  backHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backHeaderTitle: { fontSize: 17, fontWeight: '700', color: C.ink900 },

  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: C.ink700, marginBottom: 10, marginTop: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20 },
  charCount: { fontSize: 10.5, color: C.ink400 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '48%', backgroundColor: C.sky050, borderRadius: 16,
    padding: 14, borderWidth: 1.5, borderColor: 'transparent', gap: 4,
  },
  typeCardActive: { borderColor: C.brand500, backgroundColor: C.sky100 },
  typeIcon: { fontSize: 20 },
  typeLabel: { color: C.ink900, fontSize: 13, fontWeight: '700' },
  typeLabelActive: { color: C.brand700 },
  typeDesc: { color: C.ink400, fontSize: 10 },

  textInput: {
    borderWidth: 1, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 13.5, color: C.ink900, backgroundColor: C.surface,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: C.line, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.surface,
  },
  chipActive: { backgroundColor: C.brand600, borderColor: C.brand600 },
  chipText: { fontSize: 12, color: C.ink500, fontWeight: '600' },
  chipTextActive: { fontSize: 12, color: '#fff', fontWeight: '700' },

  tagInput: {
    borderWidth: 1, borderColor: C.line, borderRadius: 12, marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 12.5, color: C.ink900, backgroundColor: C.surface,
  },

  memoInput: {
    borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14,
    fontSize: 13, color: C.ink900, backgroundColor: C.surface, minHeight: 90,
  },
  disclaimer: { color: C.ink400, fontSize: 10, textAlign: 'center', marginTop: 16 },

  ctaBar: { padding: 16, paddingBottom: 22, borderTopWidth: 1, borderTopColor: C.line },
  cta: { backgroundColor: C.brand600, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  ctaDisabled: { backgroundColor: C.line },
  ctaText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
