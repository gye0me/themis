import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from '../components/BackHeader';
import { C } from '../theme/tokens';
import { CASE_TYPE_META } from '../services/responseGuideSteps';
import { DEMO_HOT_BOARD_COMMENTS } from '../services/hotBoardService';

// "지금 주목받는 사건" 카드를 눌렀을 때 들어오는 상세 페이지.
// 일반 게시판(ExpertScreen) 글 카드와 같은 톤(제목+배지, 사건설명, 댓글 목록)으로 맞춰서,
// 사용자가 "여기도 게시판의 일부"라고 자연스럽게 느끼도록 한다.
// 댓글은 DEMO_HOT_BOARD_COMMENTS에 있는 완전한 더미 데이터만 보여준다 — 실제 전문가가
// 단 댓글이 아니라 "전문가들이 이 사건에 주목하고 있다"는 걸 보여주기 위한 예시다.
export function HotBoardDetailScreen({ navigation, route }) {
  const entry = route?.params?.entry ?? {};
  const meta = CASE_TYPE_META[entry.caseType] ?? CASE_TYPE_META['기타'];
  const comments = DEMO_HOT_BOARD_COMMENTS[entry.id] ?? [];

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <BackHeader title="주목받는 사건" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.postCard}>
          <View style={styles.headerRow}>
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>🔥 HOT</Text>
            </View>
            <Text style={styles.title}>{meta.icon} {entry.roomName || `${meta.label} 피해자 연대`}</Text>
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.victimBadge}>
              <Text style={styles.victimBadgeText}>피해자 {entry.memberCount ?? 0}명</Text>
            </View>
          </View>

          <Text style={styles.body}>
            {entry.description || `${meta.label} 피해를 입은 분들이 ${entry.memberCount ?? 0}명 모였습니다.`}
          </Text>

          {entry.watchingExperts?.length > 0 && (
            <View style={styles.tagRow}>
              {entry.watchingExperts.map((expert) => (
                <View key={expert} style={styles.tag}>
                  <Text style={styles.tagText}>{expert} 주목 중</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.commentSection}>
          <Text style={styles.commentSectionTitle}>
            전문가 댓글 {comments.length > 0 ? comments.length : ''}
          </Text>

          {comments.length === 0 ? (
            <Text style={styles.noCommentText}>아직 댓글을 남긴 전문가가 없어요.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <View style={styles.commentHeaderRow}>
                  <Text style={styles.commentAuthor}>{c.authorName}</Text>
                  <View style={styles.expertBadge}>
                    <Text style={styles.expertBadgeText}>🎖 {c.expertType}</Text>
                  </View>
                  <Text style={styles.commentTime}>{c.relativeTime}</Text>
                </View>
                <Text style={styles.commentBody}>{c.content}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: C.surface },
  content: { flex: 1, padding: 20 },

  postCard: {
    backgroundColor: C.sky050,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  hotBadge: {
    backgroundColor: C.danger100, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  hotBadgeText: { color: C.danger600, fontSize: 10.5, fontWeight: '700' },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: C.ink900 },

  badgeRow: { flexDirection: 'row' },
  victimBadge: {
    backgroundColor: C.danger100, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  victimBadgeText: { color: C.danger600, fontSize: 11, fontWeight: '700' },

  body: { fontSize: 13, color: C.ink700, lineHeight: 19 },

  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  tagText: { fontSize: 10.5, color: C.ink500, fontWeight: '600' },

  commentSection: {
    marginTop: 22, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.line, gap: 2,
  },
  commentSectionTitle: { fontSize: 12.5, fontWeight: '700', color: C.ink500, marginBottom: 6 },
  noCommentText: { fontSize: 11, color: C.ink400, paddingVertical: 6 },

  commentRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  commentAuthor: { fontSize: 11.5, fontWeight: '700', color: C.ink900 },
  expertBadge: {
    backgroundColor: C.sky100, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  expertBadgeText: { fontSize: 9.5, color: C.brand600, fontWeight: '600' },
  commentTime: { fontSize: 10, color: C.ink400, marginLeft: 'auto' },
  commentBody: { fontSize: 12.5, color: C.ink700, lineHeight: 18 },
});
