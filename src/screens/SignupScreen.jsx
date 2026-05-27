import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { signUp } from '../services/firebaseService';

export function SignupScreen({ onSwitchToLogin }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!displayName.trim()) {
      setError('이름을 입력해주세요.');
      return false;
    }
    if (!email.includes('@')) {
      setError('유효한 이메일을 입력해주세요.');
      return false;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      console.log('Starting signup with email:', email);
      await signUp(email, password, displayName);
      console.log('Signup successful');
    } catch (err) {
      console.error('회원가입 오류:', err);

      // Firebase 오류 메시지 한국어로 변환
      if (err.code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 이메일입니다.');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.');
      } else if (err.code === 'auth/invalid-email') {
        setError('유효하지 않은 이메일입니다.');
      } else {
        setError('회원가입에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.badge}>THEMIS</Text>
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>새 계정을 만들고 안전한 기록 관리를 시작하세요.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>이름</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="홍길동"
              placeholderTextColor="#6f7c98"
              style={styles.input}
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="example@gmail.com"
              placeholderTextColor="#6f7c98"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#6f7c98"
              secureTextEntry
              autoComplete="password"
              style={styles.input}
              editable={!loading}
            />
            <Text style={styles.hint}>최소 6자 이상</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>비밀번호 확인</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor="#6f7c98"
              secureTextEntry
              style={styles.input}
              editable={!loading}
            />
          </View>

          <Pressable
            onPress={handleSignup}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !loading ? styles.buttonPressed : null,
              loading ? styles.buttonDisabled : null,
            ]}
          >
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>계정 만들기</Text>}
          </Pressable>

          <Pressable onPress={onSwitchToLogin} style={styles.linkButton}>
            <Text style={styles.linkText}>이미 계정이 있으신가요? 로그인</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#11192a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#22304a',
    gap: 16,
  },
  badge: {
    color: '#8fd3ff',
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#b8c2d6',
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: '#ffb5b5',
    backgroundColor: '#381d24',
    borderRadius: 16,
    padding: 14,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    color: '#d7def0',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0d1627',
    borderColor: '#29405f',
    borderWidth: 1,
    borderRadius: 16,
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  hint: {
    color: '#7f8ca8',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#4d7cff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  linkText: {
    color: '#8fd3ff',
    fontSize: 14,
    fontWeight: '600',
  },
});
