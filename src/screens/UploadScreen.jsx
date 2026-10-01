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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useAuth } from '../hooks/useAuth';
import { createEvidenceRecord, getEvidenceRecords } from '../services/firebaseService';
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

// "올린 증거에 이어서 기록"할 수 있는 증거 유형 (사진·영상·음성·계약분석)
const ATTACHABLE_TYPES = {
  image: { icon: '📷', label: '사진' },
  video: { icon: '🎥', label: '영상' },
  audio: { icon: '🎙️', label: '음성' },
  contract: { icon: '📑', label: '계약분석' },
};

function formatDateTime(date) {
  return date ? date.toLocaleString('ko-KR') : '-';
}

function formatRecordDate(value) {
  const d = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('ko-KR') : '';
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

  // 새 증거를 올리는 대신, 이미 올린 사진·영상·음성 밑에 메모를 덧붙이는 모드.
  // 원본 증거 문서는 건드리지 않고(무결성 유지) 연결 정보(linkedEvidenceId)를 가진 메모를 새로 저장한다.
  const initialLinkedId = route?.params?.linkedEvidenceId ?? null;
  const [mode, setMode] = useState(initialLinkedId ? 'attach' : 'new'); // 'new' | 'attach'
  const [attachableRecords, setAttachableRecords] = useState(null); // null = 불러오는 중
  const [linkedEvidenceId, setLinkedEvidenceId] = useState(initialLinkedId);
  const linkedEvidence = attachableRecords?.find((r) => r.id === linkedEvidenceId) ?? null;
  const isAttach = mode === 'attach';
  const stamperRef = useRef(null); // 사진에 워터마크를 픽셀로 합성하는 오프스크린 캡처기

  // 텍스트 메모는 파일에 담긴 촬영/녹음 시각이 없으므로 사용자가 사건 발생 시각을 직접 입력한다.
  const [eventDate, setEventDate] = useState(() => new Date());
  const [eventTimeModalVisible, setEventTimeModalVisible] = useState(false);

  useEffect(() => {
    void loadLocation();
  }, []);

  // 이 사건에 올린 사진·영상·음성 목록 (이어서 기록할 대상)
  useEffect(() => {
    if (!user?.uid) return;
    let active = true;
    getEvidenceRecords(user.uid, caseId)
      .then((list) => {
        if (!active) return;
        setAttachableRecords(list.filter((r) => ATTACHABLE_TYPES[r.evidenceType] && !r.hidden));
      })
      .catch((err) => {
        console.error('증거 목록 조회 오류:', err);
        if (active) setAttachableRecords([]);
      });
    return () => {
      active = false;
    };
  }, [user?.uid, caseId]);

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

    const trimmedNote = note.trim();

    if (isAttach) {
      if (!linkedEvidence) {
        Alert.alert('증거 선택', '기록을 덧붙일 증거를 골라주세요.');
        return;
      }
      if (!trimmedNote) {
        Alert.alert('내용 필요', '덧붙일 기록 내용을 입력해 주세요.');
        return;
      }
    }

    const linkedLabel = linkedEvidence ? ATTACHABLE_TYPES[linkedEvidence.evidenceType]?.label ?? '증거' : '';
    const trimmedTitle = title.trim() || (isAttach ? `${linkedLabel} 추가 기록` : '');

    if (!trimmedTitle) {
      Alert.alert('제목 필요', '증거 제목을 입력해 주세요.');
      return;
    }

    if (!isAttach && evidenceType !== 'text' && !file) {
      Alert.alert('파일 필요', '이미지, 동영상, 음성은 파일을 선택해 주세요.');
      return;
    }

    if (!isAttach && evidenceType === 'text' && !trimmedNote && !file) {
      Alert.alert('내용 필요', '텍스트 메모를 입력하거나 파일을 첨부해 주세요.');
      return;
    }

    setSaving(true);

    try {
      // 사진 증거는 업로드 전에 원본 픽셀에 워터마크를 합성한다 — 원본 파일을 그대로
      // 내려받아도 위변조 방지용 워터마크가 함께 찍혀 있도록 하기 위함.
      const recordType = isAttach ? 'text' : evidenceType;
      let fileToUpload = isAttach ? null : file;
      if (recordType === 'image' && fileToUpload) {
        try {
          const stampedUri = await stamperRef.current.stamp(fileToUpload.uri);
          fileToUpload = buildStampedImageFile(fileToUpload, stampedUri);
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
        evidenceType: recordType,
        file: fileToUpload,
        location,
        eventTime: recordType === 'text' ? eventDate : null,
        eventTimeSource: recordType === 'text' ? 'manual' : null,
        extra: isAttach
          ? {
              linkedEvidenceId: linkedEvidence.id,
              linkedEvidenceTitle: linkedEvidence.title ?? linkedLabel,
              linkedEvidenceType: linkedEvidence.evidenceType,
            }
          : {},
      });

      setSavedId(savedRecord.id);
      setSavedAt(savedRecord.capturedAt?.toDate ? savedRecord.capturedAt.toDate() : new Date());
      Alert.alert('저장 완료', isAttach ? '선택한 증거 밑에 기록이 저장되었습니다.' : '증거가 저장되었습니다.');
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
      <BackHeader
        title="상세 기록"
        subtitle={isAttach ? '올린 증거에 이어서 기록' : '직접 입력'}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>사건</Text>
          <Text style={styles.caseTitle}>{caseType ?? '사건 미지정'}</Text>
          <Text style={styles.helperText}>로그인한 사용자: {user?.email ?? '비로그인'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>어디에 기록할까요?</Text>
          <View style={styles.modeRow}>
            {[
              { key: 'new', label: '새 증거 올리기', desc: '파일·메모 새로 저장' },
              { key: 'attach', label: '올린 증거에 이어서', desc: '사진·영상·음성 밑에 메모' },
            ].map((opt) => {
              const active = mode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.modeCard, active && styles.typeCardActive]}
                  onPress={() => setMode(opt.key)}
                >
                  <Text style={[styles.typeText, active && { color: C.brand700 }]}>{opt.label}</Text>
                  <Text style={styles.modeDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isAttach && (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>기록을 덧붙일 증거</Text>
            {attachableRecords === null ? (
              <ActivityIndicator color={C.brand600} />
            ) : attachableRecords.length === 0 ? (
              <Text style={styles.helperText}>
                이 사건에 올린 사진·영상·음성이 아직 없어요. "새 증거 올리기"로 먼저 올려주세요.
              </Text>
            ) : (
              attachableRecords.map((r) => {
                const meta = ATTACHABLE_TYPES[r.evidenceType];
                const selected = r.id === linkedEvidenceId;
                const thumb = r.evidenceType === 'image' ? r.downloadURL : r.thumbnailURL;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.attachRow, selected && styles.typeCardActive]}
                    onPress={() => setLinkedEvidenceId(r.id)}
                    activeOpacity={0.8}
                  >
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.attachThumb} />
                    ) : (
                      <View style={[styles.attachThumb, styles.attachThumbIcon]}>
                        <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.attachTitle} numberOfLines={1}>{r.title || meta.label}</Text>
                      <Text style={styles.attachMeta} numberOfLines={1}>
                        {meta.label} · {formatRecordDate(r.eventTime ?? r.capturedAt)}
                      </Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {!isAttach && (
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
        )}

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>{isAttach ? '제목 (선택)' : '증거 제목'}</Text>
          <TextInput
            style={styles.input}
            placeholder={isAttach ? '비워두면 "사진 추가 기록"처럼 자동으로 붙어요' : '예: 3월 2일 집 앞 사진'}
            placeholderTextColor={C.ink400}
            value={title}
            onChangeText={setTitle}
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>메모</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={
              isAttach
                ? '예: 이 사진을 찍은 뒤 집주인이 "수리 못 해준다"고 문자함'
                : evidenceType === 'text' ? '텍스트 내용을 입력하세요' : '상황 설명을 적어두면 나중에 찾기 쉽습니다'
            }
            placeholderTextColor={C.ink400}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>

        {!isAttach && (
          <>
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
          </>
        )}

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

        {(isAttach || evidenceType === 'text') && (
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
          <Text style={styles.helperText}>저장한 시각이 함께 기록됩니다.</Text>
        </View>

        {!!savedId && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>마지막 저장 결과</Text>
            <Text style={styles.helperText}>문서 ID: {savedId}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>저장</Text>}
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
  modeRow: { flexDirection: 'row', gap: 10 },
  modeCard: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: C.line,
    paddingVertical: 12, paddingHorizontal: 12, gap: 3,
  },
  modeDesc: { fontSize: 11, color: C.ink500 },
  attachRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.line, padding: 10,
  },
  attachThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: C.sky050 },
  attachThumbIcon: { alignItems: 'center', justifyContent: 'center' },
  attachTitle: { fontSize: 13.5, fontWeight: '700', color: C.ink900 },
  attachMeta: { fontSize: 11, color: C.ink500, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 999, borderWidth: 1.5, borderColor: C.ink400,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: C.brand600 },
  radioDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: C.brand600 },
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