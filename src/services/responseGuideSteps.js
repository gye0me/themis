// src/services/responseGuideSteps.js
//
// "피해 유형별 대응 퀘스트" 로직 (전세사기 / 금전사기 / 괴롭힘 / 신변위협).
// requiredClauseChecklist.js(계약 조항 체크리스트)와 같은 패턴을 따르는 자매 모듈.
// 이 파일은 순수 로직 + 데이터만 담당한다 (UI 없음).

// ─── 1. 사건 유형 정의 (NewCaseScreen 선택 UI에서 사용) ─────────────────────

export const CASE_TYPES = ['전세사기', '금전사기', '괴롭힘', '신변위협', '기타'];

export const CASE_TYPE_META = {
  전세사기: { icon: '🏠', label: '부동산·계약', desc: '전세사기, 보증금, 계약' },
  금전사기: { icon: '💸', label: '금전·거래 사기', desc: '중고거래, 보이스피싱' },
  괴롭힘: { icon: '👥', label: '괴롭힘·폭력', desc: '직장, 학교, 따돌림' },
  신변위협: { icon: '🚨', label: '신변 위협', desc: '스토킹, 협박, 데이트폭력' },
  기타: { icon: '🗂️', label: '기타', desc: '위에 해당 없는 경우 · 항목 직접 추가 가능' },
};

// 기록 시작 화면에서 태그 직접 입력 시 참고용으로 보여주는 추천 태그 (유형 공통 풀)
export const SUGGESTED_TAGS = [
  '#전세', '#월세', '#보증금', '#소비자피해', '#프리랜서', '#직장내괴롭힘', '#학교폭력', '#온라인괴롭힘',
];

// "괴롭힘" 유형은 직장/학교/온라인이 신고 기관·절차가 완전히 달라서 하나의 목록으로 뭉쳐두면
// (예: 1350이랑 117이 같이 뜨는 식으로) 사용자 입장에서 "뭘 봐도 비슷비슷하다"는 문제가 생긴다.
// preventionGuides.js가 이미 같은 3분류(workplace/school/online)로 시나리오를 나눠뒀으므로
// 그 구조를 그대로 따라서 대응 퀘스트도 시나리오별로 분리한다.
const HARASSMENT_TAG_TO_SCENARIO = {
  '#학교폭력': 'school',
  '#온라인괴롭힘': 'online',
  '#직장내괴롭힘': 'workplace',
};

/**
 * 사건의 태그(tags)를 보고 "괴롭힘" 유형의 하위 시나리오를 추론한다.
 * 일치하는 태그가 없으면(사용자가 태그를 안 골랐으면) 가장 흔한 'workplace'를 기본값으로 둔다.
 */
export function inferHarassmentScenario(tags = []) {
  const tagList = Array.isArray(tags) ? tags : [];
  for (const tag of tagList) {
    if (HARASSMENT_TAG_TO_SCENARIO[tag]) return HARASSMENT_TAG_TO_SCENARIO[tag];
  }
  return 'workplace';
}

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

  // "괴롭힘"은 직장/학교/온라인 세 시나리오로 나뉘며, inferHarassmentScenario()가 사건의
  // 태그를 보고 고른 배열이 getResponseSteps('괴롭힘', tags)를 통해 반환된다.
  괴롭힘_workplace: [
    { id: 'harass_work_record', title: '날짜·내용 기록', requiredDocs: '메모장 또는 앱 기록', duration: '즉시' },
    { id: 'harass_work_evidence', title: '증거 수집', requiredDocs: '문자·녹음·메신저·목격자 진술', duration: '즉시' },
    { id: 'harass_work_statement', title: '진술서 작성', requiredDocs: '시간순 상세 기록', duration: '1~2일' },
    { id: 'harass_work_company_report', title: '사내 신고 (인사팀·고충처리위원회)', requiredDocs: '진술서, 증거자료', duration: '당일', phone: '1350' },
    { id: 'harass_work_moel', title: '고용노동부 진정 (직장 내 괴롭힘·임금체불·부당해고)', requiredDocs: '신분증, 근로계약서, 임금명세서', duration: '수주~수개월', link: 'minwon.moel.go.kr' },
    { id: 'harass_work_lawcenter', title: '법률구조공단 상담', requiredDocs: '신분증, 관련 서류', duration: '당일~1주', phone: '132' },
    { id: 'harass_work_nhrc', title: '국가인권위원회 진정', requiredDocs: '신분증, 진술서, 증거자료', duration: '수개월', phone: '1331' },
  ],

  괴롭힘_school: [
    { id: 'harass_school_record', title: '날짜·내용 기록', requiredDocs: '메모장 또는 앱 기록', duration: '즉시' },
    { id: 'harass_school_medical', title: '다친 곳 사진·병원 진단서', requiredDocs: '사진, 진단서', duration: '즉시' },
    { id: 'harass_school_evidence', title: '증거 수집', requiredDocs: '단톡방·SNS 캡처, 목격자 진술', duration: '즉시' },
    { id: 'harass_school_report', title: '117 신고 또는 담임·학교에 신고', requiredDocs: '진술서, 증거자료', duration: '당일', phone: '117' },
    { id: 'harass_school_simui', title: '학교폭력대책심의위원회(학폭위) 개최 요청', requiredDocs: '신고 접수증, 증거자료', duration: '2~3주', link: 'schoolsafety.kr' },
    { id: 'harass_school_wee', title: 'Wee센터 심리 상담 연계', requiredDocs: '없음', duration: '당일~1주' },
    { id: 'harass_school_lawcenter', title: '법률구조공단 상담', requiredDocs: '신분증, 관련 서류', duration: '당일~1주', phone: '132' },
  ],

  괴롭힘_online: [
    { id: 'harass_online_capture', title: '게시물·댓글 캡처 (URL·날짜 포함)', requiredDocs: '스크린샷', duration: '즉시' },
    { id: 'harass_online_account', title: '가해 계정 아이디·프로필 캡처', requiredDocs: '스크린샷', duration: '즉시' },
    { id: 'harass_online_cyber', title: '사이버수사대 신고 (모욕·명예훼손)', requiredDocs: '신분증, 캡처 자료', duration: '당일', link: 'ecrm.police.go.kr' },
    { id: 'harass_online_kocsc', title: '방송통신심의위원회 게시물 삭제 요청', requiredDocs: '게시물 URL, 캡처 자료', duration: '수일~수주', link: 'kocsc.or.kr' },
    { id: 'harass_online_lawcenter', title: '법률구조공단 상담', requiredDocs: '신분증, 관련 서류', duration: '당일~1주', phone: '132' },
  ],

  신변위협: [
    { id: 'threat_112', title: '즉시 112 신고', requiredDocs: '위험 상황 시 즉시', duration: '즉시', phone: '112' },
    { id: 'threat_evidence', title: '증거 수집', requiredDocs: '문자·녹음·CCTV 영상', duration: '즉시' },
    { id: 'threat_police_visit', title: '경찰서 방문 신고 (스토킹처벌법 고소 가능)', requiredDocs: '신분증, 증거자료', duration: '당일' },
    { id: 'threat_lawcenter', title: '법률구조공단 상담', requiredDocs: '신분증, 관련 서류', duration: '당일~1주', phone: '132' },
    { id: 'threat_injunction', title: '접근금지 가처분 신청', requiredDocs: '신분증, 고소장 사본, 증거자료', duration: '수주~수개월' },
    { id: 'threat_support', title: '피해자 지원 기관 연계 (여성긴급전화)', requiredDocs: '-', duration: '즉시', phone: '1366' },
  ],

  기타: [
    { id: 'etc_record', title: '날짜·내용 기록', requiredDocs: '메모장 또는 앱 기록', duration: '즉시' },
    { id: 'etc_evidence', title: '증거 수집', requiredDocs: '문자·녹음·사진 등 관련 자료', duration: '즉시' },
    { id: 'etc_lawcenter', title: '법률구조공단 무료 상담', requiredDocs: '신분증, 관련 서류', duration: '당일~1주', phone: '132' },
    { id: 'etc_police', title: '경찰 신고 (필요 시)', requiredDocs: '신분증, 증거자료', duration: '당일' },
    { id: 'etc_custom', title: '상황에 맞는 대응 항목 직접 추가하기', requiredDocs: '아래 "+ 항목 추가하기"로 나만의 단계를 만들어보세요', duration: '-' },
  ],
};

const RESPONSE_STEPS_FALLBACK = RESPONSE_STEPS['전세사기'];

export function getResponseSteps(caseType, tags = []) {
  if (caseType === '괴롭힘') {
    const scenario = inferHarassmentScenario(tags);
    return RESPONSE_STEPS[`괴롭힘_${scenario}`] ?? RESPONSE_STEPS.괴롭힘_workplace;
  }
  return RESPONSE_STEPS[caseType] ?? RESPONSE_STEPS_FALLBACK;
}

// ─── 3. 퀘스트 리스트 빌드 (저장된 진행 상태 + 사용자 추가 항목과 병합) ────────
//
// savedSteps: Firestore에 저장돼 있던 이전 상태 배열
//   [{ id, completed, note, source? }]
// 정의(definitions)를 기준으로 화면에 뿌릴 수 있는 퀘스트 아이템 리스트를 만들고,
// definitions에 없는(=사용자가 직접 추가한) 항목도 함께 살려서 돌려준다.

export function buildQuestSteps(caseType, savedSteps = [], tags = []) {
  const definitions = getResponseSteps(caseType, tags);
  const savedList = Array.isArray(savedSteps) ? savedSteps : [];
  const savedMap = new Map();
  savedList.forEach((s) => {
    if (s && typeof s.id === 'string') savedMap.set(s.id, s);
  });

  const fixedItems = definitions.map((def) => {
    const saved = savedMap.get(def.id);
    return {
      id: def.id,
      title: def.title,
      requiredDocs: def.requiredDocs ?? null,
      duration: def.duration ?? null,
      link: def.link ?? null,
      phone: def.phone ?? null,
      completed: Boolean(saved?.completed),
      completedAt: saved?.completedAt ?? null,
      note: saved?.note ?? '', // 사용자가 기록한 질문/메모
      source: 'ai',
    };
  });

  const definitionIds = new Set(definitions.map((d) => d.id));
  const userItems = savedList
    .filter((s) => s && s.source === 'user' && !definitionIds.has(s.id))
    .map((s) => ({
      id: s.id,
      title: s.title,
      requiredDocs: s.requiredDocs ?? null,
      duration: s.duration ?? null,
      link: s.link ?? null,
      phone: s.phone ?? null,
      completed: Boolean(s.completed),
      completedAt: s.completedAt ?? null,
      note: s.note ?? '',
      source: 'user',
    }));

  const items = [...fixedItems, ...userItems];
  return { items, progress: getQuestProgress(items) };
}

// ─── 4. 퀘스트 상태 변경 ──────────────────────────────────────────────────

export function toggleQuestStepCompleted(items, id) {
  return items.map((item) => {
    if (item.id !== id) return item;
    const completed = !item.completed;
    return { ...item, completed, completedAt: completed ? new Date().toISOString() : null };
  });
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

// ─── 5. 사용자 커스텀 퀘스트 항목 추가/삭제 ─────────────────────────────────
// requiredClauseChecklist.js의 addUserClause/removeUserClause와 동일한 패턴.
// AI(고정 목록) 항목은 절대 건드리지 않고, source: 'user'인 항목만 추가/삭제한다.

let userQuestSeq = 0;

/**
 * @param {Array} items - buildQuestSteps(...)의 items
 * @param {{ title: string, requiredDocs?: string, duration?: string }} input
 * @returns {Array} 새 항목이 추가된 items 배열 (원본은 변경하지 않음)
 */
export function addUserQuestStep(items, { title, requiredDocs = '', duration = '' }) {
  userQuestSeq += 1;
  const newItem = {
    id: `user_${Date.now()}_${userQuestSeq}`,
    title,
    requiredDocs: requiredDocs || null,
    duration: duration || null,
    link: null,
    phone: null,
    completed: false,
    completedAt: null,
    note: '',
    source: 'user',
  };
  return [...items, newItem];
}

/**
 * 사용자 항목만 삭제 가능 (source: 'ai' 고정 항목은 id를 넘겨도 삭제되지 않음).
 */
export function removeUserQuestStep(items, id) {
  return items.filter((item) => !(item.id === id && item.source === 'user'));
}
