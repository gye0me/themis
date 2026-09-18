// src/components/ScreenTopBar.jsx
//
// 홈 화면을 제외한 나머지 화면들이 공용으로 쓰는 단순 헤더.
// (로고 + 제목 + 부제) — design/themis-interactive.html 목업의 .top-bar와 동일한 구성.

import { Image, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/tokens';

const THEMIS_LOGO = require('../assets/themis-logo-brand.png');

export function ScreenTopBar({ title, subtitle, right }) {
  return (
    <View style={styles.topBar}>
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
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  badge: { width: 24, height: 24 },
  textWrap: { flexShrink: 1 },
  title: { fontSize: 19, fontWeight: '700', color: C.ink900 },
  subtitle: { fontSize: 11, color: C.ink400, marginTop: 1 },
  right: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 14 },
});
