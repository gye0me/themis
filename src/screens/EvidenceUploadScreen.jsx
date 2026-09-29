import { useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { transcribeVideoAudio } from '../services/videoTranscriptService';
import { extractTextFromImage } from '../services/ocrService';
import { PhotoWatermarkStamper } from '../components/PhotoWatermarkStamper';
import { buildStampedImageFile } from '../utils/buildStampedImageFile';
import { watermarkAndDownload } from '../services/watermarkApiService';
import { BackHeader } from '../components/BackHeader';
import { EventTimeInputModal } from '../components/EventTimeInputModal';
import { CasePickerModal } from '../components/CasePickerModal';
import { PreventionGuideModal } from '../components/PreventionGuideModal';
import { extractPhotoCaptureDate, extractContainerCreationTime } from '../utils/mediaEventTime';
import { C } from '../theme/tokens';

// 서버 워터마크(versatility.cloud)에 박아 넣을 문구. 사건 유형 + 현재 시각으로 구성해
// "언제, 어떤 사건 관련 원본인지"가 워터마크 자체에 남도록 한다.
function buildWatermarkText(caseType) {
  const now = new Date();
  const stamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `THEMIS 원본 · ${caseType || '증거'} · ${stamp}`;
}

// 타입별로 "사건 발생 시각"을 자동으로 구해본다. 실패하면 null을 반환하고,
// 호출부에서 필요 시(음성/영상) 사용자에게 직접 입력을 받는다.
async function resolveAutoEventTime(evidenceType, file) {
  if (evidenceType === 'image') {
    const date = await extractPhotoCaptureDate({ uri: file.uri, exif: file.exif, mimeType: file.mimeType });
    return { date, source: date ? 'exif' : null };
  }
  if (evidenceType === 'video' || evidenceType === 'audio') {
    const date = await extractContainerCreationTime(file.uri);
    return { date, source: date ? 'media_metadata' : null };
  }
  return { date: null, source: null };
}

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
  // 빠른 기록(기록 탭의 사진/음성/영상 타일)으로 들어오면 사건 없이 시작하고,
  // 기록을 마친 뒤 어느 사건 타임라인에 저장할지 고른다.
  const isQuickMode = !caseId;
  // 들어오자마자 바로 시작할 기록 유형 ('image' | 'audio' | 'video')
  const autoStartType = route?.params?.autoStart ?? null;
  const [uploadingType, setUploadingType] = useState(null);
  const [pendingQuickSave, setPendingQuickSave] = useState(null); // 빠른 기록: 사건 선택을 기다리는 업로드
  const [lastSaved, setLastSaved] = useState(null); // { caseId, caseTitle, label } — 저장 완료 배너 + 타임라인 이동용
  const [preventionVisible, setPreventionVisible] = useState(false);

  // 앱 안에서 바로 녹음하기 위한 상태
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 200);
  // 빠른 기록의 "음성" 타일로 들어왔으면 녹음 창을 열어둔 채로 시작한다
  const [recordModalVisible, setRecordModalVisible] = useState(() => route?.params?.autoStart === 'audio');
  const [hasRecorded, setHasRecorded] = useState(false);
  const stamperRef = useRef(null); // 사진에 워터마크를 픽셀로 합성하는 오프스크린 캡처기
  const recordingStartRef = useRef(null); // 앱 안에서 직접 녹음할 때 시작 시각(정확한 사건 발생 시각)

  // 자동 추출이 실패한 음성/영상 파일의 사건 발생 시각을 직접 입력받기 위한 대기 상태
  const [pendingManualEntry, setPendingManualEntry] = useState(null); // { evidenceType, file }

  // 파일 선택/녹음 두 경로가 공통으로 쓰는 업로드 처리 (위치 기록 → 클로바 변환 → Firestore 저장 → 결과 안내)
  // eventTime/eventTimeSource: 사건 발생 시각을 이미 구해둔 경우(EXIF, 앱 내 녹음 시작 시각 등) 전달
  // target: 저장할 사건 (빠른 기록에서 고른 사건, 기본은 이 화면의 사건)
  // ocrSourceUri: OCR에 쓸 이미지 uri. 지정하지 않으면 file.uri(업로드될 파일)를 그대로 쓴다.
  //   워터마크가 찍힌 file.uri로 OCR을 돌리면 대각선 워터마크 문구("THEMIS 원본 · ...")까지
  //   글자로 인식돼 note에 섞여 들어가므로, 사진은 항상 워터마크 찍기 전 원본 uri를 넘겨야 한다.
  const uploadEvidence = async (
    evidenceType,
    file,
    eventTime = null,
    eventTimeSource = null,
    target = { caseId, caseTitle: null },
    ocrSourceUri = null
  ) => {
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
      } else if (evidenceType === 'video') {
        try {
          note = await transcribeVideoAudio(file);
        } catch (e) {
          console.warn('영상 음성 변환 실패:', e.message);
          sttError = e.message;
        }
      } else if (evidenceType === 'image') {
        console.log('OCR 시작:', ocrSourceUri ?? file.uri);
        try {
          // 워터마크가 찍히지 않은 원본으로 OCR — 워터마크 문구가 note에 섞이는 걸 방지
          note = await extractTextFromImage(ocrSourceUri ?? file.uri);
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
        caseId: target.caseId ?? 'general',
        title: cfg.title,
        evidenceType,
        note,
        file,
        location,
        extra,
        eventTime,
        eventTimeSource,
      });

      let msg;
      if (evidenceType === 'audio' && note) {
        msg = `음성이 기록되었습니다.\n\n변환된 텍스트:\n"${note.slice(0, 80)}${note.length > 80 ? '...' : ''}"`;
      } else if (evidenceType === 'audio' && sttError) {
        msg = `음성 파일은 저장됐지만 텍스트 변환에 실패했습니다.\n(${sttError})\n\n네트워크 상태를 확인 후 타임라인에서 다시 시도해주세요.`;
      } else if (evidenceType === 'audio') {
        msg = '음성이 기록되었습니다. (인식된 텍스트가 없습니다)';
      } else if (evidenceType === 'video' && note) {
        msg = `영상이 기록되었습니다.

영상 속 음성 텍스트:
"${note.slice(0, 80)}${note.length > 80 ? '...' : ''}"`;
      } else if (evidenceType === 'video' && sttError) {
        msg = `영상은 저장됐지만 음성 텍스트 변환에 실패했습니다.
(${sttError})`;
      } else {
        msg = `${cfg.label}과 GPS 위치, 타임스탬프가 안전하게 기록되었습니다.`;
      }
      setLastSaved({ caseId: target.caseId, caseTitle: target.caseTitle, label: cfg.label });
      Alert.alert('업로드 완료!', msg);
    } catch (error) {
      console.error('업로드 실패:', error);
      Alert.alert('업로드 실패', error.message);
    } finally {
      setUploadingType(null);
    }
  };

  // 사건이 정해져 있으면 바로 저장하고, 빠른 기록이면 저장할 사건을 먼저 고르게 한다.
  // ocrSourceUri: 사진일 때 OCR에 쓸 원본(워터마크 찍기 전) uri — saveEvidence.js 상단 설명 참고.
  const saveEvidence = async (evidenceType, file, eventTime = null, eventTimeSource = null, ocrSourceUri = null) => {
    if (isQuickMode) {
      setPendingQuickSave({ evidenceType, file, eventTime, eventTimeSource, ocrSourceUri });
      return;
    }
    await uploadEvidence(evidenceType, file, eventTime, eventTimeSource, { caseId, caseTitle: null }, ocrSourceUri);
  };

  const handleQuickCaseSelected = async (picked) => {
    const entry = pendingQuickSave;
    setPendingQuickSave(null);
    if (!entry) return;
    await uploadEvidence(
      entry.evidenceType,
      entry.file,
      entry.eventTime,
      entry.eventTimeSource,
      { caseId: picked.id, caseTitle: picked.title || '이름 없는 사건' },
      entry.ocrSourceUri
    );
  };

  // 저장한 사건의 타임라인으로 이동 — 그 사건 타임라인이 이미 뒤에 쌓여 있으면 새로 쌓지 않고 그 화면으로 돌아간다
  // (AppNavigator의 getId가 사건별로 화면을 구분하고, pop이 그 위에 쌓인 화면을 정리한다).
  const goToTimeline = (targetCaseId) => {
    navigation.navigate(RECORD_ROUTES.EVIDENCE_TIMELINE, { caseId: targetCaseId }, { pop: true });
  };

  // 사진/영상은 갤러리에서, 음성은 파일 탐색기에서 선택
  const handlePickFile = async (evidenceType) => {
    if (uploadingType !== null) return;
    try {
      if (evidenceType === 'image' || evidenceType === 'video') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: evidenceType === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
          quality: 0.8,
          exif: evidenceType === 'image', // 사진일 때만 EXIF(촬영 시각 포함) 요청
        });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        let file = {
          uri: asset.uri,
          name: asset.fileName ?? `${evidenceType}-${Date.now()}.${evidenceType === 'image' ? 'jpg' : 'mp4'}`,
          mimeType: asset.mimeType ?? (evidenceType === 'image' ? 'image/jpeg' : 'video/mp4'),
          exif: asset.exif ?? null,
        };

        // 사진: 워터마크 합성 전에 원본에서 EXIF 촬영 시각을 먼저 읽어둔다
        // (워터마크 합성 과정에서 새 파일로 다시 인코딩되면 EXIF가 사라질 수 있음).
        let autoEventTime = null;
        let autoEventTimeSource = null;
        if (evidenceType === 'image') {
          const { date, source } = await resolveAutoEventTime('image', file);
          autoEventTime = date;
          autoEventTimeSource = source;
        }

        // 사진 증거는 업로드 전에 원본 픽셀에 워터마크를 합성한다 — 원본 파일을 그대로
        // 내려받아도 위변조 방지용 워터마크가 함께 찍혀 있도록 하기 위함.
        // 1순위: versatility.cloud 서버 워터마크(문구+시각을 서버에서 합성, PDF도 지원).
        // 서버 호출이 실패하면(오프라인 등) 기존 로컬 캡처 방식으로 자동 대체한다.
        if (evidenceType === 'image') {
          setUploadingType('image');
          try {
            const { localUri } = await watermarkAndDownload({
              uri: file.uri,
              name: file.name,
              mimeType: file.mimeType,
              text: buildWatermarkText(caseType),
            });
            file = buildStampedImageFile(file, localUri);
          } catch (serverError) {
            console.warn('서버 워터마크 실패, 로컬 합성으로 대체합니다:', serverError.message);
            try {
              const stampedUri = await stamperRef.current.stamp(asset.uri);
              file = buildStampedImageFile(file, stampedUri);
            } catch (localError) {
              console.warn('로컬 워터마크 합성도 실패, 원본으로 업로드합니다:', localError.message);
            }
          }
          // EXIF를 못 읽었으면(권한/포맷 문제 등) 조용히 업로드 시각으로 대체 — 스펙상 사진은 입력창을 띄우지 않음
          // asset.uri: 워터마크 찍기 전 원본 — OCR은 항상 이걸로 돌려서 워터마크 문구가 note에 섞이지 않게 한다
          await saveEvidence('image', file, autoEventTime, autoEventTimeSource, asset.uri);
          return;
        }

        // 영상: 파일 자체의 촬영 시각(mp4 컨테이너 메타데이터)을 읽어보고, 없으면 직접 입력받는다
        const { date: videoDate, source: videoSource } = await resolveAutoEventTime('video', file);
        if (videoDate) {
          await saveEvidence('video', file, videoDate, videoSource);
        } else {
          setPendingManualEntry({ evidenceType: 'video', file });
        }
        return;
      }

      const cfg = UPLOAD_TYPES[evidenceType];
      const result = await DocumentPicker.getDocumentAsync({ type: cfg.mimeType });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];

      if (evidenceType === 'audio') {
        // 음성 파일(파일 탐색기에서 선택): 컨테이너에 녹음 시각이 있으면 자동 사용, 없으면 직접 입력
        const { date, source } = await resolveAutoEventTime('audio', file);
        if (date) {
          await saveEvidence('audio', file, date, source);
        } else {
          setPendingManualEntry({ evidenceType: 'audio', file });
        }
        return;
      }

      await saveEvidence(evidenceType, file);
    } catch (error) {
      console.error('파일 선택 실패:', error);
      Alert.alert('오류', '파일을 선택하지 못했습니다.');
    }
  };

  // 자동 추출 실패 시(영상/파일에서 가져온 음성) 사용자가 직접 입력한 시각으로 업로드 진행
  const handleManualEventTimeConfirm = async (date) => {
    const entry = pendingManualEntry;
    setPendingManualEntry(null);
    if (!entry) return;
    await saveEvidence(entry.evidenceType, entry.file, date, 'manual');
  };

  // "음성" 카드 탭: 새로 녹음할지 / 기존 음성 메모 파일을 가져올지 선택
  // (선택지 Alert는 웹에서 뜨지 않아서, 녹음 창 안에 "파일에서 선택"을 함께 둔다)
  const handleAudioPress = () => {
    if (uploadingType !== null) return;
    setRecordModalVisible(true);
  };

  const pickAudioFileFromModal = () => {
    setRecordModalVisible(false);
    setHasRecorded(false);
    handlePickFile('audio');
  };

  // 빠른 기록 타일로 들어왔으면 해당 기록(사진/영상 선택)을 바로 시작한다 (한 번만, 음성은 녹음 창 초기값으로 처리)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartType !== 'image' && autoStartType !== 'video') return;
    if (autoStartedRef.current) return;
    // 화면이 한 번 그려진 뒤에 파일 선택 창을 연다 (StrictMode의 effect 재실행에도 한 번만 열리도록 콜백 안에서 표시)
    const timer = setTimeout(() => {
      autoStartedRef.current = true;
      handlePickFile(autoStartType);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartType]);

  // 사건별로 증거 업로드에 처음 들어왔을 때 예방 가이드(사례별 예방 방법 + 체크리스트)를 한 번 띄운다
  useEffect(() => {
    if (!caseId || autoStartType) return;
    const key = `prevention-guide-seen:${caseId}`;
    let active = true;
    AsyncStorage.getItem(key)
      .then((seen) => {
        if (!active || seen) return;
        setPreventionVisible(true);
        return AsyncStorage.setItem(key, '1');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [caseId, autoStartType]);

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
      recordingStartRef.current = new Date(); // 앱 안에서 직접 녹음 → 시작 시각을 정확히 알 수 있음

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
    const eventTime = recordingStartRef.current ?? null;
    recordingStartRef.current = null;
    await saveEvidence(
      'audio',
      {
        uri,
        name: `recording-${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
      },
      eventTime,
      eventTime ? 'app_recording' : null
    );
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <PhotoWatermarkStamper ref={stamperRef} />
      <BackHeader
        title="증거 업로드"
        subtitle={
          isQuickMode
            ? '빠른 기록 · 기록한 뒤 저장할 사건을 골라요'
            : caseType ? `${caseType} · 사건 기록 추가하기` : '사건 기록 추가하기'
        }
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(APP_ROUTES.HOME_STACK))}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {lastSaved && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerText}>
              ✅ {lastSaved.label}이(가) {lastSaved.caseTitle ? `"${lastSaved.caseTitle}" ` : ''}타임라인에 저장됐어요
            </Text>
            {lastSaved.caseId && (
              <TouchableOpacity style={styles.savedBannerBtn} onPress={() => goToTimeline(lastSaved.caseId)}>
                <Text style={styles.savedBannerBtnText}>타임라인 보기 →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {caseId && (
          <TouchableOpacity style={styles.preventionLink} onPress={() => setPreventionVisible(true)}>
            <Text style={styles.preventionLinkText}>🛡️ 이 사건 예방 가이드 · 체크리스트 보기</Text>
            <Text style={styles.preventionLinkArrow}>›</Text>
          </TouchableOpacity>
        )}

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
                : navigation.popTo(RECORD_ROUTES.START, { openForm: true })
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

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>수집 전에 확인해 주세요</Text>
          <Text style={styles.noticeText}>
            상대방의 동의 없는 녹음·촬영·수집은 법적 문제가 될 수 있습니다. 본인이 참여하지 않은 타인 간의 대화는 녹음하지 마세요.
            수집한 자료를 다른 사람에게 공개하면 별도의 책임이 생길 수 있습니다.
          </Text>
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
              <>
                <TouchableOpacity style={styles.recordStartBtn} onPress={startRecording}>
                  <Text style={styles.recordStartBtnText}>●  녹음 시작</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickAudioFileFromModal} style={{ marginTop: 14 }}>
                  <Text style={styles.recordFileText}>또는 음성 파일에서 선택</Text>
                </TouchableOpacity>
              </>
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

      <EventTimeInputModal
        visible={!!pendingManualEntry}
        title={pendingManualEntry?.evidenceType === 'video' ? '영상 촬영 시각 입력' : '음성 녹음 시각 입력'}
        description="파일에서 촬영/녹음 시각을 찾지 못했어요. 실제 사건이 발생한 시각을 입력해주세요."
        onConfirm={handleManualEventTimeConfirm}
        onCancel={() => setPendingManualEntry(null)}
      />

      <CasePickerModal
        visible={!!pendingQuickSave}
        userId={user?.uid}
        description={
          pendingQuickSave
            ? `방금 기록한 ${UPLOAD_TYPES[pendingQuickSave.evidenceType]?.label ?? '증거'}을(를) 저장할 사건을 골라주세요.`
            : undefined
        }
        onSelect={handleQuickCaseSelected}
        onCancel={() => setPendingQuickSave(null)}
      />

      <PreventionGuideModal
        visible={preventionVisible}
        caseId={caseId}
        caseType={caseType}
        onClose={() => setPreventionVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, padding: 20 },
  savedBanner: {
    backgroundColor: C.safe100, borderRadius: 14, padding: 14, marginBottom: 14, gap: 10,
  },
  savedBannerText: { fontSize: 13, fontWeight: '600', color: C.ink900, lineHeight: 19 },
  savedBannerBtn: {
    alignSelf: 'flex-start', backgroundColor: C.safe600, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  savedBannerBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  preventionLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.sky050, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  preventionLinkText: { fontSize: 13, fontWeight: '700', color: C.brand600 },
  preventionLinkArrow: { fontSize: 18, color: C.ink400 },
  recordFileText: { fontSize: 12.5, color: C.brand600, fontWeight: '600', textAlign: 'center' },
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
  noticeBox: {
    marginTop: 16, padding: 14, borderRadius: 14,
    backgroundColor: C.warn100, borderWidth: 1, borderColor: C.warn600, gap: 4,
  },
  noticeTitle: { color: C.warn600, fontSize: 12.5, fontWeight: '700' },
  noticeText: { color: C.warn600, fontSize: 11.5, lineHeight: 17 },
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