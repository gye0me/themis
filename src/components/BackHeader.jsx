// src/components/BackHeader.jsx
//
// 뒤로가기 버튼이 있는 화면들이 공용으로 쓰는 헤더 (로고 + 제목 + 부제).
// design/themis-interactive.html 목업의 .back-header와 동일한 구성.

import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/tokens';

const THEMIS_LOGO = require('../assets/themis-logo-brand.png');

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.ink900} strokeWidth={2}>
      <Path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function BackHeader({ title, subtitle, onBack, right }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <BackIcon />
      </TouchableOpacity>
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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.line,
    backgroundColor: C.surface,
  },
  backBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 22, height: 22 },
  textWrap: { flexShrink: 1 },
  title: { fontSize: 15.5, fontWeight: '700', color: C.ink900 },
  subtitle: { fontSize: 10.5, color: C.ink400, marginTop: 1 },
  right: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 },
});
