# Themis

디지털 증거 관리 플랫폼입니다. 현재는 React Native + Expo 기반으로 동작하며, Firebase를 연결해 둔 상태입니다.

## 실행

```bash
npm install
npm start
```

`npm start` 후에는 Expo 터미널에서 아래 중 하나를 선택하면 됩니다.

- `w`: 웹 브라우저로 열기
- `a`: Android 에뮬레이터 실행
- Expo Go 앱: QR 코드 스캔

웹 주소 예시:

```bash
http://localhost:8083
```

## 주요 명령어

```bash
npm start   # Expo 개발 서버
npm run lint # 코드 검사
```

## 현재 상태

- 앱 시작 화면은 홈 화면입니다.
- 로그인/로그아웃 흐름은 현재 비활성화되어 있습니다.
- Firebase 설정은 유지되어 있고, 나중에 인증을 다시 붙일 수 있습니다.

## 폴더 구조

```text
themis/
├── app.json
├── babel.config.js
├── eslint.config.js
├── index.js
├── App.js
├── package.json
├── src/
│   ├── App.jsx
│   ├── components/
│   ├── config/
│   ├── context/
│   ├── hooks/
│   ├── screens/
│   ├── services/
│   ├── styles/
│   └── utils/
└── public/
```

## 환경 변수

Expo에서는 `VITE_` 대신 `EXPO_PUBLIC_` 접두사를 사용합니다.

예시:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

## 참고

- 웹 실행은 `react-native-web`이 필요합니다.
- Expo 구조에 맞춰 `src/App.jsx`가 메인 진입점입니다.
