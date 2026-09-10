import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, AppState, Image, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Ellipse, Circle, Path } from 'react-native-svg';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import * as Notifications from 'expo-notifications';
import { APP_ROUTES, RECORD_ROUTES, CHAT_ROUTES } from '../navigation/routes';
import { AuthContext } from '../context/AuthContext';
import { logout, getCasesByUser, getEvidenceRecords, updateUserProfile } from '../services/firebaseService';
import { CASE_TYPE_META, buildQuestSteps } from '../services/responseGuideSteps';
import {
  syncDeadmanLocalState,
  readDeadmanTriggeredFlag,
  registerDeadmanBackgroundTask,
  unregisterDeadmanBackgroundTask,
  ensureDeadmanBackgroundTaskRegistered,
} from '../services/deadmanBackgroundTask';

// 앱이 백그라운드에 있어도 알림이 뜨도록 설정 (데드맨 스위치 초과 알림용)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const THEMIS_LOGO = require('../assets/themis-logo-brand.png');

// ---- 리디자인 디자인 토큰 (design/themis-interactive.html 목업과 동일한 값) ----
const C = {
  ink950: '#0A1628',
  brand700: '#1E3A72',
  brand600: '#2A50B8',
  brand500: '#3D6FE0',
  brand400: '#6B93EE',
  sky100: '#E9F1FD',
  sky050: '#F4F9FE',
  surface: '#FFFFFF',
  ink900: '#101828',
  ink700: '#33405C',
  ink500: '#5B6B8C',
  ink400: '#8894AC',
  line: '#E7ECF5',
  danger600: '#DC2626',
  danger100: '#FDE9E9',
  safe600: '#16A672',
  safe100: '#E4F7EF',
};

const EVIDENCE_TILES = [
  { type: 'image', label: '사진', bg: '#EFF6FF', color: '#1D4ED8' },
  { type: 'audio', label: '음성', bg: '#F5F3FF', color: '#5B21B6' },
  { type: 'video', label: '영상', bg: '#FFF7ED', color: '#C2410C' },
  { type: 'contract', label: '계약서', bg: '#F0FDF4', color: '#15803D' },
];

// 데드맨 스위치: 포그라운드에서는 1초 단위로 정확히 카운트다운한다.
// 앱이 백그라운드에 있는 동안은 deadmanBackgroundTask.js에 등록된 백그라운드 작업(EAS 개발
// 빌드에서만 동작, Expo Go에서는 무시됨)이 최소 15분 간격으로 깨어나 초과 여부를 확인하고,
// 초과 시 알림을 띄운다 — OS가 타이밍을 보장하지 않아 "정확히 30분"은 아니고,
// 앱이 완전히 종료된 동안엔 그마저도 안 돌 수 있다는 한계는 여전히 남아있다.
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

// ---- 히어로 일러스트 (design/themis-interactive.html의 방패 SVG 그대로) ----
function ShieldIllustration() {
  return (
    <View style={styles.illustrationWrap}>
      <View style={[styles.cloud, styles.cloudA]} />
      <View style={[styles.cloud, styles.cloudB]} />
      <View style={[styles.cloud, styles.cloudC]} />
      <Svg width={122} height={134} viewBox="0 0 128 140" fill="none">
        <Defs>
          <SvgGradient id="shieldFill" x1="20" y1="10" x2="108" y2="130" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#6B93EE" />
            <Stop offset="1" stopColor="#1E3A72" />
          </SvgGradient>
          <SvgGradient id="shieldGloss" x1="30" y1="16" x2="90" y2="70" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <Ellipse cx="64" cy="120" rx="34" ry="7" fill="#1E3A72" opacity={0.12} />
        <Circle cx="64" cy="68" r="58" fill="#6B93EE" opacity={0.12} />
        <Circle cx="112" cy="30" r="4" fill="#6B93EE" opacity={0.55} />
        <Circle cx="16" cy="96" r="3" fill="#6B93EE" opacity={0.45} />
        <Path d="M64 10 L104 26 L104 66 C104 96 88 116 64 130 C40 116 24 96 24 66 L24 26 Z" fill="url(#shieldFill)" />
        <Path d="M64 10 L104 26 L104 66 C104 96 88 116 64 130 C40 116 24 96 24 66 L24 26 Z" fill="url(#shieldGloss)" />
        <Path d="M46 64 L58 76 L86 46" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function SearchIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={11} cy={11} r={7} />
      <Path d="m21 21-4.3-4.3" />
    </Svg>
  );
}
function BellIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <Path d="M10 20a2 2 0 0 0 4 0" />
    </Svg>
  );
}
function AccountIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Svg>
  );
}
function SafetyShieldIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M12 3 20 6.5v5c0 5-3.4 8.7-8 9.5-4.6-.8-8-4.5-8-9.5v-5Z" />
    </Svg>
  );
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

  const [savingExpertBadge, setSavingExpertBadge] = useState(false);
  const isExpertVerified = !!profile?.isExpert;

  const displayName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '사용자';
  const joinDate = formatJoinDate(profile?.createdAt ?? profile?.joined_at);

  const toggleExpertBadge = async (next) => {
    if (!user) return;
    setSavingExpertBadge(true);
    try {
      await updateUserProfile(user.uid, { isExpert: next });
      await refreshProfile?.();
    } catch (err) {
      console.error('전문가 인증 저장 오류:', err);
      Alert.alert('오류', '설정을 저장하지 못했습니다.');
    } finally {
      setSavingExpertBadge(false);
    }
  };

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
      await syncDeadmanLocalState({ enabled: next, lastCheckIn: checkInAt, contactName, contactPhone });
      if (next) {
        await Notifications.requestPermissionsAsync().catch(() => {});
        const ok = await registerDeadmanBackgroundTask();
        if (!ok) {
          Alert.alert(
            '알림',
            'Expo Go에서는 백그라운드 감지가 동작하지 않아요. 앱이 켜져있는 동안만 카운트다운돼요.\n(EAS 개발 빌드로 실행하면 백그라운드에서도 감지됩니다.)'
          );
        }
      } else {
        await unregisterDeadmanBackgroundTask();
      }
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
      await syncDeadmanLocalState({ enabled: deadmanEnabled, lastCheckIn: checkInAt, contactName, contactPhone });
      if (deadmanEnabled) {
        await Notifications.requestPermissionsAsync().catch(() => {});
        await registerDeadmanBackgroundTask();
      }
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
    await syncDeadmanLocalState({ enabled: deadmanEnabled, lastCheckIn: checkInAt, contactName, contactPhone });
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
      await unregisterDeadmanBackgroundTask();
      await syncDeadmanLocalState({ enabled: false, lastCheckIn, contactName, contactPhone });
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

      // 켜짐 상태로 불러왔다면, 앱을 완전히 껐다 켠 경우에도 백그라운드 감지가
      // 확실히 살아있도록 로컬 상태를 다시 맞추고 등록 여부를 점검해서 복구한다.
      if (saved?.enabled) {
        const contactNameSaved = saved?.contactName ?? '';
        const contactPhoneSaved = saved?.contactPhone ?? '';
        syncDeadmanLocalState({
          enabled: true,
          lastCheckIn: savedCheckIn,
          contactName: contactNameSaved,
          contactPhone: contactPhoneSaved,
        }).catch((err) => console.error('데드맨 로컬 상태 동기화 오류:', err));
        ensureDeadmanBackgroundTaskRegistered();
      }

      return () => {
        active = false;
      };
    }, [user, profile?.deadmanSwitch])
  );

  // 앱이 백그라운드/완전종료 상태였다가 다시 켜졌을 때 — 그 사이 백그라운드 작업이
  // 이미 초과를 감지해뒀다면(triggered 플래그) 바로 알림 흐름을 이어서 진행한다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      setNowTick(Date.now());
      const alreadyTriggered = await readDeadmanTriggeredFlag().catch(() => false);
      if (alreadyTriggered) triggerDeadmanAlert();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 알림을 탭해서 앱을 열었을 때도 같은 흐름으로 이어준다 (콜드 스타트 포함).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.type === 'deadman-alert') {
        triggerDeadmanAlert();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <SafeAreaView style={styles.wrapper} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ===== 히어로 ===== */}
        <LinearGradient colors={[C.sky050, C.sky100, C.surface]} locations={[0, 0.62, 1]} style={styles.hero}>
          <View style={styles.topBar}>
            <Image source={THEMIS_LOGO} style={styles.headerBadge} resizeMode="contain" />
            <Text style={styles.topBarTitle}>홈</Text>
            <View style={styles.topBarIcons}>
              <TouchableOpacity hitSlop={8} onPress={() => Alert.alert('준비 중', '검색 기능은 준비 중입니다.')}>
                <SearchIcon color={C.ink700} />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8} onPress={() => Alert.alert('준비 중', '알림함 기능은 준비 중입니다.')}>
                <BellIcon color={C.ink700} />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8} onPress={handleLogout}>
                <AccountIcon color={C.ink700} />
              </TouchableOpacity>
            </View>
          </View>

          <ShieldIllustration />

          <View style={{ gap: 14 }}>
            <Text style={styles.heroHeadline}>
              {displayName}님, Themis가 오늘도{'\n'}
              <Text style={styles.heroHeadlineBold}>기록하고 지키고 증명</Text>하며 곁에 있어요
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.START, params: { openForm: true } })}
            >
              <LinearGradient colors={[C.brand600, C.brand400]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={styles.cta}>
                <Text style={styles.ctaText}>+ 새 사건 기록 시작하기</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ===== 본문 ===== */}
        <View style={styles.body}>

          {/* 프로필 */}
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName.slice(0, 1)}</Text>
            </View>
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName}>{displayName}님</Text>
              <Text style={styles.profileMeta}>
                {joinDate ? `가입일 ${joinDate}` : '프로필 동기화 중...'} · 진행 중인 사건 {cases.length}건 · 수집 증거 {totalEvidence}건
              </Text>
            </View>
          </View>

          {/* 오늘의 안전 체크 (데드맨 스위치) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>오늘의 안전 체크</Text>
            <LinearGradient colors={['#FBFDFF', C.sky050]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={styles.safetyCard}>
              <View style={styles.safetyTop}>
                <View style={[styles.safetyIcon, !deadmanEnabled && styles.safetyIconOff]}>
                  <SafetyShieldIcon color={deadmanEnabled ? C.safe600 : C.ink400} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.safetyTitleRow}>
                    <Text style={styles.safetyTitle}>위급 상황 자동 알림</Text>
                    <View style={[styles.statusPill, !deadmanEnabled && styles.statusPillOff]}>
                      <Text style={[styles.statusPillText, !deadmanEnabled && styles.statusPillTextOff]}>
                        {deadmanEnabled ? '감지 중' : '꺼짐'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.safetyDesc}>30분간 "체크인"이 없으면 보호자에게 위치와 함께 문자 전송을 준비해요.</Text>
                </View>
                <Switch
                  value={deadmanEnabled}
                  onValueChange={(next) => toggleDeadman(next)}
                  trackColor={{ false: C.line, true: C.brand400 }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={C.line}
                />
              </View>

              {editingContact ? (
                <View style={styles.editBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="보호자 이름"
                    placeholderTextColor={C.ink400}
                    value={contactName}
                    onChangeText={setContactName}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="연락처 (010-0000-0000)"
                    placeholderTextColor={C.ink400}
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    keyboardType="phone-pad"
                  />
                  <View style={{ flexDirection: 'row', gap: 14, marginTop: 2 }}>
                    <TouchableOpacity onPress={() => setEditingContact(false)}>
                      <Text style={styles.cancelText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={saveContact} disabled={savingContact}>
                      <Text style={styles.linkBtn}>{savingContact ? '저장 중...' : '저장'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {deadmanEnabled && (
                    <View style={styles.safetyBottom}>
                      <View style={styles.countdownBlock}>
                        <Text style={styles.countdownLabel}>남은 시간</Text>
                        <Text style={styles.countdownValue}>
                          {formatCountdown(DEADMAN_TIMEOUT_MS - (nowTick - (lastCheckIn ?? nowTick)))}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.checkinBtn} onPress={checkIn}>
                        <Text style={styles.checkinBtnText}>저 괜찮아요</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={styles.safetyContact}>
                    <Text style={styles.safetyContactText}>
                      {contactName ? (
                        <>보호자 · <Text style={styles.safetyContactBold}>{contactName} {contactPhone}</Text></>
                      ) : (
                        '보호자 연락처가 등록되지 않았어요'
                      )}
                    </Text>
                    <TouchableOpacity onPress={() => setEditingContact(true)}>
                      <Text style={styles.linkBtn}>변경</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              <Text style={styles.footnote}>
                * 앱이 켜져있는 동안 실제로 카운트다운돼요. 시간 초과 시 문자 앱이 위치와 함께 미리 채워져 열리고,
                마지막 전송은 직접 눌러야 해요(운영체제 정책). 앱을 완전히 꺼두면 그동안은 감지가 안 되고,
                다시 열었을 때 몰아서 확인해요 — 완전한 백그라운드 감지는 아직 지원하지 않습니다.
              </Text>
            </LinearGradient>
          </View>

          {/* 전문가 인증 배지 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>전문가 인증 배지</Text>
            <View style={styles.plainCard}>
              <View style={styles.safetyTop}>
                <View style={styles.expertIcon}>
                  <Text style={{ fontSize: 17 }}>🎓</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.safetyTitle}>전문가 답변 배지</Text>
                  <Text style={styles.safetyDesc}>
                    변호사·상담사 등 전문가라면 켜주세요. 전문가 채널에서 남긴 답변에 "전문가 답변" 배지가 표시돼요.
                  </Text>
                </View>
                <Switch
                  value={isExpertVerified}
                  onValueChange={(next) => toggleExpertBadge(next)}
                  disabled={savingExpertBadge}
                  trackColor={{ false: C.line, true: C.brand400 }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={C.line}
                />
              </View>
              <Text style={styles.footnote}>* 현재는 자기 신고 방식이라, 실제 자격 검증은 별도로 이루어지지 않아요.</Text>
            </View>
          </View>

          {/* 내 사건 기록 */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={C.brand500} />
            </View>
          ) : !activeCase ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyText}>아직 등록된 사건이 없습니다.</Text>
              <TouchableOpacity
                style={styles.dashedRow}
                onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.START, params: { openForm: true } })}
              >
                <Text style={styles.dashedRowText}>+ 첫 사건 기록 시작하기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>내 사건 기록</Text>

              {(() => {
                const meta = CASE_TYPE_META[activeCase.caseType] ?? { icon: '📁' };
                const { items, progress } = buildQuestSteps(activeCase.caseType, activeCase.questSteps ?? []);
                const evidence = evidenceByCase[activeCase.id] ?? { total: 0, byType: {} };
                const previewItems = items.slice(0, 4);
                const isDone = progress.percent === 100;
                return (
                  <TouchableOpacity
                    style={styles.caseCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.EVIDENCE_TIMELINE, params: { caseId: activeCase.id } })}
                  >
                    <View style={styles.caseHead}>
                      <View style={[styles.badge, isDone ? styles.badgeSafe : styles.badgeDanger]}>
                        <Text style={[styles.badgeText, isDone ? styles.badgeTextSafe : styles.badgeTextDanger]}>
                          {isDone ? '완료' : '진행 중'}
                        </Text>
                      </View>
                      <Text style={styles.caseTitle} numberOfLines={1}>{meta.icon} {activeCase.title || '이름 없는 사건'}</Text>
                      <Text style={styles.caseDate}>{formatCaseDate(activeCase.createdAt)}</Text>
                    </View>

                    <View>
                      <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>퀘스트 진행도</Text>
                        <Text style={styles.progressValue}>{progress.label}</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progress.percent}%`, backgroundColor: isDone ? C.safe600 : C.brand500 }]} />
                      </View>
                    </View>

                    {previewItems.length > 0 && (
                      <View style={styles.checkGrid}>
                        {previewItems.map((item) => (
                          <View key={item.id} style={styles.checkItem}>
                            <View style={[styles.checkDot, item.completed && styles.checkDotDone]}>
                              {item.completed && <Text style={styles.checkMark}>✓</Text>}
                            </View>
                            <Text style={[styles.checkItemText, item.completed && styles.checkItemTextDone]} numberOfLines={1}>
                              {item.title}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.evidenceRow}>
                      {EVIDENCE_TILES.map((tile) => (
                        <View key={tile.type} style={[styles.evidenceTile, { backgroundColor: tile.bg }]}>
                          <Text style={[styles.evidenceNum, { color: tile.color }]}>{evidence.byType?.[tile.type] ?? 0}</Text>
                          <Text style={[styles.evidenceLabel, { color: tile.color }]}>{tile.label}</Text>
                        </View>
                      ))}
                      <View style={styles.timelineBtn}>
                        <Text style={styles.timelineBtnText}>타임라인{'\n'}보기 →</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {restCases.map((c) => {
                const meta = CASE_TYPE_META[c.caseType] ?? { icon: '📁' };
                const { progress } = buildQuestSteps(c.caseType, c.questSteps ?? []);
                const evidence = evidenceByCase[c.id] ?? { total: 0 };
                const isDone = progress.percent === 100;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.caseRow}
                    onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.EVIDENCE_TIMELINE, params: { caseId: c.id } })}
                  >
                    <View style={styles.caseRowIcon}>
                      <Text style={{ fontSize: 17 }}>{meta.icon}</Text>
                    </View>
                    <View style={styles.caseRowText}>
                      <Text style={styles.caseRowTitle} numberOfLines={1}>{c.title || '이름 없는 사건'}</Text>
                      <Text style={styles.caseRowSub}>증거 {evidence.total}건 · 퀘스트 {progress.label}</Text>
                    </View>
                    <View style={[styles.badge, isDone ? styles.badgeSafe : styles.badgeDanger]}>
                      <Text style={[styles.badgeText, isDone ? styles.badgeTextSafe : styles.badgeTextDanger]}>
                        {isDone ? '완료' : '진행 중'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.dashedRow}
                onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK, { screen: RECORD_ROUTES.START, params: { openForm: true } })}
              >
                <Text style={styles.dashedRowText}>+ 새 사건 기록 시작하기</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 90 }} />
        </View>
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
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.CHATS_STACK, { screen: CHAT_ROUTES.SOLIDARITY })}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>채팅</Text>
        </TouchableOpacity>
        <View style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabelActive}>홈</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  scroll: { flex: 1 },

  // 히어로
  hero: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 26, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBadge: { width: 24, height: 24 },
  topBarTitle: { fontSize: 21, fontWeight: '700', color: C.ink900 },
  topBarIcons: { flexDirection: 'row', gap: 14, marginLeft: 'auto', alignItems: 'center' },
  illustrationWrap: { height: 150, alignItems: 'center', justifyContent: 'center' },
  cloud: { position: 'absolute', borderRadius: 999, backgroundColor: '#E7EFFC', opacity: 0.9 },
  cloudA: { width: 92, height: 34, top: 2, left: 6 },
  cloudB: { width: 64, height: 24, bottom: 10, right: 14, opacity: 0.75 },
  cloudC: { width: 46, height: 18, top: 40, right: 46, opacity: 0.6 },
  heroHeadline: { fontSize: 18.5, lineHeight: 27, fontWeight: '700', color: C.ink900, textAlign: 'center' },
  heroHeadlineBold: { color: C.brand500 },
  cta: { paddingVertical: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // 본문 공통
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 20 },
  section: { gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C.ink400 },
  footnote: { fontSize: 10, color: C.ink400, fontStyle: 'italic', lineHeight: 15, marginTop: 4 },
  linkBtn: { fontSize: 12, fontWeight: '700', color: C.brand500 },
  cancelText: { fontSize: 12, color: C.ink400 },

  // 프로필
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: C.sky100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '700', color: C.brand600 },
  profileTextWrap: { flex: 1, minWidth: 0, gap: 2 },
  profileName: { fontSize: 15, fontWeight: '700', color: C.ink900 },
  profileMeta: { fontSize: 12, color: C.ink500 },

  // 안전 체크 카드
  safetyCard: { borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 18, gap: 14 },
  plainCard: { borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 18, gap: 10, backgroundColor: C.surface },
  safetyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  safetyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.safe100, alignItems: 'center', justifyContent: 'center' },
  safetyIconOff: { backgroundColor: '#F0F1F6' },
  expertIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.sky100, alignItems: 'center', justifyContent: 'center' },
  safetyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  safetyTitle: { fontSize: 14.5, fontWeight: '700', color: C.ink900 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: C.safe100 },
  statusPillOff: { backgroundColor: '#F0F1F6' },
  statusPillText: { fontSize: 10.5, fontWeight: '700', color: C.safe600 },
  statusPillTextOff: { color: C.ink400 },
  safetyDesc: { fontSize: 12, color: C.ink500, lineHeight: 18, marginTop: 3 },
  safetyBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countdownBlock: { gap: 2 },
  countdownLabel: { fontSize: 10.5, color: C.ink400 },
  countdownValue: { fontSize: 24, fontWeight: '700', color: C.ink900, fontVariant: ['tabular-nums'] },
  checkinBtn: { backgroundColor: C.ink900, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  checkinBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  safetyContact: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line, borderStyle: 'dashed',
  },
  safetyContactText: { fontSize: 12, color: C.ink500, flex: 1, paddingRight: 8 },
  safetyContactBold: { color: C.ink700, fontWeight: '700' },
  editBox: { gap: 8 },
  textInput: {
    backgroundColor: C.sky050, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: C.ink900,
  },

  // 사건 카드
  caseCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, gap: 12 },
  caseHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDanger: { backgroundColor: C.danger100 },
  badgeSafe: { backgroundColor: C.safe100 },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  badgeTextDanger: { color: C.danger600 },
  badgeTextSafe: { color: C.safe600 },
  caseTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: C.ink900 },
  caseDate: { fontSize: 11, color: C.ink400 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11.5, color: C.ink500 },
  progressValue: { fontSize: 11.5, fontWeight: '700', color: C.ink700 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: C.sky100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '46%' },
  checkDot: { width: 15, height: 15, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  checkDotDone: { backgroundColor: C.brand500, borderColor: C.brand500 },
  checkMark: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  checkItemText: { fontSize: 11.5, color: C.ink500, flexShrink: 1 },
  checkItemTextDone: { color: C.ink700 },
  evidenceRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  evidenceTile: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  evidenceNum: { fontSize: 15, fontWeight: '700' },
  evidenceLabel: { fontSize: 10, fontWeight: '600' },
  timelineBtn: { width: 60, borderRadius: 12, backgroundColor: C.ink900, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  timelineBtnText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700', textAlign: 'center', lineHeight: 13 },

  caseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: C.line,
  },
  caseRowIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.sky100, alignItems: 'center', justifyContent: 'center' },
  caseRowText: { flex: 1, minWidth: 0, gap: 2 },
  caseRowTitle: { fontSize: 13.5, fontWeight: '700', color: C.ink900 },
  caseRowSub: { fontSize: 11.5, color: C.ink500 },

  dashedRow: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed',
  },
  dashedRowText: { color: C.brand500, fontSize: 13, fontWeight: '700' },

  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: C.ink400, fontSize: 13 },

  // 하단 네비
  navbar: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.line,
    paddingVertical: 10, paddingHorizontal: 8, paddingBottom: 18,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6, borderRadius: 14 },
  navItemActive: { backgroundColor: C.sky100 },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 10.5, color: C.ink400, fontWeight: '600' },
  navLabelActive: { fontSize: 10.5, color: C.brand600, fontWeight: '700' },
});
