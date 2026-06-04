import { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import { createEvidenceRecord, getEvidenceRecords } from '../services/firebaseService';

const TYPE_CONFIG = {
  image:  { icon: '📷', color: '#EA580C' },
  audio:  { icon: '🎙️', color: '#7C3AED' },
  video:  { icon: '🎥', color: '#16A34A' },
  text:   { icon: '📝', color: '#3B82F6' },
  default:{ icon: '📄', color: '#94A3B8' },
};

function formatDate(capturedAt) {
  if (!capturedAt) return '';
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

export function EvidenceUploadScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [uploadingType, setUploadingType] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);

  useEffect(() => {
    if (!user) return;
    getEvidenceRecords(user.uid)
      .then((data) => setRecentRecords(data.slice(0, 3)))
      .catch(() => {});
  }, [user]);

  const handleUpload = async (evidenceType) => {
    const cfg = UPLOAD_TYPES[evidenceType];
    if (!cfg) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: cfg.mimeType });
      if (result.canceled || !result.assets?.length) return;

      setUploadingType(evidenceType);
      const file = result.assets[0];

      let location = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }

      await createEvidenceRecord({
        userId: user?.uid ?? null,
        caseId: 'case_12345',
        title: cfg.title,
        evidenceType,
        file,
        location,
      });

      Alert.alert('업로드 완료!', `${cfg.label}과 GPS 위치, 타임스탬프가 안전하게 기록되었습니다.`);
    } catch (error) {
      console.error('업로드 실패:', error);
      Alert.alert('업로드 실패', error.message);
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* 앱바 */}
      <View style={styles.appbar}>
        <View style={styles.appbarLogo}>
          <Text style={styles.appbarLogoText}>T</Text>
        </View>
        <View>
          <Text style={styles.appbarTitle}>증거 업로드</Text>
          <Text style={styles.appbarSub}>사건 기록 추가하기</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 기록 유형 선택 */}
        <Text style={styles.sectionTitle}>기록 유형 선택</Text>

        {/* 계약서 분석 큰 카드 */}
        <TouchableOpacity style={styles.contractCard}>
          <Text style={styles.contractIcon}>📋</Text>
          <View>
            <Text style={styles.contractTitle}>계약서 분석</Text>
            <Text style={styles.contractDesc}>독소조항 자동 탐지</Text>
          </View>
        </TouchableOpacity>

        {/* 4개 카드 그리드 */}
        <View style={styles.cardGrid}>
          <TouchableOpacity
            style={[styles.uploadCard, { borderTopColor: '#EA580C' }]}
            onPress={() => handleUpload('image')}
            disabled={uploadingType !== null}
          >
            <Text style={styles.cardIcon}>📷</Text>
            <Text style={styles.cardTitle}>{uploadingType === 'image' ? '업로드 중...' : '사진'}</Text>
            <Text style={styles.cardDesc}>현장 사진 촬영</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadCard, { borderTopColor: '#7C3AED' }]}
            onPress={() => handleUpload('audio')}
            disabled={uploadingType !== null}
          >
            <Text style={styles.cardIcon}>🎙️</Text>
            <Text style={styles.cardTitle}>{uploadingType === 'audio' ? '업로드 중...' : '음성'}</Text>
            <Text style={styles.cardDesc}>녹음 파일 업로드</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadCard, { borderTopColor: '#16A34A' }]}
            onPress={() => handleUpload('video')}
            disabled={uploadingType !== null}
          >
            <Text style={styles.cardIcon}>🎥</Text>
            <Text style={styles.cardTitle}>{uploadingType === 'video' ? '업로드 중...' : '영상'}</Text>
            <Text style={styles.cardDesc}>동영상 파일 업로드</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.uploadCard, { borderTopColor: '#94A3B8' }]}>
            <Text style={styles.cardIcon}>📝</Text>
            <Text style={styles.cardTitle}>메모</Text>
            <Text style={styles.cardDesc}>텍스트 직접 입력</Text>
          </TouchableOpacity>
        </View>

        {/* GPS 안내 */}
        <View style={styles.gpsNotice}>
          <Text style={styles.gpsTitle}>📍 GPS + 타임스탬프 자동 저장</Text>
          <Text style={styles.gpsDesc}>업로드 시 현재 위치와 시간이 자동으로 기록됩니다</Text>
        </View>

        {/* 내 타임라인 */}
        <Text style={styles.sectionTitle2}>내 타임라인</Text>

        {recentRecords.length === 0 ? (
          <View style={styles.timelineEmpty}>
            <Text style={styles.timelineEmptyText}>아직 업로드된 증거가 없습니다</Text>
          </View>
        ) : (
          recentRecords.map((item) => {
            const cfg = TYPE_CONFIG[item.evidenceType] ?? TYPE_CONFIG.default;
            return (
              <View key={item.id} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: cfg.color }]} />
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineDate}>{formatDate(item.capturedAt)}</Text>
                  <Text style={styles.timelineTitle}>
                    {cfg.icon} {item.title || cfg.label}
                  </Text>
                  {item.originalFileName ? (
                    <Text style={styles.timelineSub}>{item.originalFileName}</Text>
                  ) : null}
                </View>
                {item.location && (
                  <Text style={styles.timelineGps}>GPS ✓</Text>
                )}
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.timelineBtn}
          onPress={() => navigation.navigate('EvidenceTimeline')}
        >
          <Text style={styles.timelineBtnText}>증거 타임라인 전체 보기 →</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* 하단 네비바 */}
      <View style={styles.navbar}>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIconActive}>✏️</Text>
          <Text style={styles.navLabelActive}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>전문가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>채팅</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('App')}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>홈</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  appbarLogoText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  appbarTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  appbarSub: { color: '#7B9EC5', fontSize: 11 },
  content: { flex: 1, padding: 16 },
  sectionTitle: {
    fontSize: 10, fontWeight: '500', color: '#94A3B8',
    letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase',
  },
  sectionTitle2: {
    fontSize: 10, fontWeight: '500', color: '#94A3B8',
    letterSpacing: 1, marginBottom: 10, marginTop: 8, textTransform: 'uppercase',
  },
  contractCard: {
    backgroundColor: '#1E3A5F',
    padding: 18,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  contractIcon: { fontSize: 30 },
  contractTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  contractDesc: { color: '#7B9EC5', fontSize: 12 },
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
  gpsNotice: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  gpsTitle: { color: '#1D4ED8', fontSize: 12, fontWeight: '500', marginBottom: 2 },
  gpsDesc: { color: '#3B82F6', fontSize: 11 },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
  },
  timelineDot: {
    width: 8, height: 8, borderRadius: 4,
    marginTop: 4,
  },
  timelineEmpty: { paddingVertical: 16, alignItems: 'center' },
  timelineEmptyText: { color: '#94A3B8', fontSize: 12 },
  timelineBody: { flex: 1 },
  timelineDate: { color: '#94A3B8', fontSize: 10, marginBottom: 2 },
  timelineTitle: { color: '#0F172A', fontSize: 12, fontWeight: '500' },
  timelineSub: { color: '#64748B', fontSize: 10, marginTop: 2 },
  timelineGps: { color: '#1D4ED8', fontSize: 9, fontWeight: '500' },
  timelineBtn: {
    backgroundColor: '#1E3A5F',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  timelineBtnText: { color: '#F1F5F9', fontSize: 13, fontWeight: '500' },
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
