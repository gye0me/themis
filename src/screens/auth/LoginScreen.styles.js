// 로그인·회원가입 공용 스타일 (리디자인 토큰 기반 — 홈 화면과 같은 하늘색 계열)
import { StyleSheet } from 'react-native';
import { C } from '../../theme/tokens';

export default StyleSheet.create({
  screen: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
    gap: 18,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },

  // 로고 헤더
  brand: { alignItems: 'center', gap: 6, marginBottom: 4 },
  logoWrap: {
    width: 68, height: 68, borderRadius: 22, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.line,
    shadowColor: C.brand700, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  logo: { width: 40, height: 40 },
  wordmark: { fontSize: 26, fontWeight: '800', color: C.ink900, letterSpacing: 0.3, marginTop: 6 },
  tagline: { fontSize: 13.5, color: C.ink500, textAlign: 'center' },
  taglineBold: { color: C.brand500, fontWeight: '700' },

  // 카드
  card: {
    backgroundColor: C.surface, borderRadius: 24, padding: 22, gap: 16,
    borderWidth: 1, borderColor: C.line,
    shadowColor: C.brand700, shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  title: { fontSize: 21, fontWeight: '700', color: C.ink900 },
  subtitle: { fontSize: 13, color: C.ink500, lineHeight: 19 },

  error: {
    color: C.danger600, backgroundColor: C.danger100, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 12.5, fontWeight: '600', overflow: 'hidden',
  },

  // 입력
  formGroup: { gap: 7 },
  label: { fontSize: 12.5, fontWeight: '700', color: C.ink700 },
  input: {
    backgroundColor: C.sky050, borderColor: C.line, borderWidth: 1, borderRadius: 12,
    color: C.ink900, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  inputFocused: { borderColor: C.brand400, backgroundColor: C.surface },
  hint: { fontSize: 11, color: C.ink400 },

  // 버튼
  primaryButton: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  switchText: { fontSize: 13, color: C.ink500 },
  linkText: { fontSize: 13, color: C.brand600, fontWeight: '700' },

  disclaimer: { fontSize: 10.5, color: C.ink400, textAlign: 'center' },
});
