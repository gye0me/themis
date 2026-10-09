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

// 실제로 핫게시판에 등록된 사건이 아직 하나도 없을 때(초기 상태, 전시·데모 등) 대신 보여줄
// 예시 데이터. roomId가 실제 채팅방을 가리키지 않으므로 isDemo로 표시해두고, 화면단에서
// 눌렀을 때 실제 채팅방으로 이동하는 대신 "예시"라는 걸 안내해야 한다.
// 실제 사건이 하나라도 등록되면 getHotBoardEntries()가 그쪽을 돌려주므로 이 데이터는
// 자동으로 안 쓰이게 된다 — 화면단에서 "조회 결과가 비어있을 때만" 조합해서 쓴다.
export const DEMO_HOT_BOARD_ENTRIES = [
  {
    id: 'demo-jeonse',
    roomName: '강남구 전세사기 피해자 모임',
    caseType: '전세사기',
    memberCount: 47,
    // 같은 가해자에게 당했다는 구체성이 공감을 만든다 — "비슷한 유형 피해자가 모였다"보다
    // "같은 집주인에게 당한 사람이 이만큼 있다"가 훨씬 와닿는다.
    // description: 목록 카드용 짧은 요약. detailDescription: 상세 페이지용 긴 설명.
    // 둘을 분리한 이유 — 목록 카드는 깔끔해야 하고, 상세 페이지는 자세해야 해서 길이 요구가 다르다.
    description: '같은 집주인에게 보증금을 돌려받지 못한 사람들이 모였어요. 비슷한 시기에 같은 수법으로 계약한 피해자가 계속 늘고 있어요.',
    detailDescription:
      '2026년 3월부터 8월 사이, 역삼동 소재 다세대주택 7곳에서 동일 임대인과 전세 계약을 맺은 세입자들이 ' +
      '계약 만료 후 보증금을 돌려받지 못하는 피해가 이어지고 있어요. 해당 임대인은 신규 세입자의 보증금으로 ' +
      '기존 세입자에게 돌려막는 방식으로 돌려오다가, 최근 매매가 하락으로 그 돌려막기가 끊긴 것으로 보입니다. ' +
      '등기부등본상 근저당이 이미 보증금 규모를 넘어선 사실을 계약 당시엔 몰랐다는 피해자가 대부분이에요. ' +
      '현재 모임에서는 공동으로 임차권등기명령을 신청하고, 동일 사건으로 묶어 형사 고소를 준비하고 있어요.',
    caseSummary: [
      { label: '피해 유형', value: '전세사기 (보증금 미반환)' },
      { label: '발생 지역', value: '서울 강남구 역삼동' },
      { label: '피해 추정액', value: '1인당 평균 3억 1천만원' },
      { label: '모임 시작', value: '2026.09.12' },
    ],
    watchingExperts: ['변호사', '기자', '부동산중개사'],
    triggeredBy: 'auto',
    isDemo: true,
  },
  {
    id: 'demo-money',
    roomName: '중고거래 사기 공동대응방',
    caseType: '금전사기',
    memberCount: 29,
    description: '같은 판매자 계정에 입금했다가 물건을 못 받은 사람들이 모였어요. 피해 금액과 수법이 거의 똑같아 공동 대응을 준비하고 있어요.',
    detailDescription:
      '중고거래 플랫폼에서 동일한 판매자 계정(닉네임 변경 이력 다수)이 노트북·카메라 등 고가 전자기기를 ' +
      '시세보다 20~30% 싸게 올려두고, 입금을 받은 뒤 배송을 미루다 연락을 끊는 방식의 피해가 반복되고 있어요. ' +
      '최근 3개월간 유사한 패턴의 피해 신고가 계속 모이고 있고, 피해자 대부분이 "직거래가 아니라 안심거래를 ' +
      '유도했다"는 공통점을 이야기하고 있어요. 계좌 정보와 대화 캡처를 모아 경찰에 공동 고소장을 접수할 예정이에요.',
    caseSummary: [
      { label: '피해 유형', value: '금전사기 (중고거래)' },
      { label: '거래 플랫폼', value: '당근마켓 · 번개장터' },
      { label: '피해 추정액', value: '1인당 평균 42만원' },
      { label: '모임 시작', value: '2026.09.20' },
    ],
    watchingExperts: ['변호사', '기자'],
    triggeredBy: 'manual',
    isDemo: true,
  },
];

// 핫게시판 상세 페이지에서 "전문가들이 이미 댓글을 달아 주목하고 있다"는 걸 보여주기 위한
// 예시용 댓글 데이터. DEMO_HOT_BOARD_ENTRIES의 id와 1:1로 매칭되며, 실데이터 조회·저장과는
// 무관하다(완전히 화면단 더미) — 실제 사건이 생기면 이 댓글은 쓰이지 않는다.
export const DEMO_HOT_BOARD_COMMENTS = {
  'demo-jeonse': [
    {
      id: 'demo-jeonse-c1',
      expertType: '변호사',
      authorName: '김민석 변호사',
      content: '보증금 반환 소송을 준비하신다면 임차권등기명령부터 먼저 신청하시는 걸 추천드려요. 동일 임대인 피해자가 여럿이면 소송에서도 유리하게 작용할 수 있습니다.',
      relativeTime: '2시간 전',
    },
    {
      id: 'demo-jeonse-c2',
      expertType: '기자',
      authorName: '이지은 기자',
      content: '비슷한 수법의 전세사기 제보를 받고 있습니다. 피해 사실을 기사로 다뤄볼 수 있을지 검토 중이에요. 괜찮으시면 쪽지 주세요.',
      relativeTime: '5시간 전',
    },
    {
      id: 'demo-jeonse-c3',
      expertType: '부동산중개사',
      authorName: '박현우 공인중개사',
      content: '등기부등본상 근저당 설정 시점을 꼭 확인하시고, 계약 당시와 지금 상태가 달라졌는지 비교해보세요. 매매가 하락 시점과 근저당 설정일이 겹치면 고의성 입증에도 도움이 돼요.',
      relativeTime: '1일 전',
    },
    {
      id: 'demo-jeonse-c4',
      expertType: '변호사',
      authorName: '김민석 변호사',
      content: '추가로, 동일 임대인 피해자가 7세대 이상 확인되면 "사기죄 특별가중" 적용 가능성도 검토해볼 수 있어요. 계약서 원본과 입금 내역을 날짜순으로 정리해두시면 상담이 훨씬 빨라져요.',
      relativeTime: '1일 전',
    },
  ],
  'demo-money': [
    {
      id: 'demo-money-c1',
      expertType: '변호사',
      authorName: '정수아 변호사',
      content: '동일 계좌로 입금한 피해자가 많다면 형사 고소 시 병합 처리가 가능할 수 있어요. 입금 내역과 대화 캡처를 꼭 모아두세요.',
      relativeTime: '3시간 전',
    },
    {
      id: 'demo-money-c2',
      expertType: '기자',
      authorName: '한도윤 기자',
      content: '유사 피해 사례를 모아 취재 중입니다. 제보 주시면 익명으로 다뤄드릴 수 있어요.',
      relativeTime: '하루 전',
    },
    {
      id: 'demo-money-c3',
      expertType: '변호사',
      authorName: '정수아 변호사',
      content: '"안심거래"를 유도하며 입금을 요구한 경우, 전자상거래법상 통신판매중개자 책임도 같이 물을 수 있는지 플랫폼 쪽 약관까지 같이 확인해드릴게요.',
      relativeTime: '하루 전',
    },
  ],
};

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
