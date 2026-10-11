// src/services/ocrService.js
//
// 사진 속 텍스트를 Gemini로 추출한다.
// - thinkingBudget: 0 : 생각(thinking) 토큰이 출력 한도를 먹어 본문이 비는 문제 방지 (다른 서비스와 동일 설정)
// - 큰 사진은 JPEG로 변환·축소해서 전송 (HEIC/PNG 대응 + 서버 경유 10MB 제한 대응)
// - 실패하면 빈 문자열 대신 예외를 던져서 화면에서 원인을 안내할 수 있게 한다.

import { Platform } from 'react-native';
import { geminiFetch } from './aiClient';

const OCR_MAX_WIDTH = 2000;
const OCR_JPEG_QUALITY = 0.85;

const OCR_PROMPT =
  '이 이미지에 있는 모든 텍스트를 빠짐없이 정확하게 추출해주세요. 원본의 줄바꿈, 띄어쓰기, 문장 구조를 최대한 그대로 유지해주세요. ' +
  '표나 목록이 있으면 구조를 살려서 추출해주세요. 절대로 요약하거나 설명하지 말고 이미지에 있는 텍스트만 그대로 추출해주세요. ' +
  '텍스트가 없으면 빈 문자열만 반환하세요.';

// 웹: canvas로 JPEG 변환 + 축소
function prepareImageWeb(imageUri) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const ratio = srcW > OCR_MAX_WIDTH ? OCR_MAX_WIDTH / srcW : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(srcW * ratio);
        canvas.height = Math.round(srcH * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', OCR_JPEG_QUALITY);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = imageUri;
  });
}

// 앱: expo-image-manipulator로 JPEG 변환 + 축소. 실패하면 원본 파일을 그대로 읽는다.
async function prepareImageNative(imageUri) {
  try {
    const ImageManipulator = require('expo-image-manipulator');
    // 빈 액션으로 한 번 열어 실제 가로 크기부터 확인 (작은 사진을 키우지 않기 위해)
    const probe = await ImageManipulator.manipulateAsync(imageUri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 1,
    });
    const actions = probe.width > OCR_MAX_WIDTH ? [{ resize: { width: OCR_MAX_WIDTH } }] : [];
    const result = await ImageManipulator.manipulateAsync(imageUri, actions, {
      format: ImageManipulator.SaveFormat.JPEG,
      compress: OCR_JPEG_QUALITY,
      base64: true,
    });
    if (result.base64) return { base64: result.base64, mimeType: 'image/jpeg' };
  } catch (e) {
    console.warn('OCR 이미지 축소 실패, 원본으로 시도합니다:', e.message);
  }
  const FileSystem = require('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
  return { base64, mimeType: 'image/jpeg' };
}

/**
 * 사진에서 텍스트를 추출한다. 텍스트가 없으면 빈 문자열, 호출/응답 오류는 예외로 던진다.
 */
export const extractTextFromImage = async (imageUri) => {
  const { base64, mimeType } =
    Platform.OS === 'web' ? await prepareImageWeb(imageUri) : await prepareImageNative(imageUri);

  const res = await geminiFetch({
    contents: [{ parts: [{ text: OCR_PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OCR 요청 실패 (${res.status}) ${errText.slice(0, 200)}`.trim());
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `OCR이 차단됐어요 (${blockReason})` : 'OCR 응답이 비어 있어요.');
  }

  // 여러 part로 나뉘어 와도 전부 이어붙이고, thought part는 제외한다
  return (candidate.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
};
