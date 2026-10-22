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

  // 회원가입 동의 항목
  checkboxOff: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: C.brand600,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOffSmall: {
    width: 18, height: 18, borderRadius: 5,
    borderWidth: 1.5, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOnSmall: {
    width: 18, height: 18, borderRadius: 5,
    backgroundColor: C.brand600,
    alignItems: 'center', justifyContent: 'center',
  },
  agreeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  agreeAllText: { fontSize: 13.5, fontWeight: '700', color: C.ink900 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 8 },
  agreeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7,
  },
  agreeRowMain: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  agreeLabel: { fontSize: 12, color: C.ink700, flexShrink: 1 },
  agreeViewLink: { fontSize: 11.5, color: C.ink400, fontWeight: '600', textDecorationLine: 'underline' },

  docOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  docSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '80%',
  },
  docTitle: { fontSize: 15, fontWeight: '700', color: C.ink900, marginBottom: 10 },
  docScroll: { maxHeight: '85%' },
  docSection: { marginBottom: 14 },
  docHeading: { fontSize: 12.5, fontWeight: '700', color: C.brand700, marginBottom: 4 },
  docBody: { fontSize: 12, color: C.ink700, lineHeight: 18 },
  docCloseBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 10, backgroundColor: C.sky050, borderRadius: 12 },
  docCloseText: { fontSize: 13, color: C.brand700, fontWeight: '700' },
});

export default { ...base, ...extra };
