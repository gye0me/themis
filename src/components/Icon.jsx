// src/components/Icon.jsx
//
// 앱 공용 선(line) 아이콘 — 하단 내비게이션 아이콘과 같은 스타일(24 viewBox, 둥근 끝, stroke 2).
// 화면 곳곳의 이모지를 대신한다. 사용: <Icon name="camera" size={20} color={C.brand600} />
// 데이터(사건 유형·예방 가이드·채팅방 등)에는 이모지 대신 아이콘 이름을 저장하고 여기서 그린다.
// 모르는 이름(예: DB에 예전 이모지로 저장된 값)은 fallback 아이콘으로 그린다.

import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

// 각 아이콘은 SVG 요소 목록: ['path', d] | ['circle', cx, cy, r] | ['rect', x, y, w, h, rx] | ['polygon', points]
const ICONS = {
  // 사건 유형
  home: [['path', 'M3 10.5 12 3l9 7.5'], ['path', 'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5']],
  wallet: [['rect', 3, 7, 18, 13, 2], ['path', 'M3 7a2 2 0 0 1 2-2h11v2'], ['circle', 16.5, 13.5, 1.5]],
  users: [
    ['path', 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2'],
    ['circle', 10, 7, 4],
    ['path', 'M22 21v-2a4 4 0 0 0-3-3.87'],
    ['path', 'M15.5 3.13a4 4 0 0 1 0 7.75'],
  ],
  siren: [
    ['path', 'M7 18v-6a5 5 0 0 1 10 0v6'],
    ['path', 'M5 21h14'],
    ['rect', 5, 18, 14, 3, 1],
    ['path', 'M12 2.5v2'],
    ['path', 'M20.5 12h-1.5'],
    ['path', 'M5 12H3.5'],
    ['path', 'm18.4 5.6-1 1'],
    ['path', 'm5.6 5.6 1 1'],
  ],
  folder: [['path', 'M3 6.5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z']],

  // 증거 종류
  camera: [['path', 'M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z'], ['circle', 12, 13, 3.5]],
  mic: [['rect', 9, 2, 6, 12, 3], ['path', 'M5 11a7 7 0 0 0 14 0'], ['path', 'M12 18v4'], ['path', 'M9 22h6']],
  video: [['rect', 2.5, 6, 14, 12, 2], ['path', 'M21.5 9.5 16.5 12l5 2.5v-5Z']],
  edit: [['path', 'M12 20h9'], ['path', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z']],
  file: [['path', 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7Z'], ['path', 'M14 3v4h4'], ['path', 'M9 12h6'], ['path', 'M9 16h6']],
  contract: [['path', 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7Z'], ['path', 'M14 3v4h4'], ['path', 'm9 14.5 2 2 4-4']],
  image: [['rect', 3, 3, 18, 18, 2], ['circle', 9, 9, 2], ['path', 'm21 15-5-5L5 21']],
  receipt: [['path', 'M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5Z'], ['path', 'M8.5 8h7'], ['path', 'M8.5 12h7'], ['path', 'M8.5 16h4']],
  'id-card': [['rect', 2, 5, 20, 14, 2], ['circle', 8, 12, 2.5], ['path', 'M14 10h5'], ['path', 'M14 14h4']],
  clipboard: [['rect', 8, 2, 8, 4, 1], ['path', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'], ['path', 'M9 12h6'], ['path', 'M9 16h6']],
  medical: [['rect', 8, 2, 8, 4, 1], ['path', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'], ['path', 'M12 11v6'], ['path', 'M9 14h6']],

  // 상황·사례
  shield: [['path', 'M12 3 20 6.5v5c0 5-3.4 8.7-8 9.5-4.6-.8-8-4.5-8-9.5v-5Z']],
  'shield-check': [['path', 'M12 3 20 6.5v5c0 5-3.4 8.7-8 9.5-4.6-.8-8-4.5-8-9.5v-5Z'], ['path', 'm9 12 2 2 4-4']],
  key: [['circle', 7.5, 15.5, 4.5], ['path', 'm10.7 12.3 9.8-9.8'], ['path', 'm17.5 5.5 3 3'], ['path', 'm14.5 8.5 2 2']],
  building: [['rect', 4, 2, 16, 20, 1.5], ['path', 'M9.5 22v-4h5v4'], ['path', 'M8.5 6.5h.01M12 6.5h.01M15.5 6.5h.01M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01']],
  ticket: [['path', 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z'], ['path', 'M13 5v2'], ['path', 'M13 11v2'], ['path', 'M13 17v2']],
  package: [['path', 'M21 8 12 3 3 8v8l9 5 9-5Z'], ['path', 'm3 8 9 5 9-5'], ['path', 'M12 13v8']],
  phone: [['path', 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z']],
  'trending-up': [['path', 'M22 7 13.5 15.5l-5-5L2 17'], ['path', 'M16 7h6v6']],
  briefcase: [['rect', 2, 7, 20, 14, 2], ['path', 'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2'], ['path', 'M2 13h20']],
  book: [['path', 'M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z'], ['path', 'M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z']],
  globe: [['circle', 12, 12, 9], ['path', 'M3 12h18'], ['path', 'M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z']],
  eye: [['path', 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z'], ['circle', 12, 12, 3]],
  'eye-off': [['path', 'm3 3 18 18'], ['path', 'M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 4.5 10 6a17 17 0 0 1-3 3.5'], ['path', 'M6.6 6.6C4.3 8 2.6 10.3 2 12c1 1.5 5 6 10 6a9.6 9.6 0 0 0 4.4-1.1'], ['path', 'M9.9 9.9a3 3 0 0 0 4.2 4.2']],
  heart: [['path', 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z']],
  scale: [['path', 'M12 3v18'], ['path', 'M7 21h10'], ['path', 'M4 7h16'], ['path', 'm6 7-3 7a3 3 0 0 0 6 0Z'], ['path', 'm18 7-3 7a3 3 0 0 0 6 0Z']],

  // 사람·전문가
  user: [['circle', 12, 8, 4], ['path', 'M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6']],
  graduation: [['path', 'M22 9 12 4 2 9l10 5Z'], ['path', 'M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5'], ['path', 'M22 9v6']],
  award: [['circle', 12, 9, 6], ['path', 'M8.2 13.9 7 22l5-3 5 3-1.2-8.1']],

  // 소통
  message: [['path', 'M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.8 8.8 0 0 1-3.6-.8L3 20l1-4.7A8.4 8.4 0 1 1 21 11.5Z']],
  link: [['path', 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7'], ['path', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7']],
  paperclip: [['path', 'm21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5']],
  external: [['path', 'M14 3h7v7'], ['path', 'M10 14 21 3'], ['path', 'M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5']],

  // 위치·시간
  'map-pin': [['path', 'M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z'], ['circle', 12, 9, 2.3]],
  calendar: [['rect', 3, 4.5, 18, 16.5, 2], ['path', 'M16 2.5v4'], ['path', 'M8 2.5v4'], ['path', 'M3 10h18']],

  // 상태·동작
  check: [['path', 'm5 12.5 4.5 4.5L19 7.5']],
  'check-circle': [['circle', 12, 12, 9], ['path', 'm8 12.5 2.5 2.5L16 9.5']],
  x: [['path', 'M6 6l12 12'], ['path', 'M18 6 6 18']],
  'alert-triangle': [['path', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'], ['path', 'M12 9v4'], ['path', 'M12 17h.01']],
  search: [['circle', 11, 11, 7], ['path', 'm21 21-4.3-4.3']],
  lock: [['rect', 4, 11, 16, 10, 2], ['path', 'M8 11V7a4 4 0 0 1 8 0v4']],
  trash: [['path', 'M3 6h18'], ['path', 'M8 6V4h8v2'], ['path', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'], ['path', 'M10 11v6'], ['path', 'M14 11v6']],
  flag: [['path', 'M4 22V4'], ['path', 'M4 4h13l-2 4.5L17 13H4']],
  ban: [['circle', 12, 12, 9], ['path', 'm5.6 5.6 12.8 12.8']],
  refresh: [['path', 'M3 12a9 9 0 0 1 15.5-6.3L21 8'], ['path', 'M21 3v5h-5'], ['path', 'M21 12a9 9 0 0 1-15.5 6.3L3 16'], ['path', 'M3 21v-5h5']],
  play: [['polygon', '7 4 20 12 7 20 7 4']],
  pause: [['path', 'M8 5v14'], ['path', 'M16 5v14']],
  bookmark: [['path', 'M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z']],
  sparkles: [['path', 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z']],
  flame: [['path', 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.4 1.1 1.2 2 2.5 2.8Z']],
  menu: [['path', 'M4 6h16'], ['path', 'M4 12h16'], ['path', 'M4 18h16']],
  'corner-down-right': [['path', 'm15 10 5 5-5 5'], ['path', 'M4 4v7a4 4 0 0 0 4 4h12']],
  plus: [['path', 'M12 5v14'], ['path', 'M5 12h14']],
};

const FALLBACK = 'message';

/**
 * @param {string} name   아이콘 이름 (ICONS 키). 'dot'이면 color로 채운 동그라미(신호등 등).
 * @param {number} size   기본 20
 * @param {string} color  선 색
 */
export function Icon({ name, size = 20, color = '#33405C', strokeWidth = 2, style }) {
  if (name === 'dot') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Circle cx={12} cy={12} r={8} fill={color} />
      </Svg>
    );
  }
  const shapes = ICONS[name] ?? ICONS[FALLBACK];
  const stroke = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {shapes.map((shape, i) => {
        const [type, ...a] = shape;
        if (type === 'path') return <Path key={i} d={a[0]} {...stroke} />;
        if (type === 'circle') return <Circle key={i} cx={a[0]} cy={a[1]} r={a[2]} {...stroke} />;
        if (type === 'rect') return <Rect key={i} x={a[0]} y={a[1]} width={a[2]} height={a[3]} rx={a[4] ?? 0} {...stroke} />;
        if (type === 'polygon') return <Polygon key={i} points={a[0]} {...stroke} />;
        return null;
      })}
    </Svg>
  );
}
