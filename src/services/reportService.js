// 신고 서비스 — 전문가 게시글/댓글에 대한 신고 접수 및 임계치 도달 시 자동 숨김 처리.
// 채팅 메시지 등 다른 콘텐츠 타입도 targetType만 늘리면 그대로 재사용 가능하도록 일반화했다.

import { addDocument, queryDocuments, updateDocument } from './firebaseService';

// 신고 누적 시 자동 숨김 처리되는 기준 건수 (서로 다른 사용자 기준).
const HIDE_THRESHOLD = 3;

// targetType → 실제 Firestore 컬렉션 이름 매핑.
const TARGET_COLLECTIONS = {
  expertPost: 'expertPosts',
  expertPostComment: 'expertPostComments',
};

export const REPORT_REASONS = ['욕설/비방', '스팸/광고', '개인정보 노출', '기타'];

/**
 * 신고 접수.
 * - 같은 사용자가 같은 대상을 중복 신고하면 에러.
 * - 서로 다른 신고자가 HIDE_THRESHOLD명 이상 모이면 대상 문서를 자동으로 숨김 처리한다.
 *
 * targetType: 'expertPost' | 'expertPostComment'
 */
export async function submitReport({ targetType, targetId, reporterUserId, reason }) {
  const collectionName = TARGET_COLLECTIONS[targetType];
  if (!collectionName) {
    throw new Error(`알 수 없는 신고 대상 타입입니다: ${targetType}`);
  }

  const existing = await queryDocuments('reports', 'targetId', '==', targetId);
  const alreadyReported = existing.some((r) => r.reporterUserId === reporterUserId);
  if (alreadyReported) {
    throw new Error('이미 신고한 게시물/댓글이에요.');
  }

  await addDocument('reports', {
    targetType,
    targetId,
    reporterUserId,
    reason: reason || '기타',
  });

  // 이번 신고까지 포함한 고유 신고자 수를 세서 임계치 도달 시 자동 숨김.
  const uniqueReporters = new Set(existing.map((r) => r.reporterUserId));
  uniqueReporters.add(reporterUserId);

  if (uniqueReporters.size >= HIDE_THRESHOLD) {
    await updateDocument(collectionName, targetId, { hidden: true }).catch((err) => {
      // 숨김 처리가 실패해도 신고 접수 자체는 이미 완료된 것으로 본다.
      console.error('자동 숨김 처리 오류:', err);
    });
  }
}
