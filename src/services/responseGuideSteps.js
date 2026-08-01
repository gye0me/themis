// src/services/responseGuideSteps.js
//
// "피해 유형별 대응 퀘스트" 로직 (전세사기 / 금전사기 / 괴롭힘 / 신변위협).
// requiredClauseChecklist.js(계약 조항 체크리스트)와 같은 패턴을 따르는 자매 모듈.
// 이 파일은 순수 로직 + 데이터만 담당한다 (UI 없음).

// ─── 1. 사건 유형 정의 (NewCaseScreen 선택 UI에서 사용) ─────────────────────

export const CASE_TYPES = ['전세사기', '금전사기', '괴롭힘', '신변위협'];

export const CASE_TYPE_META = {
  전세사기: { icon: '🏠', label: '전세사기 · 계약피해', desc: '보증금 미반환, 매매사기, 불공정계약 등' },
  금전사기: { icon: '💸', label: '금전·거래 사기', desc: '중고거래, 보이스피싱, 온라인쇼핑 사기 등' },
  괴롭힘: { icon: '👥', label: '괴롭힘·폭력', desc: '직장내괴롭힘, 학교폭력, 임금체불 등' },
  신변위협: { icon: '🚨', label: '신변 위협', desc: '스토킹, 협박, 데이트폭력 등' },
};

// ─── 2. 유형별 대응 퀘스트 단계 정의 ─────────────────────────────────────────
// id: 고유 키 (저장/매칭용, 변경 금지)
// title: 퀘스트 제목
// requiredDocs: 필요 서류
// duration: 소요 기간
// link / phone: 참고 링크 또는 연락처 (선택)

export const RESPONSE_STEPS = {
  전세사기: [
    { id: 'jeonse_evidence', title: '증거 수집', requiredDocs: '계약서, 거래 내역, 문자·통화 녹음', duration: '즉시' },
    { id: 'jeonse_deungibu', title: '등기부등본 열람', requiredDocs: '주소 정보', duration: '즉시', link: 'iros.go.kr' },
    { id: 'jeonse_naeyongjeungmyeong', title: '내용증명 발송', requiredDocs: '신분증, 계약서 사본, 내용증명 문서', duration: '1~2일' },
    { id: 'jeonse_lawcenter', title: '법률구조공단 무료 상담', requiredDocs: '신분증, 관련 서류', duration: '당일~1주', phone: '132' },
    { id: 'jeonse_police', title: '경찰 신고', requiredDocs: '신분증, 증거자료', duration: '당일' },
    { id: 'jeonse_sosaek', title: '소액심판 신청 (3,000만원 이하)', requiredDocs: '신분증, 계약서, 내용증명 사본, 소장', duration: '수개월', link: 'ecfs.scourt.go.kr' },
  ],

  금전사기: [
    { id: 'money_evidence', title: '증거 수집', requiredDocs: '거래 내역, 대화 캡처, 계좌 정보', duration: '즉시' },
    { id: 'money_police', title: '경찰 신고', requiredDocs: '신분증, 증거자료', duration: '당일', link: 'ecrm.police.go.kr' },
    { id: 'money_cyber', title: '사이버수사대 접수', requiredDocs: '거래 내역, 캡처 자료', duration: '당일', link: 'ecrm.police.go.kr' },
    { id: 'money_freeze', title: '계좌 지급정지 신청', requiredDocs: '신분증, 피해 계좌 정보', duration: '즉시' },
    { id: 'money_lawcenter', title: '법률구조공단 상담', requiredDocs: '신분증, 관련 서류', duration: '당일~1주', phone: '132' },
    { id: 'money_sosaek', title: '소액심판 신청 (3,000만원 이하)', requiredDocs: '신분증, 거래 내역, 소장', duration: '수개월', link: 'ecfs.scourt.go.kr' },
  ],

  괴롭힘: [
    { id: 'harass_record', title: '날짜·내용 기록', requiredDocs: '메모장 또는 앱 기록', duration: '즉시' },
    { id: 'harass_evidence', title: '증거 수집', requiredDocs: '문자·녹음·사진·목격자 진술', duration: '즉시' },
    { id: 'harass_statement', title: '진술서 작성', requiredDocs: '시간순 상세 기록', duration: '1~2일' },
    { id: 'harass_report', title: '신고 (직장내괴롭힘·임금체불 1350 / 학교폭력 117)', requiredDocs: '신분증, 진술서, 증거자료', duration: '당일', phone: '1350 / 117' },
    { id: 'harass_moel', title: '고용노동부 진정 (임금체불·부당해고)', requiredDocs: '신분증, 근로계약서, 임금명세서', duration: '수주~수개월', link: 'minwon.moel.go.kr' },
    { id: 'harass_lawcenter', title: '법률구조공단 상담', requiredDocs: '신분증, 관련 서류', duration: '당일~1주', phone: '132' },
    { id: 'harass_nhrc', title: '국가인권위원회 진정', requiredDocs: '신분증, 진술서, 증거자료', duration: '수개월', phone: '1331' },
  ],

  신변위협: [
    { id: 'threat_112', title: '즉시 112 신고', requiredDocs: '위험 상황 시 즉시', duration: '즉시', phone: '112' },
    { id: 'threat_evidence', title: '증거 수집', requiredDocs: '문자·녹음·CCTV 영상', duration: '즉시' },
    { id: 'threat_police_visit', title: '경찰서 방문 신고 (스토킹처벌법 고소 가능)', requiredDocs: '신분증, 증거자료', duration: '당일' },
    { id: 'threat_lawcenter', title: '법률구조공단 상담', requiredDocs: '신분증, 관련 서류', duration: '당일~1주', phone: '132' },
    { id: 'threat_injunction', title: '접근금지 가처분 신청', requiredDocs: '신분증, 고소장 사본, 증거자료', duration: '수주~수개월' },
    { id: 'threat_support', title: '피해자 지원 기관 연계 (여성긴급전화)', requiredDocs: '-', duration: '즉시', phone: '1366' },
  ],
};

const RESPONSE_STEPS_FALLBACK = RESPONSE_STEPS['전세사기'];

export function getResponseSteps(caseType) {
  return RESPONSE_STEPS[caseType] ?? RESPONSE_STEPS_FALLBACK;
}

// ─── 3. 퀘스트 리스트 빌드 (저장된 진행 상태와 병합) ─────────────────────────
//
// savedSteps: Firestore에 저장돼 있던 이전 상태 배열
//   [{ id, completed, note }]
// 정의(definitions)를 기준으로 화면에 뿌릴 수 있는 퀘스트 아이템 리스트를 만든다.

export function buildQuestSteps(caseType, savedSteps = []) {
  const definitions = getResponseSteps(caseType);
  const savedMap = new Map();
  (Array.isArray(savedSteps) ? savedSteps : []).forEach((s) => {
    if (s && typeof s.id === 'string') savedMap.set(s.id, s);
  });

  const items = definitions.map((def) => {
    const saved = savedMap.get(def.id);
    return {
      id: def.id,
      title: def.title,
      requiredDocs: def.requiredDocs ?? null,
      duration: def.duration ?? null,
      link: def.link ?? null,
      phone: def.phone ?? null,
      completed: Boolean(saved?.completed),
      note: saved?.note ?? '', // 사용자가 기록한 질문/메모
    };
  });

  return { items, progress: getQuestProgress(items) };
}

// ─── 4. 퀘스트 상태 변경 ──────────────────────────────────────────────────

export function toggleQuestStepCompleted(items, id) {
  return items.map((item) =>
    item.id === id ? { ...item, completed: !item.completed } : item
  );
}

/**
 * 퀘스트 카드 안 질문/메모 기록 저장. 화면단에서 값을 바꿀 때마다 호출하고,
 * 리턴된 items를 그대로 firebaseService.saveCaseQuestSteps(caseId, items)에 넘겨 저장한다.
 */
export function updateQuestStepNote(items, id, note) {
  return items.map((item) =>
    item.id === id ? { ...item, note } : item
  );
}

export function getQuestProgress(items) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent, label: `${completed} / ${total} 완료` };
}