import { useContext, useEffect, useRef, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { getChatRoomMeta, subscribeToMessages, subscribeToMembers, sendMessage } from '../services/chatService';

function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const hour = date.getHours();
  const ampm = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 || 12;
  return `${ampm} ${hour12}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateLabel(ts) {
  const date = ts ? new Date(ts) : new Date();
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function ChatRoomScreen({ navigation, route }) {
  const { user, profile } = useContext(AuthContext);
  const displayName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '익명';

  const roomId = route?.params?.roomId ?? null;
  const roomMeta = getChatRoomMeta(roomId);
  const roomName = route?.params?.roomName ?? roomMeta?.name ?? '채팅방';

  const [messages, setMessages] = useState([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      setLoadError('채팅방 정보를 찾을 수 없습니다.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    let unsubMessages;
    let unsubMembers;
    try {
      unsubMessages = subscribeToMessages(roomId, (list) => {
        setMessages(list);
        setLoading(false);
      });
      unsubMembers = subscribeToMembers(roomId, (memberIds) => setMemberCount(memberIds.length));
    } catch (err) {
      console.error('채팅방 초기화 오류:', err);
      setLoadError(err?.message ?? '채팅방을 불러오지 못했습니다.');
      setLoading(false);
    }
    return () => {
      unsubMessages?.();
      unsubMembers?.();
    };
  }, [roomId]);

  const sendCurrentDraft = async () => {
    const text = draft.trim();
    if (!text || !roomId) return;
    if (!user) {
      Alert.alert('로그인이 필요해요', '메시지를 보내려면 먼저 로그인해주세요.');
      return;
    }
    setDraft('');
    setSending(true);
    try {
      await sendMessage(roomId, { uid: user.uid, name: displayName, text });
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      console.error('메시지 전송 오류:', err);
      Alert.alert('전송 실패', err?.message ?? '메시지를 보내지 못했습니다.');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* 상태바 */}
      <View style={styles.statusbar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusApp}>Themis</Text>
      </View>

      {/* 앱바 */}
      <View style={styles.appbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.appbarTitle}>{roomName}</Text>
          <Text style={styles.appbarSub}>{roomMeta?.type === 'expert' ? '전문가 채널' : '같은 피해, 함께 대응'}</Text>
        </View>
      </View>

      {/* 채팅방 정보 카드 */}
      <View style={styles.roomInfoCard}>
        <View style={styles.roomInfoLeft}>
          <Text style={styles.roomInfoName}>{roomName}</Text>
          <Text style={styles.roomInfoDesc}>{roomMeta?.description ?? '실시간으로 연결된 채팅방입니다'}</Text>
        </View>
        <View style={styles.memberBadge}>
          <Text style={styles.memberBadgeText}>{memberCount}명</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B7DD8" />
          <Text style={styles.loadingText}>메시지를 불러오는 중...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {/* 날짜 구분선 */}
          <View style={styles.dateDivider}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDateLabel(messages[0]?.createdAt)}</Text>
            <View style={styles.dateLine} />
          </View>

          {messages.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>아직 메시지가 없어요. 첫 메시지를 보내보세요!</Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === user?.uid;
              if (isMine) {
                return (
                  <View key={msg.id} style={styles.myMsgRow}>
                    <Text style={styles.msgTime}>{formatTime(msg.createdAt)}</Text>
                    <View style={styles.myBubble}>
                      <Text style={styles.myBubbleText}>{msg.text}</Text>
                    </View>
                  </View>
                );
              }
              const initial = (msg.senderName || '?').trim().charAt(0) || '?';
              return (
                <View key={msg.id} style={styles.otherMsgRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={styles.otherMsgBody}>
                    <Text style={styles.senderName}>{msg.senderName}</Text>
                    <View style={styles.otherBubble}>
                      <Text style={styles.otherBubbleText}>{msg.text}</Text>
                    </View>
                    <Text style={styles.msgTime}>{formatTime(msg.createdAt)}</Text>
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 16 }} />
        </ScrollView>
      )}

      {/* 메시지 입력창 */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="메시지 입력..."
          placeholderTextColor="#94A3B8"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={sendCurrentDraft}
          multiline
          editable={!sending}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendCurrentDraft} disabled={!draft.trim() || sending}>
          {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.sendIcon}>▶</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 12, paddingHorizontal: 16, paddingTop: 6,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  backBtn: { paddingRight: 4 },
  backIcon: { color: '#FFFFFF', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  appbarTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  appbarSub: { color: '#7B9EC5', fontSize: 11 },

  roomInfoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 10, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  roomInfoLeft: { flex: 1 },
  roomInfoName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  roomInfoDesc: { fontSize: 11, color: '#64748B' },
  memberBadge: {
    backgroundColor: '#0F1F3D', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  memberBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#94A3B8', fontSize: 13 },
  errorText: { color: '#DC2626', fontSize: 13, paddingHorizontal: 24, textAlign: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#94A3B8', fontSize: 12 },

  chatArea: { flex: 1 },
  chatContent: { padding: 16, gap: 12 },

  dateDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dateText: { fontSize: 11, color: '#94A3B8' },

  otherMsgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#1E3A5F' },
  senderName: { fontSize: 10, color: '#94A3B8', marginBottom: 2 },
  otherMsgBody: { gap: 2 },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12, borderBottomLeftRadius: 2,
    paddingHorizontal: 12, paddingVertical: 8,
    maxWidth: 240,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2, elevation: 1,
  },
  otherBubbleText: { fontSize: 13, color: '#0F172A', lineHeight: 19 },

  myMsgRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'flex-end', gap: 6,
  },
  myBubble: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12, borderBottomRightRadius: 2,
    paddingHorizontal: 12, paddingVertical: 8,
    maxWidth: 240,
  },
  myBubbleText: { fontSize: 13, color: '#FFFFFF', lineHeight: 19 },

  msgTime: { fontSize: 10, color: '#94A3B8' },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5, borderTopColor: '#E2E8F0',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  input: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 13, color: '#0F172A', maxHeight: 80,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0F1F3D',
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: '#FFFFFF', fontSize: 14 },
});