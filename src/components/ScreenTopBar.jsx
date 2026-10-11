// src/components/ScreenTopBar.jsx
//
// 하단 탭 4개(홈·기록·전문가·채팅)가 공용으로 쓰는 상단 바 (로고 + 제목 + 부제 + 오른쪽 아이콘).
// 구분선 없이 배경은 투명 — 각 화면 배경색(홈은 하늘색 그라데이션)이 그대로 보이게 한다.
// 높이를 고정해서 탭을 오갈 때 제목 위치가 흔들리지 않게 한다.

import { Image, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/tokens';

const THEMIS_LOGO = require('../assets/themis-logo-brand.png');

export function ScreenTopBar({ title, subtitle, right, style }) {
  return (
    <View style={[styles.topBar, style]}>
      <Image source={THEMIS_LOGO} style={styles.badge} resizeMode="contain" />
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    minHeight: 64,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  badge: { width: 26, height: 26, flexShrink: 0 }, // 제목이 길어도 로고가 밀려 줄어들지 않게
  textWrap: { flexShrink: 1 },
  title: { fontSize: 20, fontWeight: '700', color: C.ink900 },
  subtitle: { fontSize: 11.5, color: C.ink400, marginTop: 1 },
  right: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 14 },
});
