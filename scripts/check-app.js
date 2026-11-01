// scripts/check-app.js
//
// 빌드 전에 "웹에서는 되는데 앱에서는 안 되는" 코드와 빠진 환경변수를 찾는다.
// 사용법: npm run check  (문제가 있으면 파일:줄과 고치는 방법을 보여주고 실패로 끝난다)
// 규칙이 왜 필요한지는 docs/WEB_APP_COMPAT.md에 정리되어 있다.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 웹 전용 코드를 Platform.OS === 'web' 분기 안에서만 쓰는 것을 확인한 파일
const WEB_GUARDED_FILES = [
  'src/screens/ChatRoomScreen.jsx',
  'src/screens/GuardianScreen.jsx',
  'src/screens/ReportPreviewScreen.jsx',
  'src/services/imagePreprocess.js',
  'src/services/ocrService.js',
  'src/services/videoTranscriptService.js',
  'src/utils/appAlert.js',
  'src/utils/videoThumbnail.js',
];

const RULES = [
  {
    pattern: /fetch\(\s*[`'"]data:/,
    message: "fetch('data:...')는 Android에서 실패합니다. src/utils/base64.js의 base64ToBytes를 쓰세요.",
  },
  {
    pattern: /new FormData\(/,
    message: '앱의 fetch는 { uri } 파일이 든 FormData를 보내지 못합니다. FileSystem.uploadAsync의 MULTIPART를 쓰세요.',
  },
  {
    pattern: /Alert\.alert\(/,
    skip: ['src/utils/appAlert.js'],
    message: 'Alert.alert는 웹에서 뜨지 않습니다. src/utils/appAlert.js의 appAlert를 쓰세요.',
  },
  {
    pattern: /import\.meta/,
    message: 'import.meta는 앱 번들에서 동작하지 않습니다. process.env.EXPO_PUBLIC_이름을 쓰세요.',
  },
  {
    pattern: /process\.env\[/,
    message: '환경변수는 빌드할 때 글자 그대로 치환됩니다. process.env.EXPO_PUBLIC_이름 형태로 쓰세요.',
  },
  {
    pattern: /['"`]http:\/\/(?!localhost|www\.w3\.org)/,
    message: 'http 주소는 폰 앱에서 차단됩니다. https를 쓰세요.',
  },
  {
    pattern: /(^|[^.\w])(document|window|navigator|localStorage|sessionStorage)\.[a-zA-Z]/,
    skip: WEB_GUARDED_FILES,
    message: "브라우저 전용 객체입니다. Platform.OS === 'web' 분기 안에서 쓰고 이 스크립트의 허용 목록에 추가하세요.",
  },
  {
    pattern: /<(div|span|button|input|iframe|img)[\s>]/,
    skip: WEB_GUARDED_FILES,
    jsxOnly: true,
    message: 'HTML 태그는 앱에서 화면이 멈춥니다. View, Text 같은 React Native 컴포넌트를 쓰세요.',
  },
];

// 없으면 앱이 아예 동작하지 않는 값 / 없으면 해당 기능만 꺼지는 값
const REQUIRED_ENV = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_GEMINI_API_KEY',
];
const FEATURE_ENV = {
  EXPO_PUBLIC_REALESTATE_API_KEY: '전세가율·건축물대장 조회',
  EXPO_PUBLIC_JUSO_API_KEY: '건물 확인 주소 검색',
  EXPO_PUBLIC_LAW_OC: '법령 검색',
  EXPO_PUBLIC_CLOVA_CLIENT_ID: 'CLOVA 음성 변환(Gemini 실패 시 보조)',
  EXPO_PUBLIC_CLOVA_CLIENT_SECRET: 'CLOVA 음성 변환(Gemini 실패 시 보조)',
};

function listSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

function checkSource() {
  const problems = [];
  for (const file of listSourceFiles(path.join(ROOT, 'src'))) {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/');
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const rule of RULES) {
        if (rule.skip?.includes(relative)) continue;
        if (rule.jsxOnly && !relative.endsWith('.jsx')) continue;
        if (rule.pattern.test(line)) problems.push(`${relative}:${index + 1}  ${rule.message}`);
      }
    });
  }
  return problems;
}

function readEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return null;
  const values = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

function checkEnv() {
  const env = readEnv();
  if (!env) return { errors: ['.env 파일이 없습니다. .env.example을 복사해 값을 채우세요.'], warnings: [] };
  return {
    errors: REQUIRED_ENV.filter((key) => !env[key]).map((key) => `.env에 ${key} 값이 없습니다.`),
    warnings: Object.entries(FEATURE_ENV)
      .filter(([key]) => !env[key])
      .map(([key, feature]) => `.env에 ${key} 값이 없어 "${feature}" 기능이 꺼집니다.`),
  };
}

const sourceProblems = checkSource();
const { errors, warnings } = checkEnv();
const failures = [...sourceProblems, ...errors];

warnings.forEach((warning) => console.warn(`[주의] ${warning}`));
failures.forEach((failure) => console.error(`[오류] ${failure}`));
console.log(failures.length === 0 ? '앱·웹 호환성 검사 통과' : `문제 ${failures.length}건을 고친 뒤 다시 실행하세요.`);
process.exit(failures.length === 0 ? 0 : 1);
