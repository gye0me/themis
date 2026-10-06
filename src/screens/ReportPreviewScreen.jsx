import { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { buildQuestSteps } from '../services/responseGuideSteps';
import { buildCaseReportHtml, buildReportHashPayload } from '../services/reportHtml';
import { hashContent } from '../services/signatureService';
import { finalizeCaseReport } from '../services/firebaseService';
import {
  REPORT_LEGAL_NOTICE_TITLE,
  REPORT_LEGAL_NOTICE_ITEMS,
  REPORT_LEGAL_NOTICE_FOOTER,
  REPORT_LEGAL_NOTICE_ACK,
  REPORT_LEGAL_NOTICE_VERSION,
} from '../services/reportLegalNotice';
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
  const [noticeModal, setNoticeModal] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  // 이 사건이 이미 예전에 확정된 적 있으면(caseData.reportFinalizedAt) 그 기록을 그대로 보여준다.
  const [finalizationHash, setFinalizationHash] = useState(caseData?.reportFinalizationHash ?? null);
  const [finalizedAt, setFinalizedAt] = useState(() => toJsDate(caseData?.reportFinalizedAt) ?? null);

  const questItems = useMemo(
    () => (caseData ? buildQuestSteps(caseData.caseType, caseData.questSteps ?? [], caseData.tags ?? []).items : []),
    [caseData]
  );

  const effectiveCaseData = useMemo(() => ({
    title: caseData?.title || '증거 정리 보고서',
    caseType: caseData?.caseType || null,
    createdAt: caseData?.createdAt ?? records[records.length - 1]?.capturedAt,
  }), [caseData, records]);

  const buildHtml = useCallback((hash, finalizedAtValue) => buildCaseReportHtml({
    caseData: effectiveCaseData,
    records,
    questItems,
    finalization: hash ? { hash, finalizedAt: finalizedAtValue } : null,
  }), [effectiveCaseData, records, questItems]);

  const html = useMemo(
    () => buildHtml(finalizationHash, finalizedAt),
    [buildHtml, finalizationHash, finalizedAt]
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

  // 법적 효력 안내 확인 → 확정: 확인 기록은 "이 보고서의 한계를 알고 확정했다"는 근거,
  // 해시는 "확정 이후 안 바뀌었다"는 근거로 함께 남긴다.
  async function handleFinalize() {
    if (!acknowledged || finalizing) return;
    setFinalizing(true);
    try {
      const hash = await hashContent(buildReportHashPayload({ caseData: effectiveCaseData, records, questItems }));
      const confirmedAt = new Date();

      // 사건에 연결된 보고서(caseData.id가 있는 경우)만 Firestore에 확정 기록을 남긴다 —
      // caseId 없이(일반 기록) 열람 중인 보고서는 이번에 내려받는 파일에만 반영된다.
      if (caseData?.id) {
        await finalizeCaseReport(caseData.id, { hash, legalNoticeVersion: REPORT_LEGAL_NOTICE_VERSION });
      }

      setFinalizationHash(hash);
      setFinalizedAt(confirmedAt);
      setNoticeModal(false);
      Alert.alert('확정 완료', '법적 효력 안내 확인과 해시값이 함께 기록되었습니다.');
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

      {/* 확정 상태 배너 — 법적 효력 안내 확인 + 해시 = "확정 이후 안 바뀌었다"는 근거 */}
      {finalizationHash ? (
        <View style={styles.finalizedBanner}>
          <Text style={styles.finalizedBannerTitle}>✅ 보고서 확정됨 · {finalizedAt ? finalizedAt.toLocaleString('ko-KR') : ''}</Text>
          <Text style={styles.finalizedBannerHash} numberOfLines={1}>해시 {finalizationHash}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.finalizeRow} onPress={() => { setAcknowledged(false); setNoticeModal(true); }}>
          <Text style={styles.finalizeRowText}>⚖️ 법적 효력 안내 확인 후 보고서 확정하기</Text>
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
        visible={noticeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setNoticeModal(false)}
      >
        <View style={noticeStyles.backdrop}>
          <View style={noticeStyles.card}>
            <Text style={noticeStyles.title}>⚠️ {REPORT_LEGAL_NOTICE_TITLE}</Text>
            <Text style={noticeStyles.desc}>보고서를 확정하기 전에 아래 내용을 꼭 확인해주세요.</Text>

            <ScrollView style={noticeStyles.noticeBox} contentContainerStyle={{ gap: 8 }}>
              {REPORT_LEGAL_NOTICE_ITEMS.map((item, i) => (
                <View key={i} style={noticeStyles.noticeItem}>
                  <Text style={noticeStyles.noticeBullet}>•</Text>
                  <Text style={noticeStyles.noticeText}>{item}</Text>
                </View>
              ))}
              <Text style={noticeStyles.noticeFooter}>{REPORT_LEGAL_NOTICE_FOOTER}</Text>
            </ScrollView>

            <TouchableOpacity style={noticeStyles.ackRow} onPress={() => setAcknowledged((v) => !v)} activeOpacity={0.8}>
              <View style={[noticeStyles.checkbox, acknowledged && noticeStyles.checkboxChecked]}>
                {acknowledged && <Text style={noticeStyles.checkboxMark}>✓</Text>}
              </View>
              <Text style={noticeStyles.ackText}>{REPORT_LEGAL_NOTICE_ACK}</Text>
            </TouchableOpacity>

            <View style={noticeStyles.btnRow}>
              <TouchableOpacity style={noticeStyles.cancelBtn} onPress={() => setNoticeModal(false)}>
                <Text style={noticeStyles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[noticeStyles.confirmBtn, (!acknowledged || finalizing) && { opacity: 0.4 }]}
                disabled={!acknowledged || finalizing}
                onPress={handleFinalize}
              >
                {finalizing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={noticeStyles.confirmBtnText}>확인하고 확정</Text>}
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
const noticeStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12, maxHeight: '90%' },
  title: { color: C.ink900, fontSize: 16, fontWeight: '700' },
  desc: { color: C.ink500, fontSize: 12, lineHeight: 18 },
  noticeBox: {
    backgroundColor: C.warn100, borderRadius: 12, padding: 14, maxHeight: 300,
  },
  noticeItem: { flexDirection: 'row', gap: 6 },
  noticeBullet: { color: C.warn600, fontSize: 12.5, lineHeight: 19, fontWeight: '700' },
  noticeText: { flex: 1, color: C.ink700, fontSize: 12.5, lineHeight: 19 },
  noticeFooter: { color: C.ink500, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  ackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.ink400, marginTop: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: C.brand600, borderColor: C.brand600 },
  checkboxMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  ackText: { flex: 1, color: C.ink900, fontSize: 12.5, lineHeight: 19, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
  cancelBtnText: { color: C.ink500, fontSize: 13, fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: C.brand600, alignItems: 'center' },
  confirmBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
