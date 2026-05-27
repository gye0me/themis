import { StyleSheet, Text, View } from 'react-native';

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.badge}>THEMIS</Text>
        <Text style={styles.title}>디지털 증거 관리 플랫폼</Text>
        <Text style={styles.subtitle}>투명한 기록과 안전한 리포팅을 위한 통합 솔루션입니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>접속 상태</Text>
        <Text style={styles.userEmail}>인증 기능은 추후 활성화할 예정입니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>핵심 기능</Text>
        <Text style={styles.feature}>• 증거 기록</Text>
        <Text style={styles.feature}>• 안전한 저장</Text>
        <Text style={styles.feature}>• 분석 및 리포팅</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    padding: 20,
    gap: 16,
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: '#121b2d',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#23314f',
  },
  badge: {
    color: '#8fd3ff',
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#b8c2d6',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#11192a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22304a',
    gap: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  userEmail: {
    color: '#8fd3ff',
    fontSize: 15,
  },
  feature: {
    color: '#d7def0',
    fontSize: 15,
  },
});
