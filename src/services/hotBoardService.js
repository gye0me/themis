// 핫게시판 · 공론화 SOS 서비스 레이어 — Firestore 사용 (컬렉션: hotBoardEntries)
//
// 기능명세서 기준 동작:
//   1) 유사 피해자(같은 caseType 채팅방 참여자) 10명 이상 모이면 자동 등록
//   2) 채팅방 안 "공론화 SOS" 버튼으로 발동 (단, 남용 방지를 위해 최소 인원·재발동 간격 제한)
// roomId 하나당 항목은 하나만 유지한다(이미 있으면 갱신, 없으면 새로 생성).
// 종료된(해결된) 사건은 관리자가 status를 'resolved'로 바꿔 목록에서 내릴 수 있다.

import { collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { addDocument, queryDocuments, updateDocument } from './firebaseService';

const COLLECTION = 'hotBoardEntries';

// 유사 피해자가 이 인원 이상 모이면 자동으로 핫게시판에 등록한다.
export const HOT_BOARD_THRESHOLD = 10;

// 수동 "공론화 SOS"는 최소 이 인원 이상 모였을 때만 최초 발동할 수 있다 (장난성 등록 방지).
export const MIN_SOS_MEMBERS = 3;

// 같은 방에서 SOS를 재발동하려면 이만큼 간격을 둬야 한다 (연타 스팸 방지).
export const SOS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24시간

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime() || 0;
}

/**
 * 핫게시판 목록 조회. 참여 인원 많은 순 → 최신순으로 정렬.
 * 기본적으로 종료 처리(status: 'resolved')된 사건은 제외한다.
 */
export async function getHotBoardEntries({ includeResolved = false } = {}) {
  const snapshot = await getDocs(collection(db, COLLECTION));
  let entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!includeResolved) {
    entries = entries.filter((e) => e.status !== 'resolved');
  }
  entries.sort((a, b) => {
    const diff = (b.memberCount ?? 0) - (a.memberCount ?? 0);
    if (diff !== 0) return diff;
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
  return entries;
}

/**
 * roomId로 이미 등록된 핫게시판 항목이 있는지 조회. 없으면 null.
 */
export async function getHotBoardEntryByRoomId(roomId) {
  const list = await queryDocuments(COLLECTION, 'roomId', '==', roomId);
  return list[0] ?? null;
}

/**
 * 핫게시판에 등록(또는 이미 있으면 인원수/상태만 갱신).
 * triggeredBy: 'auto' | 'manual'
 */
async function registerHotBoardEntry({
  roomId,
  roomName,
  caseType,
  memberCount,
  triggeredBy,
  triggeredByUid = null,
  signatureId = null,
  existing = null,
}) {
  if (existing) {
    // 이미 등록돼 있으면 최신 인원수만 갱신하고, 수동 SOS가 새로 눌리면 그 사실을 함께 기록한다.
    // 한 번 종료(resolved)된 사건이 SOS로 다시 눌리면 open으로 되돌려 재점화한다.
    await updateDocument(COLLECTION, existing.id, {
      memberCount,
      ...(triggeredBy === 'manual'
        ? { lastSosAt: serverTimestamp(), lastSosByUid: triggeredByUid, lastSosSignatureId: signatureId, status: 'open' }
        : {}),
    });
    return existing.id;
  }

  return addDocument(COLLECTION, {
    roomId,
    roomName,
    caseType,
    memberCount,
    triggeredBy, // 최초 등록 계기 — 'auto'(10명 이상 자동) | 'manual'(SOS 버튼)
    triggeredByUid,
    lastSosSignatureId: triggeredBy === 'manual' ? signatureId : null, // 최초 SOS 발동자의 전자서명 참조
    status: 'open',
  });
}

/**
 * 참여 인원이 임계치(HOT_BOARD_THRESHOLD) 이상이면 자동으로 핫게시판에 등록한다.
 * 이미 등록된 방이면 인원수만 갱신하고 조용히 반환한다.
 */
export async function maybeAutoRegisterHotBoard({ roomId, roomName, caseType, memberCount }) {
  if (!roomId || !caseType) return null;
  if (memberCount < HOT_BOARD_THRESHOLD) return null;
  const existing = await getHotBoardEntryByRoomId(roomId);
  return registerHotBoardEntry({ roomId, roomName, caseType, memberCount, triggeredBy: 'auto', existing });
}

/**
 * 지금 이 방에서 "공론화 SOS" 버튼을 눌러도 되는지 확인.
 * ChatRoomScreen에서 버튼을 비활성화하거나 안내 문구를 보여줄 때 사용한다.
 * 반환값: { allowed: boolean, reason?: string, remainingMs?: number }
 */
export function checkSosEligibility({ memberCount, existingEntry }) {
  if (memberCount < MIN_SOS_MEMBERS) {
    return { allowed: false, reason: `최소 ${MIN_SOS_MEMBERS}명 이상 모이면 발동할 수 있어요. (현재 ${memberCount}명)` };
  }
  const lastSosAt = existingEntry?.lastSosAt ? toMillis(existingEntry.lastSosAt) : 0;
  if (lastSosAt) {
    const elapsed = Date.now() - lastSosAt;
    if (elapsed < SOS_COOLDOWN_MS) {
      const remainingMs = SOS_COOLDOWN_MS - elapsed;
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      return { allowed: false, reason: `이미 발동했어요. 약 ${remainingHours}시간 뒤 다시 발동할 수 있어요.`, remainingMs };
    }
  }
  return { allowed: true };
}

/**
 * 채팅방 안 "공론화 SOS" 버튼 — 최소 인원·재발동 간격 제한을 통과해야 등록/갱신된다.
 * (서버 쪽에서도 firestore.rules가 같은 조건을 한 번 더 검증한다.)
 */
export async function triggerHotBoardSOS({ roomId, roomName, caseType, memberCount, uid, signatureId }) {
  if (!roomId) throw new Error('채팅방 정보를 찾을 수 없습니다.');
  if (!signatureId) throw new Error('전자서명 없이는 SOS를 발동할 수 없습니다.');

  const existing = await getHotBoardEntryByRoomId(roomId);
  const eligibility = checkSosEligibility({ memberCount, existingEntry: existing });
  if (!eligibility.allowed) {
    throw new Error(eligibility.reason);
  }

  return registerHotBoardEntry({
    roomId,
    roomName,
    caseType,
    memberCount,
    triggeredBy: 'manual',
    triggeredByUid: uid ?? null,
    signatureId,
    existing,
  });
}

/**
 * 사건 종료 처리 — 관리자가 해결된 핫게시판 항목을 목록에서 내릴 때 사용한다.
 * (firestore.rules에서 status 필드 변경은 관리자만 가능하도록 막아둔다.)
 */
export async function resolveHotBoardEntry(entryId, resolverUid) {
  await updateDocument(COLLECTION, entryId, {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    resolvedBy: resolverUid ?? null,
  });
}
