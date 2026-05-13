# Themis 프로젝트 구조

## 📁 디렉토리 구조

```
src/
├── assets/              # 이미지, 폰트 등
├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── Header.jsx
│   ├── Header.css
│   ├── Layout.jsx
│   └── Layout.css
├── screens/             # 전체 화면 (페이지)
│   ├── HomeScreen.jsx
│   └── HomeScreen.css
├── services/            # API, Firebase 등 외부 서비스
│   └── firebaseService.js
├── context/             # React Context (상태 관리)
│   └── AuthContext.jsx
├── hooks/               # 커스텀 React 훅
│   └── useAuth.js
├── utils/               # 유틸리티 함수
│   └── constants.js
├── styles/              # 전역 스타일
│   └── variables.css
├── config/              # 설정 파일
│   └── firebase.js
├── App.jsx              # 메인 App 컴포넌트
├── main.jsx             # 엔트리 포인트
└── index.css            # 전역 CSS
```

## 🎯 각 폴더의 역할

### `components/`
- 버튼, 헤더, 카드 등 재사용 가능한 UI 컴포넌트
- 화면 레이아웃 구성 요소

### `screens/`
- 각 페이지의 전체 화면
- 컴포넌트들을 조합하여 완성된 화면 구성
- 라우팅의 대상

### `services/`
- Firebase, API 호출 등 외부 서비스 로직
- 비즈니스 로직 구현

### `context/`
- 전역 상태 관리 (인증, 테마 등)
- React Context API 사용

### `hooks/`
- 커스텀 훅 (useAuth, useTheme 등)
- 로직 재사용

### `utils/`
- 상수, 헬퍼 함수
- 날짜 포맷팅, 데이터 변환 등

### `styles/`
- 전역 CSS 변수, 기본 스타일

### `config/`
- Firebase, API 설정
- 환경 변수 관리

## 🚀 Firebase 연결하기

1. `.env` 파일 생성 (`.env.example` 참고)
2. `src/config/firebase.js` 수정하여 Firebase 초기화
3. `src/services/firebaseService.js`에서 Firebase 함수 구현
4. `src/context/AuthContext.jsx`에서 상태 관리 설정

## 📝 새 컴포넌트 추가하기

### 새로운 화면 추가 예시:
```
src/screens/LoginScreen.jsx
src/screens/LoginScreen.css
```

### 새로운 컴포넌트 추가 예시:
```
src/components/Button.jsx
src/components/Button.css
```

## 🎨 스타일링

모든 스타일은 CSS 변수를 사용합니다:
- `--accent`: 주요 색상
- `--text`: 텍스트 색상
- `--bg`: 배경 색상
- `--spacing-md`: 기본 간격
- 등등 (src/styles/variables.css 참고)

다크 모드는 자동으로 처리됩니다.

## 📱 모바일 최적화

- 모든 컴포넌트는 모바일 우선으로 설계
- 반응형 CSS 포함
- 터치 친화적 인터페이스
