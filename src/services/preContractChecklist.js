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

/**
 * id: 고유 키(변경 금지, Firestore에 그대로 저장됨)
 * title: 체크리스트 항목 제목
 * description: 왜/어떻게 확인하는지
 * legalBasis: 관련 법령/제도 (선택)
 * severity: 이 항목을 건너뛸 때의 위험도 참고용 ('critical' | 'high' | 'medium')
 */
export const PRE_CONTRACT_CHECKLIST_ITEMS = [
  {
    id: 'registry_owner_match',
    title: '등기부등본 열람 · 임대인=소유자 확인',
    description:
      '계약 직전(가급적 계약 당일)에 등기부등본을 열람해, 계약서에 적힌 임대인 이름이 갑구의 실제 소유자와 일치하는지 확인하세요. 대리인이라면 소유자 본인의 위임장·인감증명서까지 확인해야 합니다.',
    legalBasis: '공인중개사법 제25조(중개대상물 확인·설명 의무)',
    severity: 'critical',
  },
  {
    id: 'registry_liens',
    title: '근저당권·가압류 등 권리관계 확인',
    description:
      '등기부등본 을구에서 근저당권, 가압류, 전세권 등 선순위 권리를 확인하세요. (전세보증금 + 선순위 채권) 합계가 매매 시세에 가까울수록 위험합니다.',
    severity: 'critical',
  },
  {
    id: 'tax_delinquency_check',
    title: '임대인 국세·지방세 완납증명 확인',
    description:
      '임차인은 계약 전 임대인에게 국세·지방세 미납 여부 열람에 동의해 달라고 요구할 수 있습니다(2023년 개정). 세금이 밀려 있으면 경매 시 보증금보다 세금이 먼저 변제됩니다.',
    legalBasis: '주택임대차보호법 제3조의6, 국세징수법 제109조',
    severity: 'critical',
  },
  {
    id: 'jeonse_ratio_check',
    title: '전세가율(보증금/시세) 확인',
    description:
      '계약서 분석 화면의 "전세가율 계산"으로 같은 건물의 최근 매매 시세 대비 보증금 비율을 확인하세요. 80% 이상이면 집값이 조금만 떨어져도 보증금을 못 돌려받을 위험이 커집니다.',
    severity: 'high',
  },
  {
    id: 'building_register_check',
    title: '건축물대장 확인(불법건축물 여부)',
    description:
      '정부24 등에서 건축물대장을 열람해 위반건축물로 등재되어 있지 않은지 확인하세요. 위반건축물은 전세보증금 반환보증 가입이 거절될 수 있습니다.',
    severity: 'medium',
  },
  {
    id: 'insurance_eligibility',
    title: '전세보증금 반환보증 가입 가능 여부 확인',
    description:
      'HUG(주택도시보증공사) 또는 SGI서울보증에서 반환보증 가입 조건(전세가율, 선순위 채권 등)에 해당하는지 계약 전에 미리 확인하세요. 계약 후에는 가입이 거절돼도 되돌릴 수 없습니다.',
    severity: 'high',
  },
  {
    id: 'move_in_report_same_day',
    title: '잔금일 = 전입신고 + 확정일자 당일 처리 계획',
    description:
      '잔금을 치르는 날 바로 전입신고와 확정일자를 받아야 대항력이 다음 날 0시부터 발생합니다. 임대인이 "며칠 후에 하라"고 요구하면 그 사이 근저당이 설정될 위험이 있으니 거절하세요.',
    legalBasis: '주택임대차보호법 제3조',
    severity: 'critical',
  },
  {
    id: 'deposit_account_owner_match',
    title: '계약금·보증금 입금 계좌 명의 확인',
    description:
      '입금할 계좌의 예금주가 등기부등본상 소유자(또는 정당한 대리인) 명의와 일치하는지 반드시 확인하세요. 공인중개사나 제3자 명의 계좌로 입금하라는 요구는 전형적인 사기 수법입니다.',
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
 * @param {Array<{id: string, completed: boolean, checkedAt?: any}>} savedItems
 */
export function mergePreContractChecklist(savedItems = []) {
  const savedMap = new Map((savedItems ?? []).map((item) => [item.id, item]));
  return PRE_CONTRACT_CHECKLIST_ITEMS.map((def) => {
    const saved = savedMap.get(def.id);
    return { ...def, completed: Boolean(saved?.completed), checkedAt: saved?.checkedAt ?? null };
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
 * 완료 개수/전체/퍼센트 + 미완료 항목 중 severity가 'critical'인 것이 있는지 계산.
 */
export function getPreContractProgress(items) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const hasUncheckedCritical = items.some((item) => !item.completed && item.severity === 'critical');
  return { completed, total, percent, label: `${completed} / ${total} 확인 완료`, hasUncheckedCritical };
}
