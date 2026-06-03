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
}) {
  try {
    const capturedAt = Timestamp.now();
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
    };
  } catch (error) {
    console.error('증거 저장 오류:', error);
    throw error;
  }
}

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
