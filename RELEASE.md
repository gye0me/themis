# Themis 출시 준비 가이드

## 1. 코드에 반영된 출시 대비 항목
| 항목 | 위치 |
|---|---|
| 회원 탈퇴 (앱 안에서 계정·데이터 삭제) | 홈 오른쪽 위 계정 아이콘 → 계정 화면 → 회원 탈퇴 (`src/services/accountDeletionService.js`) |
| 이용약관 · 개인정보처리방침 · 위치기반서비스 약관 | `src/services/legalDocuments.js` (계정 화면·회원가입에서 보기) |
| 회원가입 필수 동의 (만 14세 이상 + 약관 3종) | 회원가입 화면, 동의 기록은 `users/{uid}.agreements` |
| 사용자 차단 (게시판·채팅) | 게시판 글·댓글의 "🚫 차단", 채팅방 상대 이름 탭 → 차단 / 계정 화면에서 해제 |
| 앱 아이콘 · 스플래시 · 권한 설명 문구 | `assets/`, `app.json` |
| AI 키 서버 이전 | `functions/index.js` (서버), `src/services/aiClient.js` (앱) |

## 2. 출시 전에 사람이 직접 해야 할 일
1. **`src/services/legalDocuments.js`의 운영 주체·대표자·문의 이메일·보호책임자·시행일 채우기** (지금은 `[ ]` 자리표시)
2. 약관·방침 문구 법률 검토 (교수님 / 법률 전문가)
3. **위치기반서비스사업 신고** — 방송통신위원회 (위치정보법)
4. 개인정보처리방침을 웹 주소로 공개 (스토어 등록 시 URL 필요 → 웹 버전 배포 후 앱 안 화면 주소 사용 가능)
5. Expo 프로젝트 소유자 정리 (`app.json`의 owner — 팀 공용 조직 계정 권장)

## 3. Firebase 배포 (Firebase 담당)
```bash
npm i -g firebase-tools
firebase login
firebase use themis-e96f4

# 보안 규칙
firebase deploy --only firestore:rules,database

# AI 서버 함수 — Blaze(종량제) 요금제 필요
cd functions && npm install && cd ..
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set CLOVA_CLIENT_ID
firebase functions:secrets:set CLOVA_CLIENT_SECRET
firebase deploy --only functions
```
배포 후 출시용 `.env`는 `EXPO_PUBLIC_AI_PROXY=1`, `EXPO_PUBLIC_GEMINI_API_KEY`·`EXPO_PUBLIC_CLOVA_*`는 **비워서** 빌드한다.
(키가 비어 있어야 앱 파일 안에 키가 들어가지 않는다.) 기존 키는 노출된 적이 있으니 새로 발급해 서버에만 넣는 것을 권장.

서버 경유 시 제한: 사용자당 하루 Gemini 200회 · CLOVA 300회(`functions/index.js` DAILY_LIMIT), 한 번에 보내는 파일 7MB 이하
(7MB를 넘는 영상은 음성 변환을 건너뛰고 안내).

## 4. 웹 버전 배포 (전시 QR 체험용)
```bash
npx expo export --platform web   # dist/ 생성
firebase deploy --only hosting
```

## 5. 앱 빌드 · 스토어 제출 (EAS)
```bash
npm i -g eas-cli && eas login
eas build --platform android --profile preview      # 테스트용 APK
eas build --platform android --profile production   # 플레이스토어 .aab
eas build --platform ios --profile production       # 앱스토어
eas submit --platform android
eas submit --platform ios
```
- Google Play 새 개인 계정: 테스터 12명 이상 · 14일 비공개 테스트 후 정식 출시 가능
- App Store 심사: 테스트 계정과 사용 방법 설명을 함께 제출
