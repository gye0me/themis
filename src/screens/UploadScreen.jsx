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
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useAuth } from '../hooks/useAuth';
import { createEvidenceRecord } from '../services/firebaseService';
import { PhotoWatermarkStamper } from '../components/PhotoWatermarkStamper';
import { buildStampedImageFile } from '../utils/buildStampedImageFile';
import { BackHeader } from '../components/BackHeader';
import { EventTimeInputModal } from '../components/EventTimeInputModal';
import { C } from '../theme/tokens';

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

  // 텍스트 메모는 파일에 담긴 촬영/녹음 시각이 없으므로 사용자가 사건 발생 시각을 직접 입력한다.
  const [eventDate, setEventDate] = useState(() => new Date());
  const [eventTimeModalVisible, setEventTimeModalVisible] = useState(false);

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

      // 텍스트 메모는 사용자가 직접 입력한 사건 발생 시각을 그대로 사용.
      // 그 외 유형(이 화면에서 파일만 첨부하는 경우)은 별도 자동 추출 없이 업로드 시각을 사건 발생 시각으로 둔다.
      const savedRecord = await createEvidenceRecord({
        userId: user?.uid ?? null,
        caseId,
        caseTitle: caseType ?? '',
        title: trimmedTitle,
        note: trimmedNote,
        evidenceType,
        file: fileToUpload,
        location,
        eventTime: evidenceType === 'text' ? eventDate : null,
        eventTimeSource: evidenceType === 'text' ? 'manual' : null,
      });

      setSavedId(savedRecord.id);
      setSavedAt(savedRecord.capturedAt?.toDate ? savedRecord.capturedAt.toDate() : new Date());
      Alert.alert('저장 완료', 'Storage와 Firestore에 증거가 저장되었습니다.');
      setTitle('');
      setNote('');
      setFile(null);
      setEventDate(new Date());
    } catch (error) {
      console.error('증거 저장 실패:', error);
      Alert.alert('저장 실패', '증거를 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <PhotoWatermarkStamper ref={stamperRef} />
      <BackHeader title="상세 기록" subtitle="직접 입력" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>사건</Text>
          <Text style={styles.caseTitle}>{caseType ?? '사건 미지정'}</Text>
          <Text style={styles.helperText}>로그인한 사용자: {user?.email ?? '비로그인'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>기록 유형</Text>
          <View style={styles.typeGrid}>
            {evidenceTypes.map((item) => {
              const active = evidenceType === item.key;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.typeCard, active && styles.typeCardActive]}
                  onPress={() => setEvidenceType(item.key)}
                >
                  <Text style={styles.typeIcon}>{item.icon}</Text>
                  <Text style={styles.typeText}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>증거 제목</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 3월 2일 집 앞 사진"
            placeholderTextColor={C.ink400}
            value={title}
            onChangeText={setTitle}
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>메모</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={evidenceType === 'text' ? '텍스트 내용을 입력하세요' : '상황 설명을 적어두면 나중에 찾기 쉽습니다'}
            placeholderTextColor={C.ink400}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>

        <TouchableOpacity style={styles.dashedRow} onPress={pickFile}>
          <Text style={styles.dashedRowText}>
            + {evidenceType === 'text' ? '파일 첨부하기(선택)' : '파일 선택하기'}
          </Text>
        </TouchableOpacity>

        <View style={styles.fileInfoBox}>
          <Text style={styles.fileInfoLabel}>첨부 파일</Text>
          <Text style={styles.fileInfoValue}>{file?.name ?? '선택된 파일 없음'}</Text>
          {!!file?.size && <Text style={styles.fileInfoMeta}>{Math.round(file.size / 1024)} KB</Text>}
        </View>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>GPS</Text>
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

        {evidenceType === 'text' && (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>사건 발생 시각</Text>
            <TouchableOpacity style={styles.dateRow} onPress={() => setEventTimeModalVisible(true)}>
              <Text style={styles.dateRowText}>{formatDateTime(eventDate)}</Text>
              <Text style={styles.linkText}>변경</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>
              텍스트 메모는 파일에 촬영·녹음 시각이 없어 실제 사건이 일어난 시각을 직접 입력해야 해요.
              타임라인에는 이 시각이 크게 표시되고, 업로드 시각은 작게 함께 표시됩니다.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>업로드 시각</Text>
          <Text style={styles.timestampText}>{formatDateTime(savedAt)}</Text>
          <Text style={styles.helperText}>저장 시점은 Firestore createdAt과 capturedAt에 함께 기록됩니다.</Text>
        </View>

        {!!savedId && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>마지막 저장 결과</Text>
            <Text style={styles.helperText}>문서 ID: {savedId}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Storage + DB 저장</Text>}
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      <EventTimeInputModal
        visible={eventTimeModalVisible}
        title="사건 발생 시각 입력"
        description="이 메모가 실제로 일어난 시각을 입력해주세요."
        initialDate={eventDate}
        onConfirm={(date) => {
          setEventDate(date);
          setEventTimeModalVisible(false);
        }}
        onCancel={() => setEventTimeModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { padding: 20, gap: 20 },
  section: { gap: 10 },
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.line,
    gap: 6,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.06, textTransform: 'uppercase', color: C.ink400 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: C.ink700, marginBottom: 10 },
  caseTitle: { color: C.ink900, fontSize: 18, fontWeight: '700' },
  helperText: { color: C.ink500, fontSize: 12, lineHeight: 18 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    flexGrow: 1,
    minWidth: '45%',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.line,
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 4,
  },
  typeCardActive: {
    borderColor: C.brand500,
    backgroundColor: C.sky050,
  },
  typeIcon: { fontSize: 18 },
  typeText: { color: C.ink900, fontSize: 13, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.sky050,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.ink900,
    fontSize: 13.5,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  dashedRow: {
    borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  dashedRowText: { color: C.brand500, fontSize: 13, fontWeight: '700' },
  fileInfoBox: {
    borderRadius: 14,
    backgroundColor: C.sky050,
    padding: 12,
    gap: 2,
  },
  fileInfoLabel: { color: C.brand600, fontSize: 12, fontWeight: '700' },
  fileInfoValue: { color: C.ink900, fontSize: 13, fontWeight: '600' },
  fileInfoMeta: { color: C.ink500, fontSize: 11 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { color: C.brand500, fontSize: 13, fontWeight: '700' },
  locationText: { color: C.ink900, fontSize: 14, fontWeight: '600' },
  timestampText: { color: C.ink900, fontSize: 14, fontWeight: '600' },
  dateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: C.line, backgroundColor: C.sky050,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  dateRowText: { color: C.ink900, fontSize: 14, fontWeight: '700' },
  cta: {
    backgroundColor: C.brand600,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});