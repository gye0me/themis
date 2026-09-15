// src/components/EventTimeInputModal.jsx
//
// "사건 발생 시간"을 사용자가 직접 입력하는 모달.
// - 텍스트 메모: 항상 이걸로 입력
// - 음성/영상: 파일에 녹화/녹음 시각이 없을 때 폴백으로 띄움
//
// 별도 날짜 선택 라이브러리 의존 없이 년/월/일/시/분 숫자 입력으로 구성.

import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme/tokens';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toFields(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return {
    year: String(d.getFullYear()),
    month: pad2(d.getMonth() + 1),
    day: pad2(d.getDate()),
    hour: pad2(d.getHours()),
    minute: pad2(d.getMinutes()),
  };
}

function fieldsToDate(fields) {
  const year = Number(fields.year);
  const month = Number(fields.month);
  const day = Number(fields.day);
  const hour = Number(fields.hour || 0);
  const minute = Number(fields.minute || 0);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {boolean} visible
 * @param {string} title
 * @param {string} [description]
 * @param {Date} [initialDate] - 기본값은 현재 시각
 * @param {(date: Date) => void} onConfirm
 * @param {() => void} onCancel
 */
export function EventTimeInputModal({
  visible,
  title = '사건 발생 시간 입력',
  description,
  initialDate,
  onConfirm,
  onCancel,
}) {
  const [fields, setFields] = useState(() => toFields(initialDate));

  useEffect(() => {
    if (visible) setFields(toFields(initialDate));
  }, [visible, initialDate]);

  const update = (key) => (text) => {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    setFields((prev) => ({ ...prev, [key]: digitsOnly }));
  };

  function handleConfirm() {
    const date = fieldsToDate(fields);
    if (!date) return;
    onConfirm?.(date);
  }

  const isValid = !!fieldsToDate(fields);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}

          <View style={styles.row}>
            <Field label="년" value={fields.year} onChangeText={update('year')} maxLength={4} flex={1.4} />
            <Text style={styles.sep}>-</Text>
            <Field label="월" value={fields.month} onChangeText={update('month')} maxLength={2} flex={1} />
            <Text style={styles.sep}>-</Text>
            <Field label="일" value={fields.day} onChangeText={update('day')} maxLength={2} flex={1} />
          </View>

          <View style={styles.row}>
            <Field label="시" value={fields.hour} onChangeText={update('hour')} maxLength={2} flex={1} />
            <Text style={styles.sep}>:</Text>
            <Field label="분" value={fields.minute} onChangeText={update('minute')} maxLength={2} flex={1} />
          </View>

          <TouchableOpacity style={styles.nowBtn} onPress={() => setFields(toFields(new Date()))}>
            <Text style={styles.nowBtnText}>지금 시각으로 채우기</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !isValid && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!isValid}
            >
              <Text style={styles.confirmBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChangeText, maxLength, flex }) {
  return (
    <View style={[styles.fieldWrap, { flex }]}>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        maxLength={maxLength}
        textAlign="center"
      />
      <Text style={styles.fieldLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  title: { color: C.ink900, fontSize: 15, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  description: { color: C.ink500, fontSize: 12, textAlign: 'center', marginBottom: 16, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sep: { color: C.ink400, fontSize: 16, fontWeight: '700' },
  fieldWrap: { alignItems: 'center', gap: 4 },
  fieldInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingVertical: 10,
    color: C.ink900,
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: C.sky050,
  },
  fieldLabel: { color: C.ink400, fontSize: 10.5 },
  nowBtn: { alignSelf: 'center', marginTop: 4, marginBottom: 16 },
  nowBtnText: { color: C.brand500, fontSize: 12.5, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: C.ink500, fontSize: 13, fontWeight: '700' },
  confirmBtn: {
    flex: 1, backgroundColor: C.brand600, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
