// src/services/videoTranscriptService.js
//
// 영상 증거의 음성(대화)을 텍스트로 변환한다.
//
// 클로바 CSR은 영상 컨테이너(mp4/mov)를 받지 않고, 프로젝트에 ffmpeg 같은 재인코딩
// 라이브러리도 없어서 플랫폼별로 다르게 처리한다.
//  - 웹: 브라우저 WebAudio(decodeAudioData)로 영상의 음성 트랙만 디코딩 → 16kHz 모노 WAV로
//        만든 뒤 5분 단위로 잘라 Gemini에 전사 요청 (WAV라서 조각 경계가 정확하다).
//  - 앱: 음성 트랙만 떼어낼 방법이 없어 영상 파일 자체를 Gemini에 보낸다.
//        작은 파일은 inline_data, 큰 파일은 Gemini Files API로 업로드 후 참조한다.

import { Platform } from 'react-native';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_GENERATE_URL = `${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_UPLOAD_URL = `${GEMINI_BASE}/upload/v1beta/files`;

// Gemini 요청 본문 한도(약 20MB)를 넘지 않도록 inline으로 보낼 원본 크기 상한 (base64로 약 1.33배 커짐)
const INLINE_MAX_BYTES = 14 * 1024 * 1024;

const WAV_SAMPLE_RATE = 16000;
const WAV_CHUNK_SECONDS = 5 * 60;

const TRANSCRIBE_PROMPT =
  '이 파일에 녹음된 사람의 말소리를 들리는 그대로 한국어 텍스트로 받아써 주세요. ' +
  '요약하거나 설명을 덧붙이지 말고, 말한 내용만 순서대로 적어주세요. ' +
  '화자가 바뀌면 줄을 바꿔 구분해주세요. 말소리가 전혀 없으면 빈 문자열만 반환하세요.';

// 영상 파일 MIME을 Gemini가 받는 값으로 맞춘다 (iOS 촬영본은 video/quicktime).
function normalizeVideoMime(mimeType) {
  const m = (mimeType || '').toLowerCase();
  if (m === 'video/quicktime') return 'video/mov';
  if (!m || m === 'video/*') return 'video/mp4';
  return m;
}

function getApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다.');
  return apiKey;
}

async function generateTranscript(mediaPart, apiKey) {
  const res = await fetch(`${GEMINI_GENERATE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: TRANSCRIBE_PROMPT }, mediaPart] }],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini 음성 변환 오류 (${res.status}) ${errText}`.trim());
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('').trim();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

// ─── 웹: 음성 트랙 디코딩 → WAV ────────────────────────────────────────────

// 채널을 섞어 모노로 만들고 16kHz로 리샘플링한 Float32 샘플을 돌려준다.
async function decodeToMono16k(arrayBuffer) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    ctx.close?.();
  }

  const length = Math.ceil(decoded.duration * WAV_SAMPLE_RATE);
  if (length <= 0) return new Float32Array(0);
  const offline = new OfflineAudioContext(1, length, WAV_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function encodeWav(samples) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, WAV_SAMPLE_RATE, true);
  view.setUint32(28, WAV_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function transcribeVideoWeb(file, apiKey) {
  const blob = file.file ?? (await (await fetch(file.uri)).blob());
  let samples;
  try {
    samples = await decodeToMono16k(await blob.arrayBuffer());
  } catch (e) {
    // 음성 트랙이 없거나 브라우저가 코덱을 못 푸는 경우
    throw new Error(`영상에서 음성을 추출하지 못했습니다. (${e.message})`, { cause: e });
  }
  if (samples.length === 0) return '';

  const chunkLen = WAV_CHUNK_SECONDS * WAV_SAMPLE_RATE;
  const transcripts = [];
  for (let start = 0; start < samples.length; start += chunkLen) {
    const wav = encodeWav(samples.subarray(start, start + chunkLen));
    const data = await blobToBase64(wav);
    // 순서대로(병렬 X) 보내야 이어붙인 텍스트 순서가 보장된다.
    const text = await generateTranscript({ inline_data: { mime_type: 'audio/wav', data } }, apiKey);
    if (text) transcripts.push(text);
  }
  return transcripts.join('\n').trim();
}

// ─── 앱: 영상 파일을 그대로 Gemini에 전달 ─────────────────────────────────

// Gemini Files API(resumable)로 업로드하고, 처리 완료(ACTIVE)될 때까지 기다린 뒤 file uri를 돌려준다.
async function uploadToGeminiFiles(fileUri, mimeType, size, apiKey) {
  const startRes = await fetch(`${GEMINI_UPLOAD_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: `evidence-video-${Date.now()}` } }),
  });
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!startRes.ok || !uploadUrl) {
    throw new Error(`Gemini 파일 업로드 시작 실패 (${startRes.status})`);
  }

  const FileSystem = require('expo-file-system/legacy');
  const uploadRes = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': mimeType,
    },
  });
  if (uploadRes.status < 200 || uploadRes.status >= 300) {
    throw new Error(`Gemini 파일 업로드 실패 (${uploadRes.status})`);
  }
  let info = JSON.parse(uploadRes.body)?.file;

  // 영상은 업로드 직후 PROCESSING 상태라 바로 쓰면 오류가 난다.
  for (let i = 0; i < 60 && info?.state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${GEMINI_BASE}/v1beta/${info.name}?key=${apiKey}`);
    info = await res.json();
  }
  if (info?.state !== 'ACTIVE') {
    throw new Error(`Gemini 파일 처리 실패 (${info?.state ?? 'unknown'})`);
  }
  return info.uri;
}

async function transcribeVideoNative(file, apiKey) {
  const FileSystem = require('expo-file-system/legacy');
  const mimeType = normalizeVideoMime(file.mimeType);
  const size = file.size ?? (await FileSystem.getInfoAsync(file.uri, { size: true })).size;
  if (!size) throw new Error('영상 파일 크기를 확인할 수 없습니다.');

  if (size <= INLINE_MAX_BYTES) {
    const data = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
    return generateTranscript({ inline_data: { mime_type: mimeType, data } }, apiKey);
  }
  const fileUri = await uploadToGeminiFiles(file.uri, mimeType, size, apiKey);
  return generateTranscript({ file_data: { mime_type: mimeType, file_uri: fileUri } }, apiKey);
}

/**
 * 영상 증거 파일({ uri, mimeType, size?, file? })의 음성을 텍스트로 변환한다.
 * 말소리가 없으면 빈 문자열을 돌려주고, 추출/변환에 실패하면 예외를 던진다.
 */
export async function transcribeVideoAudio(file) {
  const apiKey = getApiKey();
  if (Platform.OS === 'web') return transcribeVideoWeb(file, apiKey);
  return transcribeVideoNative(file, apiKey);
}
