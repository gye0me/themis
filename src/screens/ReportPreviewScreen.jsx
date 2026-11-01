import { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { appAlert } from '../utils/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { buildQuestSteps } from '../services/responseGuideSteps';
import { buildCaseReportHtml, buildReportHashPayload } from '../services/reportHtml';
import { hashContent, createElectronicSignature } from '../services/signatureService';
import { finalizeCaseReport } from '../services/firebaseService';
import {
  REPORT_LEGAL_NOTICE_TITLE,
  REPORT_LEGAL_NOTICE_ACK,
  REPORT_LEGAL_NOTICE_VERSION,
  buildReportNoticeStatement,
} from '../services/reportLegalNotice';
import { AuthContext } from '../context/AuthContext';
import { BackHeader } from '../components/BackHeader';
import { ElectronicSignatureModal } from '../components/ElectronicSignatureModal';
import { C } from '../theme/tokens';

// HTML 안의 원격 <img src="https://...">를 data URI로 바꾼다 (실패한 이미지는 원래 주소 유지)
async function inlineRemoteImages(html) {
  const urls = [...new Set([...html.matchAll(/<img[^>]+src="(https?:[^"]+)"/g)].map((m) => m[1]))];
  let result = html;
  await Promise.all(
    urls.map(async (escapedUrl) => {
      try {
        const url = escapedUrl.replace(/&amp;/g, '&');
        const blob = await (await fetch(url)).blob();
        const dataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        result = result.split(`src="${escapedUrl}"`).join(`src="${dataUri}"`);
      } catch (err) {
        console.warn('PDF용 이미지 변환 실패:', err?.message);
      }
    })
  );
  return result;
}

// 웹: 보고서 HTML만 담은 숨김 iframe을 만들고, 이미지가 모두 로드된 뒤 그 iframe을 인쇄한다
function printHtmlOnWeb(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    iframe.onload = async () => {
      const doc = iframe.contentDocument;
      const images = [...(doc?.images ?? [])];
      await Promise.all(
        images.map((img) =>
          img.complete
            ? null
            : new Promise((done) => {
                img.onload = done;
                img.onerror = done;
                setTimeout(done, 8000); // 너무 오래 걸리는 이미지는 기다리지 않음
              })
        )
      );
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      // 인쇄 대화상자를 닫은 뒤 정리
      setTimeout(() => iframe.remove(), 1000);
      resolve();
    };
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}

function reportFileName(extension) {
  return `themis-report-${Date.now()}.${extension}`;
}

function toJsDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const EMPTY_RECORDS = [];

// 증거 타임라인(TimelineScreen)에서 "보고서 보기"를 누르면 이 화면으로 넘어와
// 1) 실제 보고서 HTML을 WebView로 앱 안에서 그대로 미리 보여주고
// 2) 증거 내용 확인 서명을 받은 뒤 하단 다운로드 버튼으로 PDF 또는 HTML 파일로 기기에 저장한다.
export default function ReportPreviewScreen({ navigation, route }) {
  const caseData = route?.params?.caseData ?? null;
  const records = route?.params?.records ?? EMPTY_RECORDS;
  const { user, profile } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [signing, setSigning] = useState(false);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [signatureModal, setSignatureModal] = useState(false);
  const [pendingDownload, setPendingDownload] = useState(null); // 서명 후 이어서 받을 형식: 'pdf' | 'html'
  const [currentHash, setCurrentHash] = useState(null);

  // 이 사건에 예전 서명이 있으면(caseData.reportSignatureId) 그 기록을 불러온다.
  // 서명 없이 안내만 확인했던 예전 확정 기록은 다시 서명해야 내려받을 수 있다.
  const [finalization, setFinalization] = useState(() => (caseData?.reportSignatureId ? {
    hash: caseData.reportFinalizationHash,
    finalizedAt: toJsDate(caseData.reportFinalizedAt),
    signatureId: caseData.reportSignatureId,
    signerName: caseData.reportSignerName,
  } : null));

  const signerName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '';

  const questItems = useMemo(
    () => (caseData ? buildQuestSteps(caseData.caseType, caseData.questSteps ?? [], caseData.tags ?? []).items : []),
    [caseData]
  );

  const effectiveCaseData = useMemo(() => ({
    title: caseData?.title || '증거 정리 보고서',
    caseType: caseData?.caseType || null,
    createdAt: caseData?.createdAt ?? records[records.length - 1]?.capturedAt,
  }), [caseData, records]);

  const visibleEvidenceCount = records.filter((r) => !r.hidden).length;

  const hashPayload = useMemo(
    () => buildReportHashPayload({ caseData: effectiveCaseData, records, questItems }),
    [effectiveCaseData, records, questItems]
  );

  useEffect(() => {
    let cancelled = false;
    hashContent(hashPayload)
      .then((hash) => { if (!cancelled) setCurrentHash(hash); })
      .catch((err) => console.warn('보고서 해시 계산 실패:', err?.message));
    return () => { cancelled = true; };
  }, [hashPayload]);

  // 서명 뒤에 증거가 바뀌면 해시가 달라지므로, 바뀐 내용으로 다시 서명해야 내려받을 수 있다.
  const isSigned = Boolean(finalization && finalization.hash === currentHash);
  const evidenceChanged = Boolean(finalization && currentHash && !isSigned);

  const buildHtml = useCallback((signedFinalization, forPrint = false) => buildCaseReportHtml({
    caseData: effectiveCaseData,
    records,
    questItems,
    finalization: signedFinalization,
    forPrint,
  }), [effectiveCaseData, records, questItems]);

  const html = useMemo(
    () => buildHtml(isSigned ? finalization : null),
    [buildHtml, isSigned, finalization]
  );

  async function saveOnAndroidToPickedFolder(fileName, content) {
    const SAF = FileSystem.StorageAccessFramework;
    if (!SAF) return false;
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return false;
    const destUri = await SAF.createFileAsync(perm.directoryUri, fileName, 'text/html');
    await FileSystem.writeAsStringAsync(destUri, content, { encoding: FileSystem.EncodingType.UTF8 });
    return true;
  }

  async function handleDownload(signedFinalization) {
    if (saving) return;
    setSaving(true);
    try {
      const fileName = reportFileName('html');
      const fileHtml = buildHtml(signedFinalization);

      if (Platform.OS === 'web') {
        const blob = new Blob([fileHtml], { type: 'text/html' });
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
        const saved = await saveOnAndroidToPickedFolder(fileName, fileHtml).catch((err) => {
          console.warn('SAF 저장 실패, 공유 방식으로 대체:', err.message);
          return false;
        });
        if (saved) {
          appAlert('저장 완료', '선택한 폴더에 보고서 HTML 파일이 저장되었습니다.');
          return;
        }
      }

      // iOS(및 Android 폴백): 앱 저장소에 파일을 쓴 뒤 공유 시트를 통해
      // "파일에 저장"으로 실제 기기 저장소에 저장하도록 안내한다.
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, fileHtml, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/html',
          dialogTitle: '보고서 HTML 파일 저장',
          UTI: 'public.html',
        });
      } else {
        appAlert('저장 완료', `기기 저장소에 파일이 생성되었습니다.\n${fileUri}`);
      }
    } catch (err) {
      console.error('HTML 보고서 저장 오류:', err);
      appAlert('오류', '보고서를 저장하지 못했습니다. 다시 시도해주세요.');
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

  async function handleDownloadPdf(signedFinalization) {
    if (savingPdf) return;
    setSavingPdf(true);
    try {
      // PDF용 HTML: 영상은 썸네일, 음성은 링크로 바꾼 인쇄용 버전
      const printHtml = buildHtml(signedFinalization, true);

      // 웹: expo-print의 웹 구현은 넘긴 HTML을 무시하고 현재 앱 화면을 window.print()해 버려서
      // 보고서 사진·썸네일이 PDF에 안 나왔다. 보고서만 담은 숨김 iframe에서 이미지 로딩을 기다린 뒤 인쇄한다.
      if (Platform.OS === 'web') {
        await printHtmlOnWeb(printHtml);
        return;
      }

      // 앱: 원격 이미지가 다 받아지기 전에 PDF가 렌더링되면 썸네일이 빈칸으로 나와서,
      // 이미지를 data URI로 미리 넣어둔 HTML로 렌더링한다 (워터마크·SHA-256·서버 타임스탬프 포함).
      const { uri } = await Print.printToFileAsync({ html: await inlineRemoteImages(printHtml) });
      const fileName = reportFileName('pdf');

      if (Platform.OS === 'android') {
        const saved = await saveOnAndroidToPickedFolderPdf(uri, fileName).catch((err) => {
          console.warn('SAF 저장 실패, 공유 방식으로 대체:', err.message);
          return false;
        });
        if (saved) {
          appAlert('저장 완료', '선택한 폴더에 보고서 PDF 파일이 저장되었습니다.');
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
        appAlert('저장 완료', `기기 저장소에 PDF가 생성되었습니다.\n${uri}`);
      }
    } catch (err) {
      console.error('PDF 보고서 생성 오류:', err);
      appAlert('오류', 'PDF를 생성하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSavingPdf(false);
    }
  }

  function runDownload(kind, signedFinalization) {
    return kind === 'pdf' ? handleDownloadPdf(signedFinalization) : handleDownload(signedFinalization);
  }

  // 지금 내용으로 서명돼 있으면 바로 받고, 아니면 서명부터 받은 뒤 이어서 내려받는다.
  function requestDownload(kind) {
    if (isSigned) {
      runDownload(kind, finalization);
      return;
    }
    setPendingDownload(kind);
    setSignatureModal(true);
  }

  function closeSignatureModal() {
    setSignatureModal(false);
    setPendingDownload(null);
  }

  // 서명 기록은 "증거 내용을 확인했고 효력이 없을 수 있음을 안다"는 근거,
  // 해시는 "서명 이후 안 바뀌었다"는 근거로 함께 남긴다.
  async function handleConfirmSignature(typedName) {
    if (signing) return;
    if (!user) {
      appAlert('로그인이 필요해요', '서명하려면 먼저 로그인해주세요.');
      return;
    }
    setSigning(true);
    try {
      const hash = await hashContent(hashPayload);
      const signatureId = await createElectronicSignature({
        signerUid: user.uid,
        signerName,
        typedName,
        statementText: `${buildReportNoticeStatement(visibleEvidenceCount)}\n\n${REPORT_LEGAL_NOTICE_ACK}`,
        targetType: 'caseReport',
        targetId: caseData?.id ?? null,
        content: hashPayload,
      });

      // 사건에 연결된 보고서(caseData.id가 있는 경우)만 사건 문서에 확정 기록을 남긴다 —
      // caseId 없이(일반 기록) 열람 중인 보고서는 이번에 내려받는 파일에만 반영된다.
      if (caseData?.id) {
        await finalizeCaseReport(caseData.id, {
          hash,
          legalNoticeVersion: REPORT_LEGAL_NOTICE_VERSION,
          signatureId,
          signerName: typedName,
        });
      }

      const signed = { hash, finalizedAt: new Date(), signatureId, signerName: typedName };
      const nextDownload = pendingDownload;
      setFinalization(signed);
      setCurrentHash(hash);
      closeSignatureModal();
      if (nextDownload) {
        await runDownload(nextDownload, signed);
      } else {
        appAlert('서명 완료', '확인 서명과 해시값이 함께 기록되었습니다.');
      }
    } catch (err) {
      console.error('보고서 서명 오류:', err);
      appAlert('오류', '서명을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSigning(false);
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

      {/* 서명 상태 배너 — 확인 서명 + 해시 = "서명 이후 안 바뀌었다"는 근거 */}
      {isSigned ? (
        <View style={styles.finalizedBanner}>
          <Text style={styles.finalizedBannerTitle}>
            {finalization.signerName} 확인 서명 · {finalization.finalizedAt ? finalization.finalizedAt.toLocaleString('ko-KR') : ''}
          </Text>
          <Text style={styles.finalizedBannerHash} numberOfLines={1}>해시 {finalization.hash}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.finalizeRow} onPress={() => setSignatureModal(true)}>
          <Text style={styles.finalizeRowText}>
            {evidenceChanged ? '증거가 바뀌었어요. 다시 확인 서명하기' : '다운로드 전 증거 내용 확인 서명하기'}
          </Text>
        </TouchableOpacity>
      )}

      {/* 팀 결정 확인 전까지 HTML을 기본(큰 버튼)으로 유지 — PDF는 옆에 보조 옵션으로만 둠 */}
      <View style={styles.downloadRow}>
        <TouchableOpacity style={styles.downloadBtn} onPress={() => requestDownload('html')} disabled={saving || signing}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.downloadBtnText}>⬇ HTML 파일로 다운로드</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.downloadBtnSecondary} onPress={() => requestDownload('pdf')} disabled={savingPdf || signing}>
          {savingPdf ? (
            <ActivityIndicator color={C.brand600} />
          ) : (
            <Text style={styles.downloadBtnSecondaryText}>PDF로</Text>
          )}
        </TouchableOpacity>
      </View>
      {/* 닫을 때 입력한 이름·체크가 남지 않도록 열려 있을 때만 마운트한다 */}
      {signatureModal && (
        <ElectronicSignatureModal
          visible
          title={`${REPORT_LEGAL_NOTICE_TITLE} · 확인 서명`}
          statementText={buildReportNoticeStatement(visibleEvidenceCount)}
          agreeText={REPORT_LEGAL_NOTICE_ACK}
          confirmLabel={pendingDownload ? '서명하고 다운로드' : '서명하기'}
          expectedName={signerName}
          submitting={signing}
          onCancel={closeSignatureModal}
          onConfirm={handleConfirmSignature}
        />
      )}
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
