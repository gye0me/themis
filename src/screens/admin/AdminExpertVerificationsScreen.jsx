import { useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { getPendingExpertVerifications, reviewExpertVerification } from '../../services/firebaseService';
import { createElectronicSignature } from '../../services/signatureService';
import { ElectronicSignatureModal } from '../../components/ElectronicSignatureModal';

function formatDate(ts) {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

// 심사 결정(승인/반려)에 대한 관리자 서명 문구 — 결정의 책임 소재를 명확히 남긴다.
function reviewStatementText(req, approve, reason) {
  const ev = req.expertVerification ?? {};
  const decision = approve ? '승인' : `반려 (사유: ${reason})`;
  return (
    `본인은 아래 전문가 인증 신청을 검토했으며, 이 결정에 대해 책임집니다.\n\n` +
    `- 신청자: ${ev.name ?? '(정보 없음)'} · ${ev.licenseType ?? ''}\n` +
    `- 결정: ${decision}\n\n` +
    `이 서명 기록은 서명 시점 내용의 해시와 함께 보관되며, 이후 수정·삭제되지 않습니다.`
  );
}

export function AdminExpertVerificationsScreen({ navigation }) {
  const { user, profile } = useContext(AuthContext);
  const adminName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '관리자';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { req, approve, reason }

  const load = useCallback(() => {
    setLoading(true);
    getPendingExpertVerifications()
      .then(setRequests)
      .catch((err) => console.error('전문가 인증 목록 조회 오류:', err))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleApprove = (req) => {
    Alert.alert('승인', `${req.expertVerification?.name ?? '신청자'}님을 전문가로 승인할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '승인', onPress: () => setPendingAction({ req, approve: true, reason: '' }) },
    ]);
  };

  const handleReject = (req) => {
    Alert.alert('반려 사유', '반려 사유를 선택해주세요.', [
      { text: '서류 불명확', onPress: () => setPendingAction({ req, approve: false, reason: '제출한 서류를 확인할 수 없어요.' }) },
      { text: '자격 확인 불가', onPress: () => setPendingAction({ req, approve: false, reason: '자격 정보를 확인할 수 없어요.' }) },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const handleConfirmReviewSignature = async (typedName) => {
    if (!pendingAction) return;
    const { req, approve, reason } = pendingAction;
    setProcessingId(req.id);
    try {
      const signatureId = await createElectronicSignature({
        signerUid: user?.uid,
        signerName: adminName,
        typedName,
        statementText: reviewStatementText(req, approve, reason),
        targetType: 'expertVerificationReview',
        targetId: req.id,
        content: { targetUid: req.id, approve, reason },
      });
      await reviewExpertVerification(req.id, {
        approve,
        reviewerUid: user?.uid,
        rejectReason: reason,
        signatureId,
      });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      setPendingAction(null);
    } catch (err) {
      console.error('심사 처리 오류:', err);
      Alert.alert('오류', '심사 처리에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <View style={styles.appbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>전문가 인증 심사</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E3A5F" />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>심사 대기 중인 신청이 없어요.</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {requests.map((req) => {
            const ev = req.expertVerification ?? {};
            return (
              <View key={req.id} style={styles.card}>
                <Text style={styles.name}>{ev.name} · {ev.licenseType}</Text>
                {!!ev.licenseNumber && <Text style={styles.meta}>등록번호: {ev.licenseNumber}</Text>}
                {!!ev.org && <Text style={styles.meta}>소속: {ev.org}</Text>}
                {!!ev.note && <Text style={styles.meta}>메모: {ev.note}</Text>}
                <Text style={styles.meta}>신청일: {formatDate(ev.submittedAt)}</Text>
                {ev.documentUrl && (
                  <Image source={{ uri: ev.documentUrl }} style={styles.docImage} />
                )}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReject(req)}
                    disabled={processingId === req.id}
                  >
                    <Text style={styles.rejectBtnText}>반려</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(req)}
                    disabled={processingId === req.id}
                  >
                    {processingId === req.id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.approveBtnText}>승인</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <ElectronicSignatureModal
        visible={!!pendingAction}
        title="심사 결정 전자서명"
        statementText={pendingAction ? reviewStatementText(pendingAction.req, pendingAction.approve, pendingAction.reason) : ''}
        expectedName={adminName}
        submitting={!!processingId}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleConfirmReviewSignature}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },
  appbar: {
    backgroundColor: '#1E3A5F', paddingHorizontal: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  backBtn: { paddingRight: 4 },
  backIcon: { color: '#FFFFFF', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 13 },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 12 },
  name: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  meta: { fontSize: 11.5, color: '#64748B', marginTop: 2 },
  docImage: { width: '100%', height: 180, borderRadius: 8, marginTop: 10, resizeMode: 'cover' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: '#DC2626', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  rejectBtnText: { color: '#DC2626', fontSize: 12.5, fontWeight: '700' },
  approveBtn: {
    flex: 1, backgroundColor: '#1E3A5F', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  approveBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
});
