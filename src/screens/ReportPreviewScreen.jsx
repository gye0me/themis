import Svg, { Path } from 'react-native-svg';
import { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Modal, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { buildQuestSteps } from '../services/responseGuideSteps';
import { buildCaseReportHtml, buildReportHashPayload } from '../services/reportHtml';
import { hashContent } from '../services/signatureService';
import { finalizeCaseReport } from '../services/firebaseService';
import { BackHeader } from '../components/BackHeader';
import { C } from '../theme/tokens';

function toJsDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const EMPTY_RECORDS = [];

// 증거 타임라인(TimelineScreen)에서 "보고서 보기"를 누르면 이 화면으로 넘어와
// 1) 실제 보고서 HTML을 WebView로 앱 안에서 그대로 미리 보여주고
// 2) 하단 다운로드 버튼으로 PDF(기본) 또는 HTML 파일로 기기에 실제로 저장한다.
export default function ReportPreviewScreen({ navigation, route }) {
  const caseData = route?.params?.caseData ?? null;
  const records = route?.params?.records ?? EMPTY_RECORDS;
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [signatureModal, setSignatureModal] = useState(false);
  const [signed, setSigned] = useState(false);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);

  // 이 사건이 이미 예전에 확정된 적 있으면(caseData.reportFinalizedAt) 그 기록을 그대로 보여준다.
  const [signatureDataUrl, setSignatureDataUrl] = useState(caseData?.reportSignatureDataUrl ?? null);
  const [finalizationHash, setFinalizationHash] = useState(caseData?.reportFinalizationHash ?? null);
  const [finalizedAt, setFinalizedAt] = useState(() => toJsDate(caseData?.reportFinalizedAt) ?? null);

  const questItems = useMemo(
    () => (caseData ? buildQuestSteps(caseData.caseType, caseData.questSteps ?? []).items : []),
    [caseData]
  );

  const effectiveCaseData = useMemo(() => ({
    title: caseData?.title || '증거 정리 보고서',
    caseType: caseData?.caseType || null,
    createdAt: caseData?.createdAt ?? records[records.length - 1]?.capturedAt,
  }), [caseData, records]);

  const buildHtml = useCallback((sigUrl, hash, finalizedAtValue) => buildCaseReportHtml({
    caseData: effectiveCaseData,
    records,
    questItems,
    signatureDataUrl: sigUrl ?? null,
    finalization: hash ? { hash, finalizedAt: finalizedAtValue } : null,
  }), [effectiveCaseData, records, questItems]);

  const html = useMemo(
    () => buildHtml(signatureDataUrl, finalizationHash, finalizedAt),
    [buildHtml, signatureDataUrl, finalizationHash, finalizedAt]
  );

  async function saveOnAndroidToPickedFolder(fileName) {
    const SAF = FileSystem.StorageAccessFramework;
    if (!SAF) return false;
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return false;
    const destUri = await SAF.createFileAsync(perm.directoryUri, fileName, 'text/html');
    await FileSystem.writeAsStringAsync(destUri, html, { encoding: FileSystem.EncodingType.UTF8 });
    return true;
  }

  async function handleDownload() {
    if (saving) return;
    setSaving(true);
    try {
      const fileName = `themis-report-${Date.now()}.html`;

      if (Platform.OS === 'web') {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      // Android: 사용자가 고른 폴더(다운로드 등)에 실제 파일로 저장.
      // 사용자가 폴더 선택을 취소하면 아래 공유 시트 방식으로 대체한다.
      if (Platform.OS === 'android') {
        const saved = await saveOnAndroidToPickedFolder(fileName).catch((err) => {
          console.warn('SAF 저장 실패, 공유 방식으로 대체:', err.message);
          return false;
        });
        if (saved) {
          Alert.alert('저장 완료', '선택한 폴더에 보고서 HTML 파일이 저장되었습니다.');
          return;
        }
      }

      // iOS(및 Android 폴백): 앱 저장소에 파일을 쓴 뒤 공유 시트를 통해
      // "파일에 저장"으로 실제 기기 저장소에 저장하도록 안내한다.
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, html, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/html',
          dialogTitle: '보고서 HTML 파일 저장',
          UTI: 'public.html',
        });
      } else {
        Alert.alert('저장 완료', `기기 저장소에 파일이 생성되었습니다.\n${fileUri}`);
      }
    } catch (err) {
      console.error('HTML 보고서 저장 오류:', err);
      Alert.alert('오류', '보고서를 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  async function saveOnAndroidToPickedFolderPdf(sourceUri, fileName) {
    const SAF = FileSystem.StorageAccessFramework;
    if (!SAF) return false;
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return false;
    const destUri = await SAF.createFileAsync(perm.directoryUri, fileName, 'application/pdf');
    const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return true;
  }

  async function handleDownloadPdf() {
    const htmlToUse = html;
    if (savingPdf) return;
    setSavingPdf(true);
    try {
      // 웹은 브라우저 인쇄 대화상자를 통해 사용자가 직접 "PDF로 저장"을 선택한다.
      if (Platform.OS === 'web') {
        await Print.printToFileAsync({ html: htmlToUse });
        return;
      }

      // 지금 만든 HTML(워터마크·SHA-256·서버 타임스탬프 포함)을 그대로 PDF로 렌더링한다.
      const { uri } = await Print.printToFileAsync({ html: htmlToUse });
      const fileName = `themis-report-${Date.now()}.pdf`;

      if (Platform.OS === 'android') {
        const saved = await saveOnAndroidToPickedFolderPdf(uri, fileName).catch((err) => {
          console.warn('SAF 저장 실패, 공유 방식으로 대체:', err.message);
          return false;
        });
        if (saved) {
          Alert.alert('저장 완료', '선택한 폴더에 보고서 PDF 파일이 저장되었습니다.');
          return;
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: '보고서 PDF 파일 저장',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('저장 완료', `기기 저장소에 PDF가 생성되었습니다.\n${uri}`);
      }
    } catch (err) {
      console.error('PDF 보고서 생성 오류:', err);
      Alert.alert('오류', 'PDF를 생성하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSavingPdf(false);
    }
  }

  // 서명 → 확정: 서명은 "내가 확인했다"는 증거, 해시는 "확정 이후 안 바뀌었다"는 증거로 함께 남긴다.
  async function handleFinalize() {
    if (!signed || finalizing) return;
    setFinalizing(true);
    try {
      let sigUrl = null;
      if (Platform.OS === 'web' && paths.length > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#1E3A5F';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        paths.forEach((path) => {
          if (path.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(path[0].x, path[0].y);
          path.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        });
        sigUrl = canvas.toDataURL('image/png');
      } else if (paths.length > 0) {
        const svgPaths = paths.map((path) => {
          if (path.length < 2) return '';
          const d = path.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
          return `<path d="${d}" stroke="#1E3A5F" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        }).join('');
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150">${svgPaths}</svg>`;
        sigUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      }

      const hash = await hashContent(buildReportHashPayload({ caseData: effectiveCaseData, records, questItems }));
      const confirmedAt = new Date();

      // 사건에 연결된 보고서(caseData.id가 있는 경우)만 Firestore에 확정 기록을 남긴다 —
      // caseId 없이(일반 기록) 열람 중인 보고서는 이번에 내려받는 파일에만 반영된다.
      if (caseData?.id) {
        await finalizeCaseReport(caseData.id, { hash, signatureDataUrl: sigUrl });
      }

      setSignatureDataUrl(sigUrl);
      setFinalizationHash(hash);
      setFinalizedAt(confirmedAt);
      setSignatureModal(false);
      Alert.alert('확정 완료', '보고서가 서명·해시값과 함께 확정되었습니다.');
    } catch (err) {
      console.error('보고서 확정 오류:', err);
      Alert.alert('오류', '보고서를 확정하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <BackHeader
        title="보고서 미리보기"
        subtitle={caseData?.title || '증거 정리 보고서'}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.webviewBox}>
        {Platform.OS === 'web' ? (
          <iframe
            title="report-preview"
            srcDoc={html}
            style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: html }}
            style={styles.webview}
            onLoadEnd={() => setWebviewLoading(false)}
          />
        )}
        {webviewLoading && Platform.OS !== 'web' && (
          <View style={styles.webviewLoading} pointerEvents="none">
            <ActivityIndicator size="large" color={C.brand600} />
          </View>
        )}
      </View>

      {/* 확정 상태 배너 — 서명 = "내가 확인했다"는 증거, 해시 = "확정 이후 안 바뀌었다"는 증거 */}
      {finalizationHash ? (
        <View style={styles.finalizedBanner}>
          <Text style={styles.finalizedBannerTitle}>✅ 보고서 확정됨 · {finalizedAt ? finalizedAt.toLocaleString('ko-KR') : ''}</Text>
          <Text style={styles.finalizedBannerHash} numberOfLines={1}>해시 {finalizationHash}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.finalizeRow} onPress={() => setSignatureModal(true)}>
          <Text style={styles.finalizeRowText}>✍️ 서명하고 보고서 확정하기</Text>
        </TouchableOpacity>
      )}

      {/* 팀 결정 확인 전까지 HTML을 기본(큰 버튼)으로 유지 — PDF는 옆에 보조 옵션으로만 둠 */}
      <View style={styles.downloadRow}>
        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.downloadBtnText}>⬇ HTML 파일로 다운로드</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.downloadBtnSecondary} onPress={handleDownloadPdf} disabled={savingPdf}>
          {savingPdf ? (
            <ActivityIndicator color={C.brand600} />
          ) : (
            <Text style={styles.downloadBtnSecondaryText}>PDF로</Text>
          )}
        </TouchableOpacity>
      </View>
      <Modal
        visible={signatureModal}
        transparent
        animationType="slide"
        onRequestClose={() => setSignatureModal(false)}
      >
        <View style={sigStyles.backdrop}>
          <View style={sigStyles.card}>
            <Text style={sigStyles.title}>서명 후 보고서를 확정합니다</Text>
            <Text style={sigStyles.desc}>
              서명은 "내가 이 보고서를 확인했다"는 증거이고, 확정 시 함께 남는 해시값은{'\n'}
              "이후 내용이 바뀌지 않았다"는 증거예요. 확정 후에도 HTML/PDF 다운로드는 자유롭게 하실 수 있습니다.{'\n\n'}
              서명란에 서명 후 아래 버튼으로 확정해주세요.
            </Text>

            <View style={sigStyles.padWrap}>
              <Text style={sigStyles.padLabel}>아래에 서명하세요</Text>
              <View
                style={sigStyles.pad}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderGrant: (e) => {
                    const { locationX, locationY } = e.nativeEvent;
                    setCurrentPath([{ x: locationX, y: locationY }]);
                  },
                  onPanResponderMove: (e) => {
                    const { locationX, locationY } = e.nativeEvent;
                    setCurrentPath((prev) => [...prev, { x: locationX, y: locationY }]);
                  },
                  onPanResponderRelease: () => {
                    setPaths((prev) => [...prev, currentPath]);
                    setCurrentPath([]);
                    setSigned(true);
                  },
                }).panHandlers}
              >
                {Platform.OS === 'web' ? (
                  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                    {paths.map((path, i) => (
                      <polyline key={i} points={path.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1E3A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {currentPath.length > 0 && (
                      <polyline points={currentPath.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1E3A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                ) : (
                  <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                    {paths.map((path, i) => {
                      if (path.length < 2) return null;
                      const d = path.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                      return <Path key={i} d={d} stroke="#1E3A5F" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
                    })}
                    {currentPath.length > 1 && (
                      <Path
                        d={currentPath.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
                        stroke="#1E3A5F" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"
                      />
                    )}
                  </Svg>
                )}
              </View>
              {signed && (
                <TouchableOpacity onPress={() => { setPaths([]); setSigned(false); }}>
                  <Text style={sigStyles.clear}>다시 서명하기</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={sigStyles.btnRow}>
              <TouchableOpacity style={sigStyles.cancelBtn} onPress={() => setSignatureModal(false)}>
                <Text style={sigStyles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sigStyles.confirmBtn, (!signed || finalizing) && { opacity: 0.4 }]}
                disabled={!signed || finalizing}
                onPress={handleFinalize}
              >
                {finalizing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={sigStyles.confirmBtnText}>보고서 확정</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  webviewBox: { flex: 1 },
  webview: { flex: 1, backgroundColor: C.surface },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surface,
  },
  finalizeRow: {
    backgroundColor: C.sky050, borderTopWidth: 1, borderTopColor: C.line,
    paddingVertical: 14, alignItems: 'center',
  },
  finalizeRowText: { color: C.brand600, fontSize: 13.5, fontWeight: '700' },
  finalizedBanner: {
    backgroundColor: C.safe100, borderTopWidth: 1, borderTopColor: C.line,
    paddingVertical: 10, paddingHorizontal: 16, gap: 2,
  },
  finalizedBannerTitle: { color: C.safe600, fontSize: 12.5, fontWeight: '700' },
  finalizedBannerHash: { color: C.ink500, fontSize: 10.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  downloadRow: { flexDirection: 'row', gap: 1 },
  downloadBtn: {
    flex: 3, backgroundColor: C.brand600, padding: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  downloadBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  downloadBtnSecondary: {
    flex: 1, backgroundColor: C.ink950, padding: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  downloadBtnSecondaryText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
});
const sigStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  title: { color: C.ink900, fontSize: 16, fontWeight: '700' },
  desc: { color: C.ink500, fontSize: 12, lineHeight: 18 },
  padWrap: { gap: 6 },
  padLabel: { color: C.ink400, fontSize: 11 },
  pad: { height: 150, backgroundColor: C.sky050, borderRadius: 12, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  clear: { color: C.brand600, fontSize: 11, textAlign: 'right', marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
  cancelBtnText: { color: C.ink500, fontSize: 13, fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: C.brand600, alignItems: 'center' },
  confirmBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
