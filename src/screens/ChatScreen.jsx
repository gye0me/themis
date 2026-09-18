import { useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHAT_ROUTES } from '../navigation/routes';
import { AuthContext } from '../context/AuthContext';
import { CHAT_ROOMS, joinRoom, subscribeToRoomMeta, subscribeToMembers } from '../services/chatService';
import { ScreenTopBar } from '../components/ScreenTopBar';
import { BottomNavBar } from '../components/BottomNavBar';
import { C } from '../theme/tokens';

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
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <ScreenTopBar title="연대 채팅" subtitle="같은 피해를 겪은 사람들, 전문가와 연결돼요" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 검색바 */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="채팅방 검색"
            placeholderTextColor={C.ink400}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* 추천 피해방 */}
        <Text style={styles.sectionTitle}>피해자 연대방</Text>

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

        {/* 전문가 채널 */}
        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>전문가 채널</Text>
        <View style={styles.rowGroup}>
          {expertRooms.map((room, i) => (
            <TouchableOpacity
              key={room.id}
              style={[styles.row, i === 0 && styles.rowFirst]}
              onPress={() => enterRoom(room)}
            >
              <View style={[styles.roomIcon, { backgroundColor: room.color }]}>
                <Text style={styles.roomIconText}>{room.icon}</Text>
              </View>
              <View style={styles.roomInfo}>
                <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
                <Text style={styles.roomDesc} numberOfLines={1}>{room.description}</Text>
              </View>
              <Text style={styles.expertArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 참여 중인 방 */}
        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>참여 중인 방</Text>
        {joinedRooms.length === 0 ? (
          <Text style={styles.noJoinedText}>아직 참여한 방이 없어요. 위에서 방을 선택해 참여해보세요.</Text>
        ) : (
          <View style={styles.rowGroup}>
            {joinedRooms.map((room, i) => {
              const meta = roomMeta[room.id];
              return (
                <TouchableOpacity
                  key={room.id}
                  style={[styles.row, i === 0 && styles.rowFirst]}
                  onPress={() => navigation.navigate(CHAT_ROUTES.ROOM, { roomId: room.id, roomName: room.name })}
                >
                  <View style={[styles.chatAvatar, { backgroundColor: room.color }]}>
                    <Text style={styles.chatAvatarText}>{room.icon}</Text>
                  </View>
                  <View style={styles.roomInfo}>
                    <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
                    <Text style={styles.roomDesc} numberOfLines={1}>
                      {meta?.lastMessage || '아직 메시지가 없어요'}
                    </Text>
                  </View>
                  {meta?.lastMessageAt ? (
                    <Text style={styles.chatTime}>{formatRelativeTime(meta.lastMessageAt)}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNavBar active="chats" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },

  searchBar: {
    backgroundColor: C.sky050,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  searchIcon: { fontSize: 13 },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: C.ink900,
    padding: 0,
  },

  content: { flex: 1, padding: 20 },

  sectionTitle: {
    fontSize: 12.5, fontWeight: '700', color: C.ink500, marginBottom: 12,
  },

  roomCard: {
    backgroundColor: C.sky050,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  roomCardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  roomIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  roomIconText: { fontSize: 17 },
  roomInfo: { flex: 1, minWidth: 0 },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  roomName: { fontSize: 13.5, fontWeight: '700', color: C.ink900 },
  victimBadgeRed: {
    backgroundColor: C.sky100, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  victimBadgeRedText: { color: C.brand600, fontSize: 10, fontWeight: '700' },
  roomDesc: { fontSize: 11.5, color: C.ink500, lineHeight: 16 },
  joinBtn: {
    backgroundColor: C.brand600,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  joinBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  createRoomBtn: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.line,
    borderStyle: 'dashed',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  createRoomIcon: { fontSize: 16, color: C.brand600, fontWeight: '700' },
  createRoomText: { fontSize: 12.5, color: C.brand600, fontWeight: '700' },

  rowGroup: { backgroundColor: C.surface },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.line,
  },
  rowFirst: { borderTopWidth: 0 },
  expertArrow: { fontSize: 18, color: C.ink400 },

  noJoinedText: { fontSize: 12, color: C.ink400, paddingVertical: 8 },

  chatAvatar: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarText: { fontSize: 16, fontWeight: '700', color: C.brand700 },
  chatTime: { fontSize: 10.5, color: C.ink400, flexShrink: 0 },
});