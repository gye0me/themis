// src/services/guardianService.js
//
// 데드맨 스위치 "보호자 앱 알림" — Themis 사용자끼리 보호자로 연결하고, 무응답 감지 시
// 보호자 폰으로 앱 푸시 알림을 보낸다.
// (iOS·안드로이드 모두 앱이 사용자 조작 없이 문자를 자동 발송하는 건 불가능해서, 자동 발송이
//  가능한 앱 푸시를 기본으로 하고 기존 문자 보내기는 보조 수단으로 남겼다.)
//
// Firestore 컬렉션 (규칙은 firestore.rules 참고)
// - themisIds/{코드}         : Themis ID(예: TM-4K7Q9) → { uid, nickname }  — 코드로 사람 찾기
// - userDirectory/{이메일}    : 이메일(소문자) → { uid, nickname, themisId } — 이메일로 사람 찾기
//   (users 문서는 본인만 읽을 수 있어서, 찾기용 최소 정보만 따로 둔다. 목록 조회는 막고 단건 조회만 허용)
// - guardianLinks/{요청자uid_보호자uid} : { requesterId, requesterName, guardianId, guardianName, status }
//   status: pending(요청) → accepted(수락) / rejected(거절). 위치가 전달되는 기능이라 보호자가 수락해야 연결된다.
// - pushTokens/{uid}         : Expo 푸시 토큰 — 본인과, 그 사람을 보호자로 둔 사용자만 읽을 수 있다.
// - deadmanAlerts/{id}       : 보낸 위급 알림 기록 — 푸시를 놓쳐도 보호자가 앱에서 확인할 수 있게.
//
// 한계: 휴대폰이 꺼졌거나 앱이 완전히 종료되면 감지 자체가 안 된다(서버 측 감시는 향후 과제).
// 안드로이드 Expo Go는 원격 푸시를 지원하지 않아 개발 빌드가 필요하다 (iOS Expo Go는 동작).

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { updateUserProfile } from './firebaseService';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O, 1/I 제외
export const GUARDIAN_CACHE_KEY = 'deadman:guardianTokens'; // 백그라운드 작업용 보호자 토큰 캐시

function randomThemisId() {
  let code = '';
  for (let i = 0; i < 5; i++) code += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return `TM-${code}`;
}

// 사용자가 입력한 코드를 저장 형식(TM-XXXXX)으로 맞춘다: "tm4k7q9", "4K7Q9" 모두 허용
export function normalizeThemisId(input) {
  const raw = String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('TM') ? raw.slice(2) : raw;
  return body.length === 5 ? `TM-${body}` : null;
}

const emailKey = (email) => String(email ?? '').trim().toLowerCase();
export const guardianLinkId = (requesterId, guardianId) => `${requesterId}_${guardianId}`;

/**
 * 로그인 시 호출: Themis ID가 없으면 만들고, 이메일 찾기용 색인을 맞춰둔다. Themis ID를 돌려준다.
 */
export async function ensureGuardianProfile({ uid, email, nickname, themisId }) {
  let id = themisId ?? null;
  if (!id) {
    for (let attempt = 0; attempt < 6 && !id; attempt++) {
      const candidate = randomThemisId();
      const taken = await getDoc(doc(db, 'themisIds', candidate));
      if (taken.exists()) continue;
      await setDoc(doc(db, 'themisIds', candidate), { uid, nickname: nickname ?? '', createdAt: serverTimestamp() });
      await updateUserProfile(uid, { themisId: candidate });
      id = candidate;
    }
  }
  if (email) {
    await setDoc(
      doc(db, 'userDirectory', emailKey(email)),
      { uid, nickname: nickname ?? '', themisId: id ?? null, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
  return id;
}

/**
 * Themis ID(코드) 또는 이메일로 사용자 찾기. 없으면 null.
 * @returns {Promise<{ uid: string, nickname: string, themisId: string|null }|null>}
 */
export async function findUserByIdOrEmail(input) {
  const text = String(input ?? '').trim();
  if (!text) return null;
  if (text.includes('@')) {
    const snap = await getDoc(doc(db, 'userDirectory', emailKey(text)));
    return snap.exists() ? { uid: snap.data().uid, nickname: snap.data().nickname, themisId: snap.data().themisId ?? null } : null;
  }
  const code = normalizeThemisId(text);
  if (!code) return null;
  const snap = await getDoc(doc(db, 'themisIds', code));
  return snap.exists() ? { uid: snap.data().uid, nickname: snap.data().nickname, themisId: code } : null;
}

/**
 * 보호자 요청 보내기 — me가 target에게 "내 보호자가 되어달라"고 요청한다.
 */
export async function sendGuardianRequest({ me, myName, target }) {
  if (target.uid === me) throw new Error('나 자신은 보호자로 추가할 수 없어요.');
  const ref = doc(db, 'guardianLinks', guardianLinkId(me, target.uid));
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const status = existing.data().status;
    if (status === 'accepted') throw new Error('이미 연결된 보호자예요.');
    if (status === 'pending') throw new Error('이미 요청을 보냈어요. 상대가 수락하면 연결돼요.');
    // 거절됐던 요청은 지우고 다시 보낸다
    await deleteDoc(ref);
  }
  await setDoc(ref, {
    requesterId: me,
    requesterName: myName ?? '',
    guardianId: target.uid,
    guardianName: target.nickname ?? '',
    status: 'pending',
    createdAt: serverTimestamp(),
    respondedAt: null,
  });
}

/**
 * 나와 관련된 보호자 연결 전체.
 * myGuardians: 내가 요청한 보호자들 / protecting: 내가 지켜주는 사람들(수락함) / incoming: 나에게 온 요청
 */
export async function getGuardianLinks(uid) {
  const [asRequester, asGuardian] = await Promise.all([
    getDocs(query(collection(db, 'guardianLinks'), where('requesterId', '==', uid))),
    getDocs(query(collection(db, 'guardianLinks'), where('guardianId', '==', uid))),
  ]);
  const mine = asRequester.docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => l.status !== 'rejected');
  const others = asGuardian.docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    myGuardians: mine,
    protecting: others.filter((l) => l.status === 'accepted'),
    incoming: others.filter((l) => l.status === 'pending'),
  };
}

export async function respondGuardianRequest(linkId, accept) {
  await updateDoc(doc(db, 'guardianLinks', linkId), {
    status: accept ? 'accepted' : 'rejected',
    respondedAt: serverTimestamp(),
  });
}

export async function removeGuardianLink(linkId) {
  await deleteDoc(doc(db, 'guardianLinks', linkId));
}

/**
 * 이 기기의 Expo 푸시 토큰을 저장한다 — 이 사용자를 보호자로 둔 사람이 무응답일 때 알림을 받기 위해.
 * askPermission이 false면 이미 허용된 경우에만 등록한다(로그인 직후 갑자기 권한 창이 뜨지 않도록).
 */
export async function registerPushToken(uid, { askPermission = false } = {}) {
  if (Platform.OS === 'web' || !uid) return null;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && askPermission) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await setDoc(doc(db, 'pushTokens', uid), { token, platform: Platform.OS, updatedAt: serverTimestamp() });
    return token;
  } catch (err) {
    // 안드로이드 Expo Go 등 원격 푸시를 지원하지 않는 환경
    console.warn('푸시 토큰 등록 실패:', err?.message);
    return null;
  }
}

// 수락된 내 보호자들의 푸시 토큰 목록
async function getMyGuardianTargets(uid) {
  const { myGuardians } = await getGuardianLinks(uid);
  const accepted = myGuardians.filter((l) => l.status === 'accepted');
  return Promise.all(
    accepted.map(async (l) => {
      let token = null;
      try {
        const snap = await getDoc(doc(db, 'pushTokens', l.guardianId));
        token = snap.exists() ? snap.data().token : null;
      } catch (err) {
        console.warn('보호자 푸시 토큰 조회 실패:', err?.message);
      }
      return { uid: l.guardianId, name: l.guardianName, token };
    })
  );
}

/**
 * 백그라운드 작업(React 밖, 로그인 상태 보장 X)이 바로 푸시를 보낼 수 있도록
 * 보호자 토큰과 내 이름을 기기에 저장해 둔다. 데드맨 스위치를 켤 때·홈 화면에 들어올 때 호출.
 */
export async function cacheGuardianTokensForBackground(uid, myName) {
  try {
    const targets = await getMyGuardianTargets(uid);
    const tokens = targets.map((t) => t.token).filter(Boolean);
    await AsyncStorage.setItem(GUARDIAN_CACHE_KEY, JSON.stringify({ tokens, myName: myName ?? '' }));
    return targets;
  } catch (err) {
    console.warn('보호자 토큰 캐시 실패:', err?.message);
    return [];
  }
}

/**
 * Expo 푸시 서비스로 알림 발송. 실패해도 예외를 던지지 않고 보낸 개수를 돌려준다.
 */
export async function sendExpoPush(tokens, { title, body, data }) {
  const valid = (tokens ?? []).filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'));
  if (valid.length === 0) return 0;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(valid.map((to) => ({ to, title, body, data, sound: 'default', priority: 'high' }))),
    });
    return res.ok ? valid.length : 0;
  } catch (err) {
    console.warn('푸시 발송 실패:', err?.message);
    return 0;
  }
}

/**
 * 무응답 감지 시(앱이 켜져 있을 때) 수락된 보호자 전원에게 알림 기록 + 푸시 발송.
 * skipPush: 백그라운드 작업이 이미 푸시를 보냈다면 기록만 남긴다(중복 알림 방지).
 * @returns {{ guardianCount: number, pushedCount: number }}
 */
export async function sendDeadmanAlertToGuardians({ uid, myName, message, locationUrl, skipPush = false }) {
  const targets = await getMyGuardianTargets(uid);
  if (targets.length === 0) return { guardianCount: 0, pushedCount: 0 };

  await Promise.all(
    targets.map((t) =>
      addDoc(collection(db, 'deadmanAlerts'), {
        fromUid: uid,
        fromName: myName ?? '',
        toUid: t.uid,
        message,
        locationUrl: locationUrl ?? null,
        createdAt: serverTimestamp(),
        readAt: null,
      }).catch((err) => console.warn('위급 알림 기록 실패:', err?.message))
    )
  );

  const pushedCount = skipPush
    ? 0
    : await sendExpoPush(
        targets.map((t) => t.token),
        {
          title: `⚠️ ${myName || 'Themis 사용자'}님이 응답이 없어요`,
          body: locationUrl ? `${message}\n위치를 확인하려면 탭하세요.` : message,
          data: { type: 'guardian-alert', fromUid: uid },
        }
      );
  return { guardianCount: targets.length, pushedCount };
}

// 보호자 입장에서 받은 위급 알림 (최신순)
export async function getReceivedAlerts(uid) {
  const snap = await getDocs(query(collection(db, 'deadmanAlerts'), where('toUid', '==', uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function markAlertRead(alertId) {
  await updateDoc(doc(db, 'deadmanAlerts', alertId), { readAt: serverTimestamp() });
}
