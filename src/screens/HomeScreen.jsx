import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
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

// 데드맨 스위치: 앱이 켜져있는(포그라운드) 동안만 정확히 동작한다.
// Expo Go 환경에서는 진짜 백그라운드 타이머(TaskManager 등)를 쓸 수 없어
// 앱이 완전히 백그라운드/종료된 동안의 시간은 다음에 앱을 열었을 때(포커스 시점)
// 한 번에 몰아서 확인하는 방식으로 최대한 보완한다 — 완벽한 대체는 아니다.
const DEADMAN_TIMEOUT_MS = 30 * 60 * 1000;

function formatCountdown(ms) {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const triggeringRef = useRef(false);

  const displayName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '사용자';
  const joinDate = formatJoinDate(profile?.createdAt ?? profile?.joined_at);

  const toggleDeadman = async (next) => {
    setDeadmanEnabled(next);
    if (next && !contactName.trim()) {
      // 켜는 순간 보호자 연락처가 없으면 바로 입력창을 띄운다
      setEditingContact(true);
      return;
    }
    if (!user) return;
    const checkInAt = next ? Date.now() : lastCheckIn;
    if (next) setLastCheckIn(checkInAt);
    try {
      await updateUserProfile(user.uid, {
        deadmanSwitch: {
          enabled: next,
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          lastCheckIn: checkInAt,
        },
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
    const checkInAt = Date.now();
    try {
      await updateUserProfile(user.uid, {
        deadmanSwitch: {
          enabled: deadmanEnabled,
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          lastCheckIn: checkInAt,
        },
      });
      setLastCheckIn(checkInAt);
      await refreshProfile?.();
      setEditingContact(false);
    } catch (err) {
      console.error('보호자 연락처 저장 오류:', err);
      Alert.alert('오류', '저장하지 못했습니다.');
    } finally {
      setSavingContact(false);
    }
  };

  // "저 괜찮아요" 체크인 — 카운트다운을 30분으로 다시 채운다.
  const checkIn = async () => {
    const checkInAt = Date.now();
    setLastCheckIn(checkInAt);
    if (!user) return;
    try {
      await updateUserProfile(user.uid, {
        deadmanSwitch: { enabled: deadmanEnabled, contactName: contactName.trim(), contactPhone: contactPhone.trim(), lastCheckIn: checkInAt },
      });
    } catch (err) {
      console.error('체크인 저장 오류:', err);
    }
  };

  // 30분 무응답 시간 초과 — GPS 위치를 담아 보호자에게 보낼 문자를 미리 채워서 연다.
  // (OS 정책상 앱이 사용자 동의 없이 문자를 "완전 자동"으로 보낼 수는 없어, 마지막 전송 버튼만 사용자가 누르면 된다.)
  const triggerDeadmanAlert = async () => {
    if (triggeringRef.current) return;
    triggeringRef.current = true;
    try {
      // 재발동 방지를 위해 즉시 끄고 저장 (사용자가 다시 켜면 재무장)
      setDeadmanEnabled(false);
      if (user) {
        await updateUserProfile(user.uid, {
          deadmanSwitch: { enabled: false, contactName: contactName.trim(), contactPhone: contactPhone.trim(), lastCheckIn },
        }).catch((err) => console.error('데드맨 스위치 비활성화 저장 오류:', err));
      }

      let locationLine = '위치 정보 없음';
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          locationLine = `https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`;
        }
      } catch (err) {
        console.warn('위치 조회 실패:', err.message);
      }

      const message = `[Themis 위급 알림] ${displayName}님이 30분간 앱에 응답이 없습니다.\n마지막 위치: ${locationLine}\n확인 부탁드립니다.`;

      const available = await SMS.isAvailableAsync();
      if (!available || !contactPhone) {
        Alert.alert(
          '무응답 감지됨',
          `30분간 체크인이 없었어요.\n\n${message}\n\n(이 기기에서 문자 전송을 사용할 수 없어 자동으로 열지 못했습니다.)`
        );
        return;
      }
      await SMS.sendSMSAsync([contactPhone], message);
      Alert.alert('알림 발송 준비 완료', '문자 앱에서 전송 버튼을 눌러 마무리해주세요. 데드맨 스위치는 안전을 위해 꺼졌습니다 — 필요하면 다시 켜주세요.');
    } finally {
      triggeringRef.current = false;
    }
  };

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
      const savedCheckIn = saved?.lastCheckIn?.toMillis ? saved.lastCheckIn.toMillis() : (saved?.lastCheckIn ?? null);
      setLastCheckIn(savedCheckIn);
      setNowTick(Date.now());

      return () => {
        active = false;
      };
    }, [user, profile?.deadmanSwitch])
  );

  // 앱이 완전히 꺼졌다/백그라운드였다가 다시 켜졌을 때 — 그동안 흐른 시간을 한 번에 확인한다.
  // (앱이 실제로 꺼져있는 동안엔 이 감지 자체가 동작하지 않는다 — 다시 열었을 때만 뒤늦게 확인 가능)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNowTick(Date.now());
    });
    return () => sub.remove();
  }, []);

  // 1초마다 카운트다운 갱신 + 시간 초과 시 알림 발동 (앱이 포그라운드일 때만 동작)
  useEffect(() => {
    if (!deadmanEnabled || !lastCheckIn) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadmanEnabled, lastCheckIn]);

  useEffect(() => {
    if (!deadmanEnabled || !lastCheckIn) return;
    if (nowTick - lastCheckIn >= DEADMAN_TIMEOUT_MS) {
      triggerDeadmanAlert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, deadmanEnabled, lastCheckIn]);

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
            <Text style={styles.deadmanSub}>30분간 "체크인"이 없으면 보호자에게 위치와 함께 문자 전송을 준비해요</Text>
            {deadmanEnabled && !editingContact && (
              <View style={styles.deadmanCountdownRow}>
                <Text style={styles.deadmanCountdown}>
                  {formatCountdown(DEADMAN_TIMEOUT_MS - (nowTick - (lastCheckIn ?? nowTick)))}
                </Text>
                <TouchableOpacity style={styles.checkInBtn} onPress={checkIn}>
                  <Text style={styles.checkInBtnText}>저 괜찮아요 ✓</Text>
                </TouchableOpacity>
              </View>
            )}
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
            <Text style={styles.deadmanNote}>
              * 앱이 켜져있는 동안 실제로 카운트다운돼요. 시간 초과 시 문자 앱이 위치와 함께 미리 채워져 열리고,
              마지막 전송은 직접 눌러야 해요(운영체제 정책). 앱을 완전히 꺼두면 그동안은 감지가 안 되고,
              다시 열었을 때 몰아서 확인해요 — 완전한 백그라운드 감지는 아직 지원하지 않습니다.
            </Text>
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
  deadmanCountdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 4 },
  deadmanCountdown: {
    color: '#F1F5F9', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'],
  },
  checkInBtn: {
    backgroundColor: '#16A34A', borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  checkInBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
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
