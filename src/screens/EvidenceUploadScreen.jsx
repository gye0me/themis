import { useContext, useState } from 'react';
import { APP_ROUTES, RECORD_ROUTES, EXPERT_ROUTES } from '../navigation/routes';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { AuthContext } from '../context/AuthContext';
import { createEvidenceRecord, getEvidenceRecords, uploadEvidenceThumbnail } from '../services/firebaseService';
import { transcribeAudioClova } from '../services/clovaSpeechService';
import { extractTextFromImage } from '../services/ocrService';

const TYPE_CONFIG = {
  image:    { icon: '📷', color: '#EA580C' },
  audio:    { icon: '🎙️', color: '#7C3AED' },
  video:    { icon: '🎥', color: '#16A34A' },
  text:     { icon: '📝', color: '#3B82F6' },
  contract: { icon: '📑', color: '#0EA5E9' }, // contract 타입 추가
  default:  { icon: '📄', color: '#94A3B8' },
};

function formatDate(capturedAt) {
  // capturedAt 값이 유효하지 않을 경우를 대비하여 방어 코드 추가
  if (!capturedAt || (typeof capturedAt.toDate !== 'function' && isNaN(new Date(capturedAt)))) {
    return '날짜 정보 없음';
  }

  const date = capturedAt?.toDate ? capturedAt.toDate() : new Date(capturedAt);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  const ampm = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 || 12;
  return `${month}월 ${day}일 ${ampm} ${hour12}:${min}`;
}

function formatTimer(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

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
  const [showRecorder, setShowRecorder] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 200);

  // 실제 저장 로직 (파일 선택으로 가져온 파일 / 앱에서 직접 녹음한 파일 공통 사용)
  const saveEvidence = async (evidenceType, file) => {
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
      if (evidenceType === 'audio') {
        try {
          note = await transcribeAudioClova(file.uri, file.mimeType);
        } catch (e) {
          console.warn('클로바 변환 실패:', e.message);
        }
      } else if (evidenceType === 'image') {
        try {
          note = await extractTextFromImage(file.uri);
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

      const msg = evidenceType === 'audio' && note
        ? `음성이 기록되었습니다.\n\n변환된 텍스트:\n"${note.slice(0, 80)}${note.length > 80 ? '...' : ''}"`
        : `${cfg.label}과 GPS 위치, 타임스탬프가 안전하게 기록되었습니다.`;
      Alert.alert('업로드 완료!', msg);
    } catch (error) {
      console.error('업로드 실패:', error);
      Alert.alert('업로드 실패', error.message);
    } finally {
      setUploadingType(null);
    }
  };

  // 파일 선택기로 기존 파일 가져오기 (사진/영상, 그리고 음성의 "파일에서 가져오기")
  const handlePickFile = async (evidenceType) => {
    const cfg = UPLOAD_TYPES[evidenceType];
    if (!cfg || uploadingType !== null) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: cfg.mimeType });
      if (result.canceled || !result.assets?.length) return;
      await saveEvidence(evidenceType, result.assets[0]);
    } catch (error) {
      console.error('파일 선택 실패:', error);
      Alert.alert('오류', error.message);
    }
  };

  // "음성" 카드 탭: 새로 녹음할지 / 기존 음성 메모 파일을 가져올지 선택
  const handleAudioPress = () => {
    if (uploadingType !== null) return;
    Alert.alert(
      '음성 증거 추가',
      '어떻게 추가할까요?',
      [
        { text: '새로 녹음하기', onPress: startRecording },
        { text: '음성 메모에서 가져오기', onPress: () => handlePickFile('audio') },
        { text: '취소', style: 'cancel' },
      ]
    );
  };

  const startRecording = async () => {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('권한 필요', '음성 녹음을 위해 마이크 접근 권한이 필요합니다.');
      return;
    }
    // 녹음을 실제로 시작하려면 오디오 모드를 "녹음 허용"으로 켜줘야 함 (안 하면 준비 단계에서 멈춤)
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setShowRecorder(true);
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const cancelRecording = async () => {
    if (recorderState.isRecording) {
      await audioRecorder.stop();
    }
    setShowRecorder(false);
  };

  const finishRecording = async () => {
    await audioRecorder.stop();
    setShowRecorder(false);
    const uri = audioRecorder.uri;
    if (!uri) {
      Alert.alert('오류', '녹음 파일을 찾을 수 없습니다.');
      return;
    }
    const file = { uri, name: `recording-${Date.now()}.m4a`, mimeType: 'audio/m4a' };
    await saveEvidence('audio', file);
  };

  return (
    // 최상위 View를 SafeAreaView로 변경하여 노치 및 하단 인디케이터 영역을 안전하게 처리합니다.
    <SafeAreaView style={styles.wrapper}>
      {/* 앱바 */}
      <View style={styles.appbar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(APP_ROUTES.HOME_STACK))}
        >
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View style={styles.appbarLogo}>
          <Text style={styles.appbarLogoText}>T</Text>
        </View>
        <View>
          <Text style={styles.appbarTitle}>증거 업로드</Text>
          <Text style={styles.appbarSub}>{caseType ? `${caseType} · 사건 기록 추가하기` : '사건 기록 추가하기'}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 기록 유형 선택 */}
        <Text style={styles.sectionTitle}>기록 유형 선택</Text>

        {/* 계약서 분석 / 사건 대응 퀘스트 — 나란히 배치 */}
        <View style={styles.shortcutRow}>
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => navigation.push(APP_ROUTES.CONTRACT_ANALYSIS, { caseId, caseType })}
          >
            <Text style={styles.shortcutIcon}>📋</Text>
            <Text style={styles.shortcutTitle}>계약서 분석</Text>
            <Text style={styles.shortcutDesc}>독소조항 자동 탐지</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shortcutCard, { borderTopColor: '#3B7DD8' }]}
            onPress={() =>
              caseId
                ? navigation.navigate(EXPERT_ROUTES.GUIDE, { caseId, caseType })
                : navigation.push(RECORD_ROUTES.START, { openForm: true })
            }
          >
            <Text style={styles.shortcutIcon}>🧭</Text>
            <Text style={styles.shortcutTitle}>사건 대응 퀘스트</Text>
            <Text style={styles.shortcutDesc}>
              {caseType ? `${caseType} 단계별 안내` : '유형별 단계별 안내'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4개 카드 그리드 */}
        <View style={styles.cardGrid}>
          <TouchableOpacity
            style={[styles.uploadCard, { borderTopColor: '#EA580C' }]}
            onPress={() => handlePickFile('image')}
            disabled={uploadingType !== null}
          >
            <Text style={styles.cardIcon}>📷</Text>
            {uploadingType === 'image' ? (
              <ActivityIndicator color="#EA580C" style={{ marginVertical: 4 }} />
            ) : (
              <Text style={styles.cardTitle}>사진</Text>
            )}
            <Text style={styles.cardDesc}>현장 사진 촬영</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadCard, { borderTopColor: '#7C3AED' }]}
            onPress={handleAudioPress}
            disabled={uploadingType !== null}
          >
            <Text style={styles.cardIcon}>🎙️</Text>
            {uploadingType === 'audio' ? (
              <ActivityIndicator color="#7C3AED" style={{ marginVertical: 4 }} />
            ) : (
              <Text style={styles.cardTitle}>음성</Text>
            )}
            <Text style={styles.cardDesc}>녹음 또는 음성 메모</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadCard, { borderTopColor: '#16A34A' }]}
            onPress={() => handlePickFile('video')}
            disabled={uploadingType !== null}
          >
            <Text style={styles.cardIcon}>🎥</Text>
            {uploadingType === 'video' ? (
              <ActivityIndicator color="#16A34A" style={{ marginVertical: 4 }} />
            ) : (
              <Text style={styles.cardTitle}>영상</Text>
            )}
            <Text style={styles.cardDesc}>동영상 파일 업로드</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadCard, { borderTopColor: '#94A3B8' }]}
            onPress={() => navigation.navigate(APP_ROUTES.UPLOAD_SCREEN, { caseId, caseType })}
          >
            <Text style={styles.cardIcon}>📝</Text>
            <Text style={styles.cardTitle}>상세 기록</Text>
            <Text style={styles.cardDesc}>텍스트 직접 입력</Text>
          </TouchableOpacity>
        </View>

        {/* GPS 안내 — 캡션 한 줄 */}
        <Text style={styles.gpsCaption}>📍 업로드 시 위치와 시간이 자동으로 기록돼요</Text>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* 녹음 중 모달 */}
      <Modal visible={showRecorder} transparent animationType="fade">
        <View style={styles.recorderOverlay}>
          <View style={styles.recorderCard}>
            <View style={styles.recorderDot} />
            <Text style={styles.recorderTimer}>{formatTimer(recorderState.durationMillis ?? 0)}</Text>
            <Text style={styles.recorderLabel}>{recorderState.isRecording ? '녹음 중...' : '준비 중...'}</Text>
            <View style={styles.recorderBtnRow}>
              <TouchableOpacity style={styles.recorderCancelBtn} onPress={cancelRecording}>
                <Text style={styles.recorderCancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.recorderStopBtn} onPress={finishRecording}>
                <Text style={styles.recorderStopBtnText}>■  저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 하단 네비바 */}
      <View style={styles.navbar}>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIconActive}>✏️</Text>
          <Text style={styles.navLabelActive}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.EXPERTS_STACK)}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>전문가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.CHATS_STACK)}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>채팅</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate(APP_ROUTES.HOME_STACK)}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>홈</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },
  appbar: {
    backgroundColor: '#1E3A5F',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appbarLogo: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: '#3B7DD8',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtn: { paddingVertical: 4, paddingRight: 6 },
  back: { color: '#7B9EC5', fontSize: 24 },
  appbarLogoText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  appbarTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  appbarSub: { color: '#7B9EC5', fontSize: 11 },
  content: { flex: 1, padding: 16 },
  sectionTitle: {
    fontSize: 10, fontWeight: '500', color: '#94A3B8',
    letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase',
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    borderTopWidth: 3,
    borderTopColor: '#5B8FD1',
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  shortcutIcon: { fontSize: 22 },
  shortcutTitle: { color: '#F1F5F9', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  shortcutDesc: { color: '#7B9EC5', fontSize: 10, textAlign: 'center' },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10,
    width: '47.5%',
    alignItems: 'center',
    borderTopWidth: 3,
  },
  cardIcon: { fontSize: 28, marginBottom: 6 },
  cardTitle: { color: '#0F172A', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  cardDesc: { color: '#94A3B8', fontSize: 11, textAlign: 'center' },
  gpsCaption: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
  },
  recorderOverlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  recorderCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 28, alignItems: 'center', gap: 8, width: '78%',
  },
  recorderDot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#EF4444', marginBottom: 6,
  },
  recorderTimer: { fontSize: 32, fontWeight: '700', color: '#0F172A' },
  recorderLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 12 },
  recorderBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  recorderCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center',
  },
  recorderCancelBtnText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  recorderStopBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#1E3A5F', alignItems: 'center',
  },
  recorderStopBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  navbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 8,
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  navItemActive: {
    backgroundColor: '#0F1F3D', borderRadius: 8, paddingVertical: 6,
  },
  navIcon: { fontSize: 20 },
  navIconActive: { fontSize: 20 },
  navLabel: { fontSize: 10, color: '#94A3B8' },
  navLabelActive: { fontSize: 10, color: '#FFFFFF', fontWeight: '500' },
});