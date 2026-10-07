// 채팅 서비스 레이어 — Firebase Realtime Database 사용
// Firestore(cases, evidenceRecords 등)와 달리 채팅은 초당 다수의 쓰기/실시간 구독이
// 필요해 지연이 적고 비용 구조가 맞는 Realtime Database로 구현한다.

import {
  ref,
  push,
  set,
  update,
  onValue,
  off,
  get,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp,
} from 'firebase/database';
import { realtimeDb } from '../config/firebase';

// 고정 채팅방 목록. '전문가 채널'은 공익변호사 / 법률구조공단 등 실제 상담 창구로 연결되는
// 채널로, 일반 피해자 연대방과 같은 실시간 채팅 구조를 쓰되 room_type만 다르게 둔다.
export const CHAT_ROOMS = [
  {
    id: 'jeonse-gangnam',
    name: '강남구 전세사기 피해자',
    description: '같은 집주인에게 사례 다수 · 집단 고소 준비',
    icon: '🏠',
    color: '#FEE2E2',
    type: 'victim',
  },
  {
    id: 'stalking-support',
    name: '스토킹 피해자 지원',
    description: '피해자 지원센터 연결 · 법적 대응 공유',
    icon: '🛡️',
    color: '#F3E8FF',
    type: 'victim',
  },
  {
    id: 'workplace-harassment',
    name: '직장 내 괴롭힘 피해자',
    description: '증거 수집 방법 공유 · 노동청 신고 안내',
    icon: '💼',
    color: '#FFF7ED',
    type: 'victim',
  },
  {
    id: 'money-fraud-support',
    name: '금전·거래 사기 피해자',
    description: '중고거래·보이스피싱 피해 공유 · 신고 절차 안내',
    icon: '💸',
    color: '#FEF3C7',
    type: 'victim',
  },
  {
    id: 'expert-public-lawyer',
    name: '공익변호사 상담 채널',
    description: '공익 목적 법률 상담을 진행하는 변호사와 1:1로 연결됩니다',
    icon: '⚖️',
    color: '#DBEAFE',
    type: 'expert',
  },
  {
    id: 'expert-legal-aid',
    name: '대한법률구조공단 채널',
    description: '법률구조공단 상담원에게 직접 문의할 수 있는 공식 채널입니다',
    icon: '🏛️',
    color: '#DCFCE7',
    type: 'expert',
  },
];

export function getChatRoomMeta(roomId) {
  return CHAT_ROOMS.find((r) => r.id === roomId) ?? null;
}

// 사건 유형(caseType) → 같은 피해 유형 채팅방 매핑.
// '기타'처럼 대응되는 방이 없으면 매칭하지 않는다.
const CASE_TYPE_TO_ROOM_ID = {
  전세사기: 'jeonse-gangnam',
  금전사기: 'money-fraud-support',
  괴롭힘: 'workplace-harassment',
  신변위협: 'stalking-support',
};

/**
 * 새로 등록한 사건의 caseType과 같은 피해 유형을 다루는 피해자 연대방을 찾는다.
 * 매칭되는 방이 없으면 null.
 */
export function getMatchingRoomForCaseType(caseType) {
  const roomId = CASE_TYPE_TO_ROOM_ID[caseType];
  if (!roomId) return null;
  return getChatRoomMeta(roomId);
}

function assertRtdb() {
  if (!realtimeDb) {
    throw new Error(
      'Realtime Database가 초기화되지 않았습니다. .env의 EXPO_PUBLIC_FIREBASE_DATABASE_URL을 설정해주세요.',
    );
  }
}

/**
 * roomId 채팅방의 메시지를 실시간 구독한다.
 * 최근 200개까지만 불러와 오래된 방도 가볍게 유지한다.
 * 반환값(unsubscribe)을 컴포넌트 unmount 시 반드시 호출할 것.
 */
export function subscribeToMessages(roomId, callback, limit = 200) {
  assertRtdb();
  const messagesRef = query(
    ref(realtimeDb, `chatRooms/${roomId}/messages`),
    orderByChild('createdAt'),
    limitToLast(limit),
  );
  const handler = onValue(
    messagesRef,
    (snapshot) => {
      const val = snapshot.val() ?? {};
      const list = Object.entries(val)
        .map(([id, msg]) => ({ id, ...msg }))
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      callback(list);
    },
    (error) => {
      console.error('채팅 메시지 구독 오류:', error);
    },
  );
  return () => off(messagesRef, 'value', handler);
}

/**
 * 채팅방에 메시지 전송. text 메시지 또는 파일 첨부 메시지를 지원한다.
 */
export async function sendMessage(roomId, { uid, name, text, file = null }) {
  assertRtdb();
  const trimmed = (text ?? '').trim();
  if (!trimmed && !file) return;

  const messagesRef = ref(realtimeDb, `chatRooms/${roomId}/messages`);
  const newMsgRef = push(messagesRef);
  await set(newMsgRef, {
    senderId: uid,
    senderName: name || '익명',
    text: trimmed,
    file: file ?? null,
    createdAt: serverTimestamp(),
  });

  // 방 목록 화면에서 '마지막 메시지 미리보기'용으로 별도 저장
  await update(ref(realtimeDb, `chatRooms/${roomId}/meta`), {
    lastMessage: file ? `[파일] ${file.name ?? ''}` : trimmed,
    lastMessageAt: serverTimestamp(),
  });

  return newMsgRef.key;
}

/**
 * 방 메타(마지막 메시지, 참여자 수)를 실시간 구독.
 */
export function subscribeToRoomMeta(roomId, callback) {
  assertRtdb();
  const metaRef = ref(realtimeDb, `chatRooms/${roomId}/meta`);
  const handler = onValue(
    metaRef,
    (snapshot) => callback(snapshot.val() ?? null),
    (error) => console.error('채팅방 메타 구독 오류:', error),
  );
  return () => off(metaRef, 'value', handler);
}

/**
 * 참여 중인 회원 목록(uid 집합)을 실시간 구독. 참여 인원수 표시에 사용.
 */
export function subscribeToMembers(roomId, callback) {
  assertRtdb();
  const membersRef = ref(realtimeDb, `chatRooms/${roomId}/members`);
  const handler = onValue(
    membersRef,
    (snapshot) => {
      const val = snapshot.val() ?? {};
      callback(Object.keys(val));
    },
    (error) => console.error('채팅방 참여자 구독 오류:', error),
  );
  return () => off(membersRef, 'value', handler);
}

/**
 * 채팅방 참여. 참여자 목록에 uid를 추가하고 표시용 이름을 함께 저장한다.
 */
export async function joinRoom(roomId, uid, displayName) {
  assertRtdb();
  await update(ref(realtimeDb, `chatRooms/${roomId}/members`), {
    [uid]: { name: displayName || '익명', joinedAt: serverTimestamp() },
  });
}

/**
 * 채팅방 나가기. 참여자 목록에서 uid를 제거한다.
 */
export async function leaveRoom(roomId, uid) {
  assertRtdb();
  await update(ref(realtimeDb, `chatRooms/${roomId}/members`), { [uid]: null });
}

// ─── 새 채팅방 개설 요청 (최소 인원 모아 개설) ────────────────────────────────
// CHAT_ROOMS에 없는 주제를 사용자가 요청하면 "관심 등록"만 받다가, 관심자가
// MIN_PARTICIPANTS_TO_OPEN명 이상 모이면 자동으로 실제 채팅방을 개설한다.
// 데이터 경로: roomRequests/{topicKey} = { topic, requestedBy, interested: {uid: true}, openedRoomId? }

export const MIN_PARTICIPANTS_TO_OPEN = 5;

// 사용자가 입력한 자유 텍스트 주제를 Realtime Database 키로 쓸 수 있게 정규화.
// RTDB 키는 '.', '#', '$', '/', '[', ']' 를 못 쓰므로 전부 제거하고 공백은 하이픈으로.
function topicToKey(topic) {
  return topic
    .trim()
    .toLowerCase()
    .replace(/[.#$/\[\]]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

/**
 * 새 채팅방 주제에 관심(참여 의사) 등록. 관심자가 MIN_PARTICIPANTS_TO_OPEN명이 되면
 * 이 호출 안에서 바로 실제 채팅방(chatRooms/{topicKey})을 만들고 openedRoomId를 남긴다.
 * @returns {Promise<{ topicKey: string, interestedCount: number, opened: boolean, roomId: string|null }>}
 */
export async function requestNewRoomTopic(topic, uid, displayName) {
  assertRtdb();
  const trimmed = topic.trim();
  if (!trimmed) throw new Error('채팅방 주제를 입력해주세요.');
  const topicKey = topicToKey(trimmed);
  if (!topicKey) throw new Error('채팅방 주제에 사용할 수 있는 문자가 없어요.');

  const requestRef = ref(realtimeDb, `roomRequests/${topicKey}`);
  await update(requestRef, {
    topic: trimmed,
    [`interested/${uid}`]: true,
  });

  // 방금 등록 직후의 관심자 수를 다시 읽어서 임계값 도달 여부를 확인한다.
  const snap = await get(requestRef);
  const data = snap.val() ?? {};
  const interestedCount = Object.keys(data.interested ?? {}).length;

  // 이미 열렸으면 그 방으로, 아직이고 임계값 도달이면 지금 새로 연다.
  if (data.openedRoomId) {
    return { topicKey, interestedCount, opened: true, roomId: data.openedRoomId };
  }
  if (interestedCount >= MIN_PARTICIPANTS_TO_OPEN) {
    const roomId = `req-${topicKey}`;
    const meta = {
      name: trimmed,
      description: `참여자 ${interestedCount}명이 모여 개설된 채팅방`,
      icon: '🆕',
      createdAt: serverTimestamp(),
    };
    await update(ref(realtimeDb, `chatRooms/${roomId}/meta`), meta);
    // chatRooms/{roomId} 전체는 읽기 권한이 세분화돼 있어서(meta만 읽기 허용) 방 목록을
    // 조회할 때 chatRooms 루트를 통째로 읽을 수가 없다. 그래서 "열린 방 목록"만 따로
    // openedRoomsIndex에 가볍게 복사해두고, subscribeToDynamicRooms는 그걸 읽는다.
    await update(ref(realtimeDb, `openedRoomsIndex/${roomId}`), meta);
    await joinRoom(roomId, uid, displayName);
    await update(requestRef, { openedRoomId: roomId });
    return { topicKey, interestedCount, opened: true, roomId };
  }
  return { topicKey, interestedCount, opened: false, roomId: null };
}

/**
 * 특정 주제 요청의 관심자 수 + 개설 여부를 실시간 구독.
 * callback({ interestedCount, opened, roomId })
 */
export function subscribeToRoomRequest(topic, callback) {
  assertRtdb();
  const topicKey = topicToKey(topic);
  const requestRef = ref(realtimeDb, `roomRequests/${topicKey}`);
  const handler = onValue(
    requestRef,
    (snapshot) => {
      const data = snapshot.val() ?? {};
      const interestedCount = Object.keys(data.interested ?? {}).length;
      callback({ interestedCount, opened: !!data.openedRoomId, roomId: data.openedRoomId ?? null });
    },
    (error) => console.error('채팅방 개설 요청 구독 오류:', error),
  );
  return () => off(requestRef, 'value', handler);
}

/**
 * 아직 열리지 않은(=openedRoomId 없는) 모든 채팅방 요청을 실시간 구독.
 * "나 말고 다른 사람들도 이런 방을 원하고 있다"를 보여주기 위한 목록 — 사용자가 새 주제를
 * 직접 입력하기 전에 여기서 비슷한 요청이 있으면 그걸 눌러서 바로 합류할 수 있다.
 * callback([{ topicKey, topic, interestedCount, isJoinedByMe }])
 */
export function subscribeToPendingRoomRequests(callback, myUid) {
  assertRtdb();
  const requestsRef = ref(realtimeDb, 'roomRequests');
  const handler = onValue(
    requestsRef,
    (snapshot) => {
      const val = snapshot.val() ?? {};
      const pending = Object.entries(val)
        .filter(([, data]) => !data.openedRoomId && data.topic)
        .map(([topicKey, data]) => ({
          topicKey,
          topic: data.topic,
          interestedCount: Object.keys(data.interested ?? {}).length,
          isJoinedByMe: !!(myUid && data.interested?.[myUid]),
        }))
        .sort((a, b) => b.interestedCount - a.interestedCount);
      callback(pending);
    },
    (error) => console.error('채팅방 요청 목록 구독 오류:', error),
  );
  return () => off(requestsRef, 'value', handler);
}

/**
 * 모집이 완료되어 새로 열린 "요청 기반" 채팅방들을 실시간 구독.
 * CHAT_ROOMS(고정 목록)에 없는 추가 방 목록을 화면에서 합쳐서 보여줄 때 사용.
 * (chatRooms 루트는 읽기 권한이 세분화돼 있어 통째로 못 읽으므로, 가벼운 색인 노드인
 * openedRoomsIndex를 대신 구독한다 — database.rules.json에 별도 .read 규칙 필요)
 */
export function subscribeToDynamicRooms(callback) {
  assertRtdb();
  const indexRef = ref(realtimeDb, 'openedRoomsIndex');
  const handler = onValue(
    indexRef,
    (snapshot) => {
      const val = snapshot.val() ?? {};
      const dynamicRooms = Object.entries(val).map(([roomId, meta]) => ({
        id: roomId,
        name: meta.name,
        description: meta.description ?? '',
        icon: meta.icon ?? '🆕',
        color: '#E0F2FE',
        type: 'victim',
      }));
      callback(dynamicRooms);
    },
    (error) => console.error('개설된 채팅방 목록 구독 오류:', error),
  );
  return () => off(indexRef, 'value', handler);
}
