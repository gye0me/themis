import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const env = globalThis.process?.env ?? {};

const apiKey = env.EXPO_PUBLIC_FIREBASE_API_KEY;
const authDomain = env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = env.EXPO_PUBLIC_FIREBASE_APP_ID;
const measurementId = env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  ...(measurementId ? { measurementId } : {}),
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
export { auth };

export default app;
