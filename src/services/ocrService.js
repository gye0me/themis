import { Platform } from 'react-native';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

export const extractTextFromImage = async (imageUri) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API 키가 없습니다.');

    let base64;
    let mimeType = 'image/jpeg';

    if (Platform.OS === 'web') {
      base64 = await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl.split(',')[1]);
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = (e) => reject(new Error('이미지 로드 실패'));
        img.src = imageUri;
      });
    } else {
      const FileSystem = require('expo-file-system/legacy');
      base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: '이 이미지에 있는 모든 텍스트를 빠짐없이 정확하게 추출해주세요. 원본의 줄바꿈, 띄어쓰기, 문장 구조를 최대한 그대로 유지해주세요. 표나 목록이 있으면 구조를 살려서 추출해주세요. 절대로 요약하거나 설명하지 말고 이미지에 있는 텍스트만 그대로 추출해주세요. 텍스트가 없으면 빈 문자열만 반환하세요.' },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return text.trim();
  } catch (e) {
    console.warn('OCR 오류:', e.message);
    return '';
  }
};