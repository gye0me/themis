# ⚖️ Themis - 디지털 증거 관리 플랫폼

투명한 기록과 안전한 리포팅을 위한 통합 솔루션입니다. React와 Firebase를 사용한 모바일 앱 프로젝트입니다.

---

## 📋 목차

1. [프로젝트 설정](#프로젝트-설정)
2. [폴더 구조](#폴더-구조)
3. [개발 시작하기](#개발-시작하기)
4. [코드 스타일 가이드](#코드-스타일-가이드)
5. [Firebase 설정](#firebase-설정)
6. [주요 파일 설명](#주요-파일-설명)
7. [개발 팁](#개발-팁)

---

## 🚀 프로젝트 설정

### 1단계: 프로젝트 다운로드

```bash
git clone https://github.com/gye0me/themis.git
cd themis
```

### 2단계: 패키지 설치

```bash
npm install
```

### 3단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 열기

### 유용한 명령어

```bash
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
npm run lint     # 코드 검사
```

---

## 📁 폴더 구조

```
themis/
│
├── 📄 README.md              # 이 파일! 프로젝트 설명서
├── 📄 package.json           # 프로젝트 설정, 의존성 패키지 목록
├── 📄 vite.config.js         # Vite 번들러 설정
├── 📄 tailwind.config.js     # Tailwind CSS 설정
├── 📄 postcss.config.js      # PostCSS 설정
├── 📄 eslint.config.js       # ESLint 코드 검사 규칙
├── 📄 .env.example           # 환경변수 예시 (실제 복사해서 .env 만들기)
├── 📄 .gitignore             # Git 업로드 무시할 파일 목록
│
├── 📂 public/                # 웹사이트 공개 파일
│   └── 정적 이미지, 아이콘 등
│
├── 📂 src/                   # ⭐ 모든 코드가 여기!
│   │
│   ├── 📂 components/        # 🧩 재사용 가능한 UI 컴포넌트
│   │   ├── Header.jsx        # 상단 헤더
│   │   ├── Header.css        # 헤더 스타일
│   │   ├── Layout.jsx        # 전체 페이지 레이아웃
│   │   └── Layout.css        # 레이아웃 스타일
│   │
│   ├── 📂 screens/           # 📱 전체 페이지 (각 화면)
│   │   ├── HomeScreen.jsx    # 홈 화면
│   │   └── HomeScreen.css    # 홈 화면 스타일
│   │
│   ├── 📂 services/          # 🔌 외부 연결 (API, Firebase)
│   │   └── firebaseService.js # Firebase 함수 모음
│   │
│   ├── 📂 context/           # 🌍 전역 상태 관리
│   │   └── AuthContext.jsx   # 로그인 정보 등 전역 상태
│   │
│   ├── 📂 hooks/             # 🎣 커스텀 React 훅
│   │   └── useAuth.js        # 인증 정보 사용 훅
│   │
│   ├── 📂 utils/             # 🛠️ 유틸리티 (공통 함수, 상수)
│   │   └── constants.js      # 앱 전체에서 사용할 상수
│   │
│   ├── 📂 styles/            # 🎨 전역 스타일
│   │   └── variables.css     # CSS 변수 (색상, 크기 등)
│   │
│   ├── 📂 config/            # ⚙️ 설정 파일
│   │   └── firebase.js       # Firebase 초기화 설정
│   │
│   ├── 📂 assets/            # 🖼️ 이미지, 폰트 등 정적 자료
│   │
│   ├── 📄 App.jsx            # 메인 컴포넌트 (모든 페이지의 시작점)
│   ├── 📄 main.jsx           # 앱 시작 파일 (index.html과 연결)
│   └── 📄 index.css          # 기본 스타일
│
├── 📂 node_modules/          # ⚠️ 자동 생성! 건드리지 말기
├── 📂 dist/                  # ⚠️ 자동 생성! 빌드 결과물
└── 📂 .git/                  # ⚠️ Git 저장소 (자동 관리)

```

---

## 📂 주요 파일 설명

### `src/components/` - 재사용 가능한 UI 컴포넌트

**언제 사용?** 여러 페이지에서 같은 버튼, 카드, 입력창 등을 사용할 때

#### Header.jsx / Header.css
```jsx
// 사용 예시
<Header title="홈" onMenuClick={handleMenu} />
```
- 앱 상단에 나오는 헤더
- 제목과 메뉴 버튼 포함

#### Layout.jsx / Layout.css
```jsx
// 사용 예시
<Layout>
  <Header title="페이지명" />
  <div>페이지 내용</div>
</Layout>
```
- 모든 페이지의 기본 틀
- 모바일 최적화 적용됨

---

### `src/screens/` - 전체 페이지 화면

**언제 사용?** 새로운 페이지를 만들 때 (로그인, 대시보드, 프로필 등)

#### HomeScreen.jsx
- 홈 화면 구현
- Header, Layout 등 컴포넌트 조합

**새 페이지 만드는 방법:**

```jsx
// src/screens/LoginScreen.jsx
import React from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import './LoginScreen.css';

export function LoginScreen() {
  return (
    <Layout>
      <Header title="로그인" />
      <div className="login-container">
        {/* 로그인 폼 */}
      </div>
    </Layout>
  );
}
```

```css
/* src/screens/LoginScreen.css */
.login-container {
  padding: var(--spacing-lg);
  max-width: 640px;
  margin: 0 auto;
}
```

---

### `src/services/` - API와 Firebase 연결

**언제 사용?** 서버에 데이터를 보내거나 받을 때

#### firebaseService.js
```javascript
// 예시: 사용자 로그인
import firebaseService from '../services/firebaseService';

await firebaseService.auth.signIn(email, password);
```

Firebase 함수들이 모여있는 곳입니다. 나중에 구현할 함수 목록:
- `signUp(email, password)` - 회원가입
- `signIn(email, password)` - 로그인
- `signOut()` - 로그아웃
- `addDocument(collection, data)` - 데이터 추가
- `updateDocument(collection, docId, data)` - 데이터 수정
- `deleteDocument(collection, docId)` - 데이터 삭제
- `uploadFile(file, path)` - 파일 업로드

---

### `src/context/` - 전역 상태 관리

**언제 사용?** 앱 전체에서 같은 정보를 사용할 때 (로그인 정보, 테마 등)

#### AuthContext.jsx
```jsx
// 사용 예시
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { user, loading, error } = useAuth();
  
  return <div>안녕 {user?.name}!</div>;
}
```

로그인한 사용자 정보를 저장하는 전역 상태입니다.

**파일 구조:**
```jsx
export const AuthContext = createContext();  // 상태 저장소 생성

export function AuthProvider({ children }) {  // 전체 앱에 적용
  const [user, setUser] = useState(null);     // 사용자 정보
  const [loading, setLoading] = useState(true); // 로딩 중인지
  const [error, setError] = useState(null);   // 오류 메시지
  
  return (
    <AuthContext.Provider value={{ user, setUser, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

### `src/hooks/` - 커스텀 React 훅

**언제 사용?** 자주 반복되는 로직을 간단히 만들 때

#### useAuth.js
```jsx
// 사용 예시
import { useAuth } from '../hooks/useAuth';

function Profile() {
  const { user } = useAuth();  // 한 줄로 사용자 정보 가져오기
  return <div>{user?.name}</div>;
}
```

---

### `src/utils/` - 공통 함수와 상수

#### constants.js
```javascript
// 앱 전체에서 사용할 상수들
export const APP_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
};

export const APP_THEME = {
  PRIMARY: '#aa3bff',      // 주요 색상
  SECONDARY: '#6b6375',    // 보조 색상
};
```

**사용 예시:**
```jsx
import { APP_ROUTES } from '../utils/constants';

// 라우팅
navigate(APP_ROUTES.LOGIN);
```

---

### `src/styles/` - 전역 스타일

#### variables.css
CSS 변수를 정의하는 파일입니다. 모든 스타일에서 사용됩니다.

```css
:root {
  /* 색상 */
  --text: #6b6375;
  --accent: #aa3bff;
  
  /* 간격 */
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* 모서리 반경 */
  --radius-md: 8px;
}
```

**컴포넌트에서 사용:**
```css
.button {
  color: var(--text);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: var(--accent);
}
```

---

### `src/config/` - 설정 파일

#### firebase.js
```javascript
// Firebase 초기화 설정
// 나중에 이 파일에서 Firebase를 초기화합니다
```

---

## 🎯 개발 시작하기

### 1️⃣ 새 페이지 만들기

**예: 로그인 페이지**

**Step 1:** 화면 파일 생성
```bash
# src/screens/LoginScreen.jsx 파일 생성
```

**Step 2:** 코드 작성
```jsx
import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import './LoginScreen.css';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    console.log('로그인:', email, password);
  };

  return (
    <Layout>
      <Header title="로그인" />
      <div className="login-container">
        <input 
          type="email" 
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input 
          type="password" 
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin}>로그인</button>
      </div>
    </Layout>
  );
}
```

**Step 3:** CSS 파일 생성 (`src/screens/LoginScreen.css`)
```css
.login-container {
  padding: var(--spacing-lg);
  max-width: 640px;
  margin: 0 auto;
}

input {
  width: 100%;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

button {
  width: 100%;
  padding: var(--spacing-md);
  background-color: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}
```

**Step 4:** App.jsx에서 사용
```jsx
import { LoginScreen } from './screens/LoginScreen';

function App() {
  return <LoginScreen />;
}
```

---

### 2️⃣ 새 컴포넌트 만들기

**예: 버튼 컴포넌트**

```jsx
// src/components/Button.jsx
import React from 'react';
import './Button.css';

export function Button({ children, variant = 'primary', onClick }) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

```css
/* src/components/Button.css */
.btn {
  padding: var(--spacing-md) var(--spacing-lg);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-primary {
  background-color: var(--accent);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  border: 2px solid var(--accent);
  color: var(--accent);
  background-color: transparent;
}
```

**사용 예시:**
```jsx
<Button variant="primary" onClick={handleClick}>
  클릭하기
</Button>
```

---

## 🎨 코드 스타일 가이드

### 파일명 규칙

| 용도 | 예시 | 규칙 |
|------|------|------|
| 컴포넌트 | `Header.jsx` | PascalCase (첫 글자 대문자) |
| 함수 | `formatDate.js` | camelCase (첫 글자 소문자) |
| 스타일 | `Header.css` | 컴포넌트명과 동일 |
| 폴더 | `components/` | lowercase (소문자) |

### 컴포넌트 작성 규칙

```jsx
// ✅ 좋은 예
import React from 'react';
import './MyComponent.css';

export function MyComponent({ title, onClick }) {
  return (
    <div className="my-component">
      <h1>{title}</h1>
      <button onClick={onClick}>클릭</button>
    </div>
  );
}

// ❌ 나쁜 예
export default function myComponent(props) {
  return <div><h1>{props.title}</h1></div>;
}
```

**체크리스트:**
- [ ] 함수형 컴포넌트 사용
- [ ] export function으로 named export
- [ ] CSS 파일 별도 생성
- [ ] Props에 PropTypes 주석 추가
- [ ] 컴포넌트명은 PascalCase

### CSS 작성 규칙

```css
/* ✅ 좋은 예 */
.button {
  padding: var(--spacing-md);
  background-color: var(--accent);
  border: none;
}

.button:hover {
  opacity: 0.9;
}

/* ❌ 나쁜 예 */
.button {
  padding: 16px;
  background: #aa3bff;
  border-radius: 0;
}
```

**체크리스트:**
- [ ] CSS 변수 사용
- [ ] 색상 직접 입력 금지 (변수 사용)
- [ ] 모바일 반응형 포함
- [ ] hover 상태 정의

---

## 🔧 Firebase 설정

### 1단계: Firebase 프로젝트 생성

1. https://firebase.google.com 방문
2. "시작하기" 클릭
3. "프로젝트 만들기" 클릭
4. 프로젝트 이름: `themis` 입력

### 2단계: 웹앱 등록

1. Firebase 콘솔에서 웹 아이콘 클릭
2. 앱 닉네임: `themis-web` 입력
3. Firebase SDK 코드 복사

### 3단계: 환경변수 설정

`.env` 파일 생성 (`.env.example` 참고):

```
VITE_FIREBASE_API_KEY=YOUR_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 4단계: Firebase 초기화

`src/config/firebase.js` 수정:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### 5단계: Firebase 서비스 구현

`src/services/firebaseService.js`:

```javascript
import { auth, db } from '../config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { collection, addDoc, getDocs } from 'firebase/firestore';

// 회원가입
export async function signUp(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('회원가입 오류:', error);
    throw error;
  }
}

// 로그인
export async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('로그인 오류:', error);
    throw error;
  }
}

// 로그아웃
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('로그아웃 오류:', error);
    throw error;
  }
}

// 데이터 추가
export async function addData(collectionName, data) {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);
    return docRef.id;
  } catch (error) {
    console.error('데이터 추가 오류:', error);
    throw error;
  }
}
```

---

## 💡 개발 팁

### Git 사용법

**변경사항 저장:**
```bash
# 1. 변경된 파일 확인
git status

# 2. 변경사항 준비
git add .

# 3. 메시지와 함께 커밋
git commit -m "기능: 로그인 화면 추가"

# 4. GitHub에 업로드
git push origin main
```

**좋은 커밋 메시지 예시:**
- ✅ `git commit -m "기능: 로그인 페이지 구현"`
- ✅ `git commit -m "수정: 버튼 디자인 변경"`
- ✅ `git commit -m "문서: README 업데이트"`
- ❌ `git commit -m "수정"`
- ❌ `git commit -m "asdf"`

### 자주 쓰는 명령어

```bash
# 특정 폴더의 파일만 커밋
git add src/screens/
git commit -m "기능: 새 페이지 추가"

# 마지막 커밋 취소
git reset HEAD~1

# 변경사항 모두 취소
git checkout .

# 커밋 히스토리 확인
git log --oneline
```

### 개발 중 유용한 팁

**1. 핫 리로드 사용**
```bash
npm run dev
```
파일을 저장하면 자동으로 브라우저에 반영됩니다.

**2. 콘솔 로그 확인**
```javascript
// React DevTools에서 확인 가능
console.log('디버깅:', variable);
```

**3. CSS 변수 사용**
```css
/* 색상 일관성 유지 */
color: var(--accent);
padding: var(--spacing-md);
```

**4. 반응형 디자인**
```css
/* 모바일 먼저 작성 */
.card {
  padding: var(--spacing-md);
}

/* 큰 화면에서 조정 */
@media (min-width: 768px) {
  .card {
    padding: var(--spacing-lg);
  }
}
```

### 문제 해결

**문제: 페이지가 안 나타남**
```bash
# 1. 개발 서버 재시작
npm run dev

# 2. 캐시 삭제
# 브라우저 개발자도구 > Network 탭 > "Disable cache" 체크

# 3. node_modules 재설치
rm -r node_modules
npm install
```

**문제: 스타일이 적용 안 됨**
```css
/* 1. CSS 파일이 import 되어있는지 확인 */
/* src/screens/MyScreen.jsx */
import './MyScreen.css';

/* 2. 클래스명이 맞는지 확인 */
<div className="my-screen">  /* 소문자, 하이픈 사용 */
```

**문제: Firebase 연결 안 됨**
```bash
# 1. .env 파일 있는지 확인
# 2. 환경변수 값 정확한지 확인
# 3. 개발 서버 재시작
npm run dev
```

---

## 📞 팀원과 협업하기

### 작업 시작 전

```bash
# 최신 코드 받기
git pull origin main

# 새 브랜치 만들기 (각자의 작업 공간)
git checkout -b feature/login-page
```

### 작업 완료 후

```bash
# 변경사항 커밋
git add .
git commit -m "기능: 로그인 페이지 구현"

# GitHub에 업로드
git push origin feature/login-page
```

### Pull Request (코드 검토)

1. GitHub에서 "Pull Request" 생성
2. 팀원들이 코드 검토
3. 피드백 받고 수정
4. 승인되면 main에 병합

---

## ✅ 체크리스트

새로운 팀원이 프로젝트를 시작할 때:

- [ ] 프로젝트 다운로드: `git clone https://github.com/gye0me/themis.git`
- [ ] 패키지 설치: `npm install`
- [ ] 개발 서버 실행: `npm run dev`
- [ ] 브라우저에서 확인: `http://localhost:5173`
- [ ] Git 사용자 설정: `git config user.name "이름"`, `git config user.email "이메일"`
- [ ] `.env` 파일 생성 (Firebase 설정)
- [ ] README.md 읽기 ✅ (지금 하는 중!)

---

## 📚 더 알아보기

- **React 공식 문서**: https://react.dev
- **Vite 가이드**: https://vitejs.dev/guide/
- **Tailwind CSS**: https://tailwindcss.com
- **Firebase 문서**: https://firebase.google.com/docs

---

**질문이 있으면 이슈 탭에서 물어봐주세요!** 💬

Happy coding! 🎉

