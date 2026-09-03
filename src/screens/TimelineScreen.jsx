import { useCallback, useContext, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { APP_ROUTES, RECORD_ROUTES, EXPERT_ROUTES } from '../navigation/routes';
import { getEvidenceRecords, getCaseById, deleteCase, setEvidenceHidden } from '../services/firebaseService';

// color: 타입 식별용 포인트 컬러(타임라인 점, 필터 칩) / badgeBg·badgeColor: 카드 아이콘 뱃지(리디자인)
const TYPE_CONFIG = {
  image:    { icon: '📷', color: '#EA580C', badgeBg: '#FFF3E8', badgeColor: '#E07B30', label: '사진' },
  audio:    { icon: '🎙️', color: '#7C3AED', badgeBg: '#F1EBFC', badgeColor: '#7C4FD8', label: '음성' },
  video:    { icon: '🎥', color: '#16A34A', badgeBg: '#E8F4EF', badgeColor: '#2E8B68', label: '영상' },
  text:     { icon: '📝', color: '#3B82F6', badgeBg: '#EEF2FB', badgeColor: '#4A6FA5', label: '메모' },
  contract: { icon: '📑', color: '#0EA5E9', badgeBg: '#E6F6FD', badgeColor: '#0E92C4', label: '계약분석' },
  default:  { icon: '📄', color: '#94A3B8', badgeBg: '#F0F1F6', badgeColor: '#6B7A9A', label: '기타' },
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
  const [deleting, setDeleting] = useState(false);
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

  function handleDeleteCase() {
    if (!caseId || !user || deleting) return;
    Alert.alert(
      '사건 삭제',
      `"${caseData?.title || '이 사건'}"을(를) 삭제하시겠습니까?\n포함된 증거 ${records.length}건도 함께 영구 삭제되며, 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteCase(caseId, user.uid);
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.getParent()?.navigate(APP_ROUTES.HOME_STACK);
              }
            } catch (err) {
              console.error('사건 삭제 오류:', err);
              Alert.alert('삭제 실패', '사건을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.');
              setDeleting(false);
            }
          },
        },
      ],
    );
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
          {caseId && (
            <TouchableOpacity
              style={styles.deleteBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={handleDeleteCase}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#F87171" />
              ) : (
                <Text style={styles.deleteBtnText}>🗑</Text>
              )}
            </TouchableOpacity>
          )}
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
          <ActivityIndicator size="large" color="#4A6FA5" />
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
                    isActive && { backgroundColor: cfg ? cfg.color : '#1A2540', borderColor: 'transparent' },
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
                      onLongPress={() => {
                        Alert.alert(
                          item.hidden ? '증거 복원' : '증거 숨기기',
                          item.hidden
                            ? '이 증거를 다시 표시할까요?'
                            : '이 증거를 숨길까요? 보고서에서도 제외됩니다.',
                          [
                            { text: '취소', style: 'cancel' },
                            {
                              text: item.hidden ? '복원' : '숨기기',
                              onPress: () => setEvidenceHidden(item.id, !item.hidden),
                            },
                          ]
                        );
                      }}
                      style={[styles.timelineCard, item.hidden && styles.timelineCardHidden]}
                    >
                      {item.hidden && (
                        <View style={styles.hiddenBanner}>
                          <Text style={styles.hiddenBannerText}>🚫 숨겨진 증거 (길게 눌러서 복원)</Text>
                        </View>
                      )}
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardDate}>{formatDate(item.capturedAt)}</Text>
                        {item.location && (
                          <View style={styles.gpsBadge}>
                            <Text style={styles.gpsBadgeText}>📍 GPS 확인됨</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.typeRow}>
                        <View style={[styles.typeBadge, { backgroundColor: cfg.badgeBg }]}>
                          <Text style={[styles.typeIcon, { color: cfg.badgeColor }]}>{cfg.icon}</Text>
                        </View>
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
                          {item.note ? (
                            <TouchableOpacity 
                              style={styles.hashCard}
                              onPress={() => Alert.alert('OCR 추출 텍스트', item.note)}
                            >
                              <Text style={styles.hashLabel}>📝 OCR 추출 텍스트 (탭하면 전체 보기)</Text>
                              <Text style={styles.memoDetailText} numberOfLines={3}>{item.note}</Text>
                            </TouchableOpacity>
                          ) : null}
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
  wrapper: { flex: 1, backgroundColor: '#F5F4F0' },
  statusbar: {
    backgroundColor: '#1A2540', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  statusTime: { color: '#8BA4C8', fontSize: 12 },
  statusApp: { color: '#8BA4C8', fontSize: 12 },
  appbar: {
    backgroundColor: '#1A2540', paddingTop: 16, paddingBottom: 14,
    paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { paddingVertical: 4, paddingRight: 6 },
  back: { color: '#8BA4C8', fontSize: 24 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  subtitle: { color: '#8BA4C8', fontSize: 11 },
  shareBtn: { padding: 4 },
  shareBtnText: { color: '#8BA4C8', fontSize: 18 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },
  newCaseBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#4A6FA5' },
  newCaseBtnText: { color: '#8BA4C8', fontSize: 11 },
  content: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#94A3B8', fontSize: 13 },
  errorText: { color: '#DC2626', fontSize: 13 },
  retryText: { color: '#4A6FA5', fontSize: 13 },
  summaryRow: {
    backgroundColor: '#1A2540', borderRadius: 10,
    padding: 10, flexDirection: 'row',
    flexWrap: 'wrap', gap: 6, marginBottom: 12,
    minHeight: 40, alignItems: 'center',
  },
  summaryTag: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 4 },
  summaryTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' },
  emptyTagText: { color: '#8BA4C8', fontSize: 11 },
  filterRow: { marginBottom: 14 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 0.5, borderColor: '#E0E2EA',
    backgroundColor: '#FFFFFF', marginRight: 8,
  },
  filterChipIcon: { fontSize: 12 },
  filterChipText: { fontSize: 12, color: '#666666', fontWeight: '500' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterChipCount: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#888888', fontSize: 13 },
  uploadBtn: { backgroundColor: '#1A2540', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  uploadBtnText: { color: '#FFFFFF', fontSize: 12 },
  dateDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dateLine: { flex: 1, height: 0.5, backgroundColor: '#E0E2EA' },
  dateText: { color: '#888888', fontSize: 10 },
  timelineItem: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  timelineLeft: { alignItems: 'center', paddingTop: 4 },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: '#FFFFFF' },
  line: { width: 2, flex: 1, backgroundColor: '#D0D4E0', marginTop: 4 },
  timelineCard: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderRadius: 12, padding: 13, gap: 5,
    borderWidth: 0.5, borderColor: '#E0E2EA',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { color: '#888888', fontSize: 11, fontWeight: '500' },
  gpsBadge: { backgroundColor: '#ECEEF5', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  gpsBadgeText: { color: '#4A6FA5', fontSize: 10, fontWeight: '600' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  typeIcon: { fontSize: 16 },
  cardTitle: { color: '#1A2540', fontSize: 13, fontWeight: '700', flex: 1 },
  cardSub: { color: '#666666', fontSize: 11 },
  fileName: { color: '#94A3B8', fontSize: 9, fontStyle: 'italic' },
  expandHint: { color: '#4A6FA5', fontSize: 10, marginLeft: 'auto' },
  contractDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: '#E0E2EA', gap: 8 },
  contractImage: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#E2E5EF' },
  detailCard: { backgroundColor: '#F5F6FA', borderRadius: 6, padding: 8, borderLeftWidth: 3 },
  detailTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  detailLevelIcon: { fontSize: 12 },
  detailBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 20 },
  detailBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  detailTitle: { color: '#1A2540', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  detailDesc: { color: '#666666', fontSize: 10, marginTop: 2 },
  hashCard: { backgroundColor: '#F5F6FA', borderRadius: 8, padding: 10, marginBottom: 8 },
  hashLabel: { color: '#94A3B8', fontSize: 9 },
  hashValue: { color: '#4A6FA5', fontSize: 9 },
  pdfBtn: {
    backgroundColor: '#1A2540', borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 10,
  },
  pdfBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  floatingBtn: {
    position: 'absolute', right: 16, bottom: 32,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#4A6FA5',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 999,
  },
  floatingBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  floatingUploadBtn: {
    position: 'absolute', right: 16, bottom: 92,
    backgroundColor: '#1A2540', borderRadius: 20,
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
    backgroundColor: '#4A6FA5', borderRadius: 10, padding: 14,
    alignItems: 'center',
  },
  audioPlayBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  memoDetailText: { color: '#334155', fontSize: 13, lineHeight: 20 },
  timelineCardHidden: { opacity: 0.4 },
  hiddenBanner: { backgroundColor: '#FEF2F2', borderRadius: 6, padding: 6, marginBottom: 6 },
  hiddenBannerText: { color: '#EF4444', fontSize: 10 },
});