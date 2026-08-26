import { useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_ROUTES, CHAT_ROUTES } from '../navigation/routes';
import { AuthContext } from '../context/AuthContext';
import { CHAT_ROOMS, joinRoom, subscribeToRoomMeta, subscribeToMembers } from '../services/chatService';

function formatRelativeTime(ts) {
  if (!ts) return null;
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const date = new Date(ts);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

export function ChatScreen({ navigation }) {
  const { user, profile } = useContext(AuthContext);
  const displayName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '익명';

  const [search, setSearch] = useState('');
  const [roomMeta, setRoomMeta] = useState({}); // { [roomId]: { lastMessage, lastMessageAt } }
  const [roomMembers, setRoomMembers] = useState({}); // { [roomId]: string[] }
  const [joining, setJoining] = useState(null);

  useEffect(() => {
    const unsubscribers = CHAT_ROOMS.flatMap((room) => [
      subscribeToRoomMeta(room.id, (meta) => {
        setRoomMeta((prev) => ({ ...prev, [room.id]: meta }));
      }),
      subscribeToMembers(room.id, (memberIds) => {
        setRoomMembers((prev) => ({ ...prev, [room.id]: memberIds }));
      }),
    ]);
    return () => unsubscribers.forEach((unsub) => unsub?.());
  }, []);

  function matchesSearch(room, term) {
    if (!term.trim()) return true;
    const t = term.trim().toLowerCase();
    return room.name.toLowerCase().includes(t) || room.description.toLowerCase().includes(t);
  }

  const victimRooms = useMemo(
    () => CHAT_ROOMS.filter((r) => r.type === 'victim' && matchesSearch(r, search)),
    [search],
  );
  const expertRooms = useMemo(
    () => CHAT_ROOMS.filter((r) => r.type === 'expert' && matchesSearch(r, search)),
    [search],
  );
  const joinedRooms = useMemo(
    () => CHAT_ROOMS.filter((r) => (roomMembers[r.id] ?? []).includes(user?.uid)),
    [roomMembers, user],
  );

  async function enterRoom(room) {
    if (!user) {
      Alert.alert('로그인이 필요해요', '채팅방에 참여하려면 먼저 로그인해주세요.');
      return;
    }
    try {
      setJoining(room.id);
      const alreadyJoined = (roomMembers[room.id] ?? []).includes(user.uid);
      if (!alreadyJoined) {
        await joinRoom(room.id, user.uid, displayName);
      }
      navigation.navigate(CHAT_ROUTES.ROOM, {
        roomId: room.id,
        roomName: room.name,
      });
    } catch (err) {
      console.error('채팅방 참여 오류:', err);
      Alert.alert('입장 실패', err?.message ?? '채팅방에 참여하지 못했습니다.');
    } finally {
      setJoining(null);
    }
  }

  function memberCountOf(room) {
    return (roomMembers[room.id] ?? []).length;
  }

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
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 추천 피해방 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>추천 피해방</Text>
        </View>

        {victimRooms.map((room) => (
          <View key={room.id} style={styles.roomCard}>
            <View style={styles.roomCardTop}>
              <View style={[styles.roomIcon, { backgroundColor: room.color }]}>
                <Text style={styles.roomIconText}>{room.icon}</Text>
              </View>
              <View style={styles.roomInfo}>
                <View style={styles.roomTitleRow}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <View style={styles.victimBadgeRed}>
                    <Text style={styles.victimBadgeRedText}>참여 {memberCountOf(room)}명</Text>
                  </View>
                </View>
                <Text style={styles.roomDesc}>{room.description}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => enterRoom(room)}
              disabled={joining === room.id}
            >
              <Text style={styles.joinBtnText}>
                {joining === room.id
                  ? '입장 중...'
                  : (roomMembers[room.id] ?? []).includes(user?.uid)
                    ? '참여 중 ✓'
                    : '참여하기'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

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

        {/* 전문가 채널 */}
        <Text style={styles.sectionTitle}>전문가 채널</Text>
        {expertRooms.map((room) => (
          <TouchableOpacity key={room.id} style={styles.expertCard} onPress={() => enterRoom(room)}>
            <View style={[styles.roomIcon, { backgroundColor: room.color }]}>
              <Text style={styles.roomIconText}>{room.icon}</Text>
            </View>
            <View style={styles.roomInfo}>
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.roomDesc}>{room.description}</Text>
            </View>
            <Text style={styles.expertArrow}>→</Text>
          </TouchableOpacity>
        ))}

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 참여 중인 방 */}
        <Text style={styles.sectionTitle}>참여 중인 방</Text>
        {joinedRooms.length === 0 ? (
          <Text style={styles.noJoinedText}>아직 참여한 방이 없어요. 위에서 방을 선택해 참여해보세요.</Text>
        ) : (
          joinedRooms.map((room) => {
            const meta = roomMeta[room.id];
            return (
              <TouchableOpacity
                key={room.id}
                style={styles.chatItem}
                onPress={() => navigation.navigate(CHAT_ROUTES.ROOM, { roomId: room.id, roomName: room.name })}
              >
                <View style={[styles.chatAvatar, { backgroundColor: room.color }]}>
                  <Text style={styles.chatAvatarText}>{room.icon}</Text>
                </View>
                <View style={styles.chatContent}>
                  <View style={styles.chatTop}>
                    <Text style={styles.chatRoomName}>{room.name}</Text>
                    {meta?.lastMessageAt ? (
                      <Text style={styles.chatTime}>{formatRelativeTime(meta.lastMessageAt)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.chatBottom}>
                    <Text style={styles.chatLastMsg} numberOfLines={1}>
                      {meta?.lastMessage || '아직 메시지가 없어요'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

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
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },

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

  expertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expertArrow: { fontSize: 14, color: '#94A3B8' },

  noJoinedText: { fontSize: 12, color: '#94A3B8', paddingVertical: 8 },

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