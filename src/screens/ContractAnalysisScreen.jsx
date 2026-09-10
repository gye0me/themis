import { useContext, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, TextInput } from "react-native";
import { APP_ROUTES } from "../navigation/routes";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { AuthContext } from "../context/AuthContext";
import {
  B_callGeminiAPI,
  buildPreprocessPrompt,
  callGeminiChecklistAPI,
} from "../services/geminiService";
import {
  preprocessContractImage,
  readImageBase64FromUri,
} from "../services/imagePreprocess";
import { createEvidenceRecord } from "../services/firebaseService";
import { buildChecklist } from "../services/requiredClauseChecklist";
import {
  REGION_CODES,
  HOUSING_TYPE_LABELS,
  fetchRecentTrades,
  groupTradesByBuilding,
  filterTradesByArea,
  calcAverageDealAmount,
  calcJeonseRatio,
  getJeonseRiskLevel,
  formatManwonToKorean,
  getPreviousYearMonth,
} from "../services/realEstateService";

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

function buildAnalysisNote(result) {
  const counts = { danger: 0, warning: 0, safe: 0 };
  result.items.forEach((item) => {
    if (counts[item.level] !== undefined) counts[item.level] += 1;
  });
  const summaryLine = result.summary || `위험 ${counts.danger} · 주의 ${counts.warning} · 양호 ${counts.safe}`;
  return result.documentSummary ? `${result.documentSummary}\n${summaryLine}` : summaryLine;
}

async function saveAnalysisToTimeline({ userId, caseId, contractType, image, result, geminiRawResults = [] }) {
  const checklist = buildChecklist(contractType, geminiRawResults);

  await createEvidenceRecord({
    userId,
    caseId: caseId ?? 'general',
    title: `${contractType} 계약서 분석`,
    note: buildAnalysisNote(result),
    evidenceType: 'contract',
    file: image ?? null,
    extra: {
      contractType,
      analysisSummary: result.summary ?? null,
      analysisItems: result.items ?? [],
      requiredClauseChecklist: checklist.items,
      requiredClauseProgress: checklist.progress,
    },
  });
}

export default function ContractAnalysisScreen({ navigation, route }) {
  const caseId = route?.params?.caseId ?? null;
  const { user } = useContext(AuthContext);
  const [selectedType, setSelectedType] = useState("전월세");
  const [image, setImage] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preprocessEnabled, setPreprocessEnabled] = useState(true);
  const [housingType, setHousingType] = useState("apt");
  const [selectedRegion, setSelectedRegion] = useState("강남구");
  const [dealYmd, setDealYmd] = useState(getPreviousYearMonth());
  const [buildingGroups, setBuildingGroups] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [contractArea, setContractArea] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesSearched, setTradesSearched] = useState(false);

  const filteredBuildingTrades = selectedBuilding ? filterTradesByArea(selectedBuilding.trades, contractArea) : [];
  const compareAvgAmount = selectedBuilding ? calcAverageDealAmount(filteredBuildingTrades) : null;
  const jeonseRatio = calcJeonseRatio(depositAmount, compareAvgAmount);
  const jeonseRisk = getJeonseRiskLevel(jeonseRatio);
  const jeonseRiskLabel = { danger: "깡통전세 위험", warning: "주의 필요", safe: "비교적 안전" };

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


  const handleFetchTrades = async () => {
    const lawdCd = REGION_CODES[selectedRegion];
    if (!lawdCd || !/^\d{6}$/.test(dealYmd)) {
      Alert.alert("알림", "지역과 조회월(YYYYMM)을 확인해주세요.");
      return;
    }
    setTradesLoading(true);
    setTradesSearched(true);
    setSelectedBuilding(null);
    try {
      // 구 단위 평균은 편차가 커서, 최근 3개월치를 모아 건물별로 묶어야
      // 계약서와 같은 건물을 골라 정확하게 비교할 수 있다.
      const recentTrades = await fetchRecentTrades({ housingType, lawdCd, baseYmd: dealYmd, months: 3 });
      setBuildingGroups(groupTradesByBuilding(recentTrades));
    } finally {
      setTradesLoading(false);
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

      // 독소조항 분석 + 필수 조항 체크리스트를 병렬 호출
      const [nextResult, geminiRawResults] = await Promise.all([
        B_callGeminiAPI(finalBase64, mimeType, selectedType, prompt),
        callGeminiChecklistAPI(finalBase64, mimeType, selectedType).catch((e) => {
          console.warn('체크리스트 분석 실패:', e.message);
          return [];
        }),
      ]);

      const checklist = buildChecklist(selectedType, geminiRawResults);
      setResults({ ...nextResult, checklistItems: checklist.items });
      if (!nextResult.items.length) {
        const alertMessage = nextResult.documentSummary || '위험 조항을 찾지 못했습니다.';
        Alert.alert('알림', alertMessage);
      }

      // 분석 결과를 타임라인에 자동 기록 (실패해도 화면 결과 표시는 그대로 진행)
      try {
        await saveAnalysisToTimeline({ userId: user?.uid ?? null, caseId, contractType: selectedType, image, result: nextResult, geminiRawResults });
      } catch (saveErr) {
        console.warn('타임라인 저장 실패:', saveErr.message);
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

        {/* 전월세 계약 시 국토교통부 실거래가 기반 전세가율(깡통전세 위험) 체크 */}
        {selectedType === "전월세" && (
          <View style={styles.realEstateBox}>
            <Text style={styles.label}>전세가율 위험도 체크 (국토교통부 실거래가 연동)</Text>

            <View style={styles.toggleRow}>
              {Object.entries(HOUSING_TYPE_LABELS).map(([type, label]) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setHousingType(type);
                    setBuildingGroups([]);
                    setSelectedBuilding(null);
                    setTradesSearched(false);
                  }}
                  style={[styles.toggleBtn, { backgroundColor: housingType === type ? "#1E3A5F" : "#1a2942" }]}
                >
                  <Text style={[styles.toggleText, styles.housingToggleText, { color: housingType === type ? "#fff" : "#8da3c1" }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionScroll}>
              {Object.keys(REGION_CODES).map((region) => (
                <TouchableOpacity
                  key={region}
                  onPress={() => setSelectedRegion(region)}
                  style={[styles.regionChip, selectedRegion === region && styles.regionChipActive]}
                >
                  <Text style={[styles.regionChipText, selectedRegion === region && styles.regionChipTextActive]}>
                    {region}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.dealYmdRow}>
              <Text style={styles.dealYmdLabel}>기준월</Text>
              <TextInput
                style={styles.dealYmdInput}
                value={dealYmd}
                onChangeText={setDealYmd}
                placeholder="YYYYMM"
                placeholderTextColor="#6B7280"
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={styles.tradeSearchBtn}
                onPress={handleFetchTrades}
                disabled={tradesLoading}
              >
                <Text style={styles.tradeSearchBtnText}>{tradesLoading ? "조회 중..." : "건물 조회"}</Text>
              </TouchableOpacity>
            </View>

            {buildingGroups.length > 0 && (
              <>
                <Text style={styles.dealYmdLabel2}>계약서와 같은 건물을 선택하세요 (최근 3개월 매매 건수)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionScroll}>
                  {buildingGroups.map((g) => (
                    <TouchableOpacity
                      key={`${g.dong}-${g.buildingName}`}
                      onPress={() => setSelectedBuilding(g)}
                      style={[styles.regionChip, selectedBuilding?.buildingName === g.buildingName && styles.regionChipActive]}
                    >
                      <Text style={[styles.regionChipText, selectedBuilding?.buildingName === g.buildingName && styles.regionChipTextActive]}>
                        {g.buildingName} ({g.count})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            {tradesSearched && !tradesLoading && buildingGroups.length === 0 && (
              <Text style={styles.tradeEmptyText}>
                해당 조건의 매매 실거래 내역이 없습니다. 기준월을 바꾸거나 주택유형을 확인해보세요.
              </Text>
            )}

            {selectedBuilding && (
              <View style={styles.tradesResultBox}>
                <Text style={styles.tradesAvg}>
                  {selectedBuilding.dong} {selectedBuilding.buildingName} · 최근 3개월 매매 {selectedBuilding.count}건
                </Text>

                <View style={styles.dealYmdRow}>
                  <Text style={styles.dealYmdLabel}>전용면적(㎡)</Text>
                  <TextInput
                    style={styles.dealYmdInput}
                    value={contractArea}
                    onChangeText={setContractArea}
                    placeholder="예: 84 (선택)"
                    placeholderTextColor="#6B7280"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.dealYmdRow}>
                  <Text style={styles.dealYmdLabel}>전세보증금(만원)</Text>
                  <TextInput
                    style={styles.dealYmdInput}
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    placeholder="예: 45000"
                    placeholderTextColor="#6B7280"
                    keyboardType="number-pad"
                  />
                </View>

                <Text style={styles.compareAvgText}>
                  비교 매매 평균가: {formatManwonToKorean(compareAvgAmount) || "정보없음"} ({filteredBuildingTrades.length}건 기준
                  {contractArea ? `, ${contractArea}㎡ 근접` : ""})
                </Text>

                {jeonseRatio != null && jeonseRisk && (
                  <View
                    style={[
                      styles.warningBanner,
                      {
                        backgroundColor: jeonseRisk === "danger" ? "#FEE2E2" : jeonseRisk === "warning" ? "#FEF3C7" : "#DCFCE7",
                        borderLeftColor: levelColor[jeonseRisk],
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Text style={styles.warningIcon}>{levelIcon[jeonseRisk]}</Text>
                        <Text
                          style={[
                            styles.warningTitle,
                            { color: jeonseRisk === "danger" ? "#991B1B" : jeonseRisk === "warning" ? "#92400E" : "#166534" },
                          ]}
                        >
                          전세가율 {jeonseRatio}% — {jeonseRiskLabel[jeonseRisk]}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.warningDesc,
                          { color: jeonseRisk === "danger" ? "#991B1B" : jeonseRisk === "warning" ? "#92400E" : "#166534" },
                        ]}
                      >
                        보증금이 이 건물 실거래 매매가 대비 {jeonseRatio}% 수준입니다. 80% 이상이면 집값 하락 시 보증금을
                        돌려받지 못하는 깡통전세 위험이 커지니, 전세보증보험 가입 여부를 꼭 확인하세요.
                      </Text>
                    </View>
                  </View>
                )}

                {selectedBuilding.trades.slice(0, 5).map((t, idx) => (
                  <View key={idx} style={styles.tradeRow}>
                    <Text style={styles.tradeAptName}>
                      {t.area}㎡ · {t.floor}층
                    </Text>
                    <Text style={styles.tradeAmount}>{t.dealAmountKorean} · {t.dealDate}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

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
            {(results?.checklistItems ?? []).filter(i => !i.completed).length > 0 && (
              <View style={styles.warningBanner}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Text style={styles.warningIcon}>⚠️</Text>
                    <Text style={styles.warningTitle}>특약 누락 경고</Text>
                  </View>
                  <Text style={styles.warningDesc}>
                    필수 조항 {(results?.checklistItems ?? []).filter(i => !i.completed).length}개가 계약서에 없습니다
                  </Text>
                  {(results?.checklistItems ?? []).filter(i => !i.completed).map((item, i) => (
                    <View key={i} style={styles.warningItem}>
                      <Text style={styles.warningItemText}>• {item.title}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

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
  header: { backgroundColor: "#1E3A5F", paddingHorizontal: 16, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  warningBanner: {
  backgroundColor: '#FEF3C7', borderRadius: 10,
  padding: 14, marginBottom: 12,
  flexDirection: 'row', alignItems: 'center', gap: 10,
  borderLeftWidth: 4, borderLeftColor: '#F59E0B',
  },
  warningIcon: { fontSize: 24 },
  warningTitle: { color: '#92400E', fontSize: 13, fontWeight: '700' },
  warningDesc: { color: '#92400E', fontSize: 11, marginTop: 2 },
  warningItem: { marginTop: 4 },
  warningItemText: { color: '#92400E', fontSize: 11 },
  realEstateBox: { backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#334155" },
  regionScroll: { marginTop: 8, marginBottom: 10 },
  regionChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#1a2942", marginRight: 6 },
  regionChipActive: { backgroundColor: "#1E3A5F" },
  regionChipText: { color: "#8da3c1", fontSize: 12 },
  regionChipTextActive: { color: "#fff", fontWeight: "bold" },
  dealYmdRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dealYmdLabel: { color: "#8da3c1", fontSize: 12, width: 88 },
  dealYmdLabel2: { color: "#8da3c1", fontSize: 12, marginTop: 4, marginBottom: 4 },
  compareAvgText: { color: "#93C5FD", fontSize: 12, marginBottom: 10 },
  dealYmdInput: { flex: 1, backgroundColor: "#0b1220", color: "#fff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: "#334155" },
  tradeSearchBtn: { backgroundColor: "#1D4ED8", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  tradeSearchBtnText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  housingToggleText: { fontSize: 12 },
  tradesResultBox: { marginTop: 12 },
  tradesAvg: { color: "#F8FAFC", fontSize: 13, fontWeight: "bold", marginBottom: 8 },
  tradeRow: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#1f2937" },
  tradeAptName: { color: "#CBD5E1", fontSize: 12 },
  tradeAmount: { color: "#93C5FD", fontSize: 12, marginTop: 2 },
  tradeEmptyText: { color: "#6B7280", fontSize: 12, marginTop: 10, textAlign: "center" },
});