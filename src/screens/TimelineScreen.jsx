import { useCallback, useContext, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { APP_ROUTES, RECORD_ROUTES, EXPERT_ROUTES } from '../navigation/routes';
import { getEvidenceRecords, getCaseById } from '../services/firebaseService';

const TYPE_CONFIG = {
  image:    { icon: '📷', color: '#EA580C', label: '사진' },
  audio:    { icon: '🎙️', color: '#7C3AED', label: '음성' },
  video:    { icon: '🎥', color: '#16A34A', label: '영상' },
  text:     { icon: '📝', color: '#3B82F6', label: '메모' },
  contract: { icon: '📑', color: '#0EA5E9', label: '계약분석' },
  default:  { icon: '📄', color: '#94A3B8', label: '기타' },
};

const FILTER_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'image', label: '사진' },
  { key: 'audio', label: '음성' },
  { key: 'video', label: '영상' },
  { key: 'text', label: '메모' },
  { key: 'contract', label: '계약분석' },
];

// 계약서 분석기(ContractAnalysisScreen)와 동일한 신호등 스타일
const LEVEL_COLOR = { danger: '#EF4444', warning: '#F59E0B', safe: '#10B981' };
const LEVEL_ICON = { danger: '🔴', warning: '🟡', safe: '🟢' };

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

function buildSummary(records) {
  const counts = {};
  records.forEach((r) => {
    const key = r.evidenceType ?? 'default';
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return counts;
}

// 카드가 펼쳐졌을 때만 마운트되는 독립된 영상 재생기 (카드마다 따로 가짐 → 여러 개 동시에 펼쳐도 서로 안 건드림)
// 실제 원본 영상은 "재생" 눌렀을 때만 불러옴 — 펼치자마자 스트리밍을 시작하면 그게 느려 보이는 원인이라 그 전까진 5초 스탬프 썸네일만 보여줌
function InlineVideoPlayer({ uri, thumbnailURL }) {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <TouchableOpacity style={styles.videoPoster} onPress={() => setStarted(true)} activeOpacity={0.85}>
        {thumbnailURL ? (
          <Image source={{ uri: thumbnailURL }} style={styles.videoPosterImage} resizeMode="cover" />
        ) : (
          <View style={[styles.videoPosterImage, styles.videoPosterFallback]} />
        )}
        <View style={styles.videoPosterPlayBtn}>
          <View style={styles.videoPosterPlayCircle}>
            <Text style={styles.videoPosterPlayIcon}>▶</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return <ActualVideoPlayer uri={uri} />;
}

function ActualVideoPlayer({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return <VideoView player={player} style={styles.inlineVideo} nativeControls allowsFullscreen />;
}

// 카드가 펼쳐졌을 때만 마운트되는 독립된 음성 재생기
function InlineAudioPlayer({ uri }) {
  const player = useAudioPlayer(uri);
  const [isPlaying, setIsPlaying] = useState(false);
  function toggle() {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }
  return (
    <TouchableOpacity style={styles.audioPlayBtn} onPress={toggle}>
      <Text style={styles.audioPlayBtnText}>{isPlaying ? '⏸ 일시정지' : '▶ 재생'}</Text>
    </TouchableOpacity>
  );
}


export function TimelineScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const caseId = route?.params?.caseId ?? null;
  const [records, setRecords] = useState([]);
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  // 화면에 다시 돌아올 때마다(증거 업로드 후 뒤로가기 등) 목록을 새로 불러온다.
  // useEffect(마운트 1회)만 쓰면 업로드 후 뒤로가기로 돌아왔을 때 기존 목록이 그대로 남아있는 문제가 있었다.
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setLoading(false);
        return;
      }
      fetchRecords();
    }, [user, caseId])
  );

  async function fetchRecords() {
    setLoading(true);
    setError(null);
    try {
      const [data, caseDoc] = await Promise.all([
        getEvidenceRecords(user.uid, caseId),
        caseId ? getCaseById(caseId) : Promise.resolve(null),
      ]);
      setRecords(data);
      setCaseData(caseDoc);
    } catch (err) {
      console.error(err);
      setError('증거를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenReport() {
    navigation.navigate(RECORD_ROUTES.REPORT_PREVIEW, { caseData, records });
  }

  const filteredRecords = activeFilter === 'all'
    ? records
    : records.filter((r) => r.evidenceType === activeFilter);

  const summary = buildSummary(records);
  const totalCount = records.length;

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.statusbar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusApp}>Themis</Text>
      </View>
      {/* 앱바 */}
      <View style={styles.appbar}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 16 }}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.getParent()?.navigate(APP_ROUTES.HOME_STACK)}
        >
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>증거 타임라인</Text>
          <Text style={styles.subtitle}>수집된 증거 {totalCount}건</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.newCaseBtn}
            onPress={() => navigation.navigate(RECORD_ROUTES.START, { openForm: true })}
          >
            <Text style={styles.newCaseBtnText}>+ 새 사건</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={handleOpenReport}
          >
            <Text style={styles.shareBtnText}>↗</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!user && !loading ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyText}>로그인 후 증거 타임라인을 확인할 수 있습니다.</Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => navigation.navigate('App')}
          >
            <Text style={styles.uploadBtnText}>로그인하러 가기 →</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B7DD8" />
          <Text style={styles.loadingText}>증거를 불러오는 중...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchRecords}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* 수집된 증거 요약 */}
          <View style={styles.summaryRow}>
            {Object.entries(summary).map(([type, count]) => {
              const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.default;
              return (
                <View key={type} style={[styles.summaryTag, { backgroundColor: cfg.color }]}>
                  <Text style={styles.summaryTagText}>{cfg.label} {count}</Text>
                </View>
              );
            })}
            {totalCount === 0 && (
              <Text style={styles.emptyTagText}>업로드된 증거가 없습니다</Text>
            )}
          </View>

          {/* 유형별 필터 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {FILTER_OPTIONS.map((opt) => {
              const isActive = activeFilter === opt.key;
              const cfg = TYPE_CONFIG[opt.key];
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    isActive && { backgroundColor: cfg ? cfg.color : '#1E3A5F', borderColor: 'transparent' },
                  ]}
                  onPress={() => setActiveFilter(opt.key)}
                >
                  {cfg && <Text style={styles.filterChipIcon}>{cfg.icon}</Text>}
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                  {activeFilter === opt.key && opt.key !== 'all' && (
                    <Text style={styles.filterChipCount}>
                      {' '}{summary[opt.key] ?? 0}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredRecords.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyText}>
                {activeFilter === 'all'
                  ? '아직 업로드된 증거가 없습니다.'
                  : `${TYPE_CONFIG[activeFilter]?.label ?? ''} 유형의 증거가 없습니다.`}
              </Text>
              {activeFilter === 'all' && (
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => navigation.navigate(RECORD_ROUTES.EVIDENCE_UPLOAD, { caseId, caseType: caseData?.caseType ?? null })}
                >
                  <Text style={styles.uploadBtnText}>증거 업로드하러 가기 →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* 날짜 구분선 */}
              <View style={styles.dateDivider}>
                <View style={styles.dateLine} />
                <Text style={styles.dateText}>최신 순</Text>
                <View style={styles.dateLine} />
              </View>

              {/* 타임라인 아이템 */}
              {filteredRecords.map((item, index) => {
                const cfg = TYPE_CONFIG[item.evidenceType] ?? TYPE_CONFIG.default;
                const isLast = index === filteredRecords.length - 1;
                const isContract = item.evidenceType === 'contract';
                const isExpanded = expandedIds.has(item.id);
                return (
                  <View key={item.id} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
                      {!isLast && <View style={styles.line} />}
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => toggleExpand(item.id)}
                      style={styles.timelineCard}
                    >
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardDate}>{formatDate(item.capturedAt)}</Text>
                        {item.location && (
                          <View style={styles.gpsBadge}>
                            <Text style={styles.gpsBadgeText}>GPS ✓</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.typeRow}>
                        <Text style={styles.typeIcon}>{cfg.icon}</Text>
                        <Text style={styles.cardTitle}>{item.title || cfg.label}</Text>
                        <Text style={styles.expandHint}>{isExpanded ? '접기 ▲' : '자세히 ▼'}</Text>
                      </View>
                      {item.note ? (
                        <Text style={styles.cardSub} numberOfLines={2}>
                          {item.note}
                        </Text>
                      ) : null}
                      {item.originalFileName ? (
                        <Text style={styles.fileName}>{item.originalFileName}</Text>
                      ) : null}

                      {/* 계약서 분석 상세: 사진 + AI 분석 결과 */}
                      {isContract && isExpanded && (
                        <View style={styles.contractDetail}>
                          {item.downloadURL ? (
                            <Image
                              source={{ uri: item.downloadURL }}
                              style={styles.contractImage}
                              resizeMode="cover"
                            />
                          ) : null}

                          {(item.analysisItems ?? []).map((detail, i) => (
                            <View
                              key={i}
                              style={[styles.detailCard, { borderLeftColor: LEVEL_COLOR[detail.level] ?? '#94A3B8' }]}
                            >
                              <View style={styles.detailTop}>
                                <Text style={styles.detailLevelIcon}>{LEVEL_ICON[detail.level] ?? '⚪'}</Text>
                                {detail.score ? (
                                  <View style={[styles.detailBadge, { backgroundColor: LEVEL_COLOR[detail.level] ?? '#94A3B8' }]}>
                                    <Text style={styles.detailBadgeText}>{detail.score}</Text>
                                  </View>
                                ) : null}
                                <Text style={styles.detailTitle}>{detail.title}</Text>
                              </View>
                              <Text style={styles.detailDesc}>{detail.desc}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* 사진 상세 */}
                      {item.evidenceType === 'image' && isExpanded && item.downloadURL && (
                        <View style={styles.contractDetail}>
                          <Image
                            source={{ uri: item.downloadURL }}
                            style={styles.contractImage}
                            resizeMode="cover"
                          />
                        </View>
                      )}

                      {/* 영상 상세 */}
                      {item.evidenceType === 'video' && isExpanded && item.downloadURL && (
                        <View style={styles.contractDetail}>
                          <InlineVideoPlayer uri={item.downloadURL} thumbnailURL={item.thumbnailURL} />
                        </View>
                      )}

                      {/* 음성 상세 */}
                      {item.evidenceType === 'audio' && isExpanded && item.downloadURL && (
                        <View style={styles.contractDetail}>
                          <InlineAudioPlayer uri={item.downloadURL} />
                        </View>
                      )}

                      {/* 메모 상세: 위 미리보기는 2줄로 고정, 여기에 전체 내용 표시 */}
                      {item.evidenceType === 'text' && isExpanded && item.note && (
                        <View style={styles.contractDetail}>
                          <Text style={styles.memoDetailText}>{item.note}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* 보고서 미리보기 + 다운로드 화면으로 이동 */}
              <TouchableOpacity style={styles.pdfBtn} onPress={handleOpenReport}>
                <Text style={styles.pdfBtnText}>📄 증거정리 보고서 보기 · 다운로드</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* 플로팅 버튼 */}
      {caseId && (
        <TouchableOpacity
          style={styles.floatingUploadBtn}
          onPress={() => navigation.navigate(RECORD_ROUTES.EVIDENCE_UPLOAD, { caseId, caseType: caseData?.caseType ?? null })}
        >
          <Text style={styles.floatingUploadBtnText}>+ 증거</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.floatingBtn}
        onPress={() => {
          if (caseId) {
            navigation.navigate(EXPERT_ROUTES.GUIDE, { caseId, caseType: caseData?.caseType ?? null });
            return;
          }
          const contractRecord = records.find(r => r.evidenceType === 'contract');
          navigation.navigate(EXPERT_ROUTES.GUIDE, {
            record: contractRecord ?? null,
            caseId: null,
            caseType: null,
          });
        }}
      >
        <Text style={styles.floatingBtnText}>?</Text>
      </TouchableOpacity>
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
  appbar: {
    backgroundColor: '#1E3A5F', paddingTop: 16, paddingBottom: 14,
    paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { paddingVertical: 4, paddingRight: 6 },
  back: { color: '#7B9EC5', fontSize: 24 },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#7B9EC5', fontSize: 11 },
  shareBtn: { padding: 4 },
  shareBtnText: { color: '#7B9EC5', fontSize: 18 },
  newCaseBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#3B7DD8' },
  newCaseBtnText: { color: '#7B9EC5', fontSize: 11 },
  content: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#94A3B8', fontSize: 13 },
  errorText: { color: '#DC2626', fontSize: 13 },
  retryText: { color: '#3B7DD8', fontSize: 13 },
  summaryRow: {
    backgroundColor: '#1E3A5F', borderRadius: 8,
    padding: 10, flexDirection: 'row',
    flexWrap: 'wrap', gap: 6, marginBottom: 12,
    minHeight: 40, alignItems: 'center',
  },
  summaryTag: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 4 },
  summaryTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' },
  emptyTagText: { color: '#7B9EC5', fontSize: 11 },
  filterRow: { marginBottom: 14 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF', marginRight: 8,
  },
  filterChipIcon: { fontSize: 12 },
  filterChipText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterChipCount: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#94A3B8', fontSize: 13 },
  uploadBtn: { backgroundColor: '#1E3A5F', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  uploadBtnText: { color: '#F1F5F9', fontSize: 12 },
  dateDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dateLine: { flex: 1, height: 0.5, backgroundColor: '#E2E8F0' },
  dateText: { color: '#94A3B8', fontSize: 10 },
  timelineItem: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  timelineLeft: { alignItems: 'center', paddingTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { width: 1.5, flex: 1, backgroundColor: '#E2E8F0', marginTop: 4 },
  timelineCard: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderRadius: 10, padding: 12, gap: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { color: '#94A3B8', fontSize: 10 },
  gpsBadge: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  gpsBadgeText: { color: '#1D4ED8', fontSize: 9 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeIcon: { fontSize: 14 },
  cardTitle: { color: '#0F172A', fontSize: 12, fontWeight: '600' },
  cardSub: { color: '#64748B', fontSize: 10 },
  fileName: { color: '#94A3B8', fontSize: 9, fontStyle: 'italic' },
  expandHint: { color: '#3B7DD8', fontSize: 10, marginLeft: 'auto' },
  contractDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 8 },
  contractImage: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#E2E8F0' },
  detailCard: { backgroundColor: '#F8FAFC', borderRadius: 6, padding: 8, borderLeftWidth: 3 },
  detailTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  detailLevelIcon: { fontSize: 12 },
  detailBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 20 },
  detailBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  detailTitle: { color: '#0F172A', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  detailDesc: { color: '#64748B', fontSize: 10, marginTop: 2 },
  hashCard: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 10, marginBottom: 8 },
  hashLabel: { color: '#94A3B8', fontSize: 9 },
  hashValue: { color: '#3B7DD8', fontSize: 9 },
  pdfBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    padding: 14, alignItems: 'center', marginBottom: 10,
  },
  pdfBtnText: { color: '#F1F5F9', fontSize: 12, fontWeight: '500' },
  floatingBtn: {
    position: 'absolute', right: 16, bottom: 32,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#3B7DD8',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 999,
  },
  floatingBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  floatingUploadBtn: {
    position: 'absolute', right: 16, bottom: 92,
    backgroundColor: '#1E3A5F', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    zIndex: 999,
  },
  floatingUploadBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  inlineVideo: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#000000' },
  videoPoster: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#1E293B', overflow: 'hidden' },
  videoPosterImage: { width: '100%', height: '100%' },
  videoPosterFallback: { backgroundColor: '#1E293B' },
  videoPosterPlayBtn: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  videoPosterPlayCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoPosterPlayIcon: {
    color: '#FFFFFF', fontSize: 20,
    marginLeft: 3, // ▶ 삼각형 글자 자체가 시각적으로 왼쪽으로 치우쳐 보여서 살짝 우측으로 보정
  },
  audioPlayBtn: {
    backgroundColor: '#3B7DD8', borderRadius: 10, padding: 14,
    alignItems: 'center',
  },
  audioPlayBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  memoDetailText: { color: '#334155', fontSize: 13, lineHeight: 20 },
});