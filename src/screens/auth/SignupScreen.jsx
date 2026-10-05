import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { signUp } from '../../services/firebaseService';
import { C } from '../../theme/tokens';
import { AuthLayout, AuthPrimaryButton } from './AuthLayout';
import styles from './SignupScreen.styles';

const ACCOUNT_TYPES = [
  { key: 'user', icon: '🙋', label: '일반 사용자', desc: '내 사건을 기록하고 대응해요' },
  { key: 'expert', icon: '🎓', label: '전문가', desc: '변호사·중개사 등 답변 제공' },
];
const EXPERT_JOBS = ['변호사', '공인중개사', '기자', '회계사', '기타'];

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
  const [focused, setFocused] = useState(null);

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
    if (accountType === 'expert') {
      if (!expertJob) {
        setError('전문가 직종을 선택해주세요.');
        return false;
      }
      if (!expertOrg.trim()) {
        setError('소속 기관을 입력해주세요.');
        return false;
      }
      if (!expertLicense.trim()) {
        setError('자격증/면허 번호를 입력해주세요.');
        return false;
      }
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
      await signUp(email.trim(), password, displayName.trim(), {
        accountType,
        expertProfile:
          accountType === 'expert'
            ? { job: expertJob, organization: expertOrg.trim(), licenseNumber: expertLicense.trim() }
            : null,
      });
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

  // 포커스된 입력칸 강조 + 공통 속성
  const inputProps = (key, extraStyle) => ({
    style: [styles.input, extraStyle, focused === key && styles.inputFocused],
    onFocus: () => setFocused(key),
    onBlur: () => setFocused(null),
    placeholderTextColor: C.ink400,
    editable: !loading,
  });

  return (
    <AuthLayout
      title="계정 만들기"
      subtitle="Themis와 함께 사건을 기록하고 지켜보세요."
      footer={
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>이미 계정이 있으신가요?</Text>
          <Pressable onPress={onSwitchToLogin} hitSlop={8}>
            <Text style={styles.linkText}>로그인</Text>
          </Pressable>
        </View>
      }
    >
      {/* 계정 유형 선택 */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>계정 유형</Text>
        <View style={styles.segment}>
          {ACCOUNT_TYPES.map((t) => {
            const active = accountType === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => setAccountType(t.key)}
              >
                <Text style={styles.segmentIcon}>{t.icon}</Text>
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{t.label}</Text>
                <Text style={styles.segmentDesc}>{t.desc}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>이름</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} placeholder="홍길동" {...inputProps('name')} />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>이메일</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="example@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          {...inputProps('email')}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
          {...inputProps('password')}
        />
        <Text style={styles.hint}>최소 6자 이상</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>비밀번호 확인</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          secureTextEntry
          {...inputProps('confirm')}
        />
      </View>

      {accountType === 'expert' && (
        <View style={styles.expertBox}>
          <Text style={styles.expertBoxTitle}>🎓 전문가 정보</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>직종</Text>
            <View style={styles.chipRow}>
              {EXPERT_JOBS.map((job) => {
                const active = expertJob === job;
                return (
                  <Pressable key={job} onPress={() => setExpertJob(job)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{job}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>소속 기관</Text>
            <TextInput
              value={expertOrg}
              onChangeText={setExpertOrg}
              placeholder="예) 법무법인 OO"
              {...inputProps('org', styles.expertInput)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>자격증/면허 번호</Text>
            <TextInput
              value={expertLicense}
              onChangeText={setExpertLicense}
              placeholder="자격증 또는 면허 번호 입력"
              {...inputProps('license', styles.expertInput)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>자격증 사진 첨부</Text>
            <View style={styles.uploadBox}>
              <Text style={styles.uploadText}>+ 자격증 사진 업로드 (준비 중)</Text>
            </View>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              전문가 계정으로 가입하면 전문가 채널 답변에 "전문가 답변" 배지가 표시돼요.
              (현재는 입력한 정보를 기준으로 하는 자기 신고 방식이며, 자격 검증은 추후 도입 예정이에요.)
            </Text>
          </View>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <AuthPrimaryButton label="계정 만들기" loading={loading} onPress={handleSignup} />
    </AuthLayout>
  );
}
