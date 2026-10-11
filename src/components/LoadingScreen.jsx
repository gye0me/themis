// src/components/LoadingScreen.jsx
//
// 앱 시작 로딩 화면 — 로고가 튀어오르며 나타나고, 저울 로고가 좌우로 살짝 기울며 균형을 잡는다.
// 뒤에서는 은은한 빛이 숨 쉬듯 퍼지고, 워드마크·소개 문구가 차례로 떠오른 뒤 아래 점 3개가 순서대로 깜빡인다.
// (네이티브 스플래시와 같은 하늘색 배경이라 스플래시 → 로딩 화면이 자연스럽게 이어진다)

import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../theme/tokens';

const THEMIS_LOGO = require('../assets/themis-logo-brand.png');
const useNativeDriver = Platform.OS !== 'web';

export function LoadingScreen() {
  // 애니메이션 값은 처음 한 번만 만든다
  const [cardIn] = useState(() => new Animated.Value(0)); // 로고 카드 등장 (0 → 1)
  const [swing] = useState(() => new Animated.Value(0)); // 저울 기울기 (-1 ↔ 1)
  const [glow] = useState(() => new Animated.Value(0)); // 뒤쪽 빛 (0 ↔ 1)
  const [textIn] = useState(() => new Animated.Value(0)); // 워드마크·문구 등장
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));

  useEffect(() => {
    // 카드가 살짝 튀어오르며 등장하고, 0.25초 뒤 글자가 떠오른다 (최소 표시 시간 안에 다 보이도록 겹쳐서 진행)
    Animated.parallel([
      Animated.spring(cardIn, { toValue: 1, friction: 6, tension: 70, useNativeDriver }),
      Animated.timing(textIn, { toValue: 1, duration: 500, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver }),
    ]).start();

    // 저울이 좌우로 기울었다 돌아오기를 반복 (균형을 잡는 느낌)
    const swingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(swing, { toValue: -1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(swing, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ])
    );

    // 뒤쪽 빛이 숨 쉬듯 커졌다 작아지기
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver }),
      ])
    );

    // 점 3개가 순서대로 깜빡이기
    const dotsLoop = Animated.loop(
      Animated.stagger(
        180,
        dots.map((d) =>
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver }),
            Animated.timing(d, { toValue: 0, duration: 320, useNativeDriver }),
          ])
        )
      )
    );

    swingLoop.start();
    glowLoop.start();
    dotsLoop.start();
    return () => {
      swingLoop.stop();
      glowLoop.stop();
      dotsLoop.stop();
    };
  }, [cardIn, swing, glow, textIn, dots]);

  const cardStyle = {
    opacity: cardIn,
    transform: [{ scale: cardIn.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  };
  const logoStyle = {
    transform: [{ rotate: swing.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) }],
  };
  const glowStyle = {
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.28] }),
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.12] }) }],
  };
  const textStyle = {
    opacity: textIn,
    transform: [{ translateY: textIn.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  return (
    <LinearGradient colors={[C.sky050, C.sky100, C.surface]} locations={[0, 0.55, 1]} style={styles.screen}>
      <View style={styles.center}>
        <View style={styles.logoArea}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <Animated.View style={[styles.card, cardStyle]}>
            <Animated.Image source={THEMIS_LOGO} style={[styles.logo, logoStyle]} resizeMode="contain" />
          </Animated.View>
        </View>

        <Animated.View style={[styles.textBlock, textStyle]}>
          <Text style={styles.wordmark}>Themis</Text>
          <Text style={styles.tagline}>
            <Text style={styles.taglineBold}>기록하고 지키고 증명</Text>하는 나만의 법률 안전망
          </Text>
        </Animated.View>
      </View>

      <View style={styles.dots}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
              },
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 },
  logoArea: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: C.brand400,
  },
  // 로고 뒤 흰 카드 없이 투명 배경 — 로고만 튀어오르며 등장한다
  card: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 104, height: 104 },
  textBlock: { alignItems: 'center', gap: 6 },
  wordmark: { fontSize: 32, fontWeight: '800', color: C.ink900, letterSpacing: 0.5 },
  tagline: { fontSize: 13.5, color: C.ink500 },
  taglineBold: { color: C.brand500, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 56 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand500 },
});
