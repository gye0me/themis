import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { buildQuestSteps } from '../services/responseGuideSteps';
import { buildCaseReportHtml } from '../services/reportHtml';

const EMPTY_RECORDS = [];

// 증거 타임라인(TimelineScreen)에서 "보고서 보기"를 누르면 이 화면으로 넘어와
// 1) 실제 보고서 HTML을 WebView로 앱 안에서 그대로 미리 보여주고
// 2) 하단 다운로드 버튼으로 PDF(기본) 또는 HTML 파일로 기기에 실제로 저장한다.
export default function ReportPreviewScreen({ navigation, route }) {
  const caseData = route?.params?.caseData ?? null;
  const records = route?.params?.records ?? EMPTY_RECORDS;
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [webviewLoading, setWebviewLoading] = useState(true);

  const html = useMemo(() => {
    const { items: questItems } = caseData
      ? buildQuestSteps(caseData.caseType, caseData.questSteps ?? [])
      : { items: [] };

    return buildCaseReportHtml({
      caseData: {
        title: caseData?.title || '증거 정리 보고서',
        caseType: caseData?.caseType || null,
        createdAt: caseData?.createdAt ?? records[records.length - 1]?.capturedAt,
      },
      records,
      questItems,
    });
  }, [caseData, records]);

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
    if (savingPdf) return;
    setSavingPdf(true);
    try {
      // 웹은 브라우저 인쇄 대화상자를 통해 사용자가 직접 "PDF로 저장"을 선택한다.
      if (Platform.OS === 'web') {
        await Print.printToFileAsync({ html });
        return;
      }

      // 지금 만든 HTML(워터마크·SHA-256·서버 타임스탬프 포함)을 그대로 PDF로 렌더링한다.
      const { uri } = await Print.printToFileAsync({ html });
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

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.statusbar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusApp}>Themis</Text>
      </View>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 16 }}
          style={styles.backBtn}
        >
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>보고서 미리보기</Text>
          <Text style={styles.subtitle}>{caseData?.title || '증거 정리 보고서'}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

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
            source={{ html }}
            style={styles.webview}
            onLoadEnd={() => setWebviewLoading(false)}
          />
        )}
        {webviewLoading && Platform.OS !== 'web' && (
          <View style={styles.webviewLoading} pointerEvents="none">
            <ActivityIndicator size="large" color="#3B7DD8" />
          </View>
        )}
      </View>

      {/* 팀 결정 확인 전까지 HTML을 기본(큰 버튼)으로 유지 — PDF는 옆에 보조 옵션으로만 둠 */}
      <View style={styles.downloadRow}>
        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#F1F5F9" />
          ) : (
            <Text style={styles.downloadBtnText}>⬇ HTML 파일로 다운로드</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.downloadBtnSecondary} onPress={handleDownloadPdf} disabled={savingPdf}>
          {savingPdf ? (
            <ActivityIndicator color="#1E3A5F" />
          ) : (
            <Text style={styles.downloadBtnSecondaryText}>PDF로</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  statusbar: {
    backgroundColor: '#0F1F3D', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  statusTime: { color: '#6B84A8', fontSize: 12 },
  statusApp: { color: '#6B84A8', fontSize: 12 },
  header: {
    backgroundColor: '#1E3A5F', paddingTop: 16, paddingBottom: 14,
    paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { paddingVertical: 4, paddingRight: 6 },
  back: { color: '#7B9EC5', fontSize: 24 },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#7B9EC5', fontSize: 11 },
  webviewBox: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#F1F5F9' },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  downloadRow: { flexDirection: 'row', gap: 1 },
  downloadBtn: {
    flex: 3, backgroundColor: '#1E3A5F', padding: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  downloadBtnText: { color: '#F1F5F9', fontSize: 13, fontWeight: '600' },
  downloadBtnSecondary: {
    flex: 1, backgroundColor: '#334155', padding: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  downloadBtnSecondaryText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
});
