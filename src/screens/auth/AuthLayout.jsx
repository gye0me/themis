// src/screens/auth/AuthLayout.jsx
//
// 로그인·회원가입 공용 레이아웃 — 홈 화면 히어로와 같은 하늘색 그라데이션 배경 + 로고 헤더 + 흰 카드.
// (예전 어두운 남색 디자인을 리디자인 토큰(theme/tokens.js)에 맞춰 교체)

import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../theme/tokens';
import styles from './LoginScreen.styles';

const THEMIS_LOGO = require('../../assets/themis-logo-brand.png');

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <LinearGradient colors={[C.sky050, C.sky100, C.surface]} locations={[0, 0.45, 1]} style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brand}>
              <View style={styles.logoWrap}>
                <Image source={THEMIS_LOGO} style={styles.logo} resizeMode="contain" />
              </View>
              <Text style={styles.wordmark}>Themis</Text>
              <Text style={styles.tagline}>
                <Text style={styles.taglineBold}>기록하고 지키고 증명</Text>하는 나만의 법률 안전망
              </Text>
            </View>

            <View style={styles.card}>
              <View style={{ gap: 4 }}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              {children}
            </View>

            {footer}
            <Text style={styles.disclaimer}>Themis는 법률 정보를 제공하며, 법률 조언을 대신하지 않습니다.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// 홈 화면 CTA와 같은 그라데이션 알약 버튼
export function AuthPrimaryButton({ label, loading, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [pressed && !loading ? styles.buttonPressed : null, loading ? styles.buttonDisabled : null]}
    >
      <LinearGradient
        colors={[C.brand600, C.brand400]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.4 }}
        style={styles.primaryButton}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}
