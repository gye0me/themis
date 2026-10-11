// src/services/blockService.js
//
// 사용자 차단 — 앱스토어 심사 요건(사용자 생성 콘텐츠가 있는 앱은 신고 + 차단 기능 필수).
// 차단 목록은 내 사용자 문서(users/{uid}.blockedUsers = { [상대uid]: { name, blockedAt } })에 저장하고,
// 게시판·채팅 화면이 이 목록에 있는 사람의 글·댓글·메시지를 내 화면에서만 숨긴다.

import { deleteField, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export function getBlockedUserIds(profile) {
  return new Set(Object.keys(profile?.blockedUsers ?? {}));
}

export async function blockUser(myUid, targetUid, targetName) {
  if (!myUid || !targetUid || myUid === targetUid) return;
  await setDoc(
    doc(db, 'users', myUid),
    { blockedUsers: { [targetUid]: { name: targetName || '이름 없음', blockedAt: serverTimestamp() } } },
    { merge: true }
  );
}

export async function unblockUser(myUid, targetUid) {
  await updateDoc(doc(db, 'users', myUid), { [`blockedUsers.${targetUid}`]: deleteField() });
}
