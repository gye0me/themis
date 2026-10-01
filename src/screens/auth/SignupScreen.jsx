import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { signUp } from '../../services/firebaseService';
import styles from './SignupScreen.styles';

export function SignupScreen({ onSwitchToLogin }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState('user');
  const [expertJob, setExpertJob] = useState('');
  const [expertOrg, setExpertOrg] = useState('');
  const [expertLicense, setExpertLicense] = useState('');

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
      await signUp(email, password, displayName);
    } catch (err) {
      console.error('회원가입 오류:', err);

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

    {/* 계정 유형 선택 */}
    <View style={styles.formGroup}>
      <Text style={styles.label}>계정 유형</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          style={[styles.input, { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: accountType === 'user' ? '#1E3A5F' : '#F1F5F9' }]}
          onPress={() => setAccountType('user')}
        >
          <Text style={{ color: accountType === 'user' ? '#FFFFFF' : '#0F172A', fontSize: 13 }}>일반 사용자</Text>
        </Pressable>
        <Pressable
          style={[styles.input, { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: accountType === 'expert' ? '#1E3A5F' : '#F1F5F9' }]}
          onPress={() => setAccountType('expert')}
        >
          <Text style={{ color: accountType === 'expert' ? '#FFFFFF' : '#0F172A', fontSize: 13 }}>전문가</Text>
        </Pressable>
      </View>
    </View>

    {accountType === 'expert' && (
      <>
        <View style={styles.formGroup}>
          <Text style={styles.label}>직종</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['변호사', '공인중개사', '기자', '회계사', '기타'].map((job) => (
              <Pressable
                key={job}
                onPress={() => setExpertJob(job)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: expertJob === job ? '#1E3A5F' : '#F1F5F9', borderWidth: 1, borderColor: expertJob === job ? '#1E3A5F' : '#E2E8F0' }}
              >
                <Text style={{ color: expertJob === job ? '#FFFFFF' : '#64748B', fontSize: 12 }}>{job}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>소속 기관</Text>
          <TextInput value={expertOrg} onChangeText={setExpertOrg} placeholder="예) 법무법인 OO" placeholderTextColor="#6f7c98" style={styles.input} editable={!loading} />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>자격증/면허 번호</Text>
          <TextInput value={expertLicense} onChangeText={setExpertLicense} placeholder="자격증 또는 면허 번호 입력" placeholderTextColor="#6f7c98" style={styles.input} editable={!loading} />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>자격증 사진 첨부</Text>
          <Pressable style={[styles.input, { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }]}>
            <Text style={{ color: '#94A3B8', fontSize: 13 }}>+ 자격증 사진 업로드</Text>
          </Pressable>
        </View>
        <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <Text style={{ color: '#92400E', fontSize: 11 }}>제출 후 관리자 검토 후 승인되며, 승인 시 전문가 배지가 부여됩니다.</Text>
        </View>
      </>
    )}

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
