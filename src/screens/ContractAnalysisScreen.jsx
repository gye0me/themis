import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from "react-native";
import { APP_ROUTES } from "../navigation/routes";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  B_callGeminiAPI,
  buildPreprocessPrompt,
  compareAnalysisResults,
  normalizeContractAnalysisText,
} from "../services/geminiService";
import {
  preprocessContractImage,
  readImageBase64FromUri,
} from "../services/imagePreprocess";

const CONTRACT_TYPES = ["전월세", "매매", "프리랜서"];

const levelColor = {
  danger: "#EF4444",
  warning: "#F59E0B",
  safe: "#10B981",
};
const levelIcon = {
  danger: "🔴",
  warning: "🟡",
  safe: "🟢",
};

const levelLabel = {
  danger: "위험",
  warning: "주의",
  safe: "양호",
};

export default function ContractAnalysisScreen({ navigation }) {
  const [selectedType, setSelectedType] = useState("전월세");
  const [image, setImage] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preprocessEnabled, setPreprocessEnabled] = useState(true);

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "카메라 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      exif: true,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
      setResults(null);
    }
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "갤러리 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      exif: true,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
      setResults(null);
    }
  };


  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setResults(null);
    try {
      const sourceUri = image.uri;
      const processedImage = preprocessEnabled
        ? await preprocessContractImage({
            uri: sourceUri,
            exif: image.exif ?? null,
            enableEnhancement: true,
          })
        : null;

      const finalBase64 = processedImage?.base64 ?? (await readImageBase64FromUri(sourceUri));
      const mimeType = processedImage?.mimeType ?? 'image/jpeg';
      const prompt = buildPreprocessPrompt(selectedType);
      const nextResult = await B_callGeminiAPI(finalBase64, mimeType, selectedType, prompt);

      setResults(nextResult);
      if (!nextResult.items.length) {
        const alertMessage = nextResult.documentSummary || '위험 조항을 찾지 못했습니다.';
        Alert.alert('알림', alertMessage);
      }
    } catch (err) {
      Alert.alert('오류', err.message ?? '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>계약서 분석</Text>
          <Text style={styles.headerSub}>독소조항 탐지 — {selectedType} 특화</Text>
        </View>
        <Text style={styles.appName}>Themis</Text>
      </View>

      <ScrollView>
        <View style={styles.body}>
        {/* 계약 유형 토글 */}
        <Text style={styles.label}>계약 유형</Text>
        <View style={styles.toggleRow}>
          {CONTRACT_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setSelectedType(type)}
              style={[
                styles.toggleBtn,
                { backgroundColor: selectedType === type ? "#1E3A5F" : "#1a2942" },
              ]}
            >
              <Text style={[
                styles.toggleText,
                { color: selectedType === type ? "#fff" : "#8da3c1" },
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => setPreprocessEnabled((value) => !value)}
          style={[styles.toggleBtn, styles.preprocessToggle, { backgroundColor: preprocessEnabled ? "#0f766e" : "#334155" }]}
        >
          <Text style={styles.toggleText}>{preprocessEnabled ? "회전·크기 보정 ON" : "보정 OFF"}</Text>
        </TouchableOpacity>

        {/* 사진 영역 */}
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.preview} />
        ) : (
          <View style={styles.uploadBox}>
            <Text style={styles.uploadIcon}>📄</Text>
            <Text style={styles.uploadText}>계약서를 촬영하거나 불러오세요</Text>
          </View>
        )}

        <Text style={styles.captureGuide}>촬영 팁: 문서를 화면 프레임에 꽉 차게 맞추고, 그림자 없이 수평으로 촬영하세요.</Text>

        {/* 버튼 2개 */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.halfBtn} onPress={handleCamera}>
            <Text style={styles.halfBtnText}>📷 카메라 촬영</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.halfBtn} onPress={handleGallery}>
            <Text style={styles.halfBtnText}>🖼️ 갤러리 선택</Text>
          </TouchableOpacity>
        </View>

        {/* 분석하기 버튼 */}
        {!results && (
          <TouchableOpacity
            onPress={handleAnalyze}
            disabled={!image || loading}
            style={[
              styles.analyzeBtn,
              { backgroundColor: image && !loading ? "#1E3A5F" : "#374151" },
            ]}
          >
            <Text style={styles.analyzeBtnText}>
              {loading ? "분석 중..." : "분석하기"}
            </Text>
          </TouchableOpacity>
        )}

        {/* 결과 */}
        {results && (
          <View>

            {results.documentSummary ? (
              <View style={styles.comparisonBox}>
                <Text style={styles.comparisonTitle}>📄 인식된 문서</Text>
                <Text style={styles.comparisonText}>{results.documentSummary}</Text>
              </View>
            ) : null}

            <View style={styles.summaryBanner}>
              <Text style={styles.summaryText}>{results.summary}</Text>
            </View>

            {results.items.map((item, i) => (
              <View
                key={i}
                style={[styles.card, { borderLeftColor: levelColor[item.level] }]}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.levelIcon}>{levelIcon[item.level]}</Text>
                  <View style={[styles.badge, { backgroundColor: levelColor[item.level] }]}>
                    <Text style={styles.badgeText}>{item.score}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                </View>
                <Text style={styles.cardDesc}>{item.desc}</Text>
                {item.example && (
                  <Text style={styles.cardExample}>일반적인 사례{"\n"}"{item.example}"</Text>
                )}
              </View>
            ))}

            <Text style={styles.disclaimer}>
              본 분석은 법률 정보 제공이며 법률 조언이 아닙니다. 정확한 판단은 전문가와 상담하세요.
            </Text>

            <TouchableOpacity
              style={styles.expertBtn}
              onPress={() => navigation.navigate(APP_ROUTES.EVIDENCE_UPLOAD)}
            >
              <Text style={styles.expertBtnText}>전문가에게 계약서 검토 요청하기</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220" },
  header: { backgroundColor: "#1E3A5F", paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { color: "#fff", fontSize: 28, marginRight: 8 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  headerSub: { color: "#8da3c1", fontSize: 11, marginTop: 2 },
  appName: { color: "#8da3c1", fontSize: 12 },
  body: { padding: 16 },
  label: { color: "#8da3c1", fontSize: 12, marginBottom: 8 },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  toggleText: { fontWeight: "bold", fontSize: 14 },
  preprocessToggle: { marginBottom: 12, alignItems: "center" },
  sampleBtn: { backgroundColor: "#1D4ED8", padding: 12, borderRadius: 10, alignItems: "center", marginBottom: 12 },
  sampleBtnDisabled: { opacity: 0.7 },
  sampleBtnText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  uploadBox: { backgroundColor: "#1a2942", borderRadius: 12, padding: 40, alignItems: "center", marginBottom: 12 },
  uploadIcon: { fontSize: 40, marginBottom: 8 },
  uploadText: { color: "#8da3c1", fontSize: 13 },
  captureGuide: { color: "#93C5FD", fontSize: 12, marginBottom: 10, lineHeight: 18 },
  preview: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12 },
  btnRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  halfBtn: { flex: 1, backgroundColor: "#1a2942", padding: 12, borderRadius: 8, alignItems: "center" },
  halfBtnText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  analyzeBtn: { padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  analyzeBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  summaryBanner: { backgroundColor: "#7f1d1d", padding: 12, borderRadius: 8, marginBottom: 12 },
  summaryText: { color: "#FCA5A5", fontSize: 13, fontWeight: "bold" },
  card: { backgroundColor: "#1a2942", borderRadius: 8, padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  levelIcon: { fontSize: 16, marginRight: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  cardTitle: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  cardDesc: { color: "#8da3c1", fontSize: 13, marginTop: 4 },
  cardExample: { color: "#6B7280", fontSize: 12, backgroundColor: "#0b1220", padding: 8, borderRadius: 6, marginTop: 6 },
  disclaimer: { color: "#EF4444", fontSize: 11, textAlign: "center", marginVertical: 12 },
  expertBtn: { backgroundColor: "#1E3A5F", padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 40 },
  expertBtnText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  comparisonBox: { backgroundColor: "#0f172a", borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 16, borderWidth: 1, borderColor: "#334155" },
  comparisonTitle: { color: "#F8FAFC", fontSize: 13, fontWeight: "bold", marginBottom: 6 },
  comparisonText: { color: "#CBD5E1", fontSize: 12, marginTop: 2 },
  sampleReportBox: { backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#334155" },
  sampleReportText: { color: "#CBD5E1", fontSize: 12, marginTop: 4 },
});