import { Pressable, Text, View } from 'react-native';
import styles from './SettingsScreen.styles';

export function SettingsScreen({ user, profile, onLogout }) {
  const displayName = profile?.nickname || profile?.displayName || '설정되지 않음';

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.badge}>ACCOUNT</Text>
        <Text style={styles.title}>설정</Text>
        <Text style={styles.subtitle}>인증 상태와 프로필 정보를 확인하고, 필요할 때 로그아웃할 수 있습니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>로그인 정보</Text>
        <Text style={styles.label}>이메일</Text>
        <Text style={styles.value}>{profile?.email || user?.email || '정보 없음'}</Text>
        <Text style={styles.label}>닉네임</Text>
        <Text style={styles.value}>{displayName}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Firestore 연결</Text>
        <Text style={styles.description}>사용자 프로필은 users/{'{uid}'} 문서로 저장됩니다. password_hash는 Firebase Auth가 관리합니다.</Text>
      </View>

      <Pressable onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutButtonText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}
