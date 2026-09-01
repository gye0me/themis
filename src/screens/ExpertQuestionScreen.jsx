import { useCallback, useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { getCasesByUser } from '../services/firebaseService';
import { createExpertPost } from '../services/expertBoardService';
import { CASE_TYPE_META } from '../services/responseGuideSteps';

export default function ExpertQuestionScreen({ navigation }) {
  const { user, profile } = useContext(AuthContext);
  const authorName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '익명';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);

  const loadCases = useCallback(() => {
    if (!user) return;
    setLoadingCases(true);
    getCasesByUser(user.uid)
      .then((list) => {
        const sorted = [...list].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setCases(sorted);
      })
      .catch((err) => console.error('사건 목록 조회 오류:', err))
      .finally(() => setLoadingCases(false));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadCases();
    }, [loadCases]),
  );

  const openPicker = () => {
    setPickerVisible(true);
    if (cases.length === 0) loadCases();
  };

  const pickCase = (c) => {
    setSelectedCase({ id: c.id, title: c.title || '이름 없는 사건' });
    setPickerVisible(false);
  };

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
        attachedCase: selectedCase,
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
    <SafeAreaView style={styles.wrapper}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>질문 등록</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color="#1E3A5F" /> : <Text style={styles.submit}>등록</Text>}
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

        {/* 타임라인 첨부 */}
        <View style={styles.attachSection}>
          <Text style={styles.attachLabel}>📎 타임라인 첨부 (선택)</Text>
          <TouchableOpacity style={styles.attachBtn} onPress={openPicker}>
            <Text style={selectedCase ? styles.attachBtnTextFilled : styles.attachBtnText}>
              {selectedCase ? selectedCase.title : '+ 내 사건 타임라인 선택'}
            </Text>
          </TouchableOpacity>
          {selectedCase ? (
            <TouchableOpacity style={styles.removeAttachBtn} onPress={() => setSelectedCase(null)}>
              <Text style={styles.removeAttachText}>첨부 제거</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.disclaimer}>
          본 질문은 전문가 채널에 공개됩니다. 개인정보가 포함되지 않도록 주의해주세요.
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* 타임라인 선택 모달 */}
      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>내 사건 타임라인 선택</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.modalClose}>닫기</Text>
              </TouchableOpacity>
            </View>

            {loadingCases ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color="#1E3A5F" />
              </View>
            ) : cases.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>아직 기록된 사건 타임라인이 없어요.</Text>
              </View>
            ) : (
              <FlatList
                data={cases}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => {
                  const meta = CASE_TYPE_META[item.caseType] ?? { icon: '📁', label: item.caseType ?? '기타' };
                  return (
                    <TouchableOpacity style={styles.caseRow} onPress={() => pickCase(item)}>
                      <Text style={styles.caseRowIcon}>{meta.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.caseRowTitle}>{item.title || '이름 없는 사건'}</Text>
                        <Text style={styles.caseRowMeta}>{meta.label}</Text>
                      </View>
                      <Text style={styles.caseRowArrow}>›</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
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
  attachBtnTextFilled: { color: '#1E3A5F', fontSize: 13, fontWeight: '600' },
  removeAttachBtn: { alignSelf: 'flex-start' },
  removeAttachText: { color: '#EF4444', fontSize: 11.5 },
  disclaimer: { color: '#94A3B8', fontSize: 11, lineHeight: 16, paddingVertical: 12 },

  anonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  anonLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  anonSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  checkboxOff: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: '#1E3A5F',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxCheck: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  modalClose: { fontSize: 13, color: '#64748B' },
  modalLoading: { paddingVertical: 32, alignItems: 'center' },
  modalEmpty: { paddingVertical: 32, alignItems: 'center' },
  modalEmptyText: { color: '#94A3B8', fontSize: 12.5 },
  caseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  caseRowIcon: { fontSize: 20 },
  caseRowTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  caseRowMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  caseRowArrow: { color: '#CBD5E1', fontSize: 18 },
});
