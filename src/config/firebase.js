import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 직접 환경 변수 확인
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;

window.__FIREBASE_CONFIG_DEBUG__ = {
  apiKey: apiKey ? 'SET' : 'UNDEFINED',
  authDomain: authDomain ? 'SET' : 'UNDEFINED',
  projectId: projectId ? 'SET' : 'UNDEFINED',
  storageBucket: storageBucket ? 'SET' : 'UNDEFINED',
  messagingSenderId: messagingSenderId ? 'SET' : 'UNDEFINED',
  appId: appId ? 'SET' : 'UNDEFINED',
};

console.log('Firebase Environment Variables:', window.__FIREBASE_CONFIG_DEBUG__);

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

console.log('Firebase Config Loaded:', firebaseConfig);

// Firebase 초기화
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization failed:', error);
  console.error('Config was:', firebaseConfig);
}

// Firebase 서비스 내보내기
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
