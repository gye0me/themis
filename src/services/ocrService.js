import { Platform } from 'react-native';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const toBase64Web = (uri) =>
  new Promise((resolve, reject) => {
    fetch(uri)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });

export const extractTextFromImage = async (imageUri) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API 키가 없습니다.');

    let base64;
    if (Platform.OS === 'web') {
      base64 = await toBase64Web(imageUri);
    } else {
      const FileSystem = await import('expo-file-system');
        base64 = await FileSystem.default.readAsStringAsync(imageUri, {
        encoding: FileSystem.default.EncodingType.Base64,
        });
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: '이 이미지에서 텍스트를 추출해주세요. 텍스트만 반환하고 다른 설명은 하지 마세요. 텍스트가 없으면 빈 문자열을 반환하세요.',
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
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