import { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';

export default function ExpertQuestionScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('알림', '제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('알림', '내용을 입력해주세요.');
      return;
    }
    // Firebase 연결
    Alert.alert('등록 완료', '질문이 등록되었습니다!');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>질문 등록</Text>
        <TouchableOpacity onPress={handleSubmit}>
          <Text style={styles.submit}>등록</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* 제목 */}
        <TextInput
          style={styles.titleInput}
          placeholder="제목을 입력해주세요"
          placeholderTextColor="#94A3B8"
          value={title}
          onChangeText={setTitle}
        />

        <View style={styles.divider} />

        {/* 내용 */}
        <TextInput
          style={styles.contentInput}
          placeholder="전문가에게 질문할 내용을 입력해주세요"
          placeholderTextColor="#94A3B8"
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.divider} />

        {/* 타임라인 첨부 */}
        <View style={styles.attachSection}>
          <Text style={styles.attachLabel}>📎 타임라인 첨부 (선택)</Text>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => Alert.alert('준비 중', '타임라인 선택 기능은 준비 중입니다.')}
          >
            <Text style={styles.attachBtnText}>
              {selectedCase ? selectedCase.title : '+ 내 사건 타임라인 선택'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          본 질문은 전문가 채널에 공개됩니다. 개인정보가 포함되지 않도록 주의해주세요.
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
  back: { color: '#1E3A5F', fontSize: 24 },
  title: { color: '#0F172A', fontSize: 15, fontWeight: '600' },
  submit: { color: '#1E3A5F', fontSize: 14, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 16 },
  titleInput: { fontSize: 16, color: '#0F172A', paddingVertical: 16 },
  divider: { height: 0.5, backgroundColor: '#E2E8F0' },
  contentInput: { fontSize: 14, color: '#0F172A', paddingVertical: 16, minHeight: 200 },
  attachSection: { paddingVertical: 16, gap: 10 },
  attachLabel: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  attachBtn: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, borderStyle: 'dashed' },
  attachBtnText: { color: '#94A3B8', fontSize: 13 },
  disclaimer: { color: '#94A3B8', fontSize: 11, lineHeight: 16, paddingVertical: 12 },
});