import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_ROUTES } from '../navigation/routes';

export function ExpertScreen({ navigation }) {
  const [adoptedId, setAdoptedId] = useState(null);

  return (
    <SafeAreaView style={styles.wrapper}>
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
          <Text style={styles.appbarTitle}>전문가 연결</Text>
          <Text style={styles.appbarSub}>사건별 공유하고 답변 받기</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 지금 주목받는 사건 */}
        <Text style={styles.sectionTitle}>지금 주목받는 사건</Text>

        {/* 핫 케이스 1 */}
        <TouchableOpacity
          style={styles.hotCard}
          onPress={() => Alert.alert('전세보증금 미반환 — 강남구 집중', '같은 집주인에게 피해를 입은 사람이 많습니다. 전문가 12명 · 제보 3건 · 집단 고소 준비 중\n\n상세 페이지는 아직 준비 중이에요.')}
        >
          <View style={styles.hotCardHeader}>
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>🔥 HOT</Text>
            </View>
            <Text style={styles.hotCardTitle}>전세보증금 미반환 — 강남구 집중</Text>
            <View style={styles.victimBadgeRed}>
              <Text style={styles.victimBadgeRedText}>피해자 47명</Text>
            </View>
          </View>
          <Text style={styles.hotCardDesc}>같은 집주인에게 피해를 입은 사람이 많습니다. 전문인 12명 · 제보 3건 · 집단 고소 준비 중</Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Text style={styles.tagText}>변호사</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>기자</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>부동산중개사</Text></View>
          </View>
        </TouchableOpacity>

        {/* 핫 케이스 2 */}
        <TouchableOpacity
          style={[styles.hotCard, { borderLeftColor: '#F97316' }]}
          onPress={() => Alert.alert('프리랜서 대금 미지급 — IT 업계', '의뢰인으로부터 대금을 받지 못한 프리랜서들이 모이고 있습니다.\n\n상세 페이지는 아직 준비 중이에요.')}
        >
          <View style={styles.hotCardHeader}>
            <View style={[styles.hotBadge, { backgroundColor: '#FFF7ED' }]}>
              <Text style={[styles.hotBadgeText, { color: '#C2410C' }]}>금상승</Text>
            </View>
            <Text style={styles.hotCardTitle}>프리랜서 대금 미지급 — IT 업계</Text>
            <View style={[styles.victimBadgeRed, { backgroundColor: '#FFF7ED' }]}>
              <Text style={[styles.victimBadgeRedText, { color: '#C2410C' }]}>피해자 23명</Text>
            </View>
          </View>
          <Text style={styles.hotCardDesc}>의뢰인으로부터 대금을 받지 못한 프리랜서들이 모이고 있습니다.</Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Text style={styles.tagText}>변호사</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>공익법무관</Text></View>
          </View>
        </TouchableOpacity>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 일반 게시판 */}
        <Text style={styles.sectionTitle}>일반 게시판</Text>

        {/* 게시글 1 */}
        <View style={styles.postCard}>
          <View style={styles.postTop}>
            <View style={styles.avatarBlue}>
              <Text style={styles.avatarText}>김</Text>
            </View>
            <View style={styles.postMeta}>
              <Text style={styles.postAuthor}>김현탄</Text>
              <Text style={styles.postTime}>30분 전</Text>
            </View>
            <View style={styles.answerWaitBadge}>
              <Text style={styles.answerWaitText}>답변 대기 중</Text>
            </View>
          </View>
          <Text style={styles.postTitle}>스토킹 피해 — 경찰 신고 절차가 궁금합니다</Text>
          <Text style={styles.postBody}>6개월쯤 전 앞에 나타나는 사람이 있습니다. 타임라인 기록해뒀는데 어떻게 신고해야 하나요?</Text>
          <View style={styles.fileAttach}>
            <Text style={styles.fileIcon}>📄</Text>
            <Text style={styles.fileName}>증거_타임라인_250307.pdf</Text>
          </View>
          <Text style={styles.waitingText}>전문가 답변을 기다리고 있어요</Text>
        </View>

        {/* 게시글 2 */}
        <View style={styles.postCard}>
          <View style={styles.postTop}>
            <View style={styles.avatarGray}>
              <Text style={styles.avatarText}>박</Text>
            </View>
            <View style={styles.postMeta}>
              <Text style={styles.postAuthor}>박덕새</Text>
              <Text style={styles.postTime}>1시간 전</Text>
            </View>
            <View style={styles.answerCountBadge}>
              <Text style={styles.answerCountText}>답변 3개</Text>
            </View>
          </View>
          <Text style={styles.postTitle}>보증금 미반환 — 어떻게 대응해야 하나요?</Text>
          <Text style={styles.postBody}>3월부터 집주인 연락 두절입니다. 증거 기록해뒀는데 다음 절차가 궁금합니다.</Text>
          <View style={styles.fileAttach}>
            <Text style={styles.fileIcon}>📄</Text>
            <Text style={styles.fileName}>사건_타임라인_250305.pdf</Text>
          </View>
        </View>

        {/* 김변호사 답변 알림 */}
        <View style={styles.lawyerNotice}>
          <View style={styles.lawyerLeft}>
            <View style={styles.avatarGreen}>
              <Text style={styles.avatarText}>김</Text>
            </View>
            <View>
              <Text style={styles.lawyerName}>김변호사</Text>
              <Text style={styles.lawyerRole}>일반직 전문</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.selectBtn, adoptedId === 'lawyer1' && styles.selectBtnDone]}
            onPress={() => setAdoptedId((v) => (v === 'lawyer1' ? null : 'lawyer1'))}
          >
            <Text style={styles.selectBtnText}>{adoptedId === 'lawyer1' ? '채택됨 ✓' : '채택하기'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={styles.bottomButtonArea}>
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => navigation.navigate('ExpertQuestion')}
        >
          <Text style={styles.bottomButtonText}>내 타임라인 올리고 질문하기</Text>
        </TouchableOpacity>
      </View>

      {/* 네비바 */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK)}
        >
          <Text style={styles.navIcon}>✏️</Text>
          <Text style={styles.navLabel}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabelActive}>전문가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.CHATS_STACK)}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>채팅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.HOME_STACK)}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>홈</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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

  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: '#64748B',
    letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase',
  },

  hotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  hotCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  hotBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hotBadgeText: { color: '#991B1B', fontSize: 10, fontWeight: '700' },
  hotCardTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: '#0F172A' },
  victimBadgeRed: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  victimBadgeRedText: { color: '#991B1B', fontSize: 10, fontWeight: '600' },
  hotCardDesc: { fontSize: 11, color: '#64748B', marginBottom: 8, lineHeight: 16 },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 10, color: '#475569' },

  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },

  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  postTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatarBlue: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarGray: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarGreen: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '600', color: '#1E3A5F' },
  postMeta: { flex: 1 },
  postAuthor: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  postTime: { fontSize: 10, color: '#94A3B8' },
  answerWaitBadge: {
    backgroundColor: '#FFF7ED', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  answerWaitText: { fontSize: 10, color: '#C2410C' },
  answerCountBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  answerCountText: { fontSize: 10, color: '#1D4ED8' },
  postTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 4 },
  postBody: { fontSize: 11, color: '#64748B', lineHeight: 16, marginBottom: 8 },
  fileAttach: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F8FAFC', borderRadius: 6, padding: 8,
  },
  fileIcon: { fontSize: 14 },
  fileName: { fontSize: 11, color: '#475569' },
  waitingText: { fontSize: 10, color: '#94A3B8', marginTop: 8 },

  lawyerNotice: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  lawyerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lawyerName: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  lawyerRole: { fontSize: 10, color: '#64748B' },
  selectBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  selectBtnDone: { backgroundColor: '#16A34A' },
  selectBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },

  bottomButtonArea: {
    position: 'absolute',
    bottom: 82,
    left: 16,
    right: 16,
  },
  bottomButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  navbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    paddingBottom: 18,
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  navItemActive: {
    backgroundColor: '#0F1F3D', borderRadius: 10, paddingVertical: 9,
  },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 11, color: '#94A3B8' },
  navLabelActive: { fontSize: 11, color: '#FFFFFF', fontWeight: '500' },
});
