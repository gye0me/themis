// src/screens/AccountScreen.jsx
//
// 계정 화면 — 내 정보, 약관·방침 보기, 차단한 사용자 관리, 로그아웃, 회원 탈퇴.
// (앱스토어 심사 요건: 앱 안에서 계정을 삭제할 수 있어야 한다)

import { useContext, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { BackHeader } from '../components/BackHeader';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { logout } from '../services/firebaseService';
import { deleteMyAccount } from '../services/accountDeletionService';
import { unblockUser } from '../services/blockService';
import { LEGAL_DOCUMENTS } from '../services/legalDocuments';
import { ACCOUNT_ROUTES, GUARDIAN_ROUTES } from '../navigation/routes';
import { C } from '../theme/tokens';

export function AccountScreen({ navigation }) {
  const { user, profile, refreshProfile } = useContext(AuthContext);
  const displayName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '사용자';
  const isExpert = profile?.accountType === 'expert';
  const blockedUsers = Object.entries(profile?.blockedUsers ?? {});

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [agreeDelete, setAgreeDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setError('');
    if (!password) {
      setError('본인 확인을 위해 비밀번호를 입력해주세요.');
      return;
    }
    setDeleting(true);
    try {
      await deleteMyAccount(password);
      // 인증 계정이 삭제되면 자동으로 로그인 화면으로 이동한다
    } catch (err) {
      console.error('회원 탈퇴 오류:', err);
      if (['auth/invalid-credential', 'auth/wrong-password'].includes(err?.code)) {
        setError('비밀번호가 올바르지 않습니다.');
      } else if (err?.code === 'auth/too-many-requests') {
        setError('시도가 너무 많아요. 잠시 후 다시 시도해주세요.');
      } else {
        setError(err?.message ?? '탈퇴하지 못했습니다. 다시 시도해주세요.');
      }
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <BackHeader title="계정" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content} contentContainerStyle={{ gap: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* 내 정보 */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}님</Text>
            <Text style={styles.meta}>{user?.email}</Text>
            <Text style={styles.meta}>
              {isExpert ? `🎓 전문가 계정${profile?.expertProfile?.job ? ` · ${profile.expertProfile.job}` : ''}` : '일반 계정'}
              {profile?.themisId ? ` · ${profile.themisId}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>설정</Text>
          <Row label="보호자 관리" onPress={() => navigation.navigate(GUARDIAN_ROUTES.MANAGE)} />
        </View>

        {/* 약관·방침 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>약관 및 정책</Text>
          {Object.entries(LEGAL_DOCUMENTS).map(([key, docItem]) => (
            <Row key={key} label={docItem.title} onPress={() => navigation.navigate(ACCOUNT_ROUTES.LEGAL, { doc: key })} />
          ))}
        </View>

        {/* 차단한 사용자 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>차단한 사용자</Text>
          {blockedUsers.length === 0 ? (
            <Text style={styles.empty}>차단한 사용자가 없어요. 게시판·채팅에서 상대 이름 옆 "차단"으로 차단할 수 있어요.</Text>
          ) : (
            blockedUsers.map(([uid, info]) => (
              <View key={uid} style={styles.row}>
                <Text style={styles.rowLabel}>{info?.name || '이름 없음'}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    await unblockUser(user.uid, uid).catch((err) => console.error('차단 해제 오류:', err));
                    await refreshProfile?.();
                  }}
                >
                  <Text style={styles.linkText}>차단 해제</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setConfirmLogout(true)}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

        {/* 회원 탈퇴 */}
        <View style={styles.section}>
          <TouchableOpacity onPress={() => setShowDelete((v) => !v)}>
            <Text style={styles.deleteToggle}>회원 탈퇴 {showDelete ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showDelete && (
            <View style={styles.deleteBox}>
              <Text style={styles.deleteTitle}>탈퇴하면 아래 정보가 삭제되며 되돌릴 수 없어요</Text>
              <Text style={styles.deleteItem}>• 모든 사건과 증거 기록, 업로드한 사진·음성·영상 파일</Text>
              <Text style={styles.deleteItem}>• 보호자 연결, 위급 상황 자동 알림 설정</Text>
              <Text style={styles.deleteItem}>• 계정 정보와 Themis ID</Text>
              <Text style={styles.deleteNote}>
                게시판 글·댓글과 채팅 메시지는 다른 사람과의 대화라 작성자 이름만 "탈퇴한 사용자"로 바뀌어 남아요.
                증거가 필요하다면 탈퇴 전에 보고서를 PDF로 저장해두세요.
              </Text>

              <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreeDelete((v) => !v)}>
                <View style={[styles.checkbox, agreeDelete && styles.checkboxOn]}>
                  {agreeDelete && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.agreeText}>위 내용을 확인했고 탈퇴에 동의합니다</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="본인 확인용 비밀번호"
                placeholderTextColor={C.ink400}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!deleting}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.deleteBtn, (!agreeDelete || deleting) && { opacity: 0.4 }]}
                disabled={!agreeDelete || deleting}
                onPress={handleDelete}
              >
                {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteBtnText}>탈퇴하기</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirmLogout}
        title="로그아웃할까요?"
        confirmLabel="로그아웃"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={async () => {
          setConfirmLogout(false);
          await logout().catch((err) => console.error('로그아웃 오류:', err));
        }}
      />
    </SafeAreaView>
  );
}

function Row({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.sky050, borderRadius: 18, padding: 16 },
  avatar: { width: 48, height: 48, borderRadius: 999, backgroundColor: C.sky100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 19, fontWeight: '700', color: C.brand600 },
  name: { fontSize: 16, fontWeight: '700', color: C.ink900 },
  meta: { fontSize: 12, color: C.ink500, marginTop: 2 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.ink500 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
  },
  rowLabel: { fontSize: 13.5, color: C.ink900, fontWeight: '600' },
  arrow: { fontSize: 18, color: C.ink400 },
  linkText: { fontSize: 12.5, color: C.brand600, fontWeight: '700' },
  empty: { fontSize: 12, color: C.ink400, lineHeight: 18 },
  logoutBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutText: { fontSize: 14, color: C.ink700, fontWeight: '700' },
  deleteToggle: { fontSize: 12.5, color: C.ink400, fontWeight: '600', textAlign: 'center' },
  deleteBox: { backgroundColor: C.danger100, borderRadius: 16, padding: 16, gap: 8 },
  deleteTitle: { fontSize: 13.5, fontWeight: '700', color: C.danger600 },
  deleteItem: { fontSize: 12.5, color: C.ink700 },
  deleteNote: { fontSize: 11.5, color: C.ink500, lineHeight: 17 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.ink400, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
  checkboxOn: { backgroundColor: C.danger600, borderColor: C.danger600 },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  agreeText: { fontSize: 12.5, color: C.ink900, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13.5, color: C.ink900,
  },
  error: { fontSize: 12, color: C.danger600, fontWeight: '600' },
  deleteBtn: { backgroundColor: C.danger600, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
