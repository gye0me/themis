// src/services/preContractChecklist.js
//
// "계약 전 필수 확인 체크리스트" — 전세사기 등 피해를 막기 위해 계약서에 도장 찍기 *전에*
// 임차인이 직접 확인/행동해야 하는 항목들이다.
//
// requiredClauseChecklist.js(계약서 "문구"에 특정 조항이 있는지)와는 목적이 다르다:
// 이건 계약서 밖에서 하는 행동(등기부등본 열람, 전입세대 열람 등)에 대한 체크리스트라
// AI가 문서를 읽고 자동 판정할 수 없다 — 사용자가 직접 확인하고 체크하는 방식.
//
// 이 파일은 순수 로직만 담당한다 (UI 없음).

// 화면에서 항목을 묶어 보여주는 단계 (진행 순서대로)
export const PRE_CONTRACT_STAGES = [
  { id: 'landlord', title: '집주인 확인' },
  { id: 'property', title: '집 상태 확인' },
  { id: 'payment', title: '돈 보내는 날' },
];

/**
 * id: 고유 키(변경 금지, Firestore에 그대로 저장됨)
 * stage: PRE_CONTRACT_STAGES의 id
 * title: 체크리스트 항목 제목
 * summary: 무엇을 확인하는지 한 줄 (항상 보임)
 * description: 왜/어떻게 확인하는지 (펼쳤을 때 보임)
 * legalBasis: 관련 법령/제도 (선택)
 * severity: 이 항목을 건너뛸 때의 위험도 참고용 ('critical' | 'high' | 'medium')
 * mergedIds: 이 항목으로 합쳐진 예전 항목 id (선택, 저장된 체크 상태를 이어받을 때만 쓴다)
 */
export const PRE_CONTRACT_CHECKLIST_ITEMS = [
  {
    id: 'registry_owner_match',
    stage: 'landlord',
    title: '임대인 = 등기부 소유자',
    summary: '신분증 이름과 등기부등본 갑구의 소유자가 같은지 확인',
    description:
      '등기부등본은 계약 직전(가급적 계약 당일)에 열람하세요. 대리인과 계약한다면 소유자 본인의 위임장과 인감증명서까지 받아야 합니다.',
    legalBasis: '공인중개사법 제25조(중개대상물 확인·설명 의무)',
    severity: 'critical',
  },
  {
    id: 'tax_delinquency_check',
    stage: 'landlord',
    title: '임대인 세금 체납 여부',
    summary: '국세·지방세 납세증명서를 보여달라고 요구',
    description:
      '세금이 밀려 있으면 경매 시 보증금보다 세금이 먼저 변제됩니다. 임차인은 계약 전 납세증명서 제시를 요구하거나 미납 내역 열람 동의를 받을 수 있습니다.',
    legalBasis: '주택임대차보호법 제3조의7, 국세징수법 제109조',
    severity: 'critical',
  },
  {
    id: 'registry_liens',
    stage: 'property',
    title: '근저당·가압류와 전세가율',
    summary: '(보증금 + 선순위 채권)이 시세의 80% 미만인지 확인',
    description:
      '등기부등본 을구에서 근저당권, 가압류, 전세권 등 선순위 권리를 확인하세요. 시세는 계약서 분석 화면의 "전세가율 위험도 체크"로 볼 수 있습니다. 비율이 높을수록 집값이 조금만 떨어져도 보증금을 못 돌려받을 수 있습니다.',
    severity: 'critical',
    mergedIds: ['jeonse_ratio_check'],
  },
  {
    id: 'building_register_check',
    stage: 'property',
    title: '건축물대장 위반 여부',
    summary: '위반건축물로 등재되어 있지 않은지 확인',
    description: '계약서 분석 화면의 "건물 확인"이나 정부24에서 건축물대장을 열람할 수 있습니다.',
    severity: 'medium',
  },
  {
    id: 'insurance_eligibility',
    stage: 'property',
    title: '보증금 반환보증 가입 가능 여부',
    summary: 'HUG·HF·SGI 가입 조건에 맞는지 계약 전에 확인',
    description:
      '전세가율이 높거나 선순위 채권이 많거나 위반건축물이면 가입이 거절될 수 있습니다. 계약 후에는 거절돼도 되돌릴 수 없습니다.',
    severity: 'high',
  },
  {
    id: 'deposit_account_owner_match',
    stage: 'payment',
    title: '입금 계좌 = 소유자 명의',
    summary: '계약금·보증금 계좌의 예금주가 소유자인지 확인',
    description: '공인중개사나 제3자 명의 계좌로 입금하라는 요구는 전형적인 사기 수법입니다.',
    severity: 'critical',
  },
  {
    id: 'move_in_report_same_day',
    stage: 'payment',
    title: '잔금일에 전입신고 + 확정일자',
    summary: '잔금 치르는 날 바로 처리하도록 계획',
    description:
      '대항력은 전입신고 다음 날 0시부터 생깁니다. 임대인이 "며칠 후에 하라"고 요구하면 그 사이 근저당이 설정될 위험이 있으니 거절하세요.',
    legalBasis: '주택임대차보호법 제3조',
    severity: 'critical',
  },
];

/**
 * 저장/불러오기용 초기 상태를 만든다. (completed: false, checkedAt: null)
 */
export function buildInitialPreContractChecklist() {
  return PRE_CONTRACT_CHECKLIST_ITEMS.map((def) => ({
    id: def.id,
    completed: false,
    checkedAt: null,
  }));
}

/**
 * 저장된 완료 상태(items)를 정의(PRE_CONTRACT_CHECKLIST_ITEMS)와 합쳐 화면에 뿌릴 수 있는
 * 형태로 만든다. 저장된 값이 없거나 새 항목이 추가된 경우에도 안전하게 병합된다.
 * 합쳐진 예전 항목(mergedIds)이 미완료로 저장돼 있으면, 아직 확인 안 한 내용이 포함된 것이므로 미완료로 둔다.
 * @param {Array<{id: string, completed: boolean, checkedAt?: any}>} savedItems
 */
export function mergePreContractChecklist(savedItems = []) {
  const savedMap = new Map((savedItems ?? []).map((item) => [item.id, item]));
  return PRE_CONTRACT_CHECKLIST_ITEMS.map((def) => {
    const saved = savedMap.get(def.id);
    const mergedDone = (def.mergedIds ?? []).every((id) => savedMap.get(id)?.completed !== false);
    const completed = Boolean(saved?.completed) && mergedDone;
    return { ...def, completed, checkedAt: completed ? saved?.checkedAt ?? null : null };
  });
}

/**
 * 항목 완료 상태를 토글한다. (화면에서 쓰는 병합된 형태 기준)
 */
export function togglePreContractItem(items, id) {
  return items.map((item) =>
    item.id === id
      ? { ...item, completed: !item.completed, checkedAt: !item.completed ? new Date() : null }
      : item
  );
}

/**
 * Firestore에 저장할 최소 형태로 변환한다 (정의 내용은 다시 저장하지 않고 완료 상태만).
 */
export function toSavablePreContractChecklist(items) {
  return items.map((item) => ({ id: item.id, completed: item.completed, checkedAt: item.checkedAt }));
}

/**
 * 완료 개수/전체/퍼센트 + 미완료 항목 중 severity가 'critical'인 것의 개수를 계산.
 */
export function getPreContractProgress(items) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const uncheckedCritical = items.filter((item) => !item.completed && item.severity === 'critical').length;
  return { completed, total, percent, label: `${completed} / ${total} 확인 완료`, uncheckedCritical };
}

/**
 * 항목을 단계별로 묶는다. 화면에서 단계 제목과 단계별 완료 개수를 함께 보여줄 때 쓴다.
 */
export function groupPreContractItems(items) {
  return PRE_CONTRACT_STAGES.map((stage) => {
    const stageItems = items.filter((item) => item.stage === stage.id);
    return {
      ...stage,
      items: stageItems,
      completed: stageItems.filter((item) => item.completed).length,
      total: stageItems.length,
    };
  });
}
