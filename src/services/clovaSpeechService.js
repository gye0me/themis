// src/services/clovaSpeechService.js
//
// 네이버 클로바 음성인식(CSR, CLOVA Speech Recognition) 서비스.
// firebaseService.js에 있던 Whisper(OpenAI) 기반 transcribeAudio()를 대체한다.
//
// CSR의 짧은 음성인식 API(recog/v1/stt)는 1회 호출당 최대 60초까지만 인식할 수 있다.
// 그래서 원본 음성 파일을 60초 분량 바이트로 잘라 순서대로 전송하고,
// 각 조각에서 돌아온 텍스트를 순서대로 이어붙이는 방식으로 구현했다.
//
// 주의: 파일을 오디오 프레임 단위가 아니라 "예상 비트레이트 기준 바이트 위치"로
// 근사 분할한다. WAV(비압축 PCM)는 이 방식으로도 정확히 잘리지만, m4a/AAC처럼
// 컨테이너로 감싸진 압축 포맷은 조각 경계에서 헤더가 깨져 뒤 조각이 인식되지 않을 수
// 있다. 프로젝트에 오디오 재인코딩(ffmpeg 등) 라이브러리가 없어 우선 이 방식으로 구현했고,
// 데모 전 실제 녹음 포맷(m4a 등)으로 꼭 테스트가 필요하다.

import * as FileSystem from 'expo-file-system/legacy';

const CLOVA_STT_URL = 'https://naveropenapi.apigw.ntruss.com/recog/v1/stt';

const CLOVA_CHUNK_SECONDS = 60;
// 음성 녹음(모노, 대화 음질) 평균 비트레이트 추정치. 실제 파일 비트레이트에 따라 오차가 있다.
const ESTIMATED_BITRATE_BPS = 64 * 1000;
const CLOVA_CHUNK_BYTES = Math.floor((ESTIMATED_BITRATE_BPS / 8) * CLOVA_CHUNK_SECONDS);

// 클로바 CSR이 공식 지원하는 포맷 (mp3, aac, ac3, ogg, flac, wav).
const CLOVA_SUPPORTED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
]);

function base64ChunkToBlob(base64Chunk, mimeType) {
  // RN/expo 환경에는 Buffer가 없어서, base64 문자열을 data URI로 만들어
  // fetch에 태우는 방식으로 표준 Blob을 얻는다 (firebaseService.js 업로드 로직과 동일한 패턴).
  const dataUri = `data:${mimeType};base64,${base64Chunk}`;
  return fetch(dataUri).then((res) => res.blob());
}

async function callClovaChunk(base64Chunk, mimeType, clientId, clientSecret) {
  const blob = await base64ChunkToBlob(base64Chunk, mimeType);

  const res = await fetch(`${CLOVA_STT_URL}?lang=Kor`, {
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

/**
 * 클로바 음성인식(CSR)으로 음성 파일을 텍스트로 변환한다.
 * 60초 제한을 우회하기 위해 파일을 1분 단위(근사)로 잘라 순서대로 전송하고,
 * 반환된 텍스트를 순서대로 이어붙인다.
 */
export async function transcribeAudioClova(fileUri, mimeType = 'audio/m4a') {
  const clientId = process.env.EXPO_PUBLIC_CLOVA_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_CLOVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('클로바 API 키가 설정되지 않았습니다.');
  }

  if (mimeType && !CLOVA_SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase())) {
    console.warn(
      `클로바가 공식 지원하지 않는 포맷일 수 있습니다: ${mimeType} (mp3/aac/ac3/ogg/flac/wav 권장)`
    );
  }

  const { size } = await FileSystem.getInfoAsync(fileUri, { size: true });
  if (!size) throw new Error('음성 파일 크기를 확인할 수 없습니다.');

  const chunkCount = Math.max(1, Math.ceil(size / CLOVA_CHUNK_BYTES));
  const transcripts = [];

  for (let i = 0; i < chunkCount; i++) {
    const position = i * CLOVA_CHUNK_BYTES;
    const length = Math.min(CLOVA_CHUNK_BYTES, size - position);
    if (length <= 0) break;

    const base64Chunk = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    });

    try {
      // 조각을 순서대로(await, 병렬 X) 보내야 텍스트 이어붙이기 순서가 보장된다.
      const text = await callClovaChunk(base64Chunk, mimeType, clientId, clientSecret);
      if (text) transcripts.push(text);
    } catch (e) {
      console.warn(`클로바 STT 조각 ${i + 1}/${chunkCount} 변환 실패:`, e.message);
      // 한 조각이 실패해도 나머지 조각은 이어서 시도한다.
    }
  }

  return transcripts.join(' ').trim();
}
