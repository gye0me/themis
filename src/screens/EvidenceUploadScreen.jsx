import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'

export function EvidenceUploadScreen() {
  return (
    <ScrollView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>증거 업로드</Text>
        <Text style={styles.headerSubtitle}>사건 기록 추가하기</Text>
      </View>

      {/* 기록 유형 선택 */}
      <Text style={styles.sectionTitle}>기록 유형 선택</Text>

      {/* 계약서 분석 큰 카드 */}
      <TouchableOpacity style={styles.contractCard}>
        <Text style={styles.contractIcon}>📄</Text>
        <View>
          <Text style={styles.contractTitle}>계약서 분석</Text>
          <Text style={styles.contractDesc}>독소조항 자동 탐지</Text>
        </View>
      </TouchableOpacity>

      {/* 4개 카드 그리드 */}
      <View style={styles.cardGrid}>
        <TouchableOpacity style={styles.uploadCard}>
          <Text style={styles.cardIcon}>📷</Text>
          <Text style={styles.cardTitle}>사진</Text>
          <Text style={styles.cardDesc}>현장 사진 촬영</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadCard}>
          <Text style={styles.cardIcon}>🎙️</Text>
          <Text style={styles.cardTitle}>음성</Text>
          <Text style={styles.cardDesc}>녹음 파일 업로드</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadCard}>
          <Text style={styles.cardIcon}>🎥</Text>
          <Text style={styles.cardTitle}>영상</Text>
          <Text style={styles.cardDesc}>동영상 파일 업로드</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadCard}>
          <Text style={styles.cardIcon}>📝</Text>
          <Text style={styles.cardTitle}>메모</Text>
          <Text style={styles.cardDesc}>텍스트 직접 입력</Text>
        </TouchableOpacity>
      </View>

      {/* GPS 안내 */}
      <View style={styles.gpsNotice}>
        <Text style={styles.gpsTitle}>GPS + 타임스탬프 자동 저장</Text>
        <Text style={styles.gpsDesc}>
          업로드 시 현재 위치와 시간이 자동으로 기록됩니다
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    padding: 16,
  },
  header: {
    backgroundColor: '#1a2942',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#8da3c1',
    fontSize: 14,
  },
  sectionTitle: {
    color: '#8da3c1',
    fontSize: 14,
    marginBottom: 12,
  },
  contractCard: {
    backgroundColor: '#1a3a5c',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  contractIcon: {
    fontSize: 32,
  },
  contractTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  contractDesc: {
    color: '#8da3c1',
    fontSize: 13,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  uploadCard: {
    backgroundColor: '#1a2942',
    padding: 20,
    borderRadius: 12,
    width: '47%',
    alignItems: 'center',
    borderTopWidth: 4,
    borderTopColor: '#4a90e2',
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  cardTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDesc: {
    color: '#8da3c1',
    fontSize: 12,
    textAlign: 'center',
  },
  gpsNotice: {
    backgroundColor: '#1a2942',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  gpsTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gpsDesc: {
    color: '#8da3c1',
    fontSize: 12,
  },
})