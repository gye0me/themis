import { useCallback, useContext, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { APP_ROUTES, RECORD_ROUTES } from '../navigation/routes';
import { AuthContext } from '../context/AuthContext';
import { logout, getCasesByUser, getEvidenceRecords, updateUserProfile } from '../services/firebaseService';
import { CASE_TYPE_META, buildQuestSteps } from '../services/responseGuideSteps';

const EVIDENCE_TILES = [
  { type: 'image', label: '사진', bg: '#EFF6FF', color: '#1D4ED8' },
  { type: 'audio', label: '음성', bg: '#F5F3FF', color: '#5B21B6' },
  { type: 'video', label: '영상', bg: '#FFF7ED', color: '#C2410C' },
  { type: 'contract', label: '계약서', bg: '#F0FDF4', color: '#15803D' },
];

function formatJoinDate(ts) {
  if (!ts) return null;
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatCaseDate(ts) {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}월 ${date.getDate()}일~`;
}

export function HomeScreen({ navigation }) {
  const { user, profile, refreshProfile } = useContext(AuthContext);

  const [cases, setCases] = useState([]);
  const [evidenceByCase, setEvidenceByCase] = useState({});
  const [loading, setLoading] = useState(true);

  const [deadmanEnabled, setDeadmanEnabled] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setLoading(false);
        return;
      }
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const list = await getCasesByUser(user.uid);
          const sorted = [...list].sort(
            (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
          );
          if (!active) return;
          setCases(sorted);

          const entries = await Promise.all(
            sorted.map(async (c) => {
              try {
                const records = await getEvidenceRecords(user.uid, c.id);
                const byType = {};
                records.forEach((r) => {
                  const key = r.evidenceType ?? 'default';
                  byType[key] = (byType[key] ?? 0) + 1;
                });
                return [c.id, { total: records.length, byType }];
              } catch (err) {
                console.error('사건별 증거 조회 오류:', err);
                return [c.id, { total: 0, byType: {} }];
              }
            })
          );
          if (!active) return;
          setEvidenceByCase(Object.fromEntries(entries));
        } catch (err) {
          console.error('홈 데이터 조회 오류:', err);
        } finally {
          if (active) setLoading(false);
        }
      })();

      // 데드맨 스위치 설정값은 프로필 문서에서 불러온다 (저장 안 돼있으면 기본 OFF)
      const saved = profile?.deadmanSwitch;
      setDeadmanEnabled(Boolean(saved?.enabled));
      setContactName(saved?.contactName ?? '');
      setContactPhone(saved?.contactPhone ?? '');

      return () => {
        active = false;
      };
    }, [user, profile?.deadmanSwitch])
  );

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (err) {
            console.error('로그아웃 오류:', err);
            Alert.alert('오류', '로그아웃에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const totalEvidence = Object.values(evidenceByCase).reduce((sum, v) => sum + (v?.total ?? 0), 0);
  const activeCase = cases[0] ?? null;
  const restCases = cases.slice(1);

  const toggleDeadman = async (next) => {
    setDeadmanEnabled(next);
    if (next && !contactName.trim()) {
      // 켜는 순간 보호자 연락처가 없으면 바로 입력창을 띄운다
      setEditingContact(true);
      return;
    }
    if (!user) return;
    try {
      await updateUserProfile(user.uid, {
        deadmanSwitch: { enabled: next, contactName: contactName.trim(), contactPhone: contactPhone.trim() },
      });
      await refreshProfile?.();
    } catch (err) {
      console.error('데드맨 스위치 저장 오류:', err);
      Alert.alert('오류', '설정을 저장하지 못했습니다.');
    }
  };

  const saveContact = async () => {
    if (!user) return;
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('알림', '보호자 이름과 연락처를 입력해주세요.');
      return;
    }
    setSavingContact(true);
    try {
      await updateUserProfile(user.uid, {
        deadmanSwitch: { enabled: deadmanEnabled, contactName: contactName.trim(), contactPhone: contactPhone.trim() },
      });
      await refreshProfile?.();
      setEditingContact(false);
    } catch (err) {
      console.error('보호자 연락처 저장 오류:', err);
      Alert.alert('오류', '저장하지 못했습니다.');
    } finally {
      setSavingContact(false);
    }
  };

  const displayName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '사용자';
  const joinDate = formatJoinDate(profile?.createdAt ?? profile?.joined_at);

  return (
    <SafeAreaView style={styles.wrapper}>
      {/* 상태바 */}
      <View style={styles.statusbar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusApp}>Themis</Text>
      </View>

      {/* 앱바 */}
      <View style={styles.appbar}>
        <View style={styles.appbarLogo}>
          <Text style={styles.appbarLogoText}>T</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.appbarTitle}>홈</Text>
          <Text style={styles.appbarSub}>{user?.email ?? '어떤 도움이 필요하세요?'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarIcon}>👤</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileSub}>{joinDate ? `가입일 ${joinDate}` : '프로필 동기화 중...'}</Text>
            <Text style={styles.profileDetail}>진행 중인 사건 {cases.length}건 · 수집 증거 {totalEvidence}건</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1E3A5F" />
          </View>
        ) : !activeCase ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>아직 등록된 사건이 없습니다.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.START, params: { openForm: true } })}
            >
              <Text style={styles.emptyBtnText}>+ 첫 사건 기록 시작하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* 진행 중인 사건 배너 */}
            {(() => {
              const meta = CASE_TYPE_META[activeCase.caseType] ?? { icon: '📁' };
              const { progress } = buildQuestSteps(activeCase.caseType, activeCase.questSteps ?? []);
              const evidence = evidenceByCase[activeCase.id] ?? { total: 0 };
              return (
                <TouchableOpacity
                  style={styles.caseBanner}
                  onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.EVIDENCE_TIMELINE, params: { caseId: activeCase.id } })}
                >
                  <Text style={styles.caseBannerText}>현재 진행 중인 사건</Text>
                  <Text style={styles.caseBannerSub}>
                    {meta.icon} {activeCase.title || '이름 없는 사건'} · 퀘스트 {progress.label} · 증거 {evidence.total}건 수집
                  </Text>
                  <Text style={styles.caseBannerArrow}>→</Text>
                </TouchableOpacity>
              );
            })()}

            {/* 섹션 타이틀 */}
            <Text style={styles.sectionTitle}>내 사건 기록</Text>

            {/* 대표 사건 카드 (퀘스트 + 증거 상세) */}
            {(() => {
              const meta = CASE_TYPE_META[activeCase.caseType] ?? { icon: '📁' };
              const { items, progress } = buildQuestSteps(activeCase.caseType, activeCase.questSteps ?? []);
              const evidence = evidenceByCase[activeCase.id] ?? { total: 0, byType: {} };
              const previewItems = items.slice(0, 5);
              const isDone = progress.percent === 100;
              return (
                <TouchableOpacity
                  style={styles.caseCard}
                  onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.EVIDENCE_TIMELINE, params: { caseId: activeCase.id } })}
                >
                  <View style={[styles.caseCardBar, { backgroundColor: isDone ? '#16A34A' : '#DC2626' }]} />
                  <View style={styles.caseCardBody}>
                    <View style={styles.caseCardHeader}>
                      <View style={isDone ? styles.badgeSuccess : styles.badgeDanger}>
                        <Text style={isDone ? styles.badgeSuccessText : styles.badgeDangerText}>{isDone ? '완료' : '진행 중'}</Text>
                      </View>
                      <Text style={styles.caseCardTitle} numberOfLines={1}>{meta.icon} {activeCase.title || '이름 없는 사건'}</Text>
                      <Text style={styles.caseDate}>{formatCaseDate(activeCase.createdAt)}</Text>
                    </View>

                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>퀘스트 진행도</Text>
                      <Text style={styles.progressValue}>{progress.label}</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progress.percent}%`, backgroundColor: isDone ? '#16A34A' : '#3B7DD8' }]} />
                    </View>

                    {previewItems.length > 0 && (
                      <View style={styles.checkGrid}>
                        {previewItems.map((item) => (
                          <Text key={item.id} style={item.completed ? styles.checkDone : styles.checkTodo} numberOfLines={1}>
                            {item.completed ? '✓' : '○'} {item.title}
                          </Text>
                        ))}
                      </View>
                    )}

                    <View style={styles.evidenceRow}>
                      {EVIDENCE_TILES.map((tile) => (
                        <View key={tile.type} style={[styles.evidenceCard, { backgroundColor: tile.bg }]}>
                          <Text style={[styles.evidenceNum, { color: tile.color }]}>{evidence.byType?.[tile.type] ?? 0}</Text>
                          <Text style={[styles.evidenceLabel, { color: tile.color }]}>{tile.label}</Text>
                        </View>
                      ))}
                      <TouchableOpacity
                        style={styles.timelineBtn}
                        onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.EVIDENCE_TIMELINE, params: { caseId: activeCase.id } })}
                      >
                        <Text style={styles.timelineBtnText}>타임라인{'\n'}보기 →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* 나머지 사건 카드들 (간단 표시) */}
            {restCases.map((c) => {
              const meta = CASE_TYPE_META[c.caseType] ?? { icon: '📁' };
              const { progress } = buildQuestSteps(c.caseType, c.questSteps ?? []);
              const evidence = evidenceByCase[c.id] ?? { total: 0 };
              const isDone = progress.percent === 100;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={styles.caseCard}
                  onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.EVIDENCE_TIMELINE, params: { caseId: c.id } })}
                >
                  <View style={[styles.caseCardBar, { backgroundColor: isDone ? '#16A34A' : '#DC2626' }]} />
                  <View style={styles.caseCardBody}>
                    <View style={styles.caseCardHeader}>
                      <View style={isDone ? styles.badgeSuccess : styles.badgeDanger}>
                        <Text style={isDone ? styles.badgeSuccessText : styles.badgeDangerText}>{isDone ? '완료' : '진행 중'}</Text>
                      </View>
                      <Text style={styles.caseCardTitle} numberOfLines={1}>{meta.icon} {c.title || '이름 없는 사건'}</Text>
                      <Text style={styles.caseDate}>{formatCaseDate(c.createdAt)}</Text>
                    </View>
                    <Text style={styles.caseMeta}>증거 {evidence.total}건</Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progress.percent}%`, backgroundColor: isDone ? '#16A34A' : '#3B7DD8' }]} />
                    </View>
                    <View style={styles.progressRow}>
                      <View />
                      <Text style={styles.progressValue}>퀘스트 {progress.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* 새 사건 추가 */}
        <TouchableOpacity
          style={styles.caseCardNew}
          onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.START, params: { openForm: true } })}
        >
          <Text style={styles.caseCardNewPlus}>+</Text>
          <Text style={styles.caseCardNewText}>새 사건 기록 시작하기</Text>
        </TouchableOpacity>

        {/* 데드맨 스위치 */}
        <View style={styles.deadman}>
          <View style={styles.deadmanLeft}>
            <Text style={styles.deadmanTitle}>위급 상황 자동 알림</Text>
            <Text style={styles.deadmanSub}>30분 무응답 시 보호자에게 GPS + 증거 자동 전송</Text>
            {editingContact ? (
              <View style={styles.deadmanEditBox}>
                <TextInput
                  style={styles.deadmanInput}
                  placeholder="보호자 이름"
                  placeholderTextColor="#5C7A9E"
                  value={contactName}
                  onChangeText={setContactName}
                />
                <TextInput
                  style={styles.deadmanInput}
                  placeholder="연락처 (010-0000-0000)"
                  placeholderTextColor="#5C7A9E"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity onPress={() => setEditingContact(false)}>
                    <Text style={styles.deadmanCancel}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveContact} disabled={savingContact}>
                    <Text style={styles.deadmanChange}>{savingContact ? '저장 중...' : '저장'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.deadmanContact}>
                  {contactName ? `보호자: ${contactName} · ${contactPhone}` : '보호자 연락처가 등록되지 않았어요'}
                </Text>
                <TouchableOpacity onPress={() => setEditingContact(true)}>
                  <Text style={styles.deadmanChange}>변경 →</Text>
                </TouchableOpacity>
              </>
            )}
            <Text style={styles.deadmanNote}>* 연락처 저장까지 지원돼요. 무응답 감지·자동 SMS 발송은 개발 중입니다.</Text>
          </View>
          <TouchableOpacity
            style={deadmanEnabled ? styles.toggleOn : styles.toggleOff}
            onPress={() => toggleDeadman(!deadmanEnabled)}
          >
            <View style={styles.toggleCircle} />
            <Text style={styles.toggleText}>{deadmanEnabled ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* 네비바 */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK)}>
          <Text style={styles.navIcon}>✏️</Text>
          <Text style={styles.navLabel}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.EXPERTS_STACK)}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>전문가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.CHATS_STACK)}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>채팅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navLabelActive}>홈</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },
  statusbar: {
    backgroundColor: '#0F1F3D',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusTime: { color: '#6B84A8', fontSize: 12 },
  statusApp: { color: '#6B84A8', fontSize: 12 },
  appbar: {
    backgroundColor: '#1E3A5F',
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appbarLogo: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: '#3B7DD8',
    alignItems: 'center', justifyContent: 'center',
  },
  appbarLogoText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  appbarTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  appbarSub: { color: '#7B9EC5', fontSize: 11 },
  logoutBtn: {
    backgroundColor: '#1E3A5F',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  logoutText: { color: '#94A3B8', fontSize: 11 },
  content: { flex: 1, padding: 16 },
  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: '#94A3B8', fontSize: 13 },
  emptyBtn: { backgroundColor: '#1E3A5F', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  emptyBtnText: { color: '#F1F5F9', fontSize: 12, fontWeight: '600' },
  profileCard: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    padding: 16, flexDirection: 'row',
    alignItems: 'center', gap: 12, marginBottom: 10,
  },
  profileAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#243C5C',
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarIcon: { fontSize: 22 },
  profileInfo: { flex: 1 },
  profileName: { color: '#F1F5F9', fontSize: 14, fontWeight: '600' },
  profileSub: { color: '#7B9EC5', fontSize: 11 },
  profileDetail: { color: '#4A90D9', fontSize: 11 },
  caseBanner: {
    backgroundColor: '#EFF6FF', borderRadius: 8,
    padding: 10, marginBottom: 14,
    borderWidth: 0.5, borderColor: '#BFDBFE',
  },
  caseBannerText: { color: '#1D4ED8', fontSize: 11, fontWeight: '500' },
  caseBannerSub: { color: '#3B82F6', fontSize: 10 },
  caseBannerArrow: { color: '#1D4ED8', fontSize: 12, position: 'absolute', right: 12, top: 10 },
  sectionTitle: {
    fontSize: 10, fontWeight: '500', color: '#94A3B8',
    letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
  },
  caseCard: {
    backgroundColor: '#FFFFFF', borderRadius: 10,
    flexDirection: 'row', marginBottom: 8, overflow: 'hidden',
  },
  caseCardBar: { width: 4 },
  caseCardBody: { flex: 1, padding: 12, gap: 6 },
  caseCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDanger: { backgroundColor: '#FEE2E2', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2 },
  badgeDangerText: { color: '#991B1B', fontSize: 10 },
  badgeSuccess: { backgroundColor: '#DCFCE7', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2 },
  badgeSuccessText: { color: '#166534', fontSize: 10 },
  caseCardTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A', flex: 1 },
  caseDate: { fontSize: 10, color: '#94A3B8' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 10, color: '#64748B' },
  progressValue: { fontSize: 10, color: '#3B7DD8' },
  progressBar: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#3B7DD8' },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  checkDone: { fontSize: 10, color: '#16A34A', width: '48%' },
  checkTodo: { fontSize: 10, color: '#94A3B8', width: '48%' },
  evidenceRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  evidenceCard: {
    flex: 1, borderRadius: 8, padding: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  evidenceNum: { fontSize: 18, fontWeight: '600' },
  evidenceLabel: { fontSize: 9 },
  timelineBtn: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8,
    padding: 6, alignItems: 'center', justifyContent: 'center',
  },
  timelineBtnText: { fontSize: 9, color: '#3B7DD8', textAlign: 'center' },
  caseMeta: { fontSize: 10, color: '#64748B' },
  caseCardNew: {
    backgroundColor: '#F8FAFC', borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
    padding: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginBottom: 10,
  },
  caseCardNewPlus: { fontSize: 20, color: '#CBD5E1' },
  caseCardNewText: { fontSize: 12, color: '#94A3B8' },
  deadman: {
    backgroundColor: '#0F1F3D', borderRadius: 10,
    padding: 14, flexDirection: 'row',
    alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 10,
  },
  deadmanLeft: { flex: 1, paddingRight: 10 },
  deadmanTitle: { color: '#F87171', fontSize: 12, fontWeight: '600' },
  deadmanSub: { color: '#4A6FA5', fontSize: 10 },
  deadmanContact: { color: '#4A6FA5', fontSize: 10, marginTop: 2 },
  deadmanChange: { color: '#3B7DD8', fontSize: 10, marginTop: 4, fontWeight: '600' },
  deadmanCancel: { color: '#8595AC', fontSize: 10, marginTop: 4 },
  deadmanNote: { color: '#4A6FA5', fontSize: 9, marginTop: 8, fontStyle: 'italic' },
  deadmanEditBox: { marginTop: 6, gap: 6 },
  deadmanInput: {
    backgroundColor: '#16233F', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 11, color: '#F1F5F9',
  },
  toggleOn: {
    backgroundColor: '#3B7DD8', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  toggleOff: {
    backgroundColor: '#334155', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  toggleCircle: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF' },
  toggleText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' },
  navbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    paddingBottom: 18,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  navItemActive: {
    backgroundColor: '#0F1F3D', borderRadius: 10,
    paddingVertical: 9,
  },
  navIcon: { fontSize: 22 },
  navIconActive: { fontSize: 22 },
  navLabel: { fontSize: 11, color: '#94A3B8' },
  navLabelActive: { fontSize: 11, color: '#FFFFFF', fontWeight: '500' },
});
