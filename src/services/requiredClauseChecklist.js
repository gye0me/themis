// src/services/requiredClauseChecklist.js
//
// "필수 조항 체크리스트" 로직
// geminiService.js가 찾는 "위험/주의 조항"과 반대로, 계약서에 반드시 있어야 하는
// 법정·보호 조항이 실제로 있는지 확인하는 퀘스트형 체크리스트를 만든다.
//
// 이 파일은 순수 로직만 담당한다 (UI 없음, Gemini 호출 없음).
// Gemini 프롬프트/호출은 이후 합칠 예정이므로,
// 그 결과를 아래 스키마 형태의 JSON으로 받는다고 가정하고
// 그것을 정규화하는 함수임.

// ─── 1. 계약 유형별 필수 조항 정의 ──────────────────────────────────────────
// id: 고유 키 (Gemini 응답 매칭용, 변경 금지)
// title: 화면에 표시할 짧은 라벨 (스크린샷의 퀘스트 제목 자리)
// description: 왜 필요한지 한 줄 설명
// legalBasis: 근거 법령 (선택, 있으면 표시)
// keywords: 로컬 폴백 매칭에 쓰는 키워드 후보 (OR 매칭)

export const REQUIRED_CLAUSES = {
  전월세: [
    {
      id: 'jeontae_hwakjeongilja',
      title: '확정일자·전입신고 안내',
      description: '대항력·우선변제권 확보를 위해 확정일자·전입신고 관련 안내가 있어야 합니다.',
      legalBasis: '주택임대차보호법 제3조의2',
      keywords: ['확정일자', '전입신고'],
    },
    {
      id: 'jeontae_boyjeungeum_banhwan',
      title: '보증금 반환 시기 명시',
      description: '퇴거 후 보증금을 언제 돌려받는지 구체적인 기한이 적혀 있어야 합니다.',
      legalBasis: '주택임대차보호법 제3조의2',
      keywords: ['보증금 반환', '보증금을 반환', '반환한다', '반환일'],
    },
    {
      id: 'jeontae_gwolli_gojirul',
      title: '권리관계(근저당·체납세금) 고지',
      description: '근저당권, 세금 체납 여부 등 임대인의 권리관계 정보가 고지되어야 합니다.',
      legalBasis: '공인중개사법 제25조',
      keywords: ['근저당', '체납', '권리관계', '등기부등본'],
    },
    {
      id: 'jeontae_gaengsin_cheonggu',
      title: '계약갱신청구권 관련 조항',
      description: '임차인의 2년 계약갱신청구권을 제한하지 않는지 확인이 필요합니다.',
      legalBasis: '주택임대차보호법 제6조의3',
      keywords: ['갱신청구', '계약갱신', '갱신요구'],
    },
    {
      id: 'jeontae_gwanribi',
      title: '관리비 항목·금액 명시',
      description: '관리비로 청구되는 항목과 금액이 특약에 구체적으로 적혀 있어야 합니다.',
      keywords: ['관리비'],
    },
  ],

  매매: [
    {
      id: 'maemae_soyugweon_iju',
      title: '잔금·소유권이전 동시이행 명시',
      description: '잔금 지급과 소유권 이전 등기 신청이 동시에 이루어진다는 조항이 있어야 합니다.',
      legalBasis: '민법 제568조',
      keywords: ['소유권이전', '소유권 이전', '동시이행', '동시 이행'],
    },
    {
      id: 'maemae_geunjeodang_malso',
      title: '근저당 말소 의무 명시',
      description: '잔금 지급 전까지 근저당권 등을 말소한다는 의무가 명시되어야 합니다.',
      keywords: ['말소', '근저당'],
    },
    {
      id: 'maemae_haja_damboe',
      title: '하자 담보책임 조항',
      description: '매도인의 하자 담보책임을 면제하지 않는지 확인이 필요합니다.',
      legalBasis: '민법 제580조',
      keywords: ['하자담보', '하자 담보', '하자보수'],
    },
    {
      id: 'maemae_wiyakgeum_gijun',
      title: '위약금 기준 명시',
      description: '매도인·매수인 쌍방에 동일하게 적용되는 위약금 기준이 있어야 합니다.',
      keywords: ['위약금'],
    },
  ],

  프리랜서: [
    {
      id: 'freelance_daegeum_sigi',
      title: '대금 지급 시기 명시',
      description: '납품 후 며칠 이내 대금을 지급하는지 구체적인 기한이 있어야 합니다.',
      keywords: ['대금 지급', '지급일', '납품 후'],
    },
    {
      id: 'freelance_susjeong_hoesu',
      title: '수정 횟수 제한 명시',
      description: '무한 수정을 막기 위해 수정 요청 가능 횟수가 정해져 있어야 합니다.',
      keywords: ['수정 횟수', '수정요청', '수정 요청'],
    },
    {
      id: 'freelance_seongmyeongpyosigwon',
      title: '저작인격권(성명표시권) 보장',
      description: '결과물에 작업자의 이름을 표시할 권리가 보장되어야 합니다.',
      legalBasis: '저작권법 제12조',
      keywords: ['성명표시권', '저작인격권'],
    },
    {
      id: 'freelance_gyeyak_haeji',
      title: '해지 조건 쌍방 동일',
      description: '발주사만 일방적으로 해지할 수 있는 조항은 아닌지 확인이 필요합니다.',
      keywords: ['해지'],
    },
  ],
};

const REQUIRED_CLAUSES_FALLBACK = REQUIRED_CLAUSES['전월세'];

export function getRequiredClauses(contractType) {
  return REQUIRED_CLAUSES[contractType] ?? REQUIRED_CLAUSES_FALLBACK;
}

// ─── 2. Gemini 응답 스키마 (팀원 프롬프트 작성 시 참고용) ───────────────────
//
// 팀원이 짤 Gemini 프롬프트는 아래 형태의 JSON을 반환하도록 설계하면 된다.
// {
//   "results": [
//     { "id": "jeontae_hwakjeongilja", "found": true,  "evidence": "제5조: 임차인은 확정일자를..." },
//     { "id": "jeontae_boyjeungeum_banhwan", "found": false, "evidence": null }
//   ]
// }
// id 값은 REQUIRED_CLAUSES의 id와 반드시 일치해야 한다.

// ─── 3. Gemini 결과 정규화 + 진행률 계산 ────────────────────────────────────

/**
 * Gemini(또는 다른 소스)가 반환한 원시 결과를 화면에 바로 뿌릴 수 있는
 * 퀘스트 리스트 형태로 정규화한다. found 값이 없는 항목은 미완료로 처리한다.
 *
 * @param {string} contractType - '전월세' | '매매' | '프리랜서'
 * @param {Array<{id: string, found: boolean, evidence?: string}>} rawResults
 * @returns {{ items: Array, progress: {completed: number, total: number, percent: number, label: string} }}
 */
export function buildChecklist(contractType, rawResults = []) {
  const definitions = getRequiredClauses(contractType);
  const resultMap = new Map();
  (Array.isArray(rawResults) ? rawResults : []).forEach((r) => {
    if (r && typeof r.id === 'string') {
      resultMap.set(r.id, r);
    }
  });

  const items = definitions.map((def) => {
    const matched = resultMap.get(def.id);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      legalBasis: def.legalBasis ?? null,
      completed: Boolean(matched?.found),
      evidence: matched?.evidence ?? null,
      source: 'ai', // AI가 자동으로 만든 항목 표시 (사용자 추가 항목과 구분)
    };
  });

  return { items, progress: getChecklistProgress(items) };
}

// ─── 4. 사용자 커스텀 항목 추가/삭제 ────────────────────────────────────────
//
// AI가 자동으로 채운 items 배열은 절대 건드리지 않고, 사용자가 추가한 항목만
// source: 'user'로 뒤에 이어붙인다. 저장은 화면단에서 items 배열 통째로
// Firestore에 넣으면 되고, 다시 불러올 때도 source 필드로 AI/사용자 항목을
// 구분할 수 있으니 재분석해도 사용자 항목은 그대로 유지된다.

let userClauseSeq = 0;

/**
 * 사용자가 직접 추가하는 체크리스트 항목을 만든다.
 * @param {Array} items - buildChecklist(...)의 items (또는 이미 user 항목이 섞인 배열)
 * @param {{ title: string, description?: string }} input
 * @returns {Array} 새 항목이 추가된 items 배열 (원본은 변경하지 않음)
 */
export function addUserClause(items, { title, description = '' }) {
  userClauseSeq += 1;
  const newItem = {
    id: `user_${Date.now()}_${userClauseSeq}`,
    title,
    description,
    legalBasis: null,
    completed: false,
    evidence: null,
    source: 'user',
  };
  return [...items, newItem];
}

/**
 * 사용자 항목만 삭제 가능 (source: 'ai' 항목은 id를 넘겨도 삭제되지 않음 — 실수 방지).
 */
export function removeUserClause(items, id) {
  return items.filter((item) => !(item.id === id && item.source === 'user'));
}

/**
 * 항목 완료 상태 토글 (AI/사용자 항목 공통, 완료 여부는 사용자가 수동으로도 체크 가능하게).
 */
export function toggleClauseCompleted(items, id) {
  return items.map((item) =>
    item.id === id ? { ...item, completed: !item.completed } : item
  );
}

/**
 * 완료 개수/전체/퍼센트/라벨("3 / 5 완료")을 계산한다.
 */
export function getChecklistProgress(items) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent, label: `${completed} / ${total} 완료` };
}

// ─── 5. 로컬 폴백: Gemini 없이 추출 텍스트로 간이 매칭 ──────────────────────
//
// 팀원의 Gemini 프롬프트가 준비되기 전까지, 혹은 API 호출 없이 빠르게
// 프리뷰하고 싶을 때 쓰는 키워드 매칭 폴백. 정확도는 낮으므로
// 실제 서비스에서는 buildChecklist(Gemini 결과)로 교체하는 것을 권장.
//
// @param {string} contractType
// @param {string} extractedText - geminiService의 계약서 분석 결과 중 extractedText
export function buildChecklistFromText(contractType, extractedText = '') {
  const definitions = getRequiredClauses(contractType);
  const text = (extractedText || '').replace(/\s+/g, '');

  const rawResults = definitions.map((def) => {
    const found = def.keywords.some((kw) => text.includes(kw.replace(/\s+/g, '')));
    return { id: def.id, found, evidence: null };
  });

  return buildChecklist(contractType, rawResults);
}