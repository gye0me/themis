// src/services/notificationService.js
//
// 홈 상단 종 아이콘의 "알림함". 별도 알림 컬렉션 없이, 이미 저장돼 있는 데이터에서 나에게 온 소식을 모아 보여준다.
//  - 위급 알림: 내가 지켜주는 사람이 응답 없음 (deadmanAlerts)
//  - 보호자 요청을 받음 / 내가 보낸 보호자 요청이 수락됨 (guardianLinks)
//  - 내 질문에 새 답변이 달림 (expertPosts + expertPostComments)
// 읽음 여부는 "마지막으로 알림함을 연 시각"을 기기에 저장해서 그 이후 알림만 안 읽음으로 본다.
// 항목별 조회가 실패해도(규칙 미배포 등) 나머지 알림은 그대로 보여준다.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryDocuments } from './firebaseService';
import { getExpertPostComments } from './expertBoardService';
import { getGuardianLinks, getReceivedAlerts } from './guardianService';

const seenKey = (uid) => `notifications:seenAt:${uid}`;

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? 0 : n;
}

async function safely(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`알림함: ${label} 불러오기 실패:`, err?.message);
    return [];
  }
}

/**
 * 나에게 온 알림 목록 (최신순, 최대 50개)
 * @returns {Promise<Array<{ id, type, title, body, time, target }>>}
 *   type: 'alert' | 'guardian-request' | 'guardian-accepted' | 'answer'
 *   target: 누르면 이동할 곳 ('guardian' | 'board')
 */
export async function getNotifications(uid) {
  if (!uid) return [];

  const [alerts, guardian, answers] = await Promise.all([
    safely('위급 알림', async () =>
      (await getReceivedAlerts(uid)).map((a) => ({
        id: `alert-${a.id}`,
        type: 'alert',
        title: `${a.fromName || '보호 대상'}님이 응답이 없어요`,
        body: a.message ?? '연락해서 안전을 확인해주세요.',
        time: toMillis(a.createdAt),
        target: 'guardian',
      }))
    ),
    safely('보호자 연결', async () => {
      const { myGuardians, incoming } = await getGuardianLinks(uid);
      return [
        ...incoming.map((l) => ({
          id: `guardian-request-${l.id}`,
          type: 'guardian-request',
          title: `${l.requesterName || '누군가'}님이 보호자 요청을 보냈어요`,
          body: '수락하면 이 분이 응답이 없을 때 알림과 위치를 받아요.',
          time: toMillis(l.createdAt),
          target: 'guardian',
        })),
        ...myGuardians
          .filter((l) => l.status === 'accepted')
          .map((l) => ({
            id: `guardian-accepted-${l.id}`,
            type: 'guardian-accepted',
            title: `${l.guardianName || '상대'}님이 보호자 요청을 수락했어요`,
            body: '이제 응답이 없을 때 이 분에게 앱 알림이 가요.',
            time: toMillis(l.respondedAt ?? l.createdAt),
            target: 'guardian',
          })),
      ];
    }),
    safely('질문 답변', async () => {
      const myPosts = await queryDocuments('expertPosts', 'userId', '==', uid);
      const perPost = await Promise.all(
        myPosts.map(async (post) => {
          const comments = await getExpertPostComments(post.id);
          return comments
            .filter((c) => c.userId !== uid && !c.hidden)
            .map((c) => ({
              id: `answer-${c.id}`,
              type: 'answer',
              title: `"${post.title || '내 질문'}"에 새 답변이 달렸어요`,
              body: `${c.isAnonymous ? '익명' : c.authorName || '익명'}: ${String(c.content ?? '').slice(0, 60)}`,
              time: toMillis(c.createdAt),
              target: 'board',
            }));
        })
      );
      return perPost.flat();
    }),
  ]);

  return [...alerts, ...guardian, ...answers].sort((a, b) => b.time - a.time).slice(0, 50);
}

export async function getNotificationsSeenAt(uid) {
  try {
    return Number(await AsyncStorage.getItem(seenKey(uid))) || 0;
  } catch {
    return 0;
  }
}

export async function markNotificationsSeen(uid) {
  try {
    await AsyncStorage.setItem(seenKey(uid), String(Date.now()));
  } catch {
    // 기기 저장 실패는 무시 (다음에 다시 안 읽음으로 보일 뿐)
  }
}

// 안 읽은 알림 수 (홈 종 아이콘 빨간 점용)
export async function getUnreadNotificationCount(uid) {
  const [items, seenAt] = await Promise.all([getNotifications(uid), getNotificationsSeenAt(uid)]);
  return items.filter((n) => n.time > seenAt).length;
}
