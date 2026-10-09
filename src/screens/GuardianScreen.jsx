// src/screens/GuardianScreen.jsx
//
// 보호자 관리 — 데드맨 스위치 무응답 시 앱 알림을 받을 보호자를 Themis 사용자끼리 연결한다.
// 1) 내 Themis ID 공유  2) ID·이메일로 보호자 요청  3) 받은 요청 수락/거절
// 4) 내 보호자 / 내가 지켜주는 사람 목록  5) 받은 위급 알림(위치 링크 포함)

import { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator, Linking, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { BackHeader } from '../components/BackHeader';
import {
  ensureGuardianProfile,
  findUserByIdOrEmail,
  getGuardianLinks,
  getReceivedAlerts,
  markAlertRead,
  registerPushToken,
  removeGuardianLink,
  respondGuardianRequest,
  sendGuardianRequest,
} from '../services/guardianService';
import { C } from '../theme/tokens';

function formatTime(ts) {
  const d = ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : null;
  return d ? d.toLocaleString('ko-KR') : '';
}

export function GuardianScreen({ navigation }) {
  const { user, profile, refreshProfile } = useContext(AuthContext);
  const myName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '사용자';

  const [themisId, setThemisId] = useState(profile?.themisId ?? null);
  const [links, setLinks] = useState(null); // { myGuardians, protecting, incoming }
  const [alerts, setAlerts] = useState([]);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState(null); // 찾은 사용자 | 'none'
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'error', text } — Alert는 웹에서 안 떠서 화면에 표시

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [nextLinks, nextAlerts] = await Promise.all([getGuardianLinks(user.uid), getReceivedAlerts(user.uid)]);
      setLinks(nextLinks);
      setAlerts(nextAlerts);
    } catch (err) {
      console.error('보호자 정보 조회 오류:', err);
      setLinks({ myGuardians: [], protecting: [], incoming: [] });
      setMessage({ type: 'error', text: '보호자 정보를 불러오지 못했어요. (Firestore 규칙 배포 여부를 확인해주세요)' });
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      // Themis ID가 없으면 만들고, 이 화면에선 알림 권한을 물어 푸시 토큰을 등록한다
      ensureGuardianProfile({ uid: user.uid, email: user.email, nickname: myName, themisId: profile?.themisId })
        .then((id) => {
          setThemisId(id);
          if (id && id !== profile?.themisId) refreshProfile?.();
        })
        .catch((err) => console.warn('Themis ID 생성 실패:', err?.message));
      registerPushToken(user.uid, { askPermission: true });
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, load])
  );

  const run = async (fn, okText) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (okText) setMessage({ type: 'ok', text: okText });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err?.message ?? '처리하지 못했어요.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSearch = () =>
    run(async () => {
      const result = await findUserByIdOrEmail(search);
      if (result?.uid === user.uid) throw new Error('나 자신은 보호자로 추가할 수 없어요.');
      setFound(result ?? 'none');
    });

  const handleRequest = () =>
    run(async () => {
      await sendGuardianRequest({ me: user.uid, myName, target: found });
      setFound(null);
      setSearch('');
    }, '보호자 요청을 보냈어요. 상대가 수락하면 연결돼요.');

  const shareMyId = async () => {
    const text = `Themis에서 제 보호자가 되어주세요! 보호자 관리 화면에서 제 Themis ID ${themisId}를 입력하면 돼요.`;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard?.writeText(themisId);
        setMessage({ type: 'ok', text: 'Themis ID를 복사했어요.' });
      } else {
        await Share.share({ message: text });
      }
    } catch (err) {
      console.warn('공유 실패:', err?.message);
    }
  };

  const openAlert = async (alert) => {
    if (!alert.readAt) markAlertRead(alert.id).catch(() => {});
    if (alert.locationUrl) Linking.openURL(alert.locationUrl).catch(() => {});
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, readAt: a.readAt ?? true } : a)));
  };

  const myGuardians = links?.myGuardians ?? [];
  const protecting = links?.protecting ?? [];
  const incoming = links?.incoming ?? [];

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <BackHeader title="보호자 관리" subtitle="무응답 시 앱 알림을 받을 사람" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} contentContainerStyle={{ gap: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {message && (
          <View style={[styles.message, message.type === 'error' && styles.messageError]}>
            <Text style={[styles.messageText, message.type === 'error' && styles.messageTextError]}>{message.text}</Text>
          </View>
        )}

        {/* 받은 위급 알림 */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>받은 위급 알림</Text>
            {alerts.map((a) => (
              <TouchableOpacity key={a.id} style={[styles.alertCard, a.readAt && styles.alertCardRead]} onPress={() => openAlert(a)}>
                <Text style={styles.alertTitle}>{a.readAt ? '' : '🔴 '}⚠️ {a.fromName || '보호 대상'}님이 응답이 없어요</Text>
                <Text style={styles.alertBody}>{a.message}</Text>
                <Text style={styles.alertMeta}>
                  {formatTime(a.createdAt)}{a.locationUrl ? ' · 탭해서 위치 보기' : ' · 위치 정보 없음'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 내 Themis ID */}
        <View style={styles.idCard}>
          <Text style={styles.idLabel}>내 Themis ID</Text>
          {themisId ? <Text style={styles.idValue} selectable>{themisId}</Text> : <ActivityIndicator color={C.brand600} />}
          <Text style={styles.idDesc}>상대가 이 코드나 내 이메일로 나를 찾을 수 있어요.</Text>
          {themisId && (
            <TouchableOpacity style={styles.shareBtn} onPress={shareMyId}>
              <Text style={styles.shareBtnText}>{Platform.OS === 'web' ? 'ID 복사하기' : 'ID 공유하기'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 받은 요청 */}
        {incoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>받은 보호자 요청</Text>
            {incoming.map((l) => (
              <View key={l.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{l.requesterName || '이름 없음'}</Text>
                  <Text style={styles.rowMeta}>수락하면 이 분이 응답이 없을 때 알림과 위치를 받아요</Text>
                </View>
                <TouchableOpacity disabled={busy} onPress={() => run(() => respondGuardianRequest(l.id, false), '요청을 거절했어요.')}>
                  <Text style={styles.ghostBtn}>거절</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallBtn}
                  disabled={busy}
                  onPress={() => run(() => respondGuardianRequest(l.id, true), `${l.requesterName || '상대'}님의 보호자가 되었어요.`)}
                >
                  <Text style={styles.smallBtnText}>수락</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 보호자 추가 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>보호자 추가</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="Themis ID(TM-XXXXX) 또는 이메일"
              placeholderTextColor={C.ink400}
              value={search}
              onChangeText={(v) => {
                setSearch(v);
                setFound(null);
              }}
              autoCapitalize="none"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.smallBtn} onPress={handleSearch} disabled={busy || !search.trim()}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.smallBtnText}>찾기</Text>}
            </TouchableOpacity>
          </View>
          {found === 'none' && <Text style={styles.rowMeta}>해당 ID·이메일로 가입한 사용자를 찾지 못했어요.</Text>}
          {found && found !== 'none' && (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{found.nickname || '이름 없음'}</Text>
                <Text style={styles.rowMeta}>{found.themisId ?? ''}</Text>
              </View>
              <TouchableOpacity style={styles.smallBtn} onPress={handleRequest} disabled={busy}>
                <Text style={styles.smallBtnText}>보호자 요청</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 내 보호자 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>내 보호자</Text>
          {links === null ? (
            <ActivityIndicator color={C.brand600} />
          ) : myGuardians.length === 0 ? (
            <Text style={styles.empty}>아직 연결된 보호자가 없어요. 가족이나 친구의 ID로 요청해보세요.</Text>
          ) : (
            myGuardians.map((l) => (
              <View key={l.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{l.guardianName || '이름 없음'}</Text>
                  <Text style={[styles.rowMeta, l.status === 'accepted' && { color: C.safe600 }]}>
                    {l.status === 'accepted' ? '연결됨 · 무응답 시 앱 알림을 받아요' : '수락 대기 중'}
                  </Text>
                </View>
                <TouchableOpacity disabled={busy} onPress={() => run(() => removeGuardianLink(l.id), '보호자 연결을 해제했어요.')}>
                  <Text style={styles.ghostBtn}>{l.status === 'accepted' ? '해제' : '요청 취소'}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* 내가 지켜주는 사람 */}
        {protecting.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>내가 지켜주는 사람</Text>
            {protecting.map((l) => (
              <View key={l.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{l.requesterName || '이름 없음'}</Text>
                  <Text style={styles.rowMeta}>이 분이 응답이 없으면 알림을 받아요</Text>
                </View>
                <TouchableOpacity disabled={busy} onPress={() => run(() => removeGuardianLink(l.id), '연결을 해제했어요.')}>
                  <Text style={styles.ghostBtn}>해제</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footnote}>
          * 알림은 앱 푸시로 전달돼요. 보호자도 Themis 앱을 설치하고 알림을 허용해야 받을 수 있어요.{'\n'}
          * 휴대폰이 꺼져 있거나 앱이 완전히 종료된 동안에는 무응답을 감지할 수 없어요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.ink500 },

  message: { backgroundColor: C.safe100, borderRadius: 12, padding: 12 },
  messageError: { backgroundColor: C.danger100 },
  messageText: { fontSize: 12.5, color: C.safe600, fontWeight: '600' },
  messageTextError: { color: C.danger600 },

  idCard: { backgroundColor: C.sky050, borderRadius: 18, padding: 18, alignItems: 'center', gap: 6 },
  idLabel: { fontSize: 12, fontWeight: '700', color: C.ink500 },
  idValue: { fontSize: 28, fontWeight: '800', color: C.brand700, letterSpacing: 2 },
  idDesc: { fontSize: 11.5, color: C.ink500, textAlign: 'center' },
  shareBtn: { marginTop: 6, backgroundColor: C.brand600, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  shareBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: C.line, backgroundColor: C.sky050, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13.5, color: C.ink900,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: C.ink900 },
  rowMeta: { fontSize: 11.5, color: C.ink500, marginTop: 2 },
  smallBtn: { backgroundColor: C.brand600, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, minWidth: 56, alignItems: 'center' },
  smallBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  ghostBtn: { color: C.ink500, fontSize: 12.5, fontWeight: '600', paddingHorizontal: 4 },
  empty: { fontSize: 12.5, color: C.ink400 },

  alertCard: { backgroundColor: C.danger100, borderRadius: 14, padding: 14, gap: 4 },
  alertCardRead: { backgroundColor: C.sky050 },
  alertTitle: { fontSize: 13.5, fontWeight: '700', color: C.danger600 },
  alertBody: { fontSize: 12.5, color: C.ink700, lineHeight: 18 },
  alertMeta: { fontSize: 11, color: C.ink500 },

  footnote: { fontSize: 10.5, color: C.ink400, lineHeight: 16 },
});
