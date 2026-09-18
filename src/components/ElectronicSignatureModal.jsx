// 법적으로 의미 있는 행위(전문가 인증 신청/승인, 공론화 SOS 발동 등) 전에
// "본인 확인 + 내용 고지 + 동의 의사표시"를 명시적으로 받기 위한 공용 전자서명 모달.
//
// 전자서명법(제2조)상 전자서명은 "서명자를 확인하고 서명자가 그 전자문서에 서명하였음을
// 나타내는 데 이용하기 위한 것"이면 되므로, 여기서는
//   1) 서명 대상 문구(statementText)를 화면에 고정해서 보여주고
//   2) 본인이 자기 이름을 직접 타이핑하게 해서 본인 확인 + 서명 의사를 남기고
//   3) 그 시점의 관련 데이터 해시(contentHash)를 같이 저장해 사후 변조를 감지할 수 있게 한다.
// 실제 법적 효력 여부는 최종적으로 변호사 자문이 필요하지만, 앱 차원에서 최소한의 증거 요건은
// 이렇게 갖출 수 있다.

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';

export function ElectronicSignatureModal({
  visible,
  title = '전자서명 확인',
  statementText,
  expectedName, // 있으면 타이핑한 이름이 이 값과 정확히 일치해야 서명 가능 (본인 확인 강화)
  submitting = false,
  onCancel,
  onConfirm, // (typedName: string) => void
}) {
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);

  const nameMatches = !expectedName || typedName.trim() === expectedName.trim();
  const canSubmit = typedName.trim().length > 0 && agreed && nameMatches;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm(typedName.trim());
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.statementBox}>
            <Text style={styles.statementText}>{statementText}</Text>
          </View>

          <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreed((v) => !v)}>
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Text style={styles.checkboxMark}>✓</Text>}
            </View>
            <Text style={styles.agreeText}>위 내용을 확인했고 이에 동의합니다.</Text>
          </TouchableOpacity>

          <Text style={styles.label}>
            본인 확인을 위해 이름을 직접 입력해주세요{expectedName ? ` (${expectedName})` : ''}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="이름 입력 = 전자서명"
            placeholderTextColor="#94A3B8"
            value={typedName}
            onChangeText={setTypedName}
          />
          {!!expectedName && typedName.length > 0 && !nameMatches && (
            <Text style={styles.errorText}>입력한 이름이 등록된 이름과 달라요.</Text>
          )}

          <Text style={styles.hint}>
            * 입력하신 이름과 시각, 관련 내용의 해시값이 서명 기록으로 함께 저장되며, 이후 수정·삭제할 수 없습니다.
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={submitting}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>서명하고 진행</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18 },
  title: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  statementBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 12, maxHeight: 150 },
  statementText: { fontSize: 12.5, color: '#334155', lineHeight: 19 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#94A3B8',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  checkboxMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  agreeText: { fontSize: 12.5, color: '#334155', flexShrink: 1 },
  label: { fontSize: 11.5, color: '#64748B', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10,
    fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', fontWeight: '600',
  },
  errorText: { fontSize: 10.5, color: '#DC2626', marginTop: 4 },
  hint: { fontSize: 10, color: '#94A3B8', marginTop: 10, lineHeight: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  confirmBtn: { flex: 1.4, backgroundColor: '#1E3A5F', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: '#94A3B8' },
  confirmBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
