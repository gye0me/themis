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

  // 파일 선택기로 기존 파일 가져오기 (사진/영상, 그리고 음성의 "파일에서 가져오기")
  const handlePickFile = async (evidenceType) => {
    const cfg = UPLOAD_TYPES[evidenceType];
    if (!cfg || uploadingType !== null) return;
    try {
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
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.statusbar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusApp}>Themis</Text>
      </View>
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
        <Text style={styles.sectionTitle}>기록 유형 선택</Text>

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
            <Text style={styles.cardDesc}>지금 녹음 또는 파일 선택</Text>
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

        <Text style={styles.gpsCaption}>📍 업로드 시 위치와 시간이 자동으로 기록돼요</Text>

        <View style={{ height: 90 }} />
      </ScrollView>

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