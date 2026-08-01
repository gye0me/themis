import { useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { APP_ROUTES } from '../navigation/routes';
import { getEvidenceRecords } from '../services/firebaseService';

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

export function TimelineScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchRecords();
  }, [user]);

  async function fetchRecords() {
    setLoading(true);
    setError(null);
    try {
      const data = await getEvidenceRecords(user.uid);
      setRecords(data);
    } catch (err) {
      console.error(err);
      setError('증거를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = activeFilter === 'all'
    ? records
    : records.filter((r) => r.evidenceType === activeFilter);

  const summary = buildSummary(records);
  const totalCount = records.length;

  return (
    <View style={styles.wrapper}>
      {/* 앱바 */}
      <View style={styles.appbar}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('App')}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>증거 타임라인</Text>
          <Text style={styles.subtitle}>수집된 증거 {totalCount}건</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>↗</Text>
        </TouchableOpacity>
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
                  onPress={() => navigation.navigate('EvidenceUpload')}
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
                const isExpanded = expandedId === item.id;
                return (
                  <View key={item.id} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
                      {!isLast && <View style={styles.line} />}
                    </View>
                    <TouchableOpacity
                      activeOpacity={isContract ? 0.7 : 1}
                      disabled={!isContract}
                      onPress={() => setExpandedId(isExpanded ? null : item.id)}
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
                        {isContract && (
                          <Text style={styles.expandHint}>{isExpanded ? '접기 ▲' : '자세히 ▼'}</Text>
                        )}
                      </View>
                      {item.note ? (
                        <Text style={styles.cardSub} numberOfLines={isExpanded ? undefined : 2}>
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
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* SHA-256 */}
              <View style={styles.hashCard}>
                <Text style={styles.hashLabel}>무결성 해시 (SHA-256) — 수정 불가 보관</Text>
                <Text style={styles.hashValue}>a3f8c2d1...e9b4 · 검증됨 ✓</Text>
              </View>

              {/* PDF 버튼 */}
              <TouchableOpacity style={styles.pdfBtn}>
                <Text style={styles.pdfBtnText}>⬇ 증거정리 HTML 다운로드</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* 플로팅 버튼 */}
      <TouchableOpacity
        style={styles.floatingBtn}
        onPress={() => {
          const contractRecord = records.find(r => r.evidenceType === 'contract');
          navigation.navigate('ResponseGuide', {
          record: contractRecord ?? null,
          caseId: null,
          caseType: null,
      });
        }}
      >
        <Text style={styles.floatingBtnText}>?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  appbar: {
    backgroundColor: '#1E3A5F', paddingTop: 44, paddingBottom: 12,
    paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: '#7B9EC5', fontSize: 24 },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#7B9EC5', fontSize: 11 },
  shareBtn: { padding: 4 },
  shareBtnText: { color: '#7B9EC5', fontSize: 18 },
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
});