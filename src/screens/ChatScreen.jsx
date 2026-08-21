import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_ROUTES, CHAT_ROUTES } from '../navigation/routes';

const ROOMS = [
  { id: 'jeonse', name: '강남구 전세사기 피해자', members: 247, color: '#1E3A5F' },
  { id: 'stalking', name: '스토킹 피해자 지원', members: 23, color: '#7C3AED' },
  { id: 'harass', name: '직장 내 괴롭힘 피해자', members: 18, color: '#EA580C' },
];

export function ChatScreen({ navigation }) {
  const [joined, setJoined] = useState({});

  const joinRoom = (room) => {
    setJoined((prev) => ({ ...prev, [room.id]: true }));
    navigation.navigate(CHAT_ROUTES.ROOM, { roomName: room.name, memberCount: room.members });
  };

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
          <Text style={styles.appbarTitle}>피해자 연대</Text>
          <Text style={styles.appbarSub}>같은 피해, 함께 대응</Text>
        </View>
      </View>

      {/* 검색바 */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="피해 유형 또는 지역 검색"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 추천 피해방 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>추천 피해방</Text>
          <TouchableOpacity onPress={() => Alert.alert('추천 피해방', '지금은 이 3개 방이 전부예요. 새로운 방이 열리면 여기 더 추가될 예정입니다.')}>
            <Text style={styles.seeAll}>전체 보기 →</Text>
          </TouchableOpacity>
        </View>

        {/* 피해방 카드 1 */}
        <View style={styles.roomCard}>
          <View style={styles.roomCardTop}>
            <View style={[styles.roomIcon, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.roomIconText}>🏠</Text>
            </View>
            <View style={styles.roomInfo}>
              <View style={styles.roomTitleRow}>
                <Text style={styles.roomName}>강남구 전세사기 피해자</Text>
                <View style={styles.victimBadgeRed}>
                  <Text style={styles.victimBadgeRedText}>피해자 47명</Text>
                </View>
              </View>
              <Text style={styles.roomDesc}>같은 집주인에게 사례 다수 · 집단 고소 준비</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.joinBtn} onPress={() => joinRoom(ROOMS[0])}>
            <Text style={styles.joinBtnText}>{joined.jeonse ? '참여 중 ✓' : '참여하기'}</Text>
          </TouchableOpacity>
        </View>

        {/* 피해방 카드 2 */}
        <View style={styles.roomCard}>
          <View style={styles.roomCardTop}>
            <View style={[styles.roomIcon, { backgroundColor: '#F3E8FF' }]}>
              <Text style={styles.roomIconText}>🛡️</Text>
            </View>
            <View style={styles.roomInfo}>
              <View style={styles.roomTitleRow}>
                <Text style={styles.roomName}>스토킹 피해자 지원</Text>
                <View style={[styles.victimBadgeRed, { backgroundColor: '#F3E8FF' }]}>
                  <Text style={[styles.victimBadgeRedText, { color: '#7C3AED' }]}>피해자 23명</Text>
                </View>
              </View>
              <Text style={styles.roomDesc}>피해자 지원센터 연결 · 법적 대응 공유</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.joinBtn, { backgroundColor: '#7C3AED' }]} onPress={() => joinRoom(ROOMS[1])}>
            <Text style={styles.joinBtnText}>{joined.stalking ? '참여 중 ✓' : '참여하기'}</Text>
          </TouchableOpacity>
        </View>

        {/* 피해방 카드 3 */}
        <View style={styles.roomCard}>
          <View style={styles.roomCardTop}>
            <View style={[styles.roomIcon, { backgroundColor: '#FFF7ED' }]}>
              <Text style={styles.roomIconText}>💼</Text>
            </View>
            <View style={styles.roomInfo}>
              <View style={styles.roomTitleRow}>
                <Text style={styles.roomName}>직장 내 괴롭힘 피해자</Text>
                <View style={[styles.victimBadgeRed, { backgroundColor: '#FFF7ED' }]}>
                  <Text style={[styles.victimBadgeRedText, { color: '#C2410C' }]}>피해자 18명</Text>
                </View>
              </View>
              <Text style={styles.roomDesc}>증거 수집 방법 공유 · 노동청 신고 안내</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.joinBtn, { backgroundColor: '#EA580C' }]} onPress={() => joinRoom(ROOMS[2])}>
            <Text style={styles.joinBtnText}>{joined.harass ? '참여 중 ✓' : '참여하기'}</Text>
          </TouchableOpacity>
        </View>

        {/* 새 피해자 모임 만들기 */}
        <TouchableOpacity
          style={styles.createRoomBtn}
          onPress={() => Alert.alert('새 피해자 모임 만들기', '모임 개설 기능은 아직 준비 중이에요. 조금만 기다려주세요!')}
        >
          <Text style={styles.createRoomIcon}>+</Text>
          <Text style={styles.createRoomText}>새 피해자 모임 만들기</Text>
        </TouchableOpacity>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 참여 중인 방 */}
        <Text style={styles.sectionTitle}>참여 중인 방</Text>

        {/* 채팅방 1 */}
        <TouchableOpacity
          style={styles.chatItem}
          onPress={() => navigation.navigate(CHAT_ROUTES.ROOM, {
            roomName: '전세사기 피해자 모임',
            memberCount: 247,
          })}
        >
          <View style={[styles.chatAvatar, { backgroundColor: '#FEE2E2' }]}>
            <Text style={styles.chatAvatarText}>김</Text>
          </View>
          <View style={styles.chatContent}>
            <View style={styles.chatTop}>
              <Text style={styles.chatRoomName}>김OO 전세사기 피해자 모임</Text>
              <Text style={styles.chatTime}>오전 10:25</Text>
            </View>
            <View style={styles.chatBottom}>
              <Text style={styles.chatLastMsg} numberOfLines={1}>첨단: PDF 공유해주실 수 있나요?</Text>
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>1</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* 채팅방 2 */}
        <TouchableOpacity
          style={styles.chatItem}
          onPress={() => navigation.navigate(CHAT_ROUTES.ROOM, {
            roomName: '프리랜서 계약 피해자',
            memberCount: 23,
          })}
        >
          <View style={[styles.chatAvatar, { backgroundColor: '#EFF6FF' }]}>
            <Text style={styles.chatAvatarText}>프</Text>
          </View>
          <View style={styles.chatContent}>
            <View style={styles.chatTop}>
              <Text style={styles.chatRoomName}>프리랜서 계약 피해자</Text>
              <Text style={styles.chatTime}>어제</Text>
            </View>
            <View style={styles.chatBottom}>
              <Text style={styles.chatLastMsg} numberOfLines={1}>딱다: 내용증명 발송했어요</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* 네비바 */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK)}>
          <Text style={styles.navIcon}>✏️</Text>
          <Text style={styles.navLabel}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.EXPERTS_STACK)}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>전문가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabelActive}>채팅</Text>
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
    paddingTop: 12, paddingHorizontal: 16, paddingBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  statusTime: { color: '#6B84A8', fontSize: 12 },
  statusApp: { color: '#6B84A8', fontSize: 12 },

  appbar: {
    backgroundColor: '#1E3A5F',
    paddingBottom: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  appbarLogo: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: '#3B7DD8',
    alignItems: 'center', justifyContent: 'center',
  },
  appbarLogoText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  appbarTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  appbarSub: { color: '#7B9EC5', fontSize: 11 },

  searchWrapper: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    backgroundColor: '#0F1F3D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#F1F5F9',
    padding: 0,
  },

  content: { flex: 1, padding: 16 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: '#64748B',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  seeAll: { fontSize: 11, color: '#3B7DD8', fontWeight: '500' },

  roomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  roomCardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  roomIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  roomIconText: { fontSize: 18 },
  roomInfo: { flex: 1 },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  roomName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  victimBadgeRed: {
    backgroundColor: '#FEE2E2', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  victimBadgeRedText: { color: '#991B1B', fontSize: 10, fontWeight: '600' },
  roomDesc: { fontSize: 11, color: '#64748B', lineHeight: 16 },
  joinBtn: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  joinBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  createRoomBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  createRoomIcon: { fontSize: 18, color: '#CBD5E1' },
  createRoomText: { fontSize: 12, color: '#94A3B8' },

  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },

  chatItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  chatAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarText: { fontSize: 16, fontWeight: '700', color: '#1E3A5F' },
  chatContent: { flex: 1 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatRoomName: { fontSize: 13, fontWeight: '600', color: '#0F172A', flex: 1 },
  chatTime: { fontSize: 10, color: '#94A3B8' },
  chatBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatLastMsg: { fontSize: 11, color: '#64748B', flex: 1 },
  unreadBadge: {
    backgroundColor: '#EF4444', borderRadius: 10,
    width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6,
  },
  unreadText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  navbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingVertical: 14, paddingHorizontal: 8, paddingBottom: 18,
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