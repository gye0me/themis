import { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const INITIAL_MESSAGES = [
  {
    id: 1,
    sender: '딱',
    avatarColor: '#DCFCE7',
    avatarTextColor: '#166534',
    text: '혹시 OO구 OO아파트\n집주인한테 당하신 분 계세요?',
    time: '오전 10:21',
    isMine: false,
  },
  {
    id: 2,
    sender: '북',
    avatarColor: '#FEF9C3',
    avatarTextColor: '#854D0E',
    text: '저도! 같은 집주인인지 확인하고\n싶어요. PDF 공유해주실 수 있나요?',
    time: '오전 10:23',
    isMine: false,
  },
  {
    id: 3,
    isFile: true,
    fileName: '사건_타임라인_250305.pdf',
    time: '오전 10:24',
    isMine: true,
  },
  {
    id: 4,
    sender: '북',
    avatarColor: '#FEF9C3',
    avatarTextColor: '#854D0E',
    text: '맞아요! 같은 분이에요.\n집단 고소 같이 진행해요.\n민원 모이면 가중처벌 가능해요.',
    time: '오전 10:25',
    isMine: false,
  },
  {
    id: 5,
    text: '같이 진행하고 싶어요!\n연락처 공유해도 될까요?',
    time: '오전 10:26',
    isMine: true,
  },
];

export function ChatRoomScreen({ navigation, route }) {
  const roomName = route?.params?.roomName ?? '전세사기 피해자 모임';
  const memberCount = route?.params?.memberCount ?? 247;

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    const now = new Date();
    const hour = now.getHours();
    const ampm = hour < 12 ? '오전' : '오후';
    const hour12 = hour % 12 || 12;
    const time = `${ampm} ${hour12}:${String(now.getMinutes()).padStart(2, '0')}`;
    setMessages((prev) => [...prev, { id: prev.length + 1, text, time, isMine: true }]);
    setDraft('');
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
          <Text style={styles.appbarTitle}>피해자 연대</Text>
          <Text style={styles.appbarSub}>같은 피해, 함께 대응</Text>
        </View>
      </View>

      {/* 채팅방 정보 카드 */}
      <View style={styles.roomInfoCard}>
        <View style={styles.roomInfoLeft}>
          <Text style={styles.roomInfoName}>{roomName}</Text>
          <Text style={styles.roomInfoDesc}>같은 집주인 피해자라면 연결 · 집단 고소 진행 가능</Text>
        </View>
        <View style={styles.memberBadge}>
          <Text style={styles.memberBadgeText}>{memberCount}명</Text>
        </View>
      </View>

      <ScrollView
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 날짜 구분선 */}
        <View style={styles.dateDivider}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>2026년 3월 7일</Text>
          <View style={styles.dateLine} />
        </View>

        {/* 메시지 목록 */}
        {messages.map((msg) => {
          if (msg.isMine) {
            return (
              <View key={msg.id} style={styles.myMsgRow}>
                <Text style={styles.msgTime}>{msg.time}</Text>
                {msg.isFile ? (
                  <View style={styles.fileCard}>
                    <View style={styles.fileCardIcon}>
                      <Text style={styles.fileCardIconText}>P</Text>
                    </View>
                    <Text style={styles.fileCardName}>{msg.fileName}</Text>
                  </View>
                ) : (
                  <View style={styles.myBubble}>
                    <Text style={styles.myBubbleText}>{msg.text}</Text>
                  </View>
                )}
              </View>
            );
          }
          return (
            <View key={msg.id} style={styles.otherMsgRow}>
              <View style={[styles.avatar, { backgroundColor: msg.avatarColor }]}>
                <Text style={[styles.avatarText, { color: msg.avatarTextColor }]}>{msg.sender}</Text>
              </View>
              <View style={styles.otherMsgBody}>
                <View style={styles.otherBubble}>
                  <Text style={styles.otherBubbleText}>{msg.text}</Text>
                </View>
                <Text style={styles.msgTime}>{msg.time}</Text>
              </View>
            </View>
          );
        })}

        {/* SOS 카드 */}
        <View style={styles.sosCard}>
          <View style={styles.sosLeft}>
            <Text style={styles.sosTitle}>핫게시판 게시 가능 SOS</Text>
            <Text style={styles.sosDesc}>피해자 10명 이상 모이면 게시 가능</Text>
          </View>
          <View style={styles.sosIconBox}>
            <Text style={styles.sosIcon}>📄</Text>
          </View>
        </View>

        {/* 현재 참여 현황 */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>현재 참여 현황</Text>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>같은 집주인 피해자</Text>
            <Text style={styles.infoCardSub}>표로 10명</Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setConfirmed(true)}>
              <Text style={styles.confirmBtnText}>{confirmed ? '확인됨 ✓' : '3명 확인'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 유사 판례 */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>유사 판례 5건 발견</Text>
          <TouchableOpacity onPress={() => Alert.alert('유사 판례', '판례 상세 화면은 아직 준비 중이에요. 국가법령정보 API 연동 후 제공될 예정입니다.')}>
            <Text style={styles.precedentLink}>비슷한 사례에서 피해자가 승소한 판례를 확인하세요 →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* 메시지 입력창 */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="메시지 입력..."
          placeholderTextColor="#94A3B8"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={sendMessage}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={!draft.trim()}>
          <Text style={styles.sendIcon}>▶</Text>
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
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700' },
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

  fileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10, padding: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
    maxWidth: 220,
  },
  fileCardIcon: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#3B7DD8',
    alignItems: 'center', justifyContent: 'center',
  },
  fileCardIconText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  fileCardName: { fontSize: 12, color: '#0F172A', flex: 1 },

  msgTime: { fontSize: 10, color: '#94A3B8' },

  sosCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#FECACA',
    marginTop: 8,
  },
  sosLeft: { flex: 1 },
  sosTitle: { fontSize: 13, fontWeight: '700', color: '#991B1B', marginBottom: 2 },
  sosDesc: { fontSize: 11, color: '#B91C1C' },
  sosIconBox: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center',
  },
  sosIcon: { fontSize: 18 },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10, padding: 14, gap: 8,
  },
  infoCardTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  infoCardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  infoCardLabel: { fontSize: 12, color: '#475569', flex: 1 },
  infoCardSub: { fontSize: 11, color: '#94A3B8' },
  confirmBtn: {
    backgroundColor: '#EFF6FF', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  confirmBtnText: { fontSize: 11, color: '#1D4ED8', fontWeight: '600' },
  precedentLink: { fontSize: 12, color: '#3B7DD8', lineHeight: 18 },

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
