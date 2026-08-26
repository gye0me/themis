// src/services/caseAssistantService.js
//
// "하단 질문창" AI 답변 서비스 — 대응 퀘스트(ResponseGuideScreen) 화면 하단에서
// 사용자가 자유 텍스트로 질문하면, 진행 중인 사건 유형(전세사기/금전사기/괴롭힘/신변위협)과
// 현재 보고 있는 퀘스트 단계를 문맥으로 넣어 Gemini에게 답변을 받아온다.
//
// responseGuideSteps.js(퀘스트 데이터) / geminiService.js(계약서 분석 프롬프트)의 자매 모듈.
// lawApiService.js(법제처 Open API)에서 사건 유형별 핵심 법령의 최신 정보를 조회해
// 답변 근거로 함께 붙인다.

import { searchLaw, formatLawContext } from './lawApiService';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

// ─── 1. 공통 답변 규칙 ───────────────────────────────────────────────────────

const COMMON_RULES = `
[답변 규칙]
* 한국어로, 3~5문장 이내로 간결하게 답변하세요.
* 마크다운 기호(*, #, ** 등)나 목록 기호 없이 자연스러운 문장으로 답변하세요.
* 확실하지 않은 사실은 단정하지 말고 "~일 가능성이 있습니다", "~를 확인해 보세요"처럼 표현하세요.
* 관련 법령·기관·연락처가 있다면 구체적으로 언급하세요.
* [국가법령정보센터 최신 조회 결과]가 주어지면 그 시행일자·소관부처 정보를 답변에 자연스럽게 반영하세요.
* 이 답변은 법률 자문이 아닌 참고 정보이며, 정확한 판단은 변호사·법률구조공단 등 전문가 상담이 필요함을 답변 끝에 짧게 덧붙이세요.
* 사용자가 겪는 상황에 공감하는 태도를 유지하되, 불필요한 위로 문구로 답변을 늘리지 마세요.`.trim();

const URGENT_SAFETY_NOTE = `
* 질문 내용에서 신체적 위험이 임박했다고 판단되면, 다른 안내보다 먼저 "지금 즉시 112에 신고하세요"를 답변 첫 문장에 넣으세요.`.trim();

// ─── 2. 사건 유형별 전문 프롬프트 (시스템 지시문) ────────────────────────────

const CASE_ASSISTANT_PROMPTS = {
  전세사기: `
당신은 주택임대차보호법과 전세사기 피해 구제 절차에 정통한 법률 상담 도우미입니다.
사용자는 전세사기(보증금 미반환, 매매사기, 불공정계약 등) 피해를 겪고 있으며,
현재 대응 퀘스트를 단계별로 진행하는 중입니다.

[핵심 지식]
- 주택임대차보호법상 대항력·우선변제권, 확정일자·전입신고
- 등기부등본 열람(iros.go.kr), 임차권등기명령
- 내용증명 발송 절차와 효력
- 전세사기피해자 지원 특별법(HUG 전세보증금반환보증, 피해자 인정 절차)
- 법률구조공단(국번없이 132) 무료 상담, 소액심판(3,000만원 이하)
- 형사고소(사기죄) vs 민사소송(보증금반환청구)의 차이

${COMMON_RULES}
`.trim(),

  금전사기: `
당신은 사기죄 형사절차와 온라인·금전 거래 사기 피해 구제에 정통한 법률 상담 도우미입니다.
사용자는 금전·거래 사기(중고거래 사기, 보이스피싱, 온라인쇼핑 사기 등) 피해를 겪고 있으며,
현재 대응 퀘스트를 단계별로 진행하는 중입니다.

[핵심 지식]
- 경찰청 사이버수사대 신고(ecrm.police.go.kr), 112
- 피해 계좌 지급정지 신청 절차(은행 콜센터 또는 경찰 신고 직후 요청)
- 통신사기피해환급법에 따른 피해금 환급 절차
- 법률구조공단(132) 무료 상담, 소액심판(3,000만원 이하)
- 형사고소장 작성 시 필요한 증거(거래내역, 대화 캡처, 계좌정보)

${COMMON_RULES}
`.trim(),

  괴롭힘: `
당신은 근로기준법상 직장 내 괴롭힘, 학교폭력예방법, 임금체불 구제 절차에 정통한 법률 상담 도우미입니다.
사용자는 괴롭힘·폭력(직장 내 괴롭힘, 학교폭력, 임금체불 등) 피해를 겪고 있으며,
현재 대응 퀘스트를 단계별로 진행하는 중입니다.

[핵심 지식]
- 근로기준법 제76조의2(직장 내 괴롭힘 금지), 고용노동부 진정(minwon.moel.go.kr), 국번없이 1350
- 학교폭력예방법상 학교폭력대책심의위원회 절차, 117 신고
- 임금체불 시 고용노동부 진정 → 체불임금 확인원 발급 → 소액체당금 신청
- 국가인권위원회 진정(1331)
- 진술서·증거(문자, 녹음, 목격자 진술) 정리 방법

${COMMON_RULES}
`.trim(),

  신변위협: `
당신은 스토킹범죄처벌법, 접근금지가처분, 피해자 보호 절차에 정통한 법률 상담 도우미입니다.
사용자는 신변 위협(스토킹, 협박, 데이트폭력 등) 피해를 겪고 있으며,
현재 대응 퀘스트를 단계별로 진행하는 중입니다.

[핵심 지식]
- 스토킹범죄의 처벌 등에 관한 법률에 따른 고소·긴급응급조치·잠정조치
- 접근금지가처분 신청 절차
- 112(긴급), 여성긴급전화 1366(피해자 지원·보호시설 연계)
- 경찰서 방문 신고 시 준비할 증거(문자, 녹음, CCTV)
- 법률구조공단(132) 무료 상담

${COMMON_RULES}
${URGENT_SAFETY_NOTE}
`.trim(),
};

const CASE_ASSISTANT_PROMPT_FALLBACK = `
당신은 한국 법률 상담 도우미입니다. 사용자의 사건 대응을 돕기 위해 질문에 답변하세요.

${COMMON_RULES}
`.trim();

export function getCaseAssistantPrompt(caseType) {
  return CASE_ASSISTANT_PROMPTS[caseType] ?? CASE_ASSISTANT_PROMPT_FALLBACK;
}

// ─── 2-1. 사건 유형별 핵심 법령 (법제처 Open API 조회용) ─────────────────────
// 질문마다 자유 키워드로 검색하면 결과가 들쑥날쑥해서, 유형당 핵심 법령 1~2개를
// 고정으로 조회해 "최신 시행일자·소관부처"를 근거로 붙이는 방식을 쓴다.

const CASE_TYPE_LAW_QUERIES = {
  전세사기: ['주택임대차보호법'],
  금전사기: ['통신사기피해환급법'],
  괴롭힘: ['근로기준법'],
  신변위협: ['스토킹범죄의 처벌 등에 관한 법률'],
};

/**
 * 사건 유형에 매핑된 핵심 법령을 법제처 API로 조회해 프롬프트용 컨텍스트 문자열로 만든다.
 * API 실패 시에도 AI 답변 자체는 계속 진행되도록 빈 문자열을 반환한다.
 */
async function getLawContext(caseType) {
  const queries = CASE_TYPE_LAW_QUERIES[caseType];
  if (!queries) return '';

  try {
    const results = await Promise.all(queries.map((q) => searchLaw(q, 1)));
    const laws = results.flat();
    return formatLawContext(laws);
  } catch (err) {
    console.warn('법령 컨텍스트 조회 실패:', err.message);
    return '';
  }
}

// ─── 3. 질문 프롬프트 조립 (사건 유형 + 현재 퀘스트 단계 문맥 + 사용자 질문) ────

/**
 * @param {string} caseType   - '전세사기' | '금전사기' | '괴롭힘' | '신변위협'
 * @param {object} questStep  - 현재 화면에 열려 있는 퀘스트 단계 (선택)
 *   { title, requiredDocs, duration }
 * @param {string} question   - 사용자가 하단 질문창에 입력한 질문
 * @param {string} [lawContext] - lawApiService에서 조회한 법령 컨텍스트 (선택)
 */
export function buildCaseAssistantPrompt(caseType, questStep, question, lawContext = '') {
  const systemPrompt = getCaseAssistantPrompt(caseType);

  const contextLines = [];
  if (questStep?.title) {
    contextLines.push(`- 현재 진행 단계: ${questStep.title}`);
  }
  if (questStep?.requiredDocs) {
    contextLines.push(`- 필요 서류: ${questStep.requiredDocs}`);
  }
  if (questStep?.duration) {
    contextLines.push(`- 예상 소요 기간: ${questStep.duration}`);
  }

  const contextBlock = contextLines.length
    ? `\n[사용자가 보고 있는 화면 정보]\n${contextLines.join('\n')}\n`
    : '';

  const lawBlock = lawContext ? `\n${lawContext}\n` : '';

  return `${systemPrompt}
${contextBlock}${lawBlock}
[사용자 질문]
${question.trim()}`;
}

// ─── 4. JSON이 아닌 순수 텍스트 응답 정리 ────────────────────────────────────
//
// [답변 규칙]에서 마크다운을 쓰지 말라고 지시해도 모델이 종종 헤더(#), 굵게(**),
// 목록 기호(-, *, 1.)를 섞어 보내는 경우가 있어, 화면에 자연스러운 문장으로
// 보이도록 후처리로 한 번 더 벗겨낸다.
function cleanAnswerText(text) {
  return text
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/```/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 응답이 토큰 한도(MAX_TOKENS)에 걸려 문장 중간에서 잘린 경우, 어색하게 끊긴
// 마지막 반쪽 문장을 버리고 마지막으로 완결된 문장까지만 보여준다.
function trimIncompleteTrailingSentence(text) {
  const lastEnd = Math.max(text.lastIndexOf('.'), text.lastIndexOf('다'), text.lastIndexOf('요'));
  // 끊긴 부분이 전체 답변의 극히 일부라면(문장 하나도 못 만든 경우) 원문을 그대로 둔다.
  if (lastEnd <= 0 || lastEnd < text.length * 0.4) return text;
  return text.slice(0, lastEnd + 1).trim();
}

// ─── 5. 메인 공개 함수 ──────────────────────────────────────────────────────

/**
 * 하단 질문창 AI 질의응답.
 *
 * @param {object} params
 * @param {string} params.caseType   - '전세사기' | '금전사기' | '괴롭힘' | '신변위협'
 * @param {object} [params.questStep] - 현재 퀘스트 단계 컨텍스트 (선택)
 * @param {string} params.question   - 사용자 질문
 * @returns {Promise<string>} AI 답변 텍스트
 */
export async function askCaseAssistant({ caseType, questStep = null, question }) {
  const trimmed = (question ?? '').trim();
  if (!trimmed) {
    throw new Error('질문 내용을 입력해주세요.');
  }

  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const lawContext = await getLawContext(caseType);
  const prompt = buildCaseAssistantPrompt(caseType, questStep, trimmed, lawContext);

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      // 3~5문장이라도 사건 설명 + 법령 컨텍스트가 붙으면 512 토큰으로는 문장 중간에
      // 잘리는 경우가 잦아(finishReason: MAX_TOKENS) "오류처럼 보이는" 반쪽 답변이
      // 나갔다. 여유를 두어 실제로 답이 끝까지 나오도록 한다.
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let response;
  try {
    response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error('AI 서버에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.', { cause: err });
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 429) {
      throw new Error('AI 요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도하세요.');
    }
    throw new Error(`AI 질문 오류 ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const rawText = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

  if (!rawText) {
    // 후보 자체가 없거나(candidates 빈 배열) 안전 필터에 걸려 텍스트 없이 차단된 경우
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason || candidate?.finishReason === 'SAFETY') {
      throw new Error('안전 정책으로 인해 답변을 생성하지 못했습니다. 표현을 바꿔 다시 질문해 주세요.');
    }
    throw new Error('AI가 답변을 생성하지 못했습니다. 다시 시도해주세요.');
  }

  const cleaned = cleanAnswerText(rawText);
  return candidate?.finishReason === 'MAX_TOKENS' ? trimIncompleteTrailingSentence(cleaned) : cleaned;
}