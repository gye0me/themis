// 전문가 채널(일반 게시판) 서비스 레이어 — Firestore 사용
// 게시글: expertPosts, 댓글: expertPostComments (post_id로 게시글 참조)
//
// [게시판 방어책] 전문가 게시판은 정책상 텍스트만 허용한다. 사건 타임라인 첨부(attachedCase)와
// PDF 등 어떤 파일 첨부도 게시글에 붙일 수 없다 — 익명 신고 특성상 원본 자료가 그대로
// 공개되면 사생활 노출·명예훼손 소지가 있고, 악성 파일 업로드 통로가 될 수도 있기 때문.
// createExpertPost가 받는 인자를 여기서 화이트리스트로 강제해서, 나중에 다른 화면에서
// 실수로 attachedCase/file 같은 필드를 넘겨도 저장되지 않고 명시적으로 에러가 나도록 막는다.

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { addDocument, deleteDocument, queryDocuments, updateDocument } from './firebaseService';

const ALLOWED_POST_FIELDS = ['userId', 'authorName', 'title', 'content', 'isAnonymous'];
const MAX_TITLE_LENGTH = 80;
const MAX_CONTENT_LENGTH = 3000;

/**
 * 전문가 채널에 새 질문 게시글 등록. 텍스트(제목/내용)만 허용 — 사건 타임라인 첨부,
 * 파일 첨부 등은 정책상 지원하지 않는다.
 * isAnonymous: true면 작성자 이름을 저장하지 않는다 (화면엔 "익명 작성자"로 표시).
 *
 * @throws 정책에 없는 필드(예: attachedCase, file 등)가 함께 전달되면 즉시 에러.
 */
export async function createExpertPost(payload) {
  const unexpectedKeys = Object.keys(payload).filter((key) => !ALLOWED_POST_FIELDS.includes(key));
  if (unexpectedKeys.length > 0) {
    throw new Error(
      `게시판에는 텍스트만 등록할 수 있습니다. 지원하지 않는 항목: ${unexpectedKeys.join(', ')} ` +
        '(사건 타임라인 첨부, PDF 등 파일 첨부는 게시판에 쓸 수 없어요.)'
    );
  }

  const { userId, authorName, title, content, isAnonymous = false } = payload;

  const trimmedTitle = (title ?? '').trim();
  const trimmedContent = (content ?? '').trim();
  if (!trimmedTitle) throw new Error('제목을 입력해주세요.');
  if (!trimmedContent) throw new Error('내용을 입력해주세요.');
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    throw new Error(`제목은 ${MAX_TITLE_LENGTH}자 이내로 입력해주세요.`);
  }
  if (trimmedContent.length > MAX_CONTENT_LENGTH) {
    throw new Error(`내용은 ${MAX_CONTENT_LENGTH}자 이내로 입력해주세요.`);
  }

  return addDocument('expertPosts', {
    userId,
    authorName: isAnonymous ? null : (authorName || '익명'),
    isAnonymous,
    title: trimmedTitle,
    content: trimmedContent,
    // 채택된 답변 상태 — 작성자가 댓글 하나를 채택하면 채워진다.
    acceptedCommentId: null,
    isResolved: false,
    // 신고 누적으로 자동 숨김 처리됐는지 여부
    hidden: false,
  });
}

/**
 * 전문가 채널 게시글 전체 목록 조회 (최신순).
 * 신고 누적으로 숨김 처리된 게시글은 제외한다.
 * 복합 인덱스 없이 동작하도록 클라이언트에서 정렬한다.
 */
export async function getExpertPosts() {
  const posts = await queryAllDocuments('expertPosts');
  const visible = posts.filter((p) => !p.hidden);
  visible.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return visible;
}

/**
 * 게시글 하나 조회.
 */
export async function getExpertPostById(postId) {
  const snap = await getDoc(doc(db, 'expertPosts', postId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * 게시글 삭제. 작성자 본인만 삭제 가능(화면단 확인 + Firestore 규칙 이중 검증).
 * 게시글에 달린 댓글도 함께 정리한다.
 */
export async function deleteExpertPost(postId, userId) {
  const post = await getExpertPostById(postId);
  if (!post) return;
  if (post.userId !== userId) {
    throw new Error('본인이 작성한 글만 삭제할 수 있습니다.');
  }

  const comments = await queryDocuments('expertPostComments', 'postId', '==', postId);
  await Promise.all(
    comments.map((c) =>
      deleteDocument('expertPostComments', c.id).catch((err) => {
        console.error('댓글 삭제 오류:', c.id, err);
      }),
    ),
  );

  await deleteDocument('expertPosts', postId);
}

const ALLOWED_COMMENT_FIELDS = ['userId', 'authorName', 'content', 'isExpertAnswer', 'isAnonymous'];
const MAX_COMMENT_LENGTH = 1500;

/**
 * 게시글에 댓글 등록. 텍스트만 허용.
 * isAnonymous: true면 작성자 이름을 저장하지 않는다 (화면엔 "익명 참여자 N"으로 표시).
 *
 * @throws 정책에 없는 필드(파일 관련 값 등)가 함께 전달되면 즉시 에러.
 */
export async function addExpertPostComment(postId, payload) {
  const unexpectedKeys = Object.keys(payload).filter((key) => !ALLOWED_COMMENT_FIELDS.includes(key));
  if (unexpectedKeys.length > 0) {
    throw new Error(`댓글에는 텍스트만 등록할 수 있습니다. 지원하지 않는 항목: ${unexpectedKeys.join(', ')}`);
  }

  const { userId, authorName, content, isExpertAnswer = false, isAnonymous = false } = payload;
  const trimmedContent = (content ?? '').trim();
  if (!trimmedContent) throw new Error('댓글 내용을 입력해주세요.');
  if (trimmedContent.length > MAX_COMMENT_LENGTH) {
    throw new Error(`댓글은 ${MAX_COMMENT_LENGTH}자 이내로 입력해주세요.`);
  }

  return addDocument('expertPostComments', {
    postId,
    userId,
    authorName: isAnonymous ? null : (authorName || '익명'),
    isAnonymous,
    content: trimmedContent,
    isExpertAnswer,
    hidden: false,
  });
}

/**
 * 게시글의 댓글 목록 조회 (오래된 순).
 */
export async function getExpertPostComments(postId) {
  const comments = await queryDocuments('expertPostComments', 'postId', '==', postId);
  comments.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  return comments;
}

/**
 * 게시글 작성자가 특정 댓글을 "채택된 답변"으로 지정한다.
 * 작성자 본인만 가능(화면단 확인 + Firestore 규칙 이중 검증).
 */
export async function acceptExpertComment(postId, commentId, userId) {
  const post = await getExpertPostById(postId);
  if (!post) throw new Error('게시글을 찾을 수 없습니다.');
  if (post.userId !== userId) {
    throw new Error('본인이 작성한 글에서만 답변을 채택할 수 있습니다.');
  }
  await updateDocument('expertPosts', postId, {
    acceptedCommentId: commentId,
    isResolved: true,
  });
}

/**
 * 채택을 취소한다. 작성자 본인만 가능.
 */
export async function unacceptExpertComment(postId, userId) {
  const post = await getExpertPostById(postId);
  if (!post) throw new Error('게시글을 찾을 수 없습니다.');
  if (post.userId !== userId) {
    throw new Error('본인이 작성한 글에서만 채택을 취소할 수 있습니다.');
  }
  await updateDocument('expertPosts', postId, {
    acceptedCommentId: null,
    isResolved: false,
  });
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime() || 0;
}

// queryDocuments는 where 조건이 필수라서, 전체 목록 조회용으로 getDocs를 직접 사용.
async function queryAllDocuments(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
