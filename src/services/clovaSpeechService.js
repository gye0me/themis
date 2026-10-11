// src/services/clovaSpeechService.js
//
// 음성 증거 → 텍스트 변환.
//  1) 클로바가 읽을 수 있는 포맷(mp3/aac/ogg/flac/wav)은 클로바 CSR로 먼저 시도한다.
//  2) m4a/mp4 등 클로바가 못 읽는 포맷이거나, 클로바가 실패/빈 결과면 Gemini로 받아쓴다.
// 클로바 CSR은 1회 최대 60초/10MB. 파일을 자르지 않고 통째로 보낸다.

import * as FileSystem from 'expo-file-system/legacy';

const CLOVA_STT_URL = 'https://naveropenapi.apigw.ntruss.com/recog/v1/stt';

// 클로바가 공식 지원하는 포맷만 (m4a/mp4는 제외 → 바로 Gemini로)
const CLOVA_OK_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
]);

// videoTranscriptService.js의 GEMINI_MODEL과 같은 값으로 맞춰 쓰세요.
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_INLINE_MAX_BYTES = 14 * 1024 * 1024;

const TRANSCRIBE_PROMPT =
  '이 파일에 녹음된 사람의 말소리를 들리는 그대로 한국어 텍스트로 받아써 주세요. ' +
  '요약하거나 설명을 덧붙이지 말고, 말한 내용만 순서대로 적어주세요. ' +
  '화자가 바뀌면 줄을 바꿔 구분해주세요. 말소리가 전혀 없으면 빈 문자열만 반환하세요.';

// Gemini가 받는 MIME으로 정리
function toGeminiMime(mimeType) {
  const m = (mimeType || '').toLowerCase();
  if (m === 'audio/m4a' || m === 'audio/x-m4a' || m === 'audio/mp4') return 'audio/mp4';
  if (m === 'audio/x-wav' || m === 'audio/wave') return 'audio/wav';
  if (m === 'audio/mp3') return 'audio/mpeg';
  if (!m || m === 'audio/*') return 'audio/mp4';
  return m;
}

// ─── 클로바 ───────────────────────────────────────────────────────────────
async function callClova(fileUri, clientId, clientSecret) {
  const response = await FileSystem.uploadAsync(`${CLOVA_STT_URL}?lang=Kor`, fileUri, {
    httpMethod: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream', // 클로바는 이 값만 허용 (STT002 방지)
      'X-NCP-APIGW-API-KEY-ID': clientId,
      'X-NCP-APIGW-API-KEY': clientSecret,
    },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  console.log('[CLOVA]', response.status, response.body);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`클로바 STT 오류 (${response.status}) ${response.body}`);
  }
  try {
    return (JSON.parse(response.body)?.text ?? '').trim();
  } catch (e) {
    throw new Error('클로바 STT 응답 파싱 실패');
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────
async function callGemini(fileUri, mimeType, size) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'null') throw new Error('Gemini API 키가 설정되지 않았습니다.');
  if (size > GEMINI_INLINE_MAX_BYTES) {
    throw new Error('음성 파일이 너무 커서 변환할 수 없습니다. (14MB 이하만 지원)');
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: TRANSCRIBE_PROMPT },
            { inline_data: { mime_type: toGeminiMime(mimeType), data: base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini 음성 변환 오류 (${res.status}) ${errText}`.trim());
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? '').join('').trim();
  console.log('[GEMINI-STT] length:', text.length);
  return text;
}

// ─── 공개 함수 ────────────────────────────────────────────────────────────
export async function transcribeAudioClova(fileUri, mimeType = 'audio/m4a') {
  const fileInfo = await FileSystem.getInfoAsync(fileUri, { size: true });
  if (!fileInfo.exists || !fileInfo.size) {
    throw new Error('음성 파일을 찾을 수 없거나 크기가 0입니다.');
  }

  const clientId = process.env.EXPO_PUBLIC_CLOVA_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_CLOVA_CLIENT_SECRET;
  const mime = (mimeType || '').toLowerCase();

  const clovaPossible =
    !!clientId &&
    !!clientSecret &&
    CLOVA_OK_MIME.has(mime) &&
    fileInfo.size <= 10 * 1024 * 1024;

  let clovaError = null;

  // 1) 클로바 (지원 포맷일 때만 — 못 읽는 포맷은 호출 자체를 건너뛰어 크레딧을 아낀다)
  if (clovaPossible) {
    try {
      const text = await callClova(fileUri, clientId, clientSecret);
      if (text) return text;
      clovaError = new Error('클로바가 빈 텍스트를 반환했습니다.');
    } catch (e) {
      console.warn('클로바 변환 실패:', e.message);
      clovaError = e;
    }
  } else {
    console.log('[STT] 클로바 건너뜀 (포맷/키/크기):', mime, fileInfo.size);
  }

  // 2) Gemini 대체
  try {
    return await callGemini(fileUri, mimeType, fileInfo.size);
  } catch (e) {
    console.warn('Gemini 음성 변환 실패:', e.message);
    throw new Error(clovaError ? `${clovaError.message} / ${e.message}` : e.message);
  }
}