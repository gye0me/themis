import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';

export function TimelineScreen({ navigation }) {
  return (
    <View style={styles.wrapper}>
      {/* 앱바 */}
      <View style={styles.appbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>증거 타임라인</Text>
          <Text style={styles.subtitle}>전세보증금 미반환 · 8건 수집</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>↗</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 수집된 증거 요약 */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryTag, {backgroundColor: '#3B7DD8'}]}>
            <Text style={styles.summaryTagText}>사진 4</Text>
          </View>
          <View style={[styles.summaryTag, {backgroundColor: '#534AB7'}]}>
            <Text style={styles.summaryTagText}>음성 2</Text>
          </View>
          <View style={[styles.summaryTag, {backgroundColor: '#854F0B'}]}>
            <Text style={styles.summaryTagText}>영상 1</Text>
          </View>
          <View style={[styles.summaryTag, {backgroundColor: '#3B6D11'}]}>
            <Text style={styles.summaryTagText}>메모 1</Text>
          </View>
          <View style={[styles.summaryTag, {backgroundColor: '#0F172A'}]}>
            <Text style={styles.summaryTagText}>PDF 저장</Text>
          </View>
        </View>

        {/* 날짜 구분 */}
        <View style={styles.dateDivider}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>2025년 3월</Text>
          <View style={styles.dateLine} />
        </View>

        {/* 타임라인 아이템 1 */}
        <View style={styles.timelineItem}>
          <View style={styles.timelineLeft}>
            <View style={[styles.dot, {backgroundColor: '#DC2626'}]} />
            <View style={styles.line} />
          </View>
          <View style={styles.timelineCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>3월 2일 오후 11:02 · 서울 마포구</Text>
              <View style={styles.gpsBadge}>
                <Text style={styles.gpsBadgeText}>GPS ✓</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>집 앞 접근 — 사진</Text>
            <View style={styles.vlmTag}>
              <Text style={styles.vlmTagText}>VLM: 검은 패딩 착용 남성 확인</Text>
            </View>
            <View style={styles.thumbnailRow}>
              <View style={styles.thumbnail}>
                <Text style={{fontSize: 18}}>🧑</Text>
              </View>
              <View style={styles.thumbnail}>
                <Text style={{fontSize: 18}}>🚪</Text>
              </View>
              <View style={styles.thumbnail}>
                <Text style={{fontSize: 18}}>📍</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 타임라인 아이템 2 */}
        <View style={styles.timelineItem}>
          <View style={styles.timelineLeft}>
            <View style={[styles.dot, {backgroundColor: '#D97706'}]} />
            <View style={styles.line} />
          </View>
          <View style={styles.timelineCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>3월 5일 오전 8:17</Text>
              <View style={styles.gpsBadge}>
                <Text style={styles.gpsBadgeText}>GPS ✓</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>협박 문자 캡처</Text>
            <View style={[styles.vlmTag, {backgroundColor: '#FFFBEB'}]}>
              <Text style={[styles.vlmTagText, {color: '#92400E'}]}>AI 태그: #보증금미반환 #연락두절</Text>
            </View>
          </View>
        </View>

        {/* 타임라인 아이템 3 */}
        <View style={styles.timelineItem}>
          <View style={styles.timelineLeft}>
            <View style={[styles.dot, {backgroundColor: '#534AB7'}]} />
            <View style={styles.line} />
          </View>
          <View style={styles.timelineCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>3월 7일 오후 2:14</Text>
              <View style={styles.gpsBadge}>
                <Text style={styles.gpsBadgeText}>GPS ✓</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>통화 녹음 3분 12초</Text>
            <View style={[styles.vlmTag, {backgroundColor: '#F5F3FF'}]}>
              <Text style={[styles.vlmTagText, {color: '#5B21B6'}]}>Whisper: "보증금 못 준다" 3회 언급</Text>
            </View>
            <Text style={styles.cardSub}>전문: "지금 당장은 어려워요, 좀 더 기다려주세요..."</Text>
          </View>
        </View>

        {/* 타임라인 아이템 4 */}
        <View style={styles.timelineItem}>
          <View style={styles.timelineLeft}>
            <View style={[styles.dot, {backgroundColor: '#3B7DD8'}]} />
          </View>
          <View style={styles.timelineCard}>
            <Text style={styles.cardDate}>3월 9일 오전 5:30</Text>
            <Text style={styles.cardTitle}>메모 — 집주인 연락 두절</Text>
            <View style={[styles.vlmTag, {backgroundColor: '#DBEAFE'}]}>
              <Text style={[styles.vlmTagText, {color: '#1D4ED8'}]}>AI 태그: #연락두절 #임대차분쟁</Text>
            </View>
          </View>
        </View>

        {/* SHA-256 */}
        <View style={styles.hashCard}>
          <Text style={styles.hashLabel}>무결성 해시 (SHA-256) — 수정 불가 보관</Text>
          <Text style={styles.hashValue}>a3f8c2d1...e9b4 · 검증됨 ✓</Text>
        </View>

        {/* AI 증거 요약 */}
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>AI 증거 요약</Text>
          <Text style={styles.aiText}>핵심 쟁점: 보증금 미반환 · 집주인 연락 두절</Text>
          <Text style={styles.aiText}>가장 강력한 증거: 3월 7일 통화 녹음 (명시적 거부 발언)</Text>
          <Text style={styles.aiAction}>→ 내용증명 발송 + 법률구조공단 신청 권장</Text>
        </View>

        <View style={{height: 40}} />

        {/* PDF 버튼 */}
        <TouchableOpacity style={styles.pdfBtn}>
          <Text style={styles.pdfBtnText}>⬇ PDF 보고서 다운로드</Text>
        </TouchableOpacity>

        <View style={{height: 80}} />
      </ScrollView>

      {/* 플로팅 버튼 */}
      <TouchableOpacity
        style={styles.floatingBtn}
        onPress={() => navigation.navigate('ResponseGuide')}
      >
        <Text style={styles.floatingBtnText}>?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F8FAFC', height: '100vh' },
  appbar: {
    backgroundColor: '#1E3A5F', paddingTop: 44, paddingBottom: 12,
    paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: '#7B9EC5', fontSize: 20 },
  title: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  subtitle: { color: '#7B9EC5', fontSize: 11 },
  shareBtn: { padding: 4 },
  shareBtnText: { color: '#7B9EC5', fontSize: 18 },
  content: { flex: 1, padding: 16 },
  summaryRow: {
    backgroundColor: '#1E3A5F', borderRadius: 8,
    padding: 10, flexDirection: 'row',
    flexWrap: 'wrap', gap: 6, marginBottom: 16,
  },
  summaryTag: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 4 },
  summaryTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' },
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
  cardTitle: { color: '#0F172A', fontSize: 12, fontWeight: '600' },
  cardSub: { color: '#64748B', fontSize: 10 },
  vlmTag: { backgroundColor: '#FEF2F2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  vlmTagText: { color: '#991B1B', fontSize: 10 },
  thumbnailRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  thumbnail: { width: 56, height: 40, borderRadius: 6, backgroundColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  hashCard: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 10, marginBottom: 8 },
  hashLabel: { color: '#94A3B8', fontSize: 9 },
  hashValue: { color: '#3B7DD8', fontSize: 9 },
  aiCard: {
    backgroundColor: '#FFFFFF', borderRadius: 10,
    padding: 14, gap: 4, marginBottom: 10,
    borderTopWidth: 3, borderTopColor: '#3B7DD8',
  },
  aiTitle: { color: '#0F172A', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  aiText: { color: '#475569', fontSize: 10 },
  aiAction: { color: '#3B7DD8', fontSize: 10, marginTop: 4 },
  pdfBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    padding: 14, alignItems: 'center', marginBottom: 10,
  },
  pdfBtnText: { color: '#F1F5F9', fontSize: 12, fontWeight: '500' },
  floatingBtn: {
    position: 'absolute', right: 16, bottom: 30,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#3B7DD8',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 999,
  },
  floatingBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
});