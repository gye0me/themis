import { useContext, useState } from 'react';
import { APP_ROUTES, RECORD_ROUTES, EXPERT_ROUTES } from '../navigation/routes';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { AuthContext } from '../context/AuthContext';
import { createEvidenceRecord, getEvidenceRecords } from '../services/firebaseService';
import { transcribeAudioClova } from '../services/clovaSpeechService';

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

// 녹음 시간을 mm:ss 형식으로 표시
function formatDuration(ms) {
  const totalSec = Math.floor((ms ?? 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

  // 앱 안에서 바로 녹음하기 위한 상태
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);

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
      }

      await createEvidenceRecord({
        userId: user?.uid ?? null,
        caseId: caseId ?? 'general',
        title: cfg.title,
        evidenceType,
        note,
        file,
        location,
      });

      let msg;
      if (evidenceType === 'audio' && note) {
        msg = `음성이 기록되었습니다.\n\n변환된 텍스트:\n"${note.slice(0, 80)}${note.length > 80 ? '...' : ''}"`;
      } else if (evidenceType === 'audio' && sttError) {
        // 파일 업로드는 성공했지만 클로바 텍스트 변환만 실패한 경우 — 원인을 사용자에게 알려준다.
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

  const handleUpload = async (evidenceType) => {
    const cfg = UPLOAD_TYPES[evidenceType];
    // 문서 선택기를 호출하기 전에 업로드 상태를 먼저 확인하여 중복 실행을 방지합니다.
    if (!cfg || uploadingType !== null) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: cfg.mimeType });
      // 사용자가 파일 선택을 취소하면 그대로 종료합니다.
      if (result.canceled || !result.assets?.length) return;
      await uploadEvidence(evidenceType, result.assets[0]);
    } catch (error) {
      console.error('파일 선택 실패:', error);
      Alert.alert('오류', '파일을 선택하지 못했습니다.');
    }
  };

  // 음성 버튼 — 파일 선택 대신 바로 녹음할지 물어봄
  const handleAudioPress = () => {
    if (uploadingType !== null) return;
    Alert.alert('음성 기록', '어떻게 기록할까요?', [
      { text: '지금 녹음하기', onPress: () => setRecordModalVisible(true) },
      { text: '파일에서 선택', onPress: () => handleUpload('audio') },
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
      // 녹음 모드를 켜주지 않으면 권한이 있어도 실제 녹음이 시작되지 않는다.
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
    // 최상위 View를 SafeAreaView로 변경하여 노치 및 하단 인디케이터 영역을 안전하게 처리합니다.
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.statusbar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusApp}>Themis</Text>
      </View>
      {/* 앱바 */}
      <View style={styles.appbar}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 16 }}
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
            onPress={() => navigation.push(APP_ROUTES.CONTRACT_ANALYSIS)}
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
            onPress={() => handleUpload('image')}
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
            <Text style={styles.cardDesc}>지금 녹음 또는 파일 선택</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadCard, { borderTopColor: '#16A34A' }]}
            onPress={() => handleUpload('video')}
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
            onPress={() => navigation.navigate(APP_ROUTES.UPLOAD_SCREEN)}
          >
            <Text style={styles.cardIcon}>📝</Text>
            <Text style={styles.cardTitle}>상세 기록</Text>
            <Text style={styles.cardDesc}>텍스트 직접 입력</Text>
          </TouchableOpacity>
        </View>

        {/* GPS 안내 — 캡션 한 줄 */}
        <Text style={styles.gpsCaption}>📍 업로드 시 위치와 시간이 자동으로 기록돼요</Text>

        <View style={{ height: 90 }} />
      </ScrollView>

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

      {/* 즉석 음성 녹음 모달 */}
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
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },
  statusbar: {
    backgroundColor: '#0F1F3D', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  statusTime: { color: '#6B84A8', fontSize: 12 },
  statusApp: { color: '#6B84A8', fontSize: 12 },
  appbar: {
    backgroundColor: '#1E3A5F',
    paddingTop: 16,
    paddingBottom: 16,
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
  navbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    paddingBottom: 18,
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  navItemActive: {
    backgroundColor: '#0F1F3D', borderRadius: 10, paddingVertical: 9,
  },
  navIcon: { fontSize: 22 },
  navIconActive: { fontSize: 22 },
  navLabel: { fontSize: 11, color: '#94A3B8' },
  navLabelActive: { fontSize: 11, color: '#FFFFFF', fontWeight: '500' },
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
  recordTitle: { color: '#0F172A', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  recordTimer: { color: '#1E3A5F', fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'], marginBottom: 24 },
  recordStartBtn: {
    backgroundColor: '#7C3AED', borderRadius: 30,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  recordStartBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  recordStopBtn: {
    backgroundColor: '#DC2626', borderRadius: 30,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  recordStopBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  recordActionRow: { flexDirection: 'row', gap: 10 },
  recordRetryBtn: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  recordRetryBtnText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  recordConfirmBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  recordConfirmBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  recordCloseText: { color: '#94A3B8', fontSize: 12 },
});