import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
const measurementId = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;
// 채팅방(Realtime Database) 전용 — Firebase 콘솔에서 Realtime Database를 만들면 발급되는 URL.
// 예: https://themis-e96f4-default-rtdb.asia-southeast1.firebasedatabase.app
const databaseURL = process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL;

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  ...(measurementId ? { measurementId } : {}),
  ...(databaseURL ? { databaseURL } : {}),
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export const db = getFirestore(app);
export const storage = getStorage(app);
// databaseURL이 설정 안 돼있으면(.env 미설정) getDatabase가 바로 예외를 던지므로,
// 채팅 기능만 비활성화되고 앱 나머지는 정상 동작하도록 방어.
let rtdb = null;
try {
  rtdb = databaseURL ? getDatabase(app) : null;
} catch (err) {
  console.error('Realtime Database 초기화 오류 (EXPO_PUBLIC_FIREBASE_DATABASE_URL 확인):', err);
}
export const realtimeDb = rtdb;
export { auth };

export default app;