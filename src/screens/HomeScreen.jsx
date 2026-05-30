import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';

export function HomeScreen({ navigation }) {
  return (
    <View style={styles.wrapper}>
      {/* 상태바 */}
      <View style={styles.statusbar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusApp}>Themis</Text>
      </View>

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
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarIcon}>👤</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>박덕새</Text>
            <Text style={styles.profileSub}>가입일 2025.03.01</Text>
            <Text style={styles.profileDetail}>진행 중인 사건 2건 · 수집 증거 8건</Text>
          </View>
        </View>

        {/* 진행 중인 사건 배너 */}
        <TouchableOpacity style={styles.caseBanner} onPress={() => navigation.navigate('Timeline')}>
          <Text style={styles.caseBannerText}>현재 진행 중인 사건</Text>
          <Text style={styles.caseBannerSub}>전세보증금 미반환 · 퀘스트 3/5 완료 · 증거 8건 수집</Text>
          <Text style={styles.caseBannerArrow}>→</Text>
        </TouchableOpacity>

        {/* 섹션 타이틀 */}
        <Text style={styles.sectionTitle}>내 사건 기록</Text>

        {/* 사건 카드 1 — 진행 중 */}
        <TouchableOpacity style={styles.caseCard} onPress={() => navigation.navigate('Upload')}>
          <View style={[styles.caseCardBar, {backgroundColor: '#DC2626'}]} />
          <View style={styles.caseCardBody}>
            <View style={styles.caseCardHeader}>
              <View style={styles.badgeDanger}>
                <Text style={styles.badgeDangerText}>진행 중</Text>
              </View>
              <Text style={styles.caseCardTitle}>전세보증금 미반환</Text>
              <Text style={styles.caseDate}>3월 2일~</Text>
            </View>

            {/* 퀘스트 진행도 */}
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>퀘스트 진행도</Text>
              <Text style={styles.progressValue}>3 / 5 완료</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {width: '60%'}]} />
            </View>

            {/* 퀘스트 체크리스트 */}
            <View style={styles.checkGrid}>
              <Text style={styles.checkDone}>✓ 임대차보호법 확인</Text>
              <Text style={styles.checkDone}>✓ 내용증명 발송</Text>
              <Text style={styles.checkDone}>✓ 증거 PDF 정리</Text>
              <Text style={styles.checkTodo}>○ 법률구조공단 신청</Text>
              <Text style={styles.checkTodo}>○ 소액심판 신청</Text>
            </View>

            {/* 증거 숫자 카드 */}
            <View style={styles.evidenceRow}>
              <View style={[styles.evidenceCard, {backgroundColor: '#EFF6FF'}]}>
                <Text style={[styles.evidenceNum, {color: '#1D4ED8'}]}>4</Text>
                <Text style={[styles.evidenceLabel, {color: '#3B82F6'}]}>사진</Text>
              </View>
              <View style={[styles.evidenceCard, {backgroundColor: '#F5F3FF'}]}>
                <Text style={[styles.evidenceNum, {color: '#5B21B6'}]}>2</Text>
                <Text style={[styles.evidenceLabel, {color: '#7C3AED'}]}>음성</Text>
              </View>
              <View style={[styles.evidenceCard, {backgroundColor: '#FFF7ED'}]}>
                <Text style={[styles.evidenceNum, {color: '#C2410C'}]}>1</Text>
                <Text style={[styles.evidenceLabel, {color: '#EA580C'}]}>영상</Text>
              </View>
              <View style={[styles.evidenceCard, {backgroundColor: '#F0FDF4'}]}>
                <Text style={[styles.evidenceNum, {color: '#15803D'}]}>1</Text>
                <Text style={[styles.evidenceLabel, {color: '#16A34A'}]}>PDF</Text>
              </View>
              <TouchableOpacity style={styles.timelineBtn} onPress={() => navigation.navigate('Timeline')}>
                <Text style={styles.timelineBtnText}>타임라인{'\n'}보기 →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        {/* 사건 카드 2 — 완료 */}
        <View style={styles.caseCard}>
          <View style={[styles.caseCardBar, {backgroundColor: '#16A34A'}]} />
          <View style={styles.caseCardBody}>
            <View style={styles.caseCardHeader}>
              <View style={styles.badgeSuccess}>
                <Text style={styles.badgeSuccessText}>완료</Text>
              </View>
              <Text style={styles.caseCardTitle}>프리랜서 계약 분쟁</Text>
              <Text style={styles.caseDate}>2월 15일~</Text>
            </View>
            <Text style={styles.caseMeta}>계약서 1 · 메모 3</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {width: '100%', backgroundColor: '#16A34A'}]} />
            </View>
            <View style={styles.progressRow}>
              <View />
              <Text style={styles.progressValue}>퀘스트 3/3</Text>
            </View>
          </View>
        </View>

        {/* 새 사건 추가 */}
        <TouchableOpacity style={styles.caseCardNew} onPress={() => navigation.navigate('NewCase')}>
          <Text style={styles.caseCardNewPlus}>+</Text>
          <Text style={styles.caseCardNewText}>새 사건 기록 시작하기</Text>
        </TouchableOpacity>

        {/* 데드맨 스위치 */}
        <View style={styles.deadman}>
          <View style={styles.deadmanLeft}>
            <Text style={styles.deadmanTitle}>위급 상황 자동 알림</Text>
            <Text style={styles.deadmanSub}>30분 무응답 시 보호자에게 GPS + 증거 자동 전송</Text>
            <Text style={styles.deadmanContact}>보호자: 홍길동 · 010-1234-5678</Text>
            <TouchableOpacity>
              <Text style={styles.deadmanChange}>변경 →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.toggleOn}>
            <View style={styles.toggleCircle} />
            <Text style={styles.toggleText}>ON</Text>
          </View>
        </View>

        <View style={{height: 60}} />
      </ScrollView>

      {/* 네비바 */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Upload')}>
          <Text style={styles.navIcon}>✏️</Text>
          <Text style={styles.navLabel}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>전문가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>채팅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navLabelActive}>홈</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },
  statusbar: {
    backgroundColor: '#0F1F3D',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusTime: { color: '#6B84A8', fontSize: 12 },
  statusApp: { color: '#6B84A8', fontSize: 12 },
  appbar: {
    backgroundColor: '#1E3A5F',
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appbarLogo: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: '#3B7DD8',
    alignItems: 'center', justifyContent: 'center',
  },
  appbarLogoText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  appbarTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  appbarSub: { color: '#7B9EC5', fontSize: 11 },
  content: { flex: 1, padding: 16 },
  profileCard: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    padding: 16, flexDirection: 'row',
    alignItems: 'center', gap: 12, marginBottom: 10,
  },
  profileAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#243C5C',
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarIcon: { fontSize: 22 },
  profileInfo: { flex: 1 },
  profileName: { color: '#F1F5F9', fontSize: 14, fontWeight: '600' },
  profileSub: { color: '#7B9EC5', fontSize: 11 },
  profileDetail: { color: '#4A90D9', fontSize: 11 },
  caseBanner: {
    backgroundColor: '#EFF6FF', borderRadius: 8,
    padding: 10, marginBottom: 14,
    borderWidth: 0.5, borderColor: '#BFDBFE',
  },
  caseBannerText: { color: '#1D4ED8', fontSize: 11, fontWeight: '500' },
  caseBannerSub: { color: '#3B82F6', fontSize: 10 },
  caseBannerArrow: { color: '#1D4ED8', fontSize: 12, position: 'absolute', right: 12, top: 10 },
  sectionTitle: {
    fontSize: 10, fontWeight: '500', color: '#94A3B8',
    letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
  },
  caseCard: {
    backgroundColor: '#FFFFFF', borderRadius: 10,
    flexDirection: 'row', marginBottom: 8, overflow: 'hidden',
  },
  caseCardBar: { width: 4 },
  caseCardBody: { flex: 1, padding: 12, gap: 6 },
  caseCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDanger: { backgroundColor: '#FEE2E2', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2 },
  badgeDangerText: { color: '#991B1B', fontSize: 10 },
  badgeSuccess: { backgroundColor: '#DCFCE7', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2 },
  badgeSuccessText: { color: '#166534', fontSize: 10 },
  caseCardTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A', flex: 1 },
  caseDate: { fontSize: 10, color: '#94A3B8' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 10, color: '#64748B' },
  progressValue: { fontSize: 10, color: '#3B7DD8' },
  progressBar: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#3B7DD8' },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  checkDone: { fontSize: 10, color: '#16A34A', width: '48%' },
  checkTodo: { fontSize: 10, color: '#94A3B8', width: '48%' },
  evidenceRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  evidenceCard: {
    flex: 1, borderRadius: 8, padding: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  evidenceNum: { fontSize: 18, fontWeight: '600' },
  evidenceLabel: { fontSize: 9 },
  timelineBtn: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8,
    padding: 6, alignItems: 'center', justifyContent: 'center',
  },
  timelineBtnText: { fontSize: 9, color: '#3B7DD8', textAlign: 'center' },
  caseMeta: { fontSize: 10, color: '#64748B' },
  caseCardNew: {
    backgroundColor: '#F8FAFC', borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
    padding: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginBottom: 10,
  },
  caseCardNewPlus: { fontSize: 20, color: '#CBD5E1' },
  caseCardNewText: { fontSize: 12, color: '#94A3B8' },
  deadman: {
    backgroundColor: '#0F1F3D', borderRadius: 10,
    padding: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  deadmanLeft: { flex: 1 },
  deadmanTitle: { color: '#F87171', fontSize: 12, fontWeight: '600' },
  deadmanSub: { color: '#4A6FA5', fontSize: 10 },
  deadmanContact: { color: '#4A6FA5', fontSize: 10, marginTop: 2 },
  deadmanChange: { color: '#3B7DD8', fontSize: 10, marginTop: 4 },
  toggleOn: {
    backgroundColor: '#3B7DD8', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  toggleCircle: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF' },
  toggleText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' },
  navbar: {
  flexDirection: 'row',
  backgroundColor: '#FFFFFF',
  borderTopWidth: 0.5,
  borderTopColor: '#E2E8F0',
  paddingVertical: 8,
  paddingHorizontal: 8,
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
},
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  navItemActive: {
    backgroundColor: '#0F1F3D', borderRadius: 8,
    paddingVertical: 6,
  },
  navIcon: { fontSize: 20 },
  navIconActive: { fontSize: 20 },
  navLabel: { fontSize: 10, color: '#94A3B8' },
  navLabelActive: { fontSize: 10, color: '#FFFFFF', fontWeight: '500' },
});