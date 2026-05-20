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
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';

console.log('Firebase Service Loading - auth:', auth, 'db:', db, 'storage:', storage);

// ==================== 인증 (Auth) ====================

/**
 * 이메일/비밀번호로 회원가입
 */
export async function signUp(email, password, displayName = '') {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // 프로필 정보 저장
    if (displayName) {
      await addUserProfile(userCredential.user.uid, {
        email,
        displayName,
        createdAt: Timestamp.now(),
      });
    }
    
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
    await addDoc(collection(db, 'users'), {
      uid: userId,
      ...profileData,
    });
  } catch (error) {
    console.error('프로필 저장 오류:', error);
    throw error;
  }
}

/**
 * 문서 추가
 */
export async function addDocument(collectionName, data) {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: Timestamp.now(),
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
      updatedAt: Timestamp.now(),
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
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
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
      where(field, operator, value)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
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
