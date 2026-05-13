// 앱 전역 상수 정의

export const APP_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
};

export const APP_THEME = {
  PRIMARY: '#aa3bff',
  SECONDARY: '#6b6375',
  SUCCESS: '#10b981',
  ERROR: '#ef4444',
  WARNING: '#f59e0b',
};

export const TOAST_DURATION = 3000;

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
