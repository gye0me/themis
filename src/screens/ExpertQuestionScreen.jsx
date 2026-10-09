import { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { createExpertPost } from '../services/expertBoardService';
import { BackHeader } from '../components/BackHeader';
import { C } from '../theme/tokens';

export default function ExpertQuestionScreen({ navigation }) {
  const { user, profile } = useContext(AuthContext);
  const authorName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '익명';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('알림', '제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('알림', '내용을 입력해주세요.');
      return;
    }
    if (!user) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }
    setSubmitting(true);
    try {
      await createExpertPost({
        userId: user.uid,
        authorName,
        title,
        content,
        isAnonymous,
      });
      Alert.alert('등록 완료', '질문이 등록되었습니다!');
      navigation.goBack();
    } catch (err) {
      console.error('질문 등록 오류:', err);
      Alert.alert('오류', '질문 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <BackHeader
        title="질문 등록"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator size="small" color={C.brand600} /> : <Text style={styles.submit}>등록</Text>}
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content}>
        {/* 제목 */}
        <TextInput
          style={styles.titleInput}
          placeholder="제목을 입력해주세요"
          placeholderTextColor={C.ink400}
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.divider} />

        {/* 내용 */}
        <TextInput
          style={styles.contentInput}
          placeholder="전문가에게 질문할 내용을 입력해주세요"
          placeholderTextColor={C.ink400}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.divider} />

        {/* 익명 게시 */}
        <TouchableOpacity style={styles.anonRow} onPress={() => setIsAnonymous((v) => !v)} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={styles.anonLabel}>🙈 익명으로 올리기</Text>
            <Text style={styles.anonSub}>켜면 닉네임 대신 "익명 작성자"로 표시돼요</Text>
          </View>
          <View style={isAnonymous ? styles.checkboxOn : styles.checkboxOff}>
            {isAnonymous ? <Text style={styles.checkboxCheck}>✓</Text> : null}
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.disclaimer}>
          본 질문은 전문가 채널에 공개됩니다. 가해자·피해자의 실명 등 개인정보는 쓰지 말고
          "OO 사건"처럼 사건 내용 중심으로 적어주세요. 특정인이 식별되면 명예훼손 등 법적 책임이 생길 수 있어요.
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  submit: { color: C.brand600, fontSize: 14, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 20 },
  titleInput: { fontSize: 16, color: C.ink900, paddingVertical: 16, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.line },
  contentInput: { fontSize: 14, color: C.ink900, paddingVertical: 16, minHeight: 200 },
  disclaimer: { color: C.ink400, fontSize: 11, lineHeight: 16, paddingVertical: 12 },

  anonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  anonLabel: { fontSize: 13, fontWeight: '700', color: C.ink900 },
  anonSub: { fontSize: 11, color: C.ink400, marginTop: 2 },
  checkboxOff: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: C.brand600,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxCheck: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
