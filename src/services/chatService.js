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
