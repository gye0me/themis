// src/services/aiClient.js
//
// Gemini · CLOVA 호출을 한곳으로 모은 공용 클라이언트.
//
// 왜 필요한가: EXPO_PUBLIC_ 로 시작하는 환경변수는 앱 파일 안에 그대로 들어가서, 출시하면 누구나
// API 키를 꺼내 쓸 수 있다(요금 폭탄 위험). 그래서 출시 버전은 키를 서버(Firebase Cloud Functions,
// functions/index.js)에만 두고 앱은 서버를 거쳐 호출해야 한다.
//
// - EXPO_PUBLIC_AI_PROXY=1 : 서버(geminiGenerate / clovaStt 함수)를 통해 호출 — 출시용
//     · 로그인한 사용자만 호출 가능, 사용자별 하루 호출 횟수 제한(서버에서 관리)
//     · 서버 요청 크기 제한(약 10MB) 때문에 한 번에 보내는 파일은 작게 나눠야 한다 (MAX_PROXY_INLINE_BYTES)
// - 설정 안 함              : 지금처럼 앱에서 직접 호출 (개발·시연용, 키가 .env에 있어야 함)
//
// geminiFetch()는 fetch()와 같은 모양({ ok, status, json(), text() })을 돌려줘서 호출부를 거의 안 바꿔도 된다.

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../config/firebase';

export const GEMINI_MODEL = 'gemini-3.5-flash';
export const AI_PROXY_ENABLED = process.env.EXPO_PUBLIC_AI_PROXY === '1';
// 서버 함수 리전 — functions/index.js의 REGION과 같아야 한다
const FUNCTIONS_REGION = 'asia-northeast3';
// 서버 경유 시 한 번에 보낼 수 있는 원본 파일 크기 (callable 요청 10MB 제한, base64로 약 1.33배 커짐)
export const MAX_PROXY_INLINE_BYTES = 7 * 1024 * 1024;

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const CLOVA_STT_URL = 'https://naveropenapi.apigw.ntruss.com/recog/v1/stt';

let functionsInstance = null;
function callable(name) {
  if (!functionsInstance) functionsInstance = getFunctions(app, FUNCTIONS_REGION);
  return httpsCallable(functionsInstance, name, { timeout: 120000 });
}

// fetch Response와 같은 모양의 결과
function responseLike(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
  };
}

function statusFromFunctionsError(err) {
  switch (err?.code) {
    case 'functions/resource-exhausted':
      return 429;
    case 'functions/unauthenticated':
      return 401;
    case 'functions/invalid-argument':
      return 400;
    default:
      return 500;
  }
}

/**
 * Gemini generateContent 호출. body는 Gemini REST 요청 본문({ contents, generationConfig }) 그대로.
 */
export async function geminiFetch(body, { model = GEMINI_MODEL } = {}) {
  if (AI_PROXY_ENABLED) {
    try {
      const { data } = await callable('geminiGenerate')({ model, body });
      return responseLike(200, data);
    } catch (err) {
      return responseLike(statusFromFunctionsError(err), { error: { message: err?.message } });
    }
  }
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다.');
  return fetch(`${GEMINI_BASE}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
    body: JSON.stringify(body),
  });
}

// 개발 모드에서만 쓰는 Gemini 키 (Files API 대용량 업로드 등 서버 경유가 어려운 경로용)
export function getDirectGeminiKey() {
  return AI_PROXY_ENABLED ? null : process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? null;
}

/**
 * CLOVA 음성인식(CSR) — 60초 이하 음성 조각(base64) 하나를 텍스트로 변환한다.
 */
export async function clovaRecognize(base64Chunk, mimeType = 'audio/m4a', lang = 'Kor') {
  if (AI_PROXY_ENABLED) {
    try {
      const { data } = await callable('clovaStt')({ audioBase64: base64Chunk, lang });
      return data?.text ?? '';
    } catch (err) {
      throw new Error(`클로바 STT 오류 (${statusFromFunctionsError(err)}) ${err?.message ?? ''}`.trim(), { cause: err });
    }
  }
  const clientId = process.env.EXPO_PUBLIC_CLOVA_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_CLOVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('클로바 API 키가 설정되지 않았습니다.');

  // RN/expo에는 Buffer가 없어 data URI → fetch로 Blob을 얻는다
  const blob = await (await fetch(`data:${mimeType};base64,${base64Chunk}`)).blob();
  const res = await fetch(`${CLOVA_STT_URL}?lang=${lang}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-NCP-APIGW-API-KEY-ID': clientId,
      'X-NCP-APIGW-API-KEY': clientSecret,
    },
    body: blob,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`클로바 STT 오류 (${res.status}) ${errText}`.trim());
  }
  const data = await res.json();
  return data?.text ?? '';
}
