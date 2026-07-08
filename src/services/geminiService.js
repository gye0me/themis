const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// 계약서 유형별 분석 포커스
const CONTRACT_FOCUS = {
  전월세: '전세·월세 임대차 계약서. 보증금 보호, 임대인 해지권, 수선 의무, 전세권 설정 조항에 집중하세요.',
  매매: '부동산 매매 계약서. 잔금 조건, 하자 담보 책임, 소유권 이전 시점, 위약금 조항에 집중하세요.',
  프리랜서: '프리랜서 용역 계약서. 대금 지급 조건, 저작권 귀속, 일방 해지권, 비밀유지 과도 조항에 집중하세요.',
};

const PROMPT_TEMPLATE = (contractType) => `
당신은 한국 계약법 전문가입니다. 첨부된 계약서 이미지를 분석해 불공정·위험 조항을 찾아주세요.

[계약 유형]: ${contractType}
[분석 포커스]: ${CONTRACT_FOCUS[contractType] ?? CONTRACT_FOCUS['전월세']}

아래 JSON 형식으로만 답변하세요. 다른 설명 없이 JSON만 출력하세요.

{
  "summary": "위험 조항 N개 · 주의 조항 N개 · 양호 조항 N개 발견",
  "items": [
    {
      "level": "danger",
      "score": "N조 위험",
      "title": "조항 이름 (15자 이내)",
      "desc": "이 조항이 왜 위험한지 1-2문장으로 설명",
      "example": "일반적으로 어떻게 수정하는지 예시 (없으면 null)"
    }
  ]
}

규칙:
- level은 danger(위험) / warning(주의) / safe(양호) 세 가지만 사용
- score는 "N조 위험", "N조 주의", "N조 양호" 형식 (N은 해당 조항 번호 또는 순번)
- items는 최대 6개
- 계약서가 불명확하거나 이미지를 읽을 수 없으면 items를 빈 배열로
- 반드시 valid JSON만 출력 (마크다운 코드블록 불필요)
`.trim();

// ─── 텍스트 후처리 파이프라인 ────────────────────────────────────────────────

function cleanRawText(text) {
  return text
    .replace(/```json\s*/gi, '')   // 마크다운 코드블록 제거
    .replace(/```\s*/g, '')
    .replace(/[​-‍﻿]/g, '')  // 제로폭 문자 제거
    .replace(/\r\n/g, '\n')        // CRLF 정규화
    .replace(/\n{3,}/g, '\n\n')    // 연속 빈줄 압축
    .trim();
}

function cleanStringValue(val) {
  if (typeof val !== 'string') return val;
  return val
    .replace(/\\n/g, ' ')          // 이스케이프 줄바꿈 → 공백
    .replace(/\s{2,}/g, ' ')       // 연속 공백 압축
    .trim();
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  const VALID_LEVELS = new Set(['danger', 'warning', 'safe']);

  return items
    .filter((item) => item && typeof item === 'object')
    .slice(0, 6)
    .map((item, idx) => ({
      level: VALID_LEVELS.has(item.level) ? item.level : 'warning',
      score: cleanStringValue(item.score) || `${idx + 1}조 주의`,
      title: cleanStringValue(item.title) || '조항 분석',
      desc: cleanStringValue(item.desc) || '',
      example: item.example ? cleanStringValue(item.example) : null,
    }));
}

// ─── JSON 파싱 (방어적) ──────────────────────────────────────────────────────

function parseGeminiResponse(rawText) {
  const cleaned = cleanRawText(rawText);

  // 1차: 전체가 JSON인 경우
  try {
    const parsed = JSON.parse(cleaned);
    return buildResult(parsed);
  } catch (_) {}

  // 2차: 중괄호 블록 추출
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return buildResult(parsed);
    } catch (_) {}
  }

  // 3차: items 배열만 추출
  const arrMatch = cleaned.match(/"items"\s*:\s*(\[[\s\S]*?\])/);
  if (arrMatch) {
    try {
      const items = JSON.parse(arrMatch[1]);
      return buildResult({ items });
    } catch (_) {}
  }

  // 최종 폴백: 빈 결과
  return buildResult({ items: [] });
}

function buildResult(parsed) {
  const items = sanitizeItems(parsed.items);
  const danger = items.filter((i) => i.level === 'danger').length;
  const warning = items.filter((i) => i.level === 'warning').length;
  const safe = items.filter((i) => i.level === 'safe').length;

  const summary =
    cleanStringValue(parsed.summary) ||
    `위험 조항 ${danger}개 · 주의 조항 ${warning}개 · 양호 조항 ${safe}개 발견`;

  return { summary, items };
}

// ─── 메인 공개 함수 ──────────────────────────────────────────────────────────

/**
 * Gemini Vision API로 계약서 이미지를 분석하여 조항 리스트를 반환합니다.
 *
 * @param {string} base64Img  - 순수 base64 문자열 (data: URI 접두사 제외)
 * @param {string} mimeType   - 이미지 MIME 타입 (기본값: 'image/jpeg')
 * @param {string} contractType - 계약 유형: '전월세' | '매매' | '프리랜서'
 * @returns {Promise<{ summary: string, items: Array }>}
 */
export const B_callGeminiAPI = async (
  base64Img,
  mimeType = 'image/jpeg',
  contractType = '전월세',
) => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT_TEMPLATE(contractType) },
          {
            inlineData: {
              mimeType,
              data: base64Img,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,      // 낮은 온도로 일관성 확보
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API 오류 ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();

  // Gemini 응답 구조: candidates[0].content.parts[0].text
  const rawText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!rawText) {
    return buildResult({ items: [] });
  }

  return parseGeminiResponse(rawText);
};
