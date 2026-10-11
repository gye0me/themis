// src/services/accountDeletionService.js
//
// 회원 탈퇴 — 앱스토어 심사 필수 요건(앱 안에서 계정 삭제 가능해야 함) + 개인정보처리방침의 파기 약속.
//
// 순서: 비밀번호로 본인 재확인 → 내 데이터 삭제 → 게시판 글 익명화 → 사용자 문서 삭제 → 인증 계정 삭제.
// 데이터 정리는 항목별로 실패해도 계속 진행하고(best effort), 마지막에 인증 계정을 지워 재로그인을 막는다.
// 다른 사람과 함께 쓰는 게시판 글·댓글은 지우면 대화 흐름이 깨지므로 작성자 정보만 "탈퇴한 사용자"로 바꾼다.
// (Realtime DB 채팅 메시지와 보낸 위급 알림 기록은 상대방의 기록이기도 해서 남겨둔다 — 개인정보처리방침 3항)

import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { deleteCase, deleteFile, getCasesByUser, getEvidenceRecords, getUserProfile } from './firebaseService';
import { getGuardianLinks, removeGuardianLink } from './guardianService';
import {
  syncDeadmanLocalState,
  unregisterDeadmanBackgroundTask,
} from './deadmanBackgroundTask';

async function safely(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[회원 탈퇴] ${label} 정리 실패:`, err?.message);
  }
}

async function anonymizeAuthored(collectionName, uid) {
  const snap = await getDocs(query(collection(db, collectionName), where('userId', '==', uid)));
  await Promise.all(
    snap.docs.map((d) => updateDoc(d.ref, { authorName: '탈퇴한 사용자' }).catch(() => {}))
  );
}

/**
 * 회원 탈퇴. password는 본인 재확인용(Firebase는 최근 로그인한 경우에만 계정 삭제를 허용한다).
 * 비밀번호가 틀리면 'auth/invalid-credential' 등의 오류를 그대로 던진다.
 */
export async function deleteMyAccount(password) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('로그인 정보가 없습니다. 다시 로그인한 뒤 시도해주세요.');

  // 1) 본인 재확인 — 여기서 실패하면 아무것도 지우지 않는다
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const uid = user.uid;
  const profile = await getUserProfile(uid).catch(() => null);

  // 2) 위급 상황 자동 알림 끄기 (이 기기의 백그라운드 감지 해제)
  await safely('데드맨 스위치', async () => {
    await unregisterDeadmanBackgroundTask();
    await syncDeadmanLocalState({ enabled: false, lastCheckIn: null, contactName: '', contactPhone: '' });
  });

  // 3) 사건 + 사건별 증거·파일
  await safely('사건', async () => {
    const cases = await getCasesByUser(uid);
    for (const c of cases) await deleteCase(c.id, uid);
  });
  // 사건에 연결되지 않은(일반) 증거까지 마저 정리
  await safely('증거', async () => {
    const records = await getEvidenceRecords(uid);
    await Promise.all(
      records.map(async (r) => {
        if (r.storagePath) await deleteFile(r.storagePath).catch(() => {});
        await deleteDoc(doc(db, 'evidenceRecords', r.id)).catch(() => {});
      })
    );
  });

  // 4) 보호자 연결 (내가 요청한 것 + 내가 보호자인 것 + 받은 요청)
  await safely('보호자 연결', async () => {
    const { myGuardians, protecting, incoming } = await getGuardianLinks(uid);
    await Promise.all([...myGuardians, ...protecting, ...incoming].map((l) => removeGuardianLink(l.id).catch(() => {})));
  });

  // 5) 나에게만 속한 문서들
  await safely('푸시 토큰', () => deleteDoc(doc(db, 'pushTokens', uid)));
  await safely('계약 전 체크리스트', () => deleteDoc(doc(db, 'preContractChecklists', uid)));
  await safely('예방 상담 기록', () => deleteDoc(doc(db, 'preventionChatHistory', uid)));
  if (profile?.themisId) await safely('Themis ID', () => deleteDoc(doc(db, 'themisIds', profile.themisId)));
  await safely('이메일 색인', () => deleteDoc(doc(db, 'userDirectory', user.email.trim().toLowerCase())));

  // 6) 게시판 글·댓글은 작성자 정보만 지운다
  await safely('게시판 글', () => anonymizeAuthored('expertPosts', uid));
  await safely('게시판 댓글', () => anonymizeAuthored('expertPostComments', uid));

  // 7) 사용자 문서 → 인증 계정 (인증 계정을 지우면 자동으로 로그아웃된다)
  await safely('사용자 문서', () => deleteDoc(doc(db, 'users', uid)));
  await deleteUser(user);
}
