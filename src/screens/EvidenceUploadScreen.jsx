import { useContext, useState } from 'react';
import { APP_ROUTES, RECORD_ROUTES, EXPERT_ROUTES } from '../navigation/routes';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import { createEvidenceRecord, getEvidenceRecords } from '../services/firebaseService';
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

  const handleUpload = async (evidenceType) => {
    const cfg = UPLOAD_TYPES[evidenceType];
    // 문서 선택기를 호출하기 전에 업로드 상태를 먼저 확인하여 중복 실행을 방지합니다.
    if (!cfg || uploadingType !== null) return;

    // await 이전에 상태를 먼저 설정하여 동시 클릭 문제를 해결합니다.
    setUploadingType(evidenceType);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: cfg.mimeType });
      // 사용자가 파일 선택을 취소하면, 업로드 상태를 초기화하고 함수를 종료합니다.
      if (result.canceled || !result.assets?.length) { setUploadingType(null); return; }

      const file = result.assets[0];

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

      await createEvidenceRecord({
        userId: user?.uid ?? null,
        caseId: caseId ?? 'general',
        title: cfg.title,
        evidenceType,
        note,
        file,
        location,
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
            onPress={() => handleUpload('audio')}
            disabled={uploadingType !== null}
          >
            <Text style={styles.cardIcon}>🎙️</Text>
            {uploadingType === 'audio' ? (
              <ActivityIndicator color="#7C3AED" style={{ marginVertical: 4 }} />
            ) : (
              <Text style={styles.cardTitle}>음성</Text>
            )}
            <Text style={styles.cardDesc}>녹음 파일 업로드</Text>
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

        <View style={{ height: 24 }} />
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