import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useAuth } from '../hooks/useAuth';
import { createEvidenceRecord } from '../services/firebaseService';
import { PhotoWatermarkStamper } from '../components/PhotoWatermarkStamper';
import { buildStampedImageFile } from '../utils/buildStampedImageFile';

const evidenceTypes = [
  { key: 'image', label: '이미지', icon: '📷' },
  { key: 'video', label: '동영상', icon: '🎥' },
  { key: 'audio', label: '음성', icon: '🎙️' },
  { key: 'text', label: '텍스트', icon: '📝' },
];

function formatDateTime(date) {
  return date ? date.toLocaleString('ko-KR') : '-';
}

export function UploadScreen({ navigation, route }) {
  const { user } = useAuth();
  const caseId = route?.params?.caseId ?? 'general';
  const caseType = route?.params?.caseType ?? null;
  const [evidenceType, setEvidenceType] = useState('image');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('GPS 위치를 불러오는 중...');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [savedId, setSavedId] = useState('');
  const stamperRef = useRef(null); // 사진에 워터마크를 픽셀로 합성하는 오프스크린 캡처기

  useEffect(() => {
    void loadLocation();
  }, []);

  async function loadLocation() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocation(null);
        setLocationStatus('GPS 권한이 없어 위치는 저장되지 않습니다');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nextLocation = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy ?? null,
      };

      setLocation(nextLocation);
      setLocationStatus(
        `GPS 확인됨 · ${nextLocation.latitude.toFixed(5)}, ${nextLocation.longitude.toFixed(5)}`
      );
    } catch (error) {
      console.error('GPS 조회 오류:', error);
      setLocation(null);
      setLocationStatus('GPS를 불러오지 못했습니다');
    }
  }

  async function pickFile() {
    try {
      const typeMap = {
        image: 'image/*',
        video: 'video/*',
        audio: 'audio/*',
        text: '*/*',
      };

      const result = await DocumentPicker.getDocumentAsync({
        type: typeMap[evidenceType] ?? '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setFile(result.assets[0]);
      }
    } catch (error) {
      console.error('파일 선택 오류:', error);
      Alert.alert('파일 선택 실패', '기기에서 파일을 가져오지 못했습니다.');
    }
  }

  async function handleSave() {
    if (saving) {
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedNote = note.trim();

    if (!trimmedTitle) {
      Alert.alert('제목 필요', '증거 제목을 입력해 주세요.');
      return;
    }

    if (evidenceType !== 'text' && !file) {
      Alert.alert('파일 필요', '이미지, 동영상, 음성은 파일을 선택해 주세요.');
      return;
    }

    if (evidenceType === 'text' && !trimmedNote && !file) {
      Alert.alert('내용 필요', '텍스트 메모를 입력하거나 파일을 첨부해 주세요.');
      return;
    }

    setSaving(true);

    try {
      // 사진 증거는 업로드 전에 원본 픽셀에 워터마크를 합성한다 — 원본 파일을 그대로
      // 내려받아도 위변조 방지용 워터마크가 함께 찍혀 있도록 하기 위함.
      let fileToUpload = file;
      if (evidenceType === 'image' && file) {
        try {
          const stampedUri = await stamperRef.current.stamp(file.uri);
          fileToUpload = buildStampedImageFile(file, stampedUri);
        } catch (stampError) {
          console.warn('워터마크 합성 실패, 원본으로 업로드합니다:', stampError.message);
        }
      }

      const savedRecord = await createEvidenceRecord({
        userId: user?.uid ?? null,
        caseId,
        caseTitle: caseType ?? '',
        title: trimmedTitle,
        note: trimmedNote,
        evidenceType,
        file: fileToUpload,
        location,
      });

      setSavedId(savedRecord.id);
      setSavedAt(savedRecord.capturedAt?.toDate ? savedRecord.capturedAt.toDate() : new Date());
      Alert.alert('저장 완료', 'Storage와 Firestore에 증거가 저장되었습니다.');
      setTitle('');
      setNote('');
      setFile(null);
    } catch (error) {
      console.error('증거 저장 실패:', error);
      Alert.alert('저장 실패', '증거를 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <PhotoWatermarkStamper ref={stamperRef} />
      <View style={styles.appbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>증거 업로드</Text>
          <Text style={styles.subtitle}>Storage + Firestore + GPS + 타임스탬프</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>사건</Text>
          <Text style={styles.caseTitle}>{caseType ?? '사건 미지정'}</Text>
          <Text style={styles.helperText}>로그인한 사용자: {user?.email ?? '비로그인'}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>기록 유형</Text>
          <View style={styles.typeRow}>
            {evidenceTypes.map((item) => {
              const active = evidenceType === item.key;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setEvidenceType(item.key)}
                >
                  <Text style={styles.typeIcon}>{item.icon}</Text>
                  <Text style={[styles.typeText, active && styles.typeTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>증거 제목</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 3월 2일 집 앞 사진"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.sectionLabel}>메모</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={evidenceType === 'text' ? '텍스트 내용을 입력하세요' : '상황 설명을 적어두면 나중에 찾기 쉽습니다'}
            placeholderTextColor="#94A3B8"
            value={note}
            onChangeText={setNote}
            multiline
          />

          <TouchableOpacity style={styles.fileButton} onPress={pickFile}>
            <Text style={styles.fileButtonText}>
              {evidenceType === 'text' ? '파일 첨부하기(선택)' : '파일 선택하기'}
            </Text>
          </TouchableOpacity>

          <View style={styles.fileInfoBox}>
            <Text style={styles.fileInfoLabel}>첨부 파일</Text>
            <Text style={styles.fileInfoValue}>{file?.name ?? '선택된 파일 없음'}</Text>
            {!!file?.size && <Text style={styles.fileInfoMeta}>{Math.round(file.size / 1024)} KB</Text>}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>GPS</Text>
            <TouchableOpacity onPress={loadLocation}>
              <Text style={styles.linkText}>다시 가져오기</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>{locationStatus}</Text>
          <Text style={styles.locationText}>
            {location
              ? `위도 ${location.latitude.toFixed(5)} · 경도 ${location.longitude.toFixed(5)}`
              : '위치 정보 없음'}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>타임스탬프</Text>
          <Text style={styles.timestampText}>{formatDateTime(savedAt)}</Text>
          <Text style={styles.helperText}>저장 시점은 Firestore createdAt과 capturedAt에 함께 기록됩니다.</Text>
        </View>

        {!!savedId && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>마지막 저장 결과</Text>
            <Text style={styles.helperText}>문서 ID: {savedId}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#F8FAFC" /> : <Text style={styles.saveButtonText}>Storage + DB 저장</Text>}
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  appbar: {
    backgroundColor: '#1E3A5F',
    padding: 16,
    paddingTop: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: { color: '#7B9EC5', fontSize: 16 },
  title: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#7B9EC5', fontSize: 11 },
  content: { padding: 16, gap: 12 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  sectionLabel: {
    color: '#1E3A5F',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  caseTitle: { color: '#0F172A', fontSize: 18, fontWeight: '700' },
  helperText: { color: '#64748B', fontSize: 12, lineHeight: 18 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeChip: {
    flexGrow: 1,
    minWidth: '45%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  typeChipActive: {
    borderColor: '#1E3A5F',
    backgroundColor: '#E2E8F0',
  },
  typeIcon: { fontSize: 18 },
  typeText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  typeTextActive: { color: '#1E3A5F' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 14,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  fileButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  fileButtonText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  fileInfoBox: {
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    padding: 12,
    gap: 4,
  },
  fileInfoLabel: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' },
  fileInfoValue: { color: '#0F172A', fontSize: 13, fontWeight: '600' },
  fileInfoMeta: { color: '#475569', fontSize: 11 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: '#1D4ED8', fontSize: 12, fontWeight: '600' },
  locationText: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  timestampText: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  saveButton: {
    backgroundColor: '#0F1F3D',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
});