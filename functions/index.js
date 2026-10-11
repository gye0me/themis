// functions/index.js — Themis 서버 함수 (Firebase Cloud Functions 2세대)
//
// 앱에 API 키를 넣지 않기 위한 AI 호출 대리(프록시) 서버.
// 앱(src/services/aiClient.js)이 EXPO_PUBLIC_AI_PROXY=1 일 때 이 함수들을 호출한다.
//
// 보안
//  - 키는 Secret Manager에만 보관 (firebase functions:secrets:set GEMINI_API_KEY 등)
//  - 로그인한 사용자만 호출 가능 (callable 함수가 Firebase 인증 토큰을 자동 검증)
//  - 사용자별 하루 호출 횟수 제한 (aiUsage 컬렉션, 앱에서는 읽기·쓰기 불가 — 규칙 기본 거부)
//  - 허용한 모델만 호출 가능
//
// 배포: README의 "AI 서버(Cloud Functions) 배포" 참고. Blaze(종량제) 요금제가 필요하다.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const REGION = 'asia-northeast3'; // 서울 — 앱의 aiClient.js FUNCTIONS_REGION과 같아야 한다
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const CLOVA_CLIENT_ID = defineSecret('CLOVA_CLIENT_ID');
const CLOVA_CLIENT_SECRET = defineSecret('CLOVA_CLIENT_SECRET');

const ALLOWED_MODELS = new Set(['gemini-3.5-flash']);
const DAILY_LIMIT = { gemini: 200, clova: 300 }; // 사용자 1명이 하루에 호출할 수 있는 횟수

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return request.auth.uid;
}

// 사용자별 하루 호출 횟수 확인 + 1 증가 (한국 시간 기준 날짜)
async function consumeQuota(uid, kind) {
  const day = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ref = db.collection('aiUsage').doc(`${uid}_${day}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? snap.get(kind) ?? 0 : 0;
    if (used >= DAILY_LIMIT[kind]) {
      throw new HttpsError('resource-exhausted', '오늘 사용할 수 있는 AI 분석 횟수를 모두 사용했어요. 내일 다시 시도해주세요.');
    }
    tx.set(ref, { uid, day, [kind]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

/**
 * Gemini generateContent 대리 호출.
 * data: { model, body } — body는 Gemini REST 요청 본문 그대로({ contents, generationConfig })
 * 반환: Gemini 응답 JSON 그대로 (앱의 기존 파싱 코드를 그대로 쓰기 위해)
 */
exports.geminiGenerate = onCall(
  { region: REGION, secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const uid = requireAuth(request);
    const { model = 'gemini-3.5-flash', body } = request.data ?? {};
    if (!ALLOWED_MODELS.has(model)) throw new HttpsError('invalid-argument', '허용되지 않은 모델입니다.');
    if (!body || !Array.isArray(body.contents)) throw new HttpsError('invalid-argument', '요청 형식이 올바르지 않습니다.');
    await consumeQuota(uid, 'gemini');

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY.value() },
      body: JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error?.message || `Gemini 오류 (${res.status})`;
      throw new HttpsError(res.status === 429 ? 'resource-exhausted' : 'internal', message);
    }
    return data;
  }
);

/**
 * CLOVA 음성인식(CSR) 대리 호출 — 60초 이하 음성 조각 하나.
 * data: { audioBase64, lang = 'Kor' } / 반환: { text }
 */
exports.clovaStt = onCall(
  { region: REGION, secrets: [CLOVA_CLIENT_ID, CLOVA_CLIENT_SECRET], timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request);
    const { audioBase64, lang = 'Kor' } = request.data ?? {};
    if (typeof audioBase64 !== 'string' || !audioBase64) throw new HttpsError('invalid-argument', '음성 데이터가 없습니다.');
    if (!['Kor', 'Eng'].includes(lang)) throw new HttpsError('invalid-argument', '지원하지 않는 언어입니다.');
    await consumeQuota(uid, 'clova');

    const res = await fetch(`https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=${lang}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-NCP-APIGW-API-KEY-ID': CLOVA_CLIENT_ID.value(),
        'X-NCP-APIGW-API-KEY': CLOVA_CLIENT_SECRET.value(),
      },
      body: Buffer.from(audioBase64, 'base64'),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpsError('internal', `클로바 STT 오류 (${res.status}) ${data?.errorMessage ?? ''}`.trim());
    return { text: data?.text ?? '' };
  }
);
