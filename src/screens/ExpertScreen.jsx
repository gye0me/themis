import { useCallback, useContext, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { APP_ROUTES, CHAT_ROUTES } from '../navigation/routes';
import { AuthContext } from '../context/AuthContext';
import {
  getExpertPosts,
  deleteExpertPost,
  getExpertPostComments,
  addExpertPostComment,
  acceptExpertComment,
  unacceptExpertComment,
} from '../services/expertBoardService';
import { submitReport } from '../services/reportService';

function formatRelativeTime(ts) {
  const date = ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : null;
  if (!date) return '방금';
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

export function ExpertScreen({ navigation }) {
  const { user, profile } = useContext(AuthContext);
  const displayName = profile?.nickname?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || '익명';
  const isExpertUser = !!profile?.isExpert;

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [commentDraft, setCommentDraft] = useState({});
  const [postingComment, setPostingComment] = useState({});
  const [acceptingId, setAcceptingId] = useState(null);
  const [anonDraftByPost, setAnonDraftByPost] = useState({});
  const [reportingId, setReportingId] = useState(null);

  const loadPosts = useCallback(() => {
    setLoadingPosts(true);
    getExpertPosts()
      .then(setPosts)
      .catch((err) => console.error('게시글 목록 조회 오류:', err))
      .finally(() => setLoadingPosts(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts]),
  );

  const loadComments = (postId) => {
    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    getExpertPostComments(postId)
      .then((list) => setCommentsByPost((prev) => ({ ...prev, [postId]: list })))
      .catch((err) => console.error('댓글 조회 오류:', err))
      .finally(() => setLoadingComments((prev) => ({ ...prev, [postId]: false })));
  };

  const toggleExpand = (postId) => {
    const next = expandedId === postId ? null : postId;
    setExpandedId(next);
    if (next && !commentsByPost[postId]) {
      loadComments(postId);
    }
  };

  const handleDelete = (post) => {
    Alert.alert('게시글 삭제', '이 질문을 삭제할까요? 삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(post.id);
            await deleteExpertPost(post.id, user.uid);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
            if (expandedId === post.id) setExpandedId(null);
          } catch (err) {
            console.error('게시글 삭제 오류:', err);
            Alert.alert('삭제 실패', err?.message ?? '게시글을 삭제하지 못했습니다.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const submitComment = async (postId) => {
    const text = (commentDraft[postId] ?? '').trim();
    if (!text) return;
    if (!user) {
      Alert.alert('로그인이 필요해요', '댓글을 남기려면 먼저 로그인해주세요.');
      return;
    }
    setPostingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      await addExpertPostComment(postId, {
        userId: user.uid,
        authorName: displayName,
        content: text,
        isExpertAnswer: isExpertUser,
        isAnonymous: !!anonDraftByPost[postId],
      });
      setCommentDraft((prev) => ({ ...prev, [postId]: '' }));
      loadComments(postId);
    } catch (err) {
      console.error('댓글 등록 오류:', err);
      Alert.alert('오류', '댓글을 등록하지 못했습니다.');
    } finally {
      setPostingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const toggleAccept = async (post, comment) => {
    if (!user) return;
    const alreadyAccepted = post.acceptedCommentId === comment.id;
    setAcceptingId(comment.id);
    try {
      if (alreadyAccepted) {
        await unacceptExpertComment(post.id, user.uid);
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, acceptedCommentId: null, isResolved: false } : p)));
      } else {
        await acceptExpertComment(post.id, comment.id, user.uid);
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, acceptedCommentId: comment.id, isResolved: true } : p)));
      }
    } catch (err) {
      console.error('답변 채택 오류:', err);
      Alert.alert('오류', err?.message ?? '처리하지 못했습니다.');
    } finally {
      setAcceptingId(null);
    }
  };

  const reportTarget = (targetType, targetId, onHidden) => {
    if (!user) {
      Alert.alert('로그인이 필요해요', '신고하려면 먼저 로그인해주세요.');
      return;
    }
    Alert.alert('신고하기', '신고 사유를 선택해주세요.', [
      { text: '욕설/비방', onPress: () => doReport(targetType, targetId, '욕설/비방', onHidden) },
      { text: '스팸/광고', onPress: () => doReport(targetType, targetId, '스팸/광고', onHidden) },
      { text: '개인정보 노출', onPress: () => doReport(targetType, targetId, '개인정보 노출', onHidden) },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const doReport = async (targetType, targetId, reason, onHidden) => {
    setReportingId(targetId);
    try {
      await submitReport({ targetType, targetId, reporterUserId: user.uid, reason });
      Alert.alert('신고 접수', '신고가 접수됐어요. 검토 후 조치할게요.');
      onHidden?.();
    } catch (err) {
      console.error('신고 오류:', err);
      Alert.alert('알림', err?.message ?? '신고를 접수하지 못했습니다.');
    } finally {
      setReportingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      {/* 상태바 */}
      <View style={styles.statusbar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusApp}>Themis</Text>
      </View>

      {/* 앱바 */}
      <View style={styles.appbar}>
        <View style={styles.appbarLogo}>
          <Text style={styles.appbarLogoText}>T</Text>
        </View>
        <View>
          <Text style={styles.appbarTitle}>전문가 연결</Text>
          <Text style={styles.appbarSub}>사건별 공유하고 답변 받기</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 지금 주목받는 사건 */}
        <Text style={styles.sectionTitle}>지금 주목받는 사건</Text>

        <TouchableOpacity
          style={styles.hotCard}
          onPress={() => Alert.alert('전세보증금 미반환 — 강남구 집중', '같은 집주인에게 피해를 입은 사람이 많습니다. 전문가 12명 · 제보 3건 · 집단 고소 준비 중\n\n상세 페이지는 아직 준비 중이에요.')}
        >
          <View style={styles.hotCardHeader}>
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>🔥 HOT</Text>
            </View>
            <Text style={styles.hotCardTitle}>전세보증금 미반환 — 강남구 집중</Text>
            <View style={styles.victimBadgeRed}>
              <Text style={styles.victimBadgeRedText}>피해자 47명</Text>
            </View>
          </View>
          <Text style={styles.hotCardDesc}>같은 집주인에게 피해를 입은 사람이 많습니다. 전문인 12명 · 제보 3건 · 집단 고소 준비 중</Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Text style={styles.tagText}>변호사</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>기자</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>부동산중개사</Text></View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.hotCard, { borderLeftColor: '#F97316' }]}
          onPress={() => Alert.alert('프리랜서 대금 미지급 — IT 업계', '의뢰인으로부터 대금을 받지 못한 프리랜서들이 모이고 있습니다.\n\n상세 페이지는 아직 준비 중이에요.')}
        >
          <View style={styles.hotCardHeader}>
            <View style={[styles.hotBadge, { backgroundColor: '#FFF7ED' }]}>
              <Text style={[styles.hotBadgeText, { color: '#C2410C' }]}>금상승</Text>
            </View>
            <Text style={styles.hotCardTitle}>프리랜서 대금 미지급 — IT 업계</Text>
            <View style={[styles.victimBadgeRed, { backgroundColor: '#FFF7ED' }]}>
              <Text style={[styles.victimBadgeRedText, { color: '#C2410C' }]}>피해자 23명</Text>
            </View>
          </View>
          <Text style={styles.hotCardDesc}>의뢰인으로부터 대금을 받지 못한 프리랜서들이 모이고 있습니다.</Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Text style={styles.tagText}>변호사</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>공익법무관</Text></View>
          </View>
        </TouchableOpacity>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 일반 게시판 */}
        <Text style={styles.sectionTitle}>일반 게시판</Text>

        {loadingPosts ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#1E3A5F" />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>아직 등록된 질문이 없어요. 첫 질문을 남겨보세요!</Text>
          </View>
        ) : (
          posts.map((post) => {
            const isMine = post.userId === user?.uid;
            const isExpanded = expandedId === post.id;
            const comments = commentsByPost[post.id] ?? [];

            // 익명 댓글 작성자를 "익명 참여자 N"으로 일관되게 표시하기 위해,
            // 오래된 순(채택 정렬 전) 기준으로 사용자별 번호를 미리 매겨둔다.
            const anonNumberMap = {};
            let anonCounter = 0;
            comments.forEach((c) => {
              if (c.isAnonymous && !(c.userId in anonNumberMap)) {
                anonCounter += 1;
                anonNumberMap[c.userId] = anonCounter;
              }
            });

            const postAuthorLabel = post.isAnonymous ? '익명 작성자' : (post.authorName ?? '익명');

            return (
              <View key={post.id} style={styles.postCard}>
                <TouchableOpacity onPress={() => toggleExpand(post.id)} activeOpacity={0.8}>
                  <View style={styles.postTop}>
                    <View style={styles.avatarBlue}>
                      <Text style={styles.avatarText}>{post.isAnonymous ? '?' : postAuthorLabel.slice(0, 1)}</Text>
                    </View>
                    <View style={styles.postMeta}>
                      <Text style={styles.postAuthor}>{postAuthorLabel}</Text>
                      <Text style={styles.postTime}>{formatRelativeTime(post.createdAt)}</Text>
                    </View>
                    {post.isResolved ? (
                      <View style={styles.resolvedBadge}>
                        <Text style={styles.resolvedBadgeText}>해결됨 ✓</Text>
                      </View>
                    ) : null}
                    <View style={styles.answerCountBadge}>
                      <Text style={styles.answerCountText}>
                        {comments.length > 0 || (isExpanded && !loadingComments[post.id])
                          ? `답변 ${comments.length}개`
                          : '답변 보기'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <Text style={styles.postBody}>{post.content}</Text>
                  {post.attachedCaseTitle ? (
                    <View style={styles.fileAttach}>
                      <Text style={styles.fileIcon}>📎</Text>
                      <Text style={styles.fileName}>{post.attachedCaseTitle}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                <View style={styles.postActionsRow}>
                  {isMine ? (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(post)}
                      disabled={deletingId === post.id}
                    >
                      {deletingId === post.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Text style={styles.deleteBtnText}>삭제</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.reportBtn}
                      onPress={() =>
                        reportTarget('expertPost', post.id, () =>
                          setPosts((prev) => prev.filter((p) => p.id !== post.id)),
                        )
                      }
                      disabled={reportingId === post.id}
                    >
                      {reportingId === post.id ? (
                        <ActivityIndicator size="small" color="#94A3B8" />
                      ) : (
                        <Text style={styles.reportBtnText}>🚩 신고</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {isExpanded ? (
                  <View style={styles.commentSection}>
                    {loadingComments[post.id] ? (
                      <ActivityIndicator color="#1E3A5F" style={{ marginVertical: 8 }} />
                    ) : comments.length === 0 ? (
                      <Text style={styles.noCommentText}>아직 댓글이 없어요.</Text>
                    ) : (
                      [...comments]
                        .sort((a, b) => {
                          const aAccepted = a.id === post.acceptedCommentId ? 1 : 0;
                          const bAccepted = b.id === post.acceptedCommentId ? 1 : 0;
                          return bAccepted - aAccepted;
                        })
                        .map((c) => {
                          const isAccepted = c.id === post.acceptedCommentId;
                          const canShowAcceptBtn = isMine && (isAccepted || !post.acceptedCommentId);
                          const isCommentMine = c.userId === user?.uid;
                          const commentAuthorLabel = c.isAnonymous
                            ? `익명 참여자 ${anonNumberMap[c.userId] ?? '?'}`
                            : (c.authorName ?? '익명');

                          if (c.hidden) {
                            return (
                              <View key={c.id} style={styles.commentRow}>
                                <Text style={styles.hiddenCommentText}>🚫 신고 누적으로 숨겨진 댓글입니다.</Text>
                              </View>
                            );
                          }

                          return (
                            <View key={c.id} style={[styles.commentRow, isAccepted && styles.commentRowAccepted]}>
                              <View style={styles.commentHeaderRow}>
                                <Text style={styles.commentAuthor}>{commentAuthorLabel}</Text>
                                {c.isExpertAnswer ? (
                                  <View style={styles.expertBadge}>
                                    <Text style={styles.expertBadgeIconText}>🎖 전문가 답변</Text>
                                  </View>
                                ) : null}
                                {isAccepted ? (
                                  <View style={styles.acceptedTag}>
                                    <Text style={styles.acceptedTagText}>채택된 답변</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.commentBody}>{c.content}</Text>
                              <View style={styles.commentFooterRow}>
                                {canShowAcceptBtn ? (
                                  <TouchableOpacity
                                    style={styles.acceptBtn}
                                    onPress={() => toggleAccept(post, c)}
                                    disabled={acceptingId === c.id}
                                  >
                                    {acceptingId === c.id ? (
                                      <ActivityIndicator size="small" color={isAccepted ? '#64748B' : '#16A34A'} />
                                    ) : (
                                      <Text style={isAccepted ? styles.acceptBtnTextCancel : styles.acceptBtnText}>
                                        {isAccepted ? '채택 취소' : '채택하기'}
                                      </Text>
                                    )}
                                  </TouchableOpacity>
                                ) : null}
                                {!isCommentMine ? (
                                  <TouchableOpacity
                                    style={styles.commentReportBtn}
                                    onPress={() =>
                                      reportTarget('expertPostComment', c.id, () => loadComments(post.id))
                                    }
                                    disabled={reportingId === c.id}
                                  >
                                    {reportingId === c.id ? (
                                      <ActivityIndicator size="small" color="#94A3B8" />
                                    ) : (
                                      <Text style={styles.commentReportBtnText}>🚩 신고</Text>
                                    )}
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>
                          );
                        })
                    )}

                    <TouchableOpacity
                      style={styles.anonToggleRow}
                      onPress={() =>
                        setAnonDraftByPost((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                      }
                      activeOpacity={0.7}
                    >
                      <View style={anonDraftByPost[post.id] ? styles.checkboxOnSmall : styles.checkboxOffSmall}>
                        {anonDraftByPost[post.id] ? <Text style={styles.checkboxCheckSmall}>✓</Text> : null}
                      </View>
                      <Text style={styles.anonToggleText}>익명으로 답글 달기</Text>
                    </TouchableOpacity>

                    <View style={styles.commentInputRow}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="댓글을 입력해주세요"
                        placeholderTextColor="#94A3B8"
                        value={commentDraft[post.id] ?? ''}
                        onChangeText={(v) => setCommentDraft((prev) => ({ ...prev, [post.id]: v }))}
                      />
                      <TouchableOpacity
                        style={styles.commentSendBtn}
                        onPress={() => submitComment(post.id)}
                        disabled={postingComment[post.id]}
                      >
                        {postingComment[post.id] ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.commentSendText}>등록</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={styles.bottomButtonArea}>
        <TouchableOpacity
          style={styles.bottomButton}
          onPress={() => navigation.navigate('ExpertQuestion')}
        >
          <Text style={styles.bottomButtonText}>내 타임라인 올리고 질문하기</Text>
        </TouchableOpacity>
      </View>

      {/* 네비바 */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate(APP_ROUTES.RECORDS_STACK)}
        >
          <Text style={styles.navIcon}>✏️</Text>
          <Text style={styles.navLabel}>기록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabelActive}>전문가</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.CHATS_STACK, { screen: CHAT_ROUTES.SOLIDARITY })}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>채팅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate(APP_ROUTES.HOME_STACK)}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>홈</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F1F5F9' },

  statusbar: {
    backgroundColor: '#0F1F3D',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusTime: { color: '#6B84A8', fontSize: 12 },
  statusApp: { color: '#6B84A8', fontSize: 12 },

  appbar: {
    backgroundColor: '#1E3A5F',
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appbarLogo: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: '#3B7DD8',
    alignItems: 'center', justifyContent: 'center',
  },
  appbarLogoText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  appbarTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '500' },
  appbarSub: { color: '#7B9EC5', fontSize: 11 },

  content: { flex: 1, padding: 16 },

  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: '#64748B',
    letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase',
  },

  hotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  hotCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  hotBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hotBadgeText: { color: '#991B1B', fontSize: 10, fontWeight: '700' },
  hotCardTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: '#0F172A' },
  victimBadgeRed: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  victimBadgeRedText: { color: '#991B1B', fontSize: 10, fontWeight: '600' },
  hotCardDesc: { fontSize: 11, color: '#64748B', marginBottom: 8, lineHeight: 16 },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 10, color: '#475569' },

  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },

  loadingBox: { paddingVertical: 24, alignItems: 'center' },
  emptyBox: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#94A3B8' },

  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  postTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatarBlue: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '600', color: '#1E3A5F' },
  postMeta: { flex: 1 },
  postAuthor: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  postTime: { fontSize: 10, color: '#94A3B8' },
  answerCountBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  answerCountText: { fontSize: 10, color: '#1D4ED8' },
  resolvedBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginRight: 6,
  },
  resolvedBadgeText: { fontSize: 10, color: '#15803D', fontWeight: '700' },
  postTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 4 },
  postBody: { fontSize: 11, color: '#64748B', lineHeight: 16, marginBottom: 8 },
  fileAttach: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F8FAFC', borderRadius: 6, padding: 8,
  },
  fileIcon: { fontSize: 14 },
  fileName: { fontSize: 11, color: '#475569' },

  deleteBtn: { alignSelf: 'flex-end', marginTop: 8 },
  deleteBtnText: { color: '#EF4444', fontSize: 11.5, fontWeight: '600' },
  postActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  reportBtn: { paddingVertical: 2 },
  reportBtnText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },

  commentSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
  },
  noCommentText: { fontSize: 11, color: '#94A3B8', paddingVertical: 6 },
  hiddenCommentText: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 4 },
  commentRow: { paddingVertical: 8 },
  commentRowAccepted: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  commentAuthor: { fontSize: 11, fontWeight: '600', color: '#0F172A' },
  expertBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  expertBadgeIconText: { fontSize: 9.5, color: '#1D4ED8', fontWeight: '600' },
  acceptedTag: {
    backgroundColor: '#16A34A', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  acceptedTagText: { fontSize: 9.5, color: '#FFFFFF', fontWeight: '700' },
  commentBody: { fontSize: 11.5, color: '#334155', marginTop: 2, lineHeight: 16 },
  commentFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  acceptBtn: { paddingVertical: 2 },
  acceptBtnText: { color: '#16A34A', fontSize: 11, fontWeight: '700' },
  acceptBtnTextCancel: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  commentReportBtn: { paddingVertical: 2, marginLeft: 'auto' },
  commentReportBtnText: { color: '#CBD5E1', fontSize: 10.5, fontWeight: '600' },

  anonToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 4 },
  anonToggleText: { fontSize: 11.5, color: '#64748B' },
  checkboxOffSmall: {
    width: 16, height: 16, borderRadius: 4,
    borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOnSmall: {
    width: 16, height: 16, borderRadius: 4,
    backgroundColor: '#1E3A5F',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxCheckSmall: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  commentInput: {
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  commentSendBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  commentSendText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '600' },

  bottomButtonArea: {
    position: 'absolute',
    bottom: 82,
    left: 16,
    right: 16,
  },
  bottomButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  navbar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 8,
    paddingBottom: 18,
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  navItemActive: {
    backgroundColor: '#0F1F3D', borderRadius: 10, paddingVertical: 9,
  },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 11, color: '#94A3B8' },
  navLabelActive: { fontSize: 11, color: '#FFFFFF', fontWeight: '500' },
});
