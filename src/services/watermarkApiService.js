// src/services/watermarkApiService.js
//
// https://versatility.cloud/api/ 서버 연동.
// - 워터마크: 이미지/PDF에 문구 + 현재 시각을 반투명 대각선으로 합성해서 돌려준다.
// - 비디오 프레임 추출: 영상에서 지정한 fps로 프레임 이미지들을 뽑아낸다(비동기 작업 + 폴링).
//
// 서버가 만들어주는 파일은 versatility.cloud 저장소에 있으므로, Themis의 증거로 영구
// 보관하려면 이 서비스가 돌려준 URL을 다시 다운로드해서 Firebase Storage에 올려야 한다
// (실제 업로드는 호출부인 화면단에서 처리 — 이 서비스는 "서버에 요청해서 결과 URL을 받아오는" 역할만 한다).

import * as FileSystem from 'expo-file-system/legacy';

const BASE_URL = 'https://versatility.cloud';

function toAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

async function parseJsonOrThrow(response, fallbackMessage) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // 응답이 JSON이 아닌 경우(서버 오류 페이지 등) — 상태 코드만으로 에러 메시지 구성
  }
  if (!response.ok) {
    const message = body?.message || body?.error || `${fallbackMessage} (HTTP ${response.status})`;
    throw new Error(message);
  }
  return body;
}

/**
 * 이미지/PDF에 서버 워터마크를 합성한다.
 * @param {{ uri: string, name: string, mimeType: string, text: string }} params
 *   text: 워터마크로 박을 문구 (최대 120자 — 서버 제한에 맞춰 자동으로 자름)
 * @returns {Promise<{ fileUrl: string, seq: number, name: string, watermarkText: string, createdAt: string }>}
 */
export async function applyServerWatermark({ uri, name, mimeType, text }) {
  if (!uri) throw new Error('워터마크를 적용할 파일이 없습니다.');
  const watermarkText = (text ?? '').slice(0, 120);

  const formData = new FormData();
  // React Native의 fetch/FormData는 { uri, name, type } 형태의 "파일 오브젝트"를 그대로 받는다.
  formData.append('file', { uri, name: name ?? 'evidence', type: mimeType ?? 'application/octet-stream' });
  formData.append('text', watermarkText);

  const response = await fetch(`${BASE_URL}/api/watermark/`, {
    method: 'POST',
    body: formData,
    headers: { Accept: 'application/json' },
    // Content-Type(multipart boundary)은 fetch가 FormData를 보고 자동으로 설정하므로 직접 지정하지 않는다.
  });

  const body = await parseJsonOrThrow(response, '워터마크 서버 요청 실패');
  return {
    fileUrl: toAbsoluteUrl(body.file_url),
    seq: body.seq,
    name: body.name,
    watermarkText: body.watermark_text,
    createdAt: body.created_at,
  };
}

/**
 * 서버가 돌려준 파일 URL을 로컬 캐시 파일로 내려받는다.
 * (이후 Firebase Storage에 업로드하기 위한 로컬 uri가 필요할 때 사용)
 * @param {string} fileUrl - applyServerWatermark 등이 돌려준 절대 URL
 * @param {string} localFileName
 * @returns {Promise<string>} 로컬 파일 uri
 */
export async function downloadServerFile(fileUrl, localFileName) {
  const dest = `${FileSystem.cacheDirectory}${localFileName}`;
  const result = await FileSystem.downloadAsync(fileUrl, dest);
  if (result.status !== 200) {
    throw new Error(`서버 파일 다운로드 실패 (HTTP ${result.status})`);
  }
  return result.uri;
}

/**
 * 워터마크 서버 호출 → 결과를 로컬로 내려받기까지 한 번에 처리하는 헬퍼.
 * EvidenceUploadScreen처럼 "합성된 로컬 uri"가 바로 필요한 화면에서 사용.
 */
export async function watermarkAndDownload({ uri, name, mimeType, text }) {
  const result = await applyServerWatermark({ uri, name, mimeType, text });
  if (!result.fileUrl) throw new Error('워터마크 서버가 결과 파일 URL을 돌려주지 않았습니다.');
  const localUri = await downloadServerFile(result.fileUrl, result.name || name || `watermarked-${Date.now()}`);
  return { ...result, localUri };
}

// ─── 비디오 프레임 추출 ──────────────────────────────────────────────────────

/**
 * 비디오 프레임 추출 작업을 시작한다 (비동기 — 작업 ID를 받아서 상태를 폴링해야 함).
 * @param {{ uri: string, name: string, mimeType: string, fpsOption?: number, keepOriginal?: boolean }} params
 * @returns {Promise<{ taskId: string, status: string }>}
 */
export async function startVideoFrameExtraction({ uri, name, mimeType, fpsOption = 1, keepOriginal = false }) {
  if (!uri) throw new Error('프레임을 추출할 영상 파일이 없습니다.');

  const formData = new FormData();
  formData.append('file', { uri, name: name ?? 'video.mp4', type: mimeType ?? 'video/mp4' });
  formData.append('fps_option', String(fpsOption));
  formData.append('keep_original', String(keepOriginal));

  const response = await fetch(`${BASE_URL}/api/videos/upload/`, {
    method: 'POST',
    body: formData,
    headers: { Accept: 'application/json' },
  });

  const body = await parseJsonOrThrow(response, '영상 프레임 추출 요청 실패');
  return { taskId: body.task_id ?? body.id, status: body.status ?? 'PENDING' };
}

/**
 * 프레임 추출 작업 상태 조회. status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
 */
export async function getVideoFrameTaskStatus(taskId) {
  const response = await fetch(`${BASE_URL}/api/videos/tasks/${taskId}/`, {
    headers: { Accept: 'application/json' },
  });
  const body = await parseJsonOrThrow(response, '작업 상태 조회 실패');
  return body;
}

/**
 * 완료된 작업의 프레임 이미지 목록을 가져온다. (완료 전 호출하면 서버가 400을 반환)
 * @returns {Promise<Array<{ url: string, timestamp?: number|string }>>}
 */
export async function getVideoFrameImages(taskId) {
  const response = await fetch(`${BASE_URL}/api/videos/tasks/${taskId}/images/`, {
    headers: { Accept: 'application/json' },
  });
  const body = await parseJsonOrThrow(response, '프레임 목록 조회 실패');
  const images = Array.isArray(body) ? body : (body.images ?? body.results ?? []);
  return images.map((img) => ({ ...img, url: toAbsoluteUrl(img.url ?? img.file_url) }));
}

/**
 * 프레임 추출 작업이 끝날 때까지 주기적으로 상태를 확인한다.
 * @param {string} taskId
 * @param {{ intervalMs?: number, timeoutMs?: number }} [options]
 * @returns {Promise<Array<{ url: string, timestamp?: number|string }>>}
 */
export async function waitForVideoFrames(taskId, { intervalMs = 2000, timeoutMs = 120000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { status } = await getVideoFrameTaskStatus(taskId);
    if (status === 'COMPLETED') return getVideoFrameImages(taskId);
    if (status === 'FAILED') throw new Error('서버에서 영상 프레임 추출에 실패했습니다.');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('영상 프레임 추출이 시간 내에 끝나지 않았습니다.');
}
