// src/theme/tokens.js
//
// 전역 디자인 토큰 — design/themis-interactive.html 목업과 동일한 값.
// 화면마다 색상을 따로 정의하지 않고 여기서 가져다 쓴다 (일관성 유지 목적).

export const C = {
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
  warn600: '#C2410C',
  warn100: '#FFF1E7',
};

// 증거 종류별 배지 색 (사진/음성/영상/계약서) — 여러 화면(홈, 기록, 타임라인)에서 공용으로 사용.
export const EVIDENCE_TILES = [
  { type: 'image', label: '사진', bg: '#EFF6FF', color: '#1D4ED8' },
  { type: 'audio', label: '음성', bg: '#F5F3FF', color: '#5B21B6' },
  { type: 'video', label: '영상', bg: '#FFF7ED', color: '#C2410C' },
  { type: 'contract', label: '계약서', bg: '#F0FDF4', color: '#15803D' },
];
