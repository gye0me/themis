import { useContext, useRef, useState } from 'react';
import { APP_ROUTES, RECORD_ROUTES, EXPERT_ROUTES } from '../navigation/routes';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { AuthContext } from '../context/AuthContext';
import { createEvidenceRecord, uploadEvidenceThumbnail } from '../services/firebaseService';
import { transcribeAudioClova } from '../services/clovaSpeechService';
import { extractTextFromImage } from '../services/ocrService';
import { PhotoWatermarkStamper } from '../components/PhotoWatermarkStamper';
import { buildStampedImageFile } from '../utils/buildStampedImageFile';
import { BackHeader } from '../components/BackHeader';
import { C } from '../theme/tokens';

// 녹음 시간을 mm:ss 형식으로 표시
function formatDuration(ms) {
  const totalSec = Math.floor((ms ?? 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// design/themis-interactive.html의 type-card 아이콘 (전부 브랜드 컬러 단색)
const iconStroke = { stroke: C.brand600, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
const TypeIcons = {
  contract: () => (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" {...iconStroke} />
      <Path d="M14 3v5h5" {...iconStroke} />
      <Path d="M9.5 14l1.8 1.8L15 12" {...iconStroke} />
    </Svg>
  ),
  quest: () => (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} {...iconStroke} />
      <Path d="m14.5 9.5-1.8 4.2-4.2 1.8 1.8-4.2Z" {...iconStroke} />
    </Svg>
  ),
  image: () => (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" {...iconStroke} />
      <Circle cx={12} cy={13} r={3.5} {...iconStroke} />
    </Svg>
  ),
  audio: () => (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Rect x={9} y={2} width={6} height={12} rx={3} {...iconStroke} />
      <Path d="M5 11a7 7 0 0 0 14 0" {...iconStroke} />
      <Path d="M12 18v4" {...iconStroke} />
      <Path d="M9 22h6" {...iconStroke} />
    </Svg>
  ),
  video: () => (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Rect x={2.5} y={6} width={14} height={12} rx={2} {...iconStroke} />
      <Path d="M21.5 9.5 16.5 12l5 2.5v-5Z" {...iconStroke} />
    </Svg>
  ),
  text: () => (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      <Path d="M4 20h4L18 10l-4-4L4 16v4Z" {...iconStroke} />
      <Path d="M14 6l4 4" {...iconStroke} />
    </Svg>
  ),
};

const UPLOAD_TYPES = {
  image: { mimeType: 'image/*',  title: '현장 사진 증거',  label: '사진' },
  audio: { mimeType: 'audio/*',  title: '음성 녹음 증거',  label: '음성' },
  video: { mimeType: 'video/*',  title: '영상 증거',        label: '영상' },
};

export function EvidenceUploadScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const caseId = route?.params?.caseId ?? null;
  const caseType = route?.params?.caseType ?? null;
  const [uploadingType, setUploadingType] = useState(null);

  // 앱 안에서 바로 녹음하기 위한 상태
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 200);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const stamperRef = useRef(null); // 사진에 워터마크를 픽셀로 합성하는 오프스크린 캡처기

  // 파일 선택/녹음 두 경로가 공통으로 쓰는 업로드 처리 (위치 기록 → 클로바 변환 → Firestore 저장 → 결과 안내)
  const uploadEvidence = async (evidenceType, file) => {
    const cfg = UPLOAD_TYPES[evidenceType];
    setUploadingType(evidenceType);
    try {
      let location = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }

      let note = '';
      let sttError = null;
      if (evidenceType === 'audio') {
        try {
          note = await transcribeAudioClova(file.uri, file.mimeType);
        } catch (e) {
          console.warn('클로바 변환 실패:', e.message);
          sttError = e.message;
        }
      } else if (evidenceType === 'image') {
        console.log('OCR 시작:', file.uri);
        try {
          note = await extractTextFromImage(file.uri);
          console.log('OCR 완료:', note);
        } catch (e) {
          console.warn('OCR 변환 실패:', e.message);
        }
      }
      // 영상 증거: 5초 지점 프레임을 캡처해 "5초 스탬프"로 함께 저장 (변조 여부 확인용 미리보기)
      let extra = {};
      if (evidenceType === 'video') {
        try {
          const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(file.uri, { time: 5000 });
          const { downloadURL: thumbnailURL } = await uploadEvidenceThumbnail(thumbUri);
          extra = { thumbnailURL, thumbnailStampSec: 5 };
        } catch (e) {
          console.warn('영상 5초 스탬프 생성 실패:', e.message);
        }
      }

      await createEvidenceRecord({
        userId: user?.uid ?? null,
        caseId: caseId ?? 'general',
        title: cfg.title,
        evidenceType,
        note,
        file,
        location,
        extra,
      });

      let msg;
      if (evidenceType === 'audio' && note) {
        msg = `음성이 기록되었습니다.\n\n변환된 텍스트:\n"${note.slice(0, 80)}${note.length > 80 ? '...' : ''}"`;
      } else if (evidenceType === 'audio' && sttError) {
        msg = `음성 파일은 저장됐지만 텍스트 변환에 실패했습니다.\n(${sttError})\n\n네트워크 상태를 확인 후 타임라인에서 다시 시도해주세요.`;
      } else if (evidenceType === 'audio') {
        msg = '음성이 기록되었습니다. (인식된 텍스트가 없습니다)';
      } else {
        msg = `${cfg.label}과 GPS 위치, 타임스탬프가 안전하게 기록되었습니다.`;
      }
      Alert.alert('업로드 완료!', msg);
    } catch (error) {
      console.error('업로드 실패:', error);
      Alert.alert('업로드 실패', error.message);
    } finally {
      setUploadingType(null);
    }
  };

  // 사진/영상은 갤러리에서, 음성은 파일 탐색기에서 선택
  const handlePickFile = async (evidenceType) => {
    if (uploadingType !== null) return;
    try {
      if (evidenceType === 'image' || evidenceType === 'video') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: evidenceType === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
          quality: 0.8,
        });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        let file = {
          uri: asset.uri,
          name: asset.fileName ?? `${evidenceType}-${Date.now()}.${evidenceType === 'image' ? 'jpg' : 'mp4'}`,
          mimeType: asset.mimeType ?? (evidenceType === 'image' ? 'image/jpeg' : 'video/mp4'),
        };

        // 사진 증거는 업로드 전에 원본 픽셀에 워터마크를 합성한다 — 원본 파일을 그대로
        // 내려받아도 위변조 방지용 워터마크가 함께 찍혀 있도록 하기 위함.
        if (evidenceType === 'image') {
          setUploadingType('image');
          try {
            const stampedUri = await stamperRef.current.stamp(asset.uri);
            file = buildStampedImageFile(file, stampedUri);
          } catch (stampError) {
            console.warn('워터마크 합성 실패, 원본으로 업로드합니다:', stampError.message);
          }
        }

        await uploadEvidence(evidenceType, file);
        return;
      }

      const cfg = UPLOAD_TYPES[evidenceType];
      const result = await DocumentPicker.getDocumentAsync({ type: cfg.mimeType });
      if (result.canceled || !result.assets?.length) return;
      await uploadEvidence(evidenceType, result.assets[0]);
    } catch (error) {
      console.error('파일 선택 실패:', error);
      Alert.alert('오류', '파일을 선택하지 못했습니다.');
    }
  };

  // "음성" 카드 탭: 새로 녹음할지 / 기존 음성 메모 파일을 가져올지 선택
  const handleAudioPress = () => {
    if (uploadingType !== null) return;
    Alert.alert('음성 기록', '어떻게 기록할까요?', [
      { text: '지금 녹음하기', onPress: () => setRecordModalVisible(true) },
      { text: '파일에서 선택', onPress: () => handlePickFile('audio') },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('마이크 권한 필요', '설정에서 마이크 접근 권한을 허용해주세요.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      setHasRecorded(false);
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      console.error('녹음 시작 실패:', error);
      Alert.alert('녹음 시작 실패', error.message ?? String(error));
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorder.stop();
      setHasRecorded(true);
    } catch (error) {
      console.error('녹음 정지 실패:', error);
      Alert.alert('녹음 정지 실패', error.message ?? String(error));
    }
  };

  const closeRecordModal = () => {
    if (recorderState.isRecording) {
      audioRecorder.stop().catch(() => {});
    }
    setHasRecorded(false);
    setRecordModalVisible(false);
  };

  const confirmRecording = async () => {
    const uri = audioRecorder.uri;
    setRecordModalVisible(false);
    setHasRecorded(false);
    if (!uri) {
      Alert.alert('오류', '녹음 파일을 찾을 수 없습니다. 다시 시도해주세요.');
      return;
    }
    await uploadEvidence('audio', {
      uri,
      name: `recording-${Date.now()}.m4a`,
      mimeType: 'audio/m4a',
    });
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <PhotoWatermarkStamper ref={stamperRef} />
      <BackHeader
        title="증거 업로드"
        subtitle={caseType ? `${caseType} · 사건 기록 추가하기` : '사건 기록 추가하기'}
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(APP_ROUTES.HOME_STACK))}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>기록 유형 선택</Text>

        <View style={styles.shortcutRow}>
          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => navigation.push(APP_ROUTES.CONTRACT_ANALYSIS, { caseId, caseType })}
          >
            <TypeIcons.contract />
            <Text style={styles.typeLabel}>계약서 분석</Text>
            <Text style={styles.typeDesc}>독소조항 자동 탐지</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.typeCard}
            onPress={() =>
              caseId
                ? navigation.navigate(EXPERT_ROUTES.GUIDE, { caseId, caseType })
                : navigation.push(RECORD_ROUTES.START, { openForm: true })
            }
          >
            <TypeIcons.quest />
            <Text style={styles.typeLabel}>사건 대응 퀘스트</Text>
            <Text style={styles.typeDesc}>
              {caseType ? `${caseType} 단계별 안내` : '유형별 단계별 안내'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.typeGrid}>
          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => handlePickFile('image')}
            disabled={uploadingType !== null}
          >
            <TypeIcons.image />
            {uploadingType === 'image' ? (
              <ActivityIndicator color={C.brand600} style={{ marginVertical: 2 }} />
            ) : (
              <Text style={styles.typeLabel}>사진</Text>
            )}
            <Text style={styles.typeDesc}>갤러리에서 선택</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.typeCard}
            onPress={handleAudioPress}
            disabled={uploadingType !== null}
          >
            <TypeIcons.audio />
            {uploadingType === 'audio' ? (
              <ActivityIndicator color={C.brand600} style={{ marginVertical: 2 }} />
            ) : (
              <Text style={styles.typeLabel}>음성</Text>
            )}
            <Text style={styles.typeDesc}>지금 녹음 또는 파일 선택</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => handlePickFile('video')}
            disabled={uploadingType !== null}
          >
            <TypeIcons.video />
            {uploadingType === 'video' ? (
              <ActivityIndicator color={C.brand600} style={{ marginVertical: 2 }} />
            ) : (
              <Text style={styles.typeLabel}>영상</Text>
            )}
            <Text style={styles.typeDesc}>동영상 파일 업로드</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => navigation.navigate(APP_ROUTES.UPLOAD_SCREEN, { caseId, caseType })}
          >
            <TypeIcons.text />
            <Text style={styles.typeLabel}>상세 기록</Text>
            <Text style={styles.typeDesc}>텍스트 직접 입력</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gpsCaptionRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.ink400} strokeWidth={2}>
            <Path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
            <Circle cx={12} cy={9} r={2.3} />
          </Svg>
          <Text style={styles.gpsCaption}>업로드 시 위치와 시간이 자동으로 기록돼요</Text>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      <Modal
        visible={recordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRecordModal}
      >
        <View style={styles.recordBackdrop}>
          <View style={styles.recordCard}>
            <Text style={styles.recordTitle}>음성 녹음</Text>
            <Text style={styles.recordTimer}>{formatDuration(recorderState.durationMillis)}</Text>

            {recorderState.isRecording ? (
              <TouchableOpacity style={styles.recordStopBtn} onPress={stopRecording}>
                <Text style={styles.recordStopBtnText}>■  정지</Text>
              </TouchableOpacity>
            ) : hasRecorded ? (
              <View style={styles.recordActionRow}>
                <TouchableOpacity style={styles.recordRetryBtn} onPress={startRecording}>
                  <Text style={styles.recordRetryBtnText}>다시 녹음</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.recordConfirmBtn} onPress={confirmRecording}>
                  <Text style={styles.recordConfirmBtnText}>이 녹음 사용하기</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.recordStartBtn} onPress={startRecording}>
                <Text style={styles.recordStartBtnText}>●  녹음 시작</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={closeRecordModal}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ marginTop: 16 }}
            >
              <Text style={styles.recordCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, padding: 20 },
  sectionTitle: {
    fontSize: 12.5, fontWeight: '700', color: C.ink500,
    marginBottom: 12,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  typeCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: C.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.line,
    alignItems: 'flex-start',
    gap: 4,
  },
  typeLabel: { color: C.ink900, fontSize: 13, fontWeight: '700' },
  typeDesc: { color: C.ink500, fontSize: 10.5 },
  gpsCaptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  gpsCaption: {
    color: C.ink400,
    fontSize: 11.5,
    textAlign: 'center',
  },
  recordBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  recordCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  recordTitle: { color: C.ink900, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  recordTimer: { color: C.brand600, fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'], marginBottom: 24 },
  recordStartBtn: {
    backgroundColor: '#7C3AED', borderRadius: 30,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  recordStartBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  recordStopBtn: {
    backgroundColor: C.danger600, borderRadius: 30,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  recordStopBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  recordActionRow: { flexDirection: 'row', gap: 10 },
  recordRetryBtn: {
    borderWidth: 1, borderColor: C.line, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  recordRetryBtnText: { color: C.ink500, fontSize: 12, fontWeight: '600' },
  recordConfirmBtn: {
    backgroundColor: C.brand600, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  recordConfirmBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  recordCloseText: { color: C.ink400, fontSize: 12 },
});