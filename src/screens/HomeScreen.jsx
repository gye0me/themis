import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';

export function HomeScreen() {
  return (
    <View style={styles.wrapper}>
      {/* 앱바 */}
      <View style={styles.appbar}>
        <View style={styles.appbarLogo}>
          <Text style={styles.appbarLogoText}>T</Text>
        </View>
        <View>
          <Text style={styles.appbarTitle}>홈</Text>
          <Text style={styles.appbarSub}>어떤 도움이 필요하세요?</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <Text style={styles.profileAvatar}>👤</Text>
          <View>
            <Text style={styles.profileName}>박덕새</Text>
            <Text style={styles.profileSub}>가입일 2025.03.01</Text>
            <Text style={styles.profileInfo}>진행 중인 사건 2건 · 수집 증거 8건</Text>
          </View>
        </View>

        {/* 진행 중인 사건 배너 */}
        <TouchableOpacity style={styles.caseBanner}>
          <Text style={styles.caseBannerText}>현재 진행 중인 사건</Text>
          <Text style={styles.caseBannerSub}>전세보증금 미반환 · 퀘스트 3/5 완료 · 증거 8건 수집</Text>
          <Text style={styles.caseBannerArrow}>→</Text>
        </TouchableOpacity>

        {/* 섹션 타이틀 */}
        <Text style={styles.sectionTitle}>내 사건 기록</Text>

        {/* 사건 카드 1 — 진행 중 */}
        <View style={[styles.caseCard, styles.caseCardDanger]}>
          <View style={[styles.caseCardBar, {backgroundColor: '#DC2626'}]} />
          <View style={styles.caseCardBody}>
            <View style={styles.caseCardHeader}>
              <View style={styles.badgeDanger}>
                <Text style={styles.badgeDangerText}>진행 중</Text>
              </View>
              <Text style={styles.caseCardTitle}>전세보증금 미반환</Text>
              <Text style={styles.caseDate}>3월 2일~</Text>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>퀘스트 진행도</Text>
              <Text style={styles.progressValue}>3 / 5 완료</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {width: '60%', backgroundColor: '#3B7DD8'}]} />
            </View>
            <Text style={styles.caseMeta}>사진 4 · 음성 2 · 영상 1 · 메모 1</Text>
          </View>
        </View>

        {/* 사건 카드 2 — 완료 */}
        <View style={[styles.caseCard]}>
          <View style={[styles.caseCardBar, {backgroundColor: '#16A34A'}]} />
          <View style={styles.caseCardBody}>
            <View style={styles.caseCardHeader}>
              <View style={styles.badgeSuccess}>
                <Text style={styles.badgeSuccessText}>완료</Text>
              </View>
              <Text style={styles.caseCardTitle}>프리랜서 계약 분쟁</Text>
              <Text style={styles.caseDate}>2월 15일~</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {width: '100%', backgroundColor: '#16A34A'}]} />
            </View>
            <Text style={styles.caseMeta}>퀘스트 3/3</Text>
          </View>
        </View>

        {/* 새 사건 추가 */}
        <TouchableOpacity style={styles.caseCardNew}>
          <Text style={styles.caseCardNewPlus}>+</Text>
          <Text style={styles.caseCardNewText}>새 사건 기록 시작하기</Text>
        </TouchableOpacity>

        {/* 데드맨 스위치 */}
        <View style={styles.deadman}>
          <View>
            <Text style={styles.deadmanTitle}>데드맨 스위치</Text>
            <Text style={styles.deadmanSub}>위급 시 자동 알림 발송</Text>
            <Text style={styles.deadmanDesc}>보호자에게 GPS + 증거 자동 전송</Text>
          </View>
          <View style={styles.deadmanDot} />
        </View>

        <View style={{height: 80}} />
      </ScrollView>

      {/* 네비바 */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>✏️</Text>
          <Text style={styles.navLabel}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>전문가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>피해자</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navLabelActive}>홈</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  appbar: {
    backgroundColor: '#1E3A5F',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appbarLogo: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#3B7DD8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appbarLogoText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  appbarTitle: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '500',
  },
  appbarSub: {
    color: '#7B9EC5',
    fontSize: 11,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  profileAvatar: {
    fontSize: 28,
  },
  profileName: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
  },
  profileSub: {
    color: '#7B9EC5',
    fontSize: 11,
  },
  profileInfo: {
    color: '#4A90D9',
    fontSize: 11,
  },
  caseBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
  },
  caseBannerText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '500',
  },
  caseBannerSub: {
    color: '#3B82F6',
    fontSize: 10,
  },
  caseBannerArrow: {
    color: '#1D4ED8',
    fontSize: 12,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  caseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 8,
    overflow: 'hidden',
  },
  caseCardBar: {
    width: 4,
  },
  caseCardBody: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  caseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  badgeDanger: {
    backgroundColor: '#FEE2E2',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeDangerText: {
    color: '#991B1B',
    fontSize: 10,
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeSuccessText: {
    color: '#166534',
    fontSize: 10,
  },
  caseCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  caseDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  progressValue: {
    fontSize: 10,
    color: '#3B7DD8',
  },
  progressBar: {
    height: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  caseMeta: {
    fontSize: 10,
    color: '#64748B',
  },
  caseCardNew: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  caseCardNewPlus: {
    fontSize: 20,
    color: '#CBD5E1',
  },
  caseCardNewText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  deadman: {
    backgroundColor: '#0F1F3D',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  deadmanTitle: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
  },
  deadmanSub: {
    color: '#4A6FA5',
    fontSize: 10,
  },
  deadmanDesc: {
    color: '#2A4A6E',
    fontSize: 10,
  },
  deadmanDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E24B4A',
  },
  navbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  navItemActive: {
    backgroundColor: '#0F1F3D',
    borderRadius: 6,
    marginHorizontal: 8,
    paddingVertical: 4,
  },
  navIcon: {
    fontSize: 20,
  },
  navLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  navLabelActive: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});