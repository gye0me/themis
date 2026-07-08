import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { B_callGeminiAPI } from "../services/geminiService";

const CONTRACT_TYPES = ["전월세", "매매", "프리랜서"];

const MOCK_RESULTS = {
  summary: "위험 조항 2개 · 주의 조항 1개 · 양호 조항 3개 발견",
  items: [
    {
      level: "danger",
      score: "14조 위험",
      title: "임대인 일방 해지 가능",
      desc: "계약 기간 중 임대인이 일방적으로 계약을 해지할 수 있는 조항입니다.",
      example: '"임차인 동의 없이 해지 불가" 조항을 추가하는 경우가 많습니다.',
    },
    {
      level: "danger",
      score: "9조 위험",
      title: "전세권 설정 불가 조항",
      desc: "전세권 설정을 제한하여 보증금 보호가 어려워질 수 있습니다.",
      example: "전세권 설정 허용 조항을 계약서에 명시하는 경우가 많습니다.",
    },
    {
      level: "warning",
      score: "7조 주의",
      title: "수리비 범위 불명확",
      desc: "수리비 부담 범위가 명확하지 않아 분쟁의 소지가 있습니다.",
      example: "수리비 부담 범위를 금액 또는 항목으로 구체적으로 명시하는 경우가 많습니다.",
    },
    {
      level: "safe",
      score: "3조 양호",
      title: "보증금 반환 조항",
      desc: "표준 조항입니다. 이상 없습니다.",
      example: null,
    },
  ],
};

const levelColor = {
  danger: "#EF4444",
  warning: "#F59E0B",
  safe: "#10B981",
};

export default function ContractAnalysisScreen({ navigation }) {
  const [selectedType, setSelectedType] = useState("전월세");
  const [image, setImage] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "카메라 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
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
      quality: 0.8,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setResults(null);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setResults(null);
    try {
      const base64 = await FileSystem.readAsStringAsync(image, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mimeType = image.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const parsed = await B_callGeminiAPI(base64, mimeType, selectedType);
      if (!parsed.items.length) {
        Alert.alert('분석 실패', '계약서를 인식하지 못했습니다. 더 선명한 사진을 사용해 주세요.');
      } else {
        setResults(parsed);
      }
    } catch (err) {
      Alert.alert('오류', err.message ?? '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
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

        {/* 사진 영역 */}
        {image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : (
          <View style={styles.uploadBox}>
            <Text style={styles.uploadIcon}>📄</Text>
            <Text style={styles.uploadText}>계약서를 촬영하거나 불러오세요</Text>
          </View>
        )}

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
            <View style={styles.summaryBanner}>
              <Text style={styles.summaryText}>{results.summary}</Text>
            </View>

            {results.items.map((item, i) => (
              <View
                key={i}
                style={[styles.card, { borderLeftColor: levelColor[item.level] }]}
              >
                <View style={styles.cardTop}>
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

            <TouchableOpacity style={styles.expertBtn}>
              <Text style={styles.expertBtnText}>전문가에게 계약서 검토 요청하기</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220" },
  header: { backgroundColor: "#1E3A5F", padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { color: "#fff", fontSize: 28, marginRight: 8 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  headerSub: { color: "#8da3c1", fontSize: 11, marginTop: 2 },
  appName: { color: "#8da3c1", fontSize: 12 },
  body: { padding: 16 },
  label: { color: "#8da3c1", fontSize: 12, marginBottom: 8 },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  toggleText: { fontWeight: "bold", fontSize: 14 },
  uploadBox: { backgroundColor: "#1a2942", borderRadius: 12, padding: 40, alignItems: "center", marginBottom: 12 },
  uploadIcon: { fontSize: 40, marginBottom: 8 },
  uploadText: { color: "#8da3c1", fontSize: 13 },
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
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  cardTitle: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  cardDesc: { color: "#8da3c1", fontSize: 13, marginTop: 4 },
  cardExample: { color: "#6B7280", fontSize: 12, backgroundColor: "#0b1220", padding: 8, borderRadius: 6, marginTop: 6 },
  disclaimer: { color: "#EF4444", fontSize: 11, textAlign: "center", marginVertical: 12 },
  expertBtn: { backgroundColor: "#1E3A5F", padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 40 },
  expertBtnText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
});