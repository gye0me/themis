import { useContext, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, TextInput, ActivityIndicator } from "react-native";
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
import { parseContractDateString } from "../utils/parseContractDate";
import {
  REGION_CODES,
  HOUSING_TYPE_LABELS,
  fetchRecentTrades,
  fetchRecentRentTrades,
  groupTradesByBuilding,
  filterTradesByArea,
  calcAverageDealAmount,
  calcAverageDeposit,
  calcJeonseRatio,
  getJeonseRiskLevel,
  formatManwonToKorean,
  getPreviousYearMonth,
} from "../services/realEstateService";
import { BackHeader } from "../components/BackHeader";
import { C } from "../theme/tokens";

const CONTRACT_TYPES = ["전월세", "매매", "프리랜서"];

const levelColor = {
  danger: C.danger600,
  warning: C.warn600,
  safe: C.safe600,
};
const levelBg = {
  danger: C.danger100,
  warning: C.warn100,
  safe: C.safe100,
};
const levelIcon = {
  danger: "🔴",
  warning: "🟡",
  safe: "🟢",
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

  // AI가 계약서 안에서 읽어낸 날짜를 "사건 발생 시각"으로 사용한다 (업로드 시각이 아니라
  // 계약서에 실제로 적힌 날짜 기준으로 타임라인/보고서가 정렬되도록).
  // 파싱에 실패하면(날짜 없음/인식 불가) createEvidenceRecord가 업로드 시각으로 자동 대체한다.
  const parsedContractDate = parseContractDateString(result.contractDate);

  await createEvidenceRecord({
    userId,
    caseId: caseId ?? 'general',
    title: `${contractType} 계약서 분석`,
    note: buildAnalysisNote(result),
    evidenceType: 'contract',
    file: image ?? null,
    eventTime: parsedContractDate,
    eventTimeSource: parsedContractDate ? 'contract_ai' : null,
    extra: {
      contractType,
      analysisSummary: result.summary ?? null,
      analysisItems: result.items ?? [],
      requiredClauseChecklist: checklist.items,
      requiredClauseProgress: checklist.progress,
      // 계약서에서 읽은 원문 날짜 문자열 — 타임라인/보고서에서 "계약서상 날짜: ..."로 표시
      contractDate: result.contractDate ?? null,
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
  const [rentTrades, setRentTrades] = useState([]);
  const [rentLoading, setRentLoading] = useState(false);

  const filteredBuildingTrades = selectedBuilding ? filterTradesByArea(selectedBuilding.trades, contractArea) : [];
  const compareAvgAmount = selectedBuilding ? calcAverageDealAmount(filteredBuildingTrades) : null;
  const jeonseRatio = calcJeonseRatio(depositAmount, compareAvgAmount);
  const jeonseRisk = getJeonseRiskLevel(jeonseRatio);
  const jeonseRiskLabel = { danger: "깡통전세 위험", warning: "주의 필요", safe: "비교적 안전" };

  const filteredRentTrades = filterTradesByArea(rentTrades, contractArea).filter((t) => t.isJeonse);
  const avgDeposit = calcAverageDeposit(filteredRentTrades);

  // 건물을 고르면(매매 쪽 선택), 같은 건물·같은 지역의 전월세 실거래도 같이 가져와서
  // "다른 세입자들은 실제로 얼마 냈는지" 비교할 수 있게 한다.
  // (selectedBuilding이 null일 때의 rentTrades 초기화는 이펙트가 아니라 selectedBuilding을
  // 바꾸는 이벤트 핸들러들에서 직접 처리한다 — 이펙트 본문에서 곧장 setState하지 않기 위함)
  useEffect(() => {
    const lawdCd = REGION_CODES[selectedRegion];
    if (!selectedBuilding || !lawdCd) return;

    let cancelled = false;
    (async () => {
      setRentLoading(true);
      try {
        const all = await fetchRecentRentTrades({ housingType, lawdCd, baseYmd: dealYmd, months: 3 });
        if (cancelled) return;
        const sameBuilding = all.filter(
          (t) => t.buildingName === selectedBuilding.buildingName && t.dong === selectedBuilding.dong
        );
        setRentTrades(sameBuilding);
      } finally {
        if (!cancelled) setRentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBuilding, housingType, selectedRegion, dealYmd]);

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
    setRentTrades([]);
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

  const missingClauses = (results?.checklistItems ?? []).filter((i) => !i.completed);

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <BackHeader
        title="계약서 분석"
        subtitle={`독소조항 탐지 · ${selectedType} 특화`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 계약 유형 토글 */}
        <Text style={styles.fieldLabel}>계약 유형</Text>
        <View style={styles.chipRow}>
          {CONTRACT_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setSelectedType(type)}
              style={[styles.chip, selectedType === type && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedType === type && styles.chipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chipRow}>
          <TouchableOpacity
            onPress={() => setPreprocessEnabled((value) => !value)}
            style={[styles.chip, preprocessEnabled && styles.chipActive]}
          >
            <Text style={[styles.chipText, preprocessEnabled && styles.chipTextActive]}>
              🔄 {preprocessEnabled ? "회전·크기 보정 ON" : "보정 OFF"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 전월세 계약 시 국토교통부 실거래가 기반 전세가율(깡통전세 위험) 체크 */}
        {selectedType === "전월세" && (
          <View style={styles.realEstateBox}>
            <Text style={styles.fieldLabel}>
              전세가율 위험도 체크 <Text style={styles.fieldLabelMuted}>(국토교통부 실거래가 연동)</Text>
            </Text>

            <View style={styles.chipRow}>
              {Object.entries(HOUSING_TYPE_LABELS).map(([type, label]) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setHousingType(type);
                    setBuildingGroups([]);
                    setSelectedBuilding(null);
                    setRentTrades([]);
                    setTradesSearched(false);
                  }}
                  style={[styles.chip, housingType === type && styles.chipActive]}
                >
                  <Text style={[styles.chipText, housingType === type && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {Object.keys(REGION_CODES).map((region) => (
                  <TouchableOpacity
                    key={region}
                    onPress={() => setSelectedRegion(region)}
                    style={[styles.chip, selectedRegion === region && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selectedRegion === region && styles.chipTextActive]}>
                      {region}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldRowLabel}>기준월</Text>
              <TextInput
                style={styles.textInput}
                value={dealYmd}
                onChangeText={setDealYmd}
                placeholder="YYYYMM"
                placeholderTextColor={C.ink400}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.chip, styles.chipActive]}
                onPress={handleFetchTrades}
                disabled={tradesLoading}
              >
                <Text style={styles.chipTextActive}>{tradesLoading ? "조회 중..." : "건물 조회"}</Text>
              </TouchableOpacity>
            </View>

            {buildingGroups.length > 0 && (
              <>
                <Text style={styles.hintText}>계약서와 같은 건물을 선택하세요 (최근 3개월 매매 건수)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {buildingGroups.map((g) => (
                      <TouchableOpacity
                        key={`${g.dong}-${g.buildingName}`}
                        onPress={() => {
                          setSelectedBuilding(g);
                          setRentTrades([]);
                        }}
                        style={[styles.chip, selectedBuilding?.buildingName === g.buildingName && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, selectedBuilding?.buildingName === g.buildingName && styles.chipTextActive]}>
                          {g.buildingName} ({g.count})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
            {tradesSearched && !tradesLoading && buildingGroups.length === 0 && (
              <Text style={styles.emptyText}>
                해당 조건의 매매 실거래 내역이 없습니다. 기준월을 바꾸거나 주택유형을 확인해보세요.
              </Text>
            )}

            {selectedBuilding && (
              <View style={styles.tradesResultBox}>
                <Text style={styles.tradesTitle}>
                  {selectedBuilding.dong} {selectedBuilding.buildingName} · 최근 3개월 매매 {selectedBuilding.count}건
                </Text>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldRowLabelWide}>전용면적(㎡)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={contractArea}
                    onChangeText={setContractArea}
                    placeholder="예: 84 (선택)"
                    placeholderTextColor={C.ink400}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldRowLabelWide}>전세보증금(만원)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    placeholder="예: 45000"
                    placeholderTextColor={C.ink400}
                    keyboardType="number-pad"
                  />
                </View>

                <Text style={styles.compareAvgText}>
                  비교 매매 평균가: {formatManwonToKorean(compareAvgAmount) || "정보없음"} ({filteredBuildingTrades.length}건 기준
                  {contractArea ? `, ${contractArea}㎡ 근접` : ""})
                </Text>
                <Text style={styles.compareAvgText}>
                  같은 건물 다른 세입자 평균 보증금: {rentLoading ? "조회 중..." : (formatManwonToKorean(avgDeposit) || "전세 거래 없음")}
                  {!rentLoading && filteredRentTrades.length > 0 ? ` (${filteredRentTrades.length}건 기준)` : ""}
                </Text>

                {jeonseRatio != null && jeonseRisk && (
                  <View style={[styles.warningBanner, { backgroundColor: levelBg[jeonseRisk], borderLeftColor: levelColor[jeonseRisk] }]}>
                    <Text style={styles.warningIcon}>{levelIcon[jeonseRisk]}</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.warningTitle, { color: levelColor[jeonseRisk] }]}>
                        전세가율 {jeonseRatio}% — {jeonseRiskLabel[jeonseRisk]}
                      </Text>
                      <Text style={[styles.warningDesc, { color: levelColor[jeonseRisk] }]}>
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
            style={[styles.cta, (!image || loading) && styles.ctaDisabled]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>분석하기</Text>}
          </TouchableOpacity>
        )}

        {/* 결과 */}
        {results && (
          <View>
            {results.documentSummary ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>📄 인식된 문서</Text>
                <Text style={styles.summaryCardText}>{results.documentSummary}</Text>
              </View>
            ) : null}

            <View style={styles.summaryBanner}>
              <Text style={styles.summaryBannerText}>{results.summary}</Text>
            </View>

            {missingClauses.length > 0 && (
              <View style={[styles.warningBanner, { backgroundColor: C.warn100, borderLeftColor: C.warn600 }]}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.warningTitle, { color: C.warn600 }]}>특약 누락 경고</Text>
                  <Text style={[styles.warningDesc, { color: C.warn600 }]}>
                    필수 조항 {missingClauses.length}개가 계약서에 없습니다
                  </Text>
                  {missingClauses.map((item, i) => (
                    <Text key={i} style={[styles.warningDesc, { color: C.warn600 }]}>• {item.title}</Text>
                  ))}
                </View>
              </View>
            )}

            {results.items.map((item, i) => (
              <View key={i} style={[styles.resultCard, { borderLeftColor: levelColor[item.level] }]}>
                <View style={styles.resultCardTop}>
                  <Text style={styles.levelIcon}>{levelIcon[item.level]}</Text>
                  <View style={[styles.scoreBadge, { backgroundColor: levelBg[item.level] }]}>
                    <Text style={[styles.scoreBadgeText, { color: levelColor[item.level] }]}>{item.score}점</Text>
                  </View>
                  <Text style={styles.resultCardTitle}>{item.title}</Text>
                </View>
                <Text style={styles.resultCardDesc}>{item.desc}</Text>
                {item.example && (
                  <Text style={styles.resultCardExample}>일반적인 사례{"\n"}"{item.example}"</Text>
                )}
                {item.negotiationPhrase && (
                  <View style={styles.negotiationBox}>
                    <Text style={styles.negotiationLabel}>💬 협상할 때 이렇게 말해보세요</Text>
                    <Text style={styles.negotiationPhrase}>"{item.negotiationPhrase}"</Text>
                    {item.legalBasis && <Text style={styles.negotiationLegal}>근거: {item.legalBasis}</Text>}
                  </View>
                )}
              </View>
            ))}

            <Text style={styles.disclaimer}>
              본 분석은 법률 정보 제공이며 법률 조언이 아닙니다. 정확한 판단은 전문가와 상담하세요.
            </Text>

            <TouchableOpacity
              style={styles.cta}
              onPress={() => navigation.navigate(APP_ROUTES.EVIDENCE_UPLOAD)}
            >
              <Text style={styles.ctaText}>전문가에게 계약서 검토 요청하기</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, padding: 20 },

  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: C.ink700, marginBottom: 10 },
  fieldLabelMuted: { fontWeight: '500', color: C.ink400 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1, borderColor: C.line, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.surface,
  },
  chipActive: { backgroundColor: C.ink900, borderColor: C.ink900 },
  chipText: { fontSize: 12, fontWeight: '600', color: C.ink700 },
  chipTextActive: { fontSize: 12, fontWeight: '700', color: '#fff' },

  realEstateBox: {
    backgroundColor: C.sky050, borderRadius: 16, padding: 14, marginBottom: 16, gap: 4,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  fieldRowLabel: { fontSize: 12, color: C.ink500, width: 56, flexShrink: 0 },
  fieldRowLabelWide: { fontSize: 12, color: C.ink500, width: 100, flexShrink: 0 },
  textInput: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: C.ink900, backgroundColor: C.surface,
  },
  hintText: { fontSize: 12, color: C.ink500, marginBottom: 8 },
  emptyText: { color: C.ink400, fontSize: 12, marginTop: 10, textAlign: 'center' },

  tradesResultBox: { marginTop: 12, gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  tradesTitle: { color: C.ink900, fontSize: 13, fontWeight: '700' },
  compareAvgText: { color: C.brand500, fontSize: 12 },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line },
  tradeAptName: { color: C.ink500, fontSize: 12 },
  tradeAmount: { color: C.brand500, fontSize: 12 },

  warningBanner: {
    borderRadius: 14, padding: 14, marginBottom: 16,
    flexDirection: 'row', gap: 10, borderLeftWidth: 4,
  },
  warningIcon: { fontSize: 22 },
  warningTitle: { fontSize: 13, fontWeight: '700' },
  warningDesc: { fontSize: 11.5, lineHeight: 17 },

  uploadBox: {
    backgroundColor: C.sky050, borderRadius: 16, padding: 40, alignItems: 'center', marginBottom: 12, gap: 6,
  },
  uploadIcon: { fontSize: 32 },
  uploadText: { color: C.ink500, fontSize: 13 },
  captureGuide: { color: C.ink400, fontSize: 11.5, marginBottom: 16, lineHeight: 17 },
  preview: { width: '100%', height: 200, borderRadius: 14, marginBottom: 12 },

  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  halfBtn: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, alignItems: 'center' },
  halfBtnText: { color: C.ink900, fontSize: 13, fontWeight: '700' },

  cta: { backgroundColor: C.brand600, borderRadius: 999, padding: 16, alignItems: 'center', marginBottom: 16 },
  ctaDisabled: { backgroundColor: C.line },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  summaryCard: { backgroundColor: C.sky050, borderRadius: 14, padding: 12, marginBottom: 12 },
  summaryCardTitle: { color: C.ink900, fontSize: 13, fontWeight: '700' },
  summaryCardText: { color: C.ink500, fontSize: 12, marginTop: 6, lineHeight: 17 },

  summaryBanner: { backgroundColor: C.danger100, borderRadius: 10, padding: 12, marginBottom: 12 },
  summaryBannerText: { color: C.danger600, fontSize: 13, fontWeight: '700' },

  resultCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, gap: 6 },
  resultCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelIcon: { fontSize: 16 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  scoreBadgeText: { fontSize: 10.5, fontWeight: '700' },
  resultCardTitle: { flex: 1, color: C.ink900, fontWeight: '700', fontSize: 15 },
  resultCardDesc: { color: C.ink500, fontSize: 13 },
  resultCardExample: { color: C.ink400, fontSize: 12, backgroundColor: C.sky050, padding: 8, borderRadius: 8 },
  negotiationBox: { backgroundColor: C.sky100, borderRadius: 10, padding: 10, gap: 4 },
  negotiationLabel: { color: C.brand700, fontSize: 11, fontWeight: '700' },
  negotiationPhrase: { color: C.ink900, fontSize: 12.5, lineHeight: 18 },
  negotiationLegal: { color: C.brand600, fontSize: 10.5, fontWeight: '600' },

  disclaimer: { color: C.danger600, fontSize: 11, textAlign: 'center', marginVertical: 12 },
});
