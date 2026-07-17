const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ─── 공통 출력 포맷 규칙 ─────────────────────────────────────────────────────

const OUTPUT_FORMAT = `
[출력 규칙 — 반드시 준수]
- 아래 JSON 형식으로만 답변하세요. 다른 설명·마크다운 코드블록 없이 JSON만 출력하세요.
- level: danger(위험) / warning(주의) / safe(양호) 세 값만 허용
- score: "N조 위험" / "N조 주의" / "N조 양호" 형식 (N은 계약서 내 조항 번호, 없으면 순번)
- title: 15자 이내
- desc: 피해자 입장에서 왜 위험한지 1~2문장, 전문 용어는 괄호로 쉬운 말 병기
- example: 해당 조항을 유리하게 수정할 때 쓰는 문구 예시. 수정 불필요면 null
- items: 최대 6개 (danger 우선 정렬)
- 계약서를 읽을 수 없거나 해당 유형 계약서가 아니면 items를 빈 배열로

{
  "summary": "위험 조항 N개 · 주의 조항 N개 · 양호 조항 N개 발견",
  "items": [
    {
      "level": "danger",
      "score": "N조 위험",
      "title": "조항 이름",
      "desc": "왜 위험한지 설명",
      "example": "수정 예시 문구 또는 null"
    }
  ]
}`.trim();

// ─── 유형별 전문 프롬프트 ────────────────────────────────────────────────────

const PROMPTS = {

  전월세: `
당신은 주택임대차보호법 전문 법무사입니다.
전세·월세 임대차 계약서 이미지를 분석해 임차인(세입자)에게 불리한 조항을 찾아주세요.

[분석 배경 — 한국 전월세 관례]
한국 전월세 계약에서 임차인이 자주 피해를 입는 패턴은 다음과 같습니다.
반드시 아래 항목들을 계약서에서 확인하세요.

▶ DANGER(위험) 패턴
1. 임대인 일방 해지권: "임대인은 언제든지 계약을 해지할 수 있다" 등 계약기간 중 임대인만 해지 가능한 조항
2. 확정일자·전세권 금지: "임차인은 전세권 설정 및 확정일자를 받을 수 없다" — 주택임대차보호법상 대항력·우선변제권 차단
3. 보증금 반환 기한 무기한: 퇴거 후 보증금 반환 시점이 명시되지 않거나 "후속 임차인 입주 후" 등 조건부
4. 체납세금·근저당 고지 면제: 임대인의 세금 체납 및 근저당권 설정 사실을 고지하지 않아도 되는 조항
5. 수선비 전액 임차인 부담: "일체의 수선은 임차인 부담" — 민법 623조 위반 (임대인 수선의무)
6. 임의 월세 인상: 임대인이 일방적으로 월세를 인상할 수 있는 조항 (주택임대차보호법 7조 5% 상한 위반)
7. 원상복구 과대: 정상 사용·마모에 의한 흔적까지 원상복구 의무 부과

▶ WARNING(주의) 패턴
8. 갱신거절권 일방 부여: 임대인만 갱신거절 가능, 임차인 갱신청구권(2년) 배제
9. 전대·양도 절대 금지: 긴급 상황에서도 전대 불가 — 과도한 제한
10. 관리비 항목 불명확: 관리비 금액·항목이 특약에 미기재
11. 특약 구두 약속 배제: "구두 약속은 효력이 없다" — 사전 협의 내용 무효화
12. 임차인 하자 신고의무 과중: 즉시 신고하지 않으면 임차인 책임으로 전가

▶ SAFE(양호) 패턴 (존재 시 명시)
13. 확정일자·전입신고 안내 명시
14. 보증보험 가입 안내
15. 퇴거 후 N일 이내 보증금 반환 명확 기재

${OUTPUT_FORMAT}
`.trim(),

  매매: `
당신은 부동산 매매 계약 전문 법무사입니다.
부동산 매매 계약서 이미지를 분석해 매수인(구매자)에게 불리한 조항을 찾아주세요.

[분석 배경 — 한국 부동산 매매 관례]
한국 부동산 매매에서 매수인이 자주 피해를 입는 패턴은 다음과 같습니다.

▶ DANGER(위험) 패턴
1. 하자 담보책임 면제: "매도인은 목적물의 하자에 대해 책임을 지지 않는다" — 민법 580조 위반
2. 잔금 기한 내 소유권 이전 불명확: 잔금 납부와 소유권 이전 등기 신청 시점이 분리되거나 불명확
3. 계약금 몰취 조건 과대: 매수인 귀책 없는 상황에서도 계약금 전액 몰취
4. 위약금 비대칭: 매도인 위약 시 계약금 반환만, 매수인 위약 시 배액 배상 등 불균형
5. 근저당·가압류 말소 의무 미기재: 잔금 전 말소 의무가 계약서에 없음
6. 공시지가·실거래가 허위 기재 유도: 다운계약서 작성 유도 조항 또는 묵인 문구

▶ WARNING(주의) 패턴
7. 중도금 이자 과중: 중도금 지연 시 연 이율이 법정 이율(연 5%)을 초과
8. 옵션 목록 불명확: 포함되는 붙박이·가전 목록이 특약에 미기재
9. 이사 날짜 명시 부재: 현 거주자 퇴거 일정 불명확
10. 취득세·등기비용 부담 기준 불명확

▶ SAFE(양호) 패턴 (존재 시 명시)
11. 잔금일 소유권 이전 등기 동시 이행 명시
12. 근저당 말소 후 잔금 지급 명시
13. 하자 고지 의무 이행 확인서 첨부

${OUTPUT_FORMAT}
`.trim(),

  프리랜서: `
당신은 저작권법·용역계약 전문 법무사입니다.
프리랜서 용역 계약서 이미지를 분석해 수급인(프리랜서)에게 불리한 조항을 찾아주세요.

[분석 배경 — 한국 프리랜서 계약 관례]
한국 프리랜서 계약에서 수급인이 자주 피해를 입는 패턴은 다음과 같습니다.

▶ DANGER(위험) 패턴
1. 저작권 전면 양도: "결과물의 모든 지식재산권은 발주사에 귀속된다" — 2차 저작물 포함 완전 박탈
2. 대금 지급 조건 불명확: 지급 시점이 "납품 후 협의" 또는 "최종 승인 후" 등 주관적 기준
3. 발주사 일방 해지권: "발주사는 언제든지 계약을 해지할 수 있으며 기지급 대금만 정산" — 미지급 잔금 몰취
4. 무한 수정 의무: 수정 횟수·범위 제한 없이 발주사 만족 시까지 수정
5. 비밀유지 과도·무기한: 경쟁사 취업·유사 작업 금지 등 직업 선택 자유 침해
6. 손해배상 예정액 과대: 지연·하자 시 계약 금액을 초과하는 위약금 설정

▶ WARNING(주의) 패턴
7. 납품물 검수 기준 불명확: 합격·불합격 판정 기준이 주관적
8. 재하도급 금지 과도: 보조 인력·툴 사용도 금지
9. 세금계산서 발행 시점 불명확: 선발행·후발행 조건 미기재
10. 계약 기간 자동 연장: 해지 통보 없으면 자동 연장되는 조항

▶ SAFE(양호) 패턴 (존재 시 명시)
11. 납품 후 N일 이내 대금 지급 명확 기재
12. 수정 횟수 N회로 제한 명시
13. 저작인격권(성명표시권) 보장 명시

${OUTPUT_FORMAT}
`.trim(),
};

// 등록되지 않은 유형 폴백
const PROMPTS_FALLBACK = PROMPTS['전월세'];

const PROMPT_TEMPLATE = (contractType) =>
  PROMPTS[contractType] ?? PROMPTS_FALLBACK;

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
    .replace(/\u00a0/g, ' ')
    .replace(/\\n/g, ' ')          // 이스케이프 줄바꿈 → 공백
    .replace(/\s*\|\s*/g, ' ')   // 표기 잔여 구분자 정리
    .replace(/\s{2,}/g, ' ')       // 연속 공백 압축
    .trim();
}

function normalizeWhitespace(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function removeNoiseLines(text) {
  const lines = normalizeWhitespace(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const filtered = lines.filter((line) => {
    if (/^(page|p\.)\s*\d+/i.test(line)) return false;
    if (/^\d+\s*\/\s*\d+$/.test(line)) return false;
    if (/^[·•\-=_]{3,}$/.test(line)) return false;
    if (/^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(line)) return false;
    return true;
  });

  return filtered.join('\n').trim();
}

export function postProcessExtractedText(text) {
  return removeNoiseLines(text)
    .replace(/\n{2,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
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

export function buildPreprocessPrompt(contractType) {
  const basePrompt = PROMPT_TEMPLATE(contractType);

  return `${basePrompt}\n\n추가 규칙:\n- OCR 노이즈처럼 보이는 반복 문자, 페이지 번호, 머리말/꼬리말은 제외하세요.\n- 줄바꿈이 깨져 있어도 조항 단위로 자연스럽게 복원하세요.\n- 근거가 약한 추정은 줄이고, 확실한 위험 조항 위주로 답하세요.`;
}

export async function testGeminiConnection() {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey.trim(),
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: '반드시 한 단어 OK만 출력하세요.' },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 429) {
      throw new Error('Gemini 요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도하세요.');
    }
    throw new Error(`Gemini 테스트 오류 ${response.status}: ${errText.slice(0, 120)}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
}

export function normalizeContractAnalysisText(text) {
  return postProcessExtractedText(text);
}

export function compareAnalysisResults(beforeResult, afterResult) {
  const beforeItems = Array.isArray(beforeResult?.items) ? beforeResult.items : [];
  const afterItems = Array.isArray(afterResult?.items) ? afterResult.items : [];

  return {
    beforeCount: beforeItems.length,
    afterCount: afterItems.length,
    beforeRiskCount: beforeItems.filter((item) => item?.level === 'danger').length,
    afterRiskCount: afterItems.filter((item) => item?.level === 'danger').length,
    beforeSummary: beforeResult?.summary ?? '',
    afterSummary: afterResult?.summary ?? '',
  };
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
  promptOverride = null,
) => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const body = {
    contents: [
      {
        parts: [
          { text: promptOverride ?? PROMPT_TEMPLATE(contractType) },
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

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey.trim() // <-- 여기에 API 키를 숨겨서 보냅니다!
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 429) {
      throw new Error('Gemini API 요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도하세요.');
    }
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
