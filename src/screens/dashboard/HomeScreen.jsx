import { Pressable, Text, View } from 'react-native';
import styles from './HomeScreen.styles';

export function HomeScreen({ userProfile, onNavigate }) {
  const displayName = userProfile?.nickname?.trim() || userProfile?.displayName?.trim() || '사용자';
  const email = userProfile?.email?.trim() || 'Firestore 프로필 동기화 대기 중';

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.badge}>THEMIS</Text>
        <Text style={styles.title}>디지털 증거 관리 플랫폼</Text>
        <Text style={styles.subtitle}>투명한 기록과 안전한 리포팅을 위한 통합 솔루션입니다.</Text>

        <View style={styles.profileBox}>
          <Text style={styles.profileLabel}>현재 계정</Text>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>접속 상태</Text>
        <Text style={styles.userEmail}>Firestore 사용자 문서와 인증 상태가 연결되어 있습니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>핵심 기능</Text>
        <Text style={styles.feature}>• 증거 기록</Text>
        <Text style={styles.feature}>• 안전한 저장</Text>
        <Text style={styles.feature}>• 분석 및 리포팅</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={() => onNavigate?.('records')} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>데이터 보기</Text>
        </Pressable>

        <Pressable onPress={() => onNavigate?.('settings')} style={styles.actionButtonSecondary}>
          <Text style={styles.actionButtonSecondaryText}>설정 열기</Text>
        </Pressable>
      </View>
    </View>
  );
}
