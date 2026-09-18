import { createContext, useEffect, useState } from 'react';
import {
  getUserProfile,
  onAuthChange,
  signIn as firebaseSignIn,
  signUp as firebaseSignUp,
  logout as firebaseLogout,
} from '../services/firebaseService';

function normalizeProfile(userProfile, currentUser) {
  return userProfile ?? {
    uid: currentUser.uid,
    email: currentUser.email ?? '',
    nickname: currentUser.displayName ?? '',
    displayName: currentUser.displayName ?? '',
  };
}

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthChange(async (currentUser) => {
      if (!active) {
        return;
      }

      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const userProfile = await getUserProfile(currentUser.uid);

        if (!active) {
          return;
        }

        setProfile(normalizeProfile(userProfile, currentUser));
      } catch (err) {
        if (!active) {
          return;
        }

        console.error('사용자 프로필 로딩 오류:', err);
        setError('사용자 정보를 불러오지 못했습니다.');
        setProfile(normalizeProfile(null, currentUser));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return null;
    }

    const userProfile = await getUserProfile(user.uid);
    setProfile(normalizeProfile(userProfile, user));

    return userProfile;
  };

  // firebaseService의 인증 함수들을 AuthContext 값으로 제공
  const login = (email, password) => firebaseSignIn(email, password);
  const signup = (email, password, displayName) => firebaseSignUp(email, password, displayName);
  const logout = () => firebaseLogout();

  const value = {
    user,
    setUser,
    profile,
    setProfile,
    loading,
    login,
    signup,
    logout,
    error,
    setError,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
