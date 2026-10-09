// 회원가입 전용 스타일 — 공용 스타일(LoginScreen.styles) 위에 계정 유형·전문가 입력 요소만 더한다
import { StyleSheet } from 'react-native';
import { C } from '../../theme/tokens';
import base from './LoginScreen.styles';

const extra = StyleSheet.create({
  // 계정 유형 선택 (일반 / 전문가)
  segment: { flexDirection: 'row', gap: 10 },
  segmentItem: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface,
    paddingVertical: 12, paddingHorizontal: 12, gap: 2,
  },
  segmentItemActive: { borderColor: C.brand500, backgroundColor: C.sky100 },
  segmentIcon: { fontSize: 18 },
  segmentLabel: { fontSize: 13.5, fontWeight: '700', color: C.ink900 },
  segmentLabelActive: { color: C.brand700 },
  segmentDesc: { fontSize: 11, color: C.ink500 },

  // 전문가 정보 영역
  expertBox: { backgroundColor: C.sky050, borderRadius: 16, padding: 14, gap: 14 },
  expertBoxTitle: { fontSize: 12.5, fontWeight: '700', color: C.brand700 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: C.line, borderRadius: 999, backgroundColor: C.surface,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  chipActive: { backgroundColor: C.brand600, borderColor: C.brand600 },
  chipText: { fontSize: 12, fontWeight: '600', color: C.ink500 },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  expertInput: { backgroundColor: C.surface },
  uploadBox: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', backgroundColor: C.surface,
  },
  uploadText: { fontSize: 12.5, color: C.ink400, fontWeight: '600' },
  notice: { backgroundColor: C.warn100, borderRadius: 12, padding: 12 },
  noticeText: { fontSize: 11.5, color: C.warn600, lineHeight: 17 },
});

export default { ...base, ...extra };
