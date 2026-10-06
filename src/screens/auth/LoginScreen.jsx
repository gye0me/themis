import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { signIn } from '../../services/firebaseService';
import { C } from '../../theme/tokens';
import { AuthLayout, AuthPrimaryButton } from './AuthLayout';
import styles from './LoginScreen.styles';

export function LoginScreen({ onSwitchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      console.error('로그인 오류:', err);

      // Firebase v10부터는 없는 계정·틀린 비밀번호를 모두 auth/invalid-credential로 돌려준다
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.code === 'auth/invalid-email') {
        setError('유효하지 않은 이메일입니다.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('로그인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.');
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="다시 오신 걸 환영해요"
      subtitle="로그인하고 내 사건 기록을 이어서 관리하세요."
      footer={
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>계정이 없으신가요?</Text>
          <Pressable onPress={onSwitchToSignup} hitSlop={8}>
            <Text style={styles.linkText}>회원가입</Text>
          </Pressable>
        </View>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.formGroup}>
        <Text style={styles.label}>이메일</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="example@gmail.com"
          placeholderTextColor={C.ink400}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={[styles.input, focused === 'email' && styles.inputFocused]}
          onFocus={() => setFocused('email')}
          onBlur={() => setFocused(null)}
          editable={!loading}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={C.ink400}
          secureTextEntry
          autoComplete="password"
          style={[styles.input, focused === 'password' && styles.inputFocused]}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused(null)}
          onSubmitEditing={handleLogin}
          returnKeyType="go"
          editable={!loading}
        />
      </View>

      <AuthPrimaryButton label="로그인" loading={loading} onPress={handleLogin} />
    </AuthLayout>
  );
}
