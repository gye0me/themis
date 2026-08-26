// Firebase 서비스 레이어
// 모든 Firebase 관련 작업을 여기에 모아서 관리합니다

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import {
  THEMIS_COLLECTIONS,
  CONTRACT_TYPES,
  CHATROOM_TYPES,
  CHATROOM_MEMBER_ROLES,
} from './themisSchema';

// ==================== 인증 (Auth) ====================

/**
 * 이메일/비밀번호로 회원가입
 */
export async function signUp(email, password, displayName = '') {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await addUserProfile(userCredential.user.uid, {
      email,
      nickname: displayName,
    });

    return userCredential.user;
  } catch (error) {
    console.error('회원가입 오류:', error);
    throw error;
  }
}

/**
 * 이메일/비밀번호로 로그인
 */
export async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('로그인 오류:', error);
    throw error;
  }
}

/**
 * 로그아웃
 */
export async function logout() {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('로그아웃 오류:', error);
    throw error;
  }
}

/**
 * 현재 로그인한 사용자 정보 (리스너)
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * 현재 로그인한 사용자
 */
export function getCurrentUser() {
  return auth.currentUser;
}

// ==================== 데이터베이스 (Firestore) ====================

/**
 * 사용자 프로필 저장
 */
export async function addUserProfile(userId, profileData) {
  try {
    await setDoc(
      doc(db, THEMIS_COLLECTIONS.USERS, userId),
      {
        uid: userId,
        ...profileData,
        joined_at: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('프로필 저장 오류:', error);
    throw error;
  }
}

/**
 * 사용자 프로필 조회
 */
export async function getUserProfile(userId) {
  try {
    const snapshot = await getDoc(doc(db, THEMIS_COLLECTIONS.USERS, userId));

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    };
  } catch (error) {
    console.error('프로필 조회 오류:', error);
    throw error;
  }
}

export async function updateUserProfile(userId, profileData) {
  try {
    await updateDocument(THEMIS_COLLECTIONS.USERS, userId, profileData);
  } catch (error) {
    console.error('사용자 프로필 수정 오류:', error);
    throw error;
  }
}

export async function createContract(contractData) {
  if (contractData.contract_type && !CONTRACT_TYPES.includes(contractData.contract_type)) {
    throw new Error(`유효하지 않은 contract_type: ${contractData.contract_type}`);
  }

  return addDocument(THEMIS_COLLECTIONS.CONTRACTS, contractData);
}

export async function getContractsByUser(userId) {
  return queryDocuments(THEMIS_COLLECTIONS.CONTRACTS, 'user_id', '==', userId);
}

export async function getContractById(contractId) {
  try {
    const snapshot = await getDoc(doc(db, THEMIS_COLLECTIONS.CONTRACTS, contractId));

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    };
  } catch (error) {
    console.error('계약서 조회 오류:', error);
    throw error;
  }
}

export async function addContractClause(contractId, clauseData) {
  return addDocument(THEMIS_COLLECTIONS.CONTRACT_CLAUSES, {
    contract_id: contractId,
    ...clauseData,
  });
}

export async function getContractClauses(contractId) {
  return queryDocuments(THEMIS_COLLECTIONS.CONTRACT_CLAUSES, 'contract_id', '==', contractId);
}

export async function addCommunityComment(commentData) {
  return addDocument(THEMIS_COLLECTIONS.COMMUNITY_COMMENTS, commentData);
}

export async function getCommunityCommentsByPost(postId) {
  return queryDocuments(THEMIS_COLLECTIONS.COMMUNITY_COMMENTS, 'post_id', '==', postId);
}

export async function createChatroom(chatroomData) {
  if (chatroomData.room_type && !CHATROOM_TYPES.includes(chatroomData.room_type)) {
    throw new Error(`유효하지 않은 room_type: ${chatroomData.room_type}`);
  }

  return addDocument(THEMIS_COLLECTIONS.CHATROOMS, chatroomData);
}

export async function getChatroomsByOriginPost(originPostId) {
  return queryDocuments(THEMIS_COLLECTIONS.CHATROOMS, 'origin_post_id', '==', originPostId);
}

export async function addChatroomMember(memberData) {
  if (memberData.role && !CHATROOM_MEMBER_ROLES.includes(memberData.role)) {
    throw new Error(`유효하지 않은 role: ${memberData.role}`);
  }

  return addDocument(THEMIS_COLLECTIONS.CHATROOM_MEMBERS, memberData);
}

export async function getChatroomMembers(chatroomId) {
  return queryDocuments(THEMIS_COLLECTIONS.CHATROOM_MEMBERS, 'chatroom_id', '==', chatroomId);
}

/**
 * 문서 추가
 */
export async function addDocument(collectionName, data) {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error(`${collectionName} 추가 오류:`, error);
    throw error;
  }
}

/**
 * 문서 수정
 */
export async function updateDocument(collectionName, docId, data) {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`${collectionName} 수정 오류:`, error);
    throw error;
  }
}

/**
 * 문서 삭제
 */
export async function deleteDocument(collectionName, docId) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    console.error(`${collectionName} 삭제 오류:`, error);
    throw error;
  }
}

/**
 * 모든 문서 조회
 */
export async function getDocuments(collectionName) {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }));
  } catch (error) {
    console.error(`${collectionName} 조회 오류:`, error);
    throw error;
  }
}

/**
 * 조건 검색
 */
export async function queryDocuments(collectionName, field, operator, value) {
  try {
    const q = query(
      collection(db, collectionName),
      where(field, operator, value),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }));
  } catch (error) {
    console.error(`${collectionName} 검색 오류:`, error);
    throw error;
  }
}

// ==================== 파일 저장소 (Storage) ====================

/**
 * 파일 업로드
 */
export async function uploadFile(file, path) {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return snapshot.ref.fullPath;
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    throw error;
  }
}

async function uploadFileFromUri(fileUri, path, contentType, webFile = null) {
  let uploadData = webFile;
  if (!uploadData) {
    const response = await fetch(fileUri);
    uploadData = await response.blob();
  }
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, uploadData, contentType ? { contentType } : undefined);
  const downloadURL = await getDownloadURL(snapshot.ref);

  return {
    fullPath: snapshot.ref.fullPath,
    downloadURL,
  };
}

/**
 * 영상 증거의 5초 지점 캡처 이미지를 Storage에 업로드.
 * (EvidenceUploadScreen에서 expo-video-thumbnails로 뽑은 썸네일 uri를 넘긴다)
 */
export async function uploadEvidenceThumbnail(thumbnailUri) {
  const path = `evidence-thumbnails/${Date.now()}-thumb.jpg`;
  return uploadFileFromUri(thumbnailUri, path, 'image/jpeg');
}

function sanitizeFileName(fileName = 'evidence') {
  return fileName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

/**
 * 증거 파일/메모를 Storage + Firestore에 함께 저장
 */
export async function createEvidenceRecord({
  userId = null,
  caseId = 'general',
  caseTitle = '',
  title = '',
  note = '',
  evidenceType = 'text',
  file = null,
  location = null,
  extra = {}, // 계약서 분석 결과처럼 타입별 추가 데이터를 넣을 때 사용 (선택)
}) {
  try {
    const capturedAt = Timestamp.now(); // 표시용 — 기기 시계 기준이라 조작 가능성이 있음
    let storagePath = null;
    let downloadURL = null;
    let originalFileName = null;
    let mimeType = null;
    let fileSize = null;

    if (file?.uri) {
      originalFileName = file.name ?? `${evidenceType}-${Date.now()}`;
      mimeType = file.mimeType ?? null;
      fileSize = file.size ?? null;
      const safeFileName = sanitizeFileName(originalFileName);
      storagePath = `evidence/${caseId}/${Date.now()}-${safeFileName}`;
      // 웹과 앱 모두 완벽하게 업로드되도록 웹 파일 객체(file.file) 전달
      const uploadResult = await uploadFileFromUri(file.uri, storagePath, mimeType, file.file);
      storagePath = uploadResult.fullPath;
      downloadURL = uploadResult.downloadURL;
    }

    const docRef = await addDoc(collection(db, 'evidenceRecords'), {
      userId,
      caseId,
      caseTitle,
      title,
      note,
      evidenceType,
      originalFileName,
      mimeType,
      fileSize,
      storagePath,
      downloadURL,
      location,
      capturedAt,
      createdAt: capturedAt,
      // 클라이언트 기기 시계는 조작 가능하므로, 서버가 실제로 문서를 받은 시점을
      // 별도로 기록해 무결성 검증 근거로 쓴다 (capturedAt과 별개로 유지).
      serverVerifiedAt: serverTimestamp(),
      ...extra,
    });

    return {
      id: docRef.id,
      userId,
      caseId,
      caseTitle,
      title,
      note,
      evidenceType,
      originalFileName,
      mimeType,
      fileSize,
      storagePath,
      downloadURL,
      location,
      capturedAt,
      ...extra,
    };
  } catch (error) {
    console.error('증거 저장 오류:', error);
    throw error;
  }
}

/**
 * 증거 목록 조회 (userId 기준, capturedAt 내림차순)
 */
export async function getEvidenceRecords(userId, caseId = null) {
  try {
    const constraints = [where('userId', '==', userId)];
    if (caseId) constraints.push(where('caseId', '==', caseId));
    const q = query(collection(db, 'evidenceRecords'), ...constraints);
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    // 복합 인덱스 없이도 동작하도록 클라이언트에서 정렬
    docs.sort((a, b) => {
      const aTime = a.capturedAt?.toDate?.() ?? new Date(a.capturedAt ?? 0);
      const bTime = b.capturedAt?.toDate?.() ?? new Date(b.capturedAt ?? 0);
      return bTime - aTime;
    });
    return docs;
  } catch (error) {
    console.error('증거 목록 조회 오류:', error);
    throw error;
  }
}

// ==================== 사건(Case) & 대응 퀘스트 ====================

/**
 * 새 사건 생성 (사건 유형 선택 → 타임라인 생성 시 호출).
 * caseType: '전세사기' | '금전사기' | '괴롭힘' | '신변위협'
 */
export async function createCase({ userId, caseType, title = '', tags = [], visibility = '나만보기', memo = '' }) {
  const caseId = await addDocument('cases', {
    userId,
    caseType,
    title: title || '새 사건',
    tags, // 자유 태그 (기록 시작 화면에서 직접 입력/선택)
    visibility, // '나만보기' | '전문가공유' | '공론화'
    memo, // 간단 메모 (선택)
    questSteps: [], // 대응 퀘스트 진행 상태 (id, completed, note)
  });
  return caseId;
}

/**
 * 사용자의 사건 목록 조회
 */
export async function getCasesByUser(userId) {
  return queryDocuments('cases', 'userId', '==', userId);
}

/**
 * 사건 하나 조회 (퀘스트 진행 상태 포함)
 */
export async function getCaseById(caseId) {
  const docRef = doc(db, 'cases', caseId);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * 대응 퀘스트 진행 상태(완료 여부 + 질문/메모 기록) 저장.
 * items는 responseGuideSteps.buildQuestSteps(...)가 반환한 items 배열을 그대로 넘기면 됨.
 */
export async function saveCaseQuestSteps(caseId, items) {
  return updateDocument('cases', caseId, { questSteps: items });
}

/**
 * Themis AI 질문/답변 기록 저장 (사건별로 누적).
 * history: [{ question, answer, createdAt }]
 */
export async function saveCaseAiHistory(caseId, history) {
  return updateDocument('cases', caseId, { aiHistory: history });
}

/**
 * 사건 삭제 (사건 문서 + 소속 증거 기록 + Storage 파일까지 함께 정리).
 * 되돌릴 수 없으므로 화면단에서 반드시 확인(Alert) 후 호출할 것.
 */
export async function deleteCase(caseId, userId) {
  try {
    const records = await getEvidenceRecords(userId, caseId);

    // Storage 파일 삭제 (하나 실패해도 나머지 정리는 계속 진행)
    await Promise.all(
      records.map(async (r) => {
        if (!r.storagePath) return;
        try {
          await deleteFile(r.storagePath);
        } catch (err) {
          console.error('증거 파일 삭제 오류:', r.storagePath, err);
        }
      }),
    );

    // 증거 문서 삭제
    await Promise.all(
      records.map((r) =>
        deleteDocument('evidenceRecords', r.id).catch((err) => {
          console.error('증거 문서 삭제 오류:', r.id, err);
        }),
      ),
    );

    // 사건 문서 삭제
    await deleteDocument('cases', caseId);
  } catch (error) {
    console.error('사건 삭제 오류:', error);
    throw error;
  }
}

// 음성 파일 텍스트 변환은 clovaSpeechService.js의 transcribeAudioClova()로 대체됨
// (기존 Whisper 연동은 크레딧/파일 크기 제한 문제로 클로바 음성인식으로 교체)

/**
 * 파일 삭제
 */
export async function deleteFile(path) {
  try {
    const fileRef = ref(storage, path);
    await deleteObject(fileRef);
  } catch (error) {
    console.error('파일 삭제 오류:', error);
    throw error;
  }
}