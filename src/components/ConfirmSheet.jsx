// src/components/ConfirmSheet.jsx
//
// 확인/취소 선택 창. 버튼이 있는 Alert.alert는 웹에서 아예 뜨지 않아서,
// 차단·로그아웃처럼 확인이 필요한 동작은 이 컴포넌트로 묻는다 (앱·웹 공통).

import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme/tokens';

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = '확인',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, destructive && styles.confirmBtnDanger]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.5)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: C.surface, borderRadius: 18, padding: 20, gap: 10, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: C.ink900 },
  message: { fontSize: 13, color: C.ink500, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: C.ink500, fontSize: 13.5, fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: C.brand600, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  confirmBtnDanger: { backgroundColor: C.danger600 },
  confirmText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
});
