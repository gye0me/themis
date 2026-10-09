import { useContext, useEffect, useRef, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Modal, FlatList, Linking,
  TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import {
  getChatRoomMeta, subscribeToMessages, subscribeToMembers, sendMessage, leaveRoom,
  shareCaseReportInRoom,
} from '../services/chatService';
import { getCasesByUser } from '../services/firebaseService';
import { BackHeader } from '../components/BackHeader';
import { C } from '../theme/tokens';

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
  // 1:1 DM방인지 — getOrCreateDirectRoom이 만드는 roomId는 항상 "dm-" 접두사를 쓴다.
  // DM방에서만 "보고서 보내기"를 노출한다(법학 교수님 피드백: 1:1은 파일 전송 가능).
  const isDirect = roomId?.startsWith('dm-') ?? false;

  const [messages, setMessages] = useState([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const [reportPickerVisible, setReportPickerVisible] = useState(false);
  const [myCases, setMyCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [sendingReportCaseId, setSendingReportCaseId] = useState(null);

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

  const handleLeaveRoom = () => {
    if (!roomId || !user) return;

    const doLeave = async () => {
      try {
        await leaveRoom(roomId, user.uid);
        navigation.goBack();
      } catch (err) {
        console.error('채팅방 나가기 오류:', err);
        Alert.alert('오류', '채팅방을 나가지 못했습니다.');
      }
    };

    // RN Web은 버튼이 여러 개인 Alert.alert가 제대로 뜨지 않아(이 프로젝트에서 이미
    // NewCaseScreen 등에서 겪은 문제), 웹에서는 window.confirm으로 대체한다.
    if (Platform.OS === 'web') {
      if (window.confirm('이 채팅방에서 나가시겠어요? 다시 들어오려면 재참여해야 해요.')) {
        doLeave();
      }
      return;
    }

    Alert.alert(
      '채팅방 나가기',
      '이 채팅방에서 나가시겠어요? 다시 들어오려면 재참여해야 해요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '나가기', style: 'destructive', onPress: doLeave },
      ]
    );
  };

  const openReportPicker = async () => {
    if (!user) {
      Alert.alert('로그인이 필요해요', '보고서를 보내려면 먼저 로그인해주세요.');
      return;
    }
    // 웹은 PDF 생성이 브라우저 인쇄 대화상자를 거쳐야 해서 자동 업로드가 안 됨 — 폰(네이티브)에서만 지원.
    if (Platform.OS === 'web') {
      Alert.alert('모바일 앱에서 지원', '보고서 보내기는 아직 모바일 앱에서만 사용할 수 있어요.');
      return;
    }
    setReportPickerVisible(true);
    setLoadingCases(true);
    try {
      const cases = await getCasesByUser(user.uid);
      setMyCases(cases);
    } catch (err) {
      console.error('사건 목록 조회 오류:', err);
      Alert.alert('오류', '사건 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingCases(false);
    }
  };

  const handleSendReport = async (caseId) => {
    if (!roomId || !user) return;
    setSendingReportCaseId(caseId);
    try {
      await shareCaseReportInRoom({ roomId, userId: user.uid, userName: displayName, caseId });
      setReportPickerVisible(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      console.error('보고서 전송 오류:', err);
      Alert.alert('전송 실패', err?.message ?? '보고서를 보내지 못했습니다.');
    } finally {
      setSendingReportCaseId(null);
    }
  };

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
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <BackHeader
        title={roomName}
        subtitle={`참여 ${memberCount}명`}
        onBack={() => navigation.goBack()}
        right={
          <View style={styles.headerRightRow}>
            {isDirect && (
              <TouchableOpacity onPress={openReportPicker} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.reportSendBtnText}>📄 보고서 보내기</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleLeaveRoom} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.leaveBtnText}>나가기</Text>
            </TouchableOpacity>
          </View>
        }
      />

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
              const fileCard = msg.file ? (
                <TouchableOpacity
                  style={styles.fileBubble}
                  onPress={() => Linking.openURL(msg.file.url).catch(() => {
                    Alert.alert('오류', '파일을 열지 못했습니다.');
                  })}
                >
                  <Text style={styles.fileBubbleText}>📄 {msg.file.name || '보고서.pdf'}</Text>
                  <Text style={styles.fileBubbleHint}>탭해서 열기</Text>
                </TouchableOpacity>
              ) : null;

              if (isMine) {
                return (
                  <View key={msg.id} style={styles.myMsgRow}>
                    <Text style={styles.msgTime}>{formatTime(msg.createdAt)}</Text>
                    {fileCard ?? (
                      <View style={styles.myBubble}>
                        <Text style={styles.myBubbleText}>{msg.text}</Text>
                      </View>
                    )}
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
                    {fileCard ?? (
                      <View style={styles.otherBubble}>
                        <Text style={styles.otherBubbleText}>{msg.text}</Text>
                      </View>
                    )}
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
          placeholderTextColor={C.ink400}
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

      <Modal visible={reportPickerVisible} animationType="slide" transparent onRequestClose={() => setReportPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>어느 사건의 보고서를 보낼까요?</Text>
            {loadingCases ? (
              <ActivityIndicator color={C.brand600} style={{ marginVertical: 20 }} />
            ) : myCases.length === 0 ? (
              <Text style={styles.pickerEmptyText}>아직 등록된 사건이 없어요.</Text>
            ) : (
              <FlatList
                data={myCases}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerRow}
                    onPress={() => handleSendReport(item.id)}
                    disabled={sendingReportCaseId === item.id}
                  >
                    <Text style={styles.pickerRowText}>{item.title || '이름 없는 사건'}</Text>
                    {sendingReportCaseId === item.id ? (
                      <ActivityIndicator size="small" color={C.brand600} />
                    ) : (
                      <Text style={styles.pickerRowArrow}>›</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setReportPickerVisible(false)}>
              <Text style={styles.pickerCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  leaveBtnText: { color: C.danger600, fontSize: 12.5, fontWeight: '600' },
  reportSendBtnText: { color: C.brand600, fontSize: 12.5, fontWeight: '600' },

  fileBubble: {
    backgroundColor: C.sky050, borderRadius: 14, borderWidth: 1, borderColor: C.line,
    paddingHorizontal: 14, paddingVertical: 10, gap: 2, maxWidth: 220,
  },
  fileBubbleText: { fontSize: 12.5, color: C.ink900, fontWeight: '700' },
  fileBubbleHint: { fontSize: 10, color: C.ink400 },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '70%',
  },
  pickerTitle: { fontSize: 14.5, fontWeight: '700', color: C.ink900, marginBottom: 12 },
  pickerEmptyText: { fontSize: 12.5, color: C.ink400, paddingVertical: 20, textAlign: 'center' },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  pickerRowText: { fontSize: 13.5, color: C.ink900, flex: 1 },
  pickerRowArrow: { fontSize: 16, color: C.ink400 },
  pickerCancelBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  pickerCancelText: { fontSize: 13, color: C.ink500, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: C.ink400, fontSize: 13 },
  errorText: { color: C.danger600, fontSize: 13, paddingHorizontal: 24, textAlign: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: C.ink400, fontSize: 12 },

  chatArea: { flex: 1 },
  chatContent: { padding: 20, gap: 14 },

  dateDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: C.line },
  dateText: { fontSize: 11, color: C.ink400 },

  otherMsgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '78%' },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.sky100,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: C.brand600 },
  senderName: { fontSize: 10.5, color: C.ink400, marginBottom: 2 },
  otherMsgBody: { gap: 3 },
  otherBubble: {
    backgroundColor: C.sky050,
    borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  otherBubbleText: { fontSize: 13, color: C.ink900, lineHeight: 19 },

  myMsgRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'flex-end', gap: 6, alignSelf: 'flex-end', maxWidth: '78%',
  },
  myBubble: {
    backgroundColor: C.ink950,
    borderRadius: 16, borderBottomRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  myBubbleText: { fontSize: 13, color: '#FFFFFF', lineHeight: 19 },

  msgTime: { fontSize: 9.5, color: C.ink400 },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.line,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  input: {
    flex: 1, backgroundColor: C.sky050, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 13, color: C.ink900, maxHeight: 80,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.ink950,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: '#FFFFFF', fontSize: 14 },
});