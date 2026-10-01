// src/services/preventionGuides.js
//
// 사건 유형별 "예방 가이드" 데이터 (순수 데이터 + 헬퍼, UI 없음).
// - PREVENTION_GUIDES[caseType].scenarios: 사례별 예방 방법(tips) + 체크리스트(checklist)
//     → PreventionGuideModal에서 보여준다 (증거 업로드 첫 진입 시 자동, 타임라인의 "예방" 버튼).
// - PREVENTION_GUIDES[caseType].requiredEvidence: 사건을 만들 때 미리 알려주는 "챙겨야 할 증거"
//     → NewCaseScreen 사건 생성 폼에서 유형을 고르면 보여준다.
// 체크리스트 id는 Firestore(cases.preventionChecklist)에 완료 여부 키로 저장되므로 바꾸지 말 것.

export const PREVENTION_GUIDES = {
  전세사기: {
    requiredEvidence: [
      { icon: '📑', title: '계약서 전체', desc: '특약사항까지 모든 페이지를 사진으로' },
      { icon: '📄', title: '등기부등본', desc: '계약 전·잔금 전에 뗀 것 모두 (소유자·근저당 확인)' },
      { icon: '🧾', title: '보증금 이체 내역', desc: '계약금·중도금·잔금 이체 확인증' },
      { icon: '🏠', title: '집 상태 사진·영상', desc: '입주 전, 하자 발생 시, 퇴거 시 각각' },
      { icon: '💬', title: '임대인·중개사 대화', desc: '문자·카톡 캡처, 통화 녹음' },
    ],
    scenarios: [
      {
        id: 'rent',
        label: '전월세',
        icon: '🔑',
        summary: '보증금을 지키려면 계약 전 확인과 입주 직후 신고가 가장 중요해요.',
        tips: [
          '계약 전에 등기부등본을 직접 떼서 집주인 이름과 근저당·압류가 있는지 확인하세요.',
          '신분증의 이름이 등기부등본의 소유자와 같은지 확인하고, 대리인이면 위임장과 인감증명서를 받으세요.',
          '보증금은 반드시 등기부등본상 소유자 명의 계좌로 보내세요.',
          '입주하면 바로 전입신고를 하고 계약서에 확정일자를 받으세요.',
          '전세보증금 반환보증(HUG·HF·SGI) 가입이 가능한지 확인해보세요.',
        ],
        checklist: [
          { id: 'rent_deungibu', text: '계약 전: 등기부등본 떼서 소유자·근저당 확인' },
          { id: 'rent_owner_id', text: '계약 전: 집주인 신분증과 등기부 소유자 일치 확인' },
          { id: 'rent_contract_photo', text: '계약 당일: 계약서 전체(특약 포함) 사진 찍기' },
          { id: 'rent_transfer', text: '계약 당일: 소유자 명의 계좌로 이체하고 이체 내역 저장' },
          { id: 'rent_movein_photo', text: '입주 전: 집 안 전체 사진·영상 찍기 (벽, 바닥, 창틀, 욕실, 옵션 가전)' },
          { id: 'rent_registration', text: '입주 직후: 전입신고 + 확정일자 받기' },
          { id: 'rent_guarantee', text: '입주 후: 전세보증금 반환보증 가입 검토' },
          { id: 'rent_defect_photo', text: '거주 중: 하자 생기면 바로 사진 찍고 집주인에게 문자로 알리기' },
          { id: 'rent_moveout_photo', text: '퇴거 시: 짐 뺀 뒤 집 상태 사진·영상 찍기' },
        ],
      },
      {
        id: 'sale',
        label: '매매',
        icon: '🏢',
        summary: '큰돈이 오가는 만큼 잔금 전 마지막 확인이 중요해요.',
        tips: [
          '계약 전과 잔금 치르기 직전에 등기부등본을 다시 떼서 바뀐 권리관계가 없는지 확인하세요.',
          '공인중개사의 등록 여부를 국가공간정보포털이나 구청에서 확인하세요.',
          '매도인 본인 확인 후 매도인 명의 계좌로만 돈을 보내세요.',
          '특약(하자 담보, 잔금일, 근저당 말소 조건 등)을 계약서에 구체적으로 적으세요.',
        ],
        checklist: [
          { id: 'sale_deungibu_before', text: '계약 전: 등기부등본 확인' },
          { id: 'sale_broker', text: '계약 전: 공인중개사 등록 여부 확인' },
          { id: 'sale_contract_photo', text: '계약 당일: 계약서·특약 전체 사진 찍기' },
          { id: 'sale_transfer', text: '매도인 명의 계좌로 이체하고 이체 내역 저장' },
          { id: 'sale_deungibu_final', text: '잔금 직전: 등기부등본 다시 확인' },
          { id: 'sale_house_photo', text: '잔금 당일: 집 상태 사진·영상 찍기' },
        ],
      },
    ],
  },

  금전사기: {
    requiredEvidence: [
      { icon: '🖼️', title: '판매·광고 글 캡처', desc: '작성자 아이디, 가격, 작성 시간이 보이게' },
      { icon: '💬', title: '대화 내용 전체', desc: '앱 밖 메신저로 옮겨간 대화까지 모두' },
      { icon: '🧾', title: '송금·이체 내역', desc: '이체 확인증, 계좌 거래내역' },
      { icon: '🪪', title: '상대방 정보', desc: '계좌번호, 예금주, 전화번호, 아이디' },
      { icon: '📞', title: '통화 녹음', desc: '보이스피싱이면 통화 기록과 녹음' },
    ],
    scenarios: [
      {
        id: 'ticket',
        label: '티켓 거래',
        icon: '🎫',
        summary: '공연·스포츠 티켓 양도는 "먼저 입금"을 요구하는 사기가 가장 많아요.',
        tips: [
          '가능하면 공식 예매처나 공식 양도·리셀 서비스를 이용하세요.',
          '입금 전에 판매자의 계좌번호·전화번호를 경찰청 사이버범죄 신고시스템의 사기 의심 조회나 더치트에서 조회하세요.',
          '예매 내역 캡처나 신분증 사진은 쉽게 조작·도용돼요. 그것만 믿고 입금하지 마세요.',
          '플랫폼 밖 메신저로 옮기자고 하거나, 판매자가 보내준 "안전결제 링크"는 가짜일 가능성이 높아요.',
          '입금했는데 연락이 끊기면 바로 112에 신고하고 송금한 은행에 지급정지를 요청하세요.',
        ],
        checklist: [
          { id: 'ticket_post_capture', text: '거래 전: 판매 글 전체 캡처 (아이디, 가격, 좌석 정보)' },
          { id: 'ticket_fraud_check', text: '거래 전: 판매자 계좌·전화번호 사기 이력 조회' },
          { id: 'ticket_chat_capture', text: '거래 중: 대화 내용 전부 캡처 (외부 메신저 포함)' },
          { id: 'ticket_safe_pay', text: '결제: 플랫폼 공식 안전결제 사용, 링크 주소 확인' },
          { id: 'ticket_transfer', text: '결제 후: 이체 확인증 저장' },
          { id: 'ticket_receive', text: '결제 후: 티켓 수령·양도 완료 여부 바로 확인' },
        ],
      },
      {
        id: 'used',
        label: '중고거래',
        icon: '📦',
        summary: '직거래가 가장 안전하고, 택배거래는 안전결제와 개봉 영상이 핵심이에요.',
        tips: [
          '가능하면 사람 많은 곳에서 직거래하고 물건을 확인한 뒤 돈을 보내세요.',
          '택배거래는 플랫폼 공식 안전결제를 이용하세요.',
          '시세보다 지나치게 싼 물건, 급하게 입금을 재촉하는 판매자는 의심하세요.',
          '물건을 받으면 택배 상자를 뜯는 순간부터 영상으로 찍어두세요.',
        ],
        checklist: [
          { id: 'used_post_capture', text: '거래 전: 판매 글·판매자 프로필 캡처' },
          { id: 'used_fraud_check', text: '거래 전: 판매자 계좌·전화번호 사기 이력 조회' },
          { id: 'used_chat_capture', text: '거래 중: 대화 내용 캡처' },
          { id: 'used_transfer', text: '결제 후: 이체 확인증 저장' },
          { id: 'used_unboxing', text: '수령 시: 택배 개봉 영상 찍기' },
        ],
      },
      {
        id: 'phishing',
        label: '보이스피싱',
        icon: '📞',
        summary: '수사기관·금융기관은 전화로 돈을 보내라고 하거나 앱 설치를 요구하지 않아요.',
        tips: [
          '검찰·경찰·금감원을 사칭하며 돈이나 개인정보를 요구하면 바로 끊으세요.',
          '문자·메신저로 온 링크를 누르거나 모르는 앱을 설치하지 마세요.',
          '가족·지인이라며 돈을 요구하면 끊고 원래 알던 번호로 직접 확인하세요.',
          '이미 송금했다면 즉시 112나 송금한 은행에 전화해 지급정지를 요청하세요.',
        ],
        checklist: [
          { id: 'phishing_call_record', text: '통화 녹음 기능 켜두기' },
          { id: 'phishing_sms_capture', text: '의심 문자·메신저 캡처 (발신번호 포함)' },
          { id: 'phishing_number_note', text: '발신번호와 통화 시각 기록' },
          { id: 'phishing_freeze', text: '송금했다면: 112·은행에 지급정지 요청' },
        ],
      },
      {
        id: 'invest',
        label: '투자 권유',
        icon: '📈',
        summary: '"원금 보장·고수익"을 약속하는 투자 권유는 대부분 사기예요.',
        tips: [
          '금융감독원 "파인"에서 제도권 금융회사인지 먼저 조회하세요.',
          '리딩방·코인 투자 권유에서 수익 인증 화면만 믿지 마세요.',
          '처음에 소액 수익을 돌려준 뒤 큰 금액을 요구하는 수법이 많아요.',
        ],
        checklist: [
          { id: 'invest_fine_check', text: '투자 전: 금감원 "파인"에서 업체 조회' },
          { id: 'invest_chat_capture', text: '권유 대화·리딩방 내용 캡처' },
          { id: 'invest_site_capture', text: '투자 사이트 주소와 화면 캡처' },
          { id: 'invest_transfer', text: '입금 내역 모두 저장' },
        ],
      },
    ],
  },

  괴롭힘: {
    requiredEvidence: [
      { icon: '📝', title: '일시·장소·내용 기록', desc: '언제, 어디서, 누가, 무슨 말·행동을 했는지' },
      { icon: '🎙️', title: '녹음', desc: '내가 참여한 대화 녹음' },
      { icon: '💬', title: '메시지·이메일', desc: '문자, 메신저, 사내 메일 캡처' },
      { icon: '🏥', title: '진단서·진료 기록', desc: '신체·정신적 피해 모두' },
      { icon: '👀', title: '목격자 정보', desc: '함께 본 사람의 이름·연락처' },
    ],
    scenarios: [
      {
        id: 'workplace',
        label: '직장 내 괴롭힘',
        icon: '🏢',
        summary: '반복된 행위를 날짜별로 꾸준히 기록하는 것이 가장 강력한 증거예요.',
        tips: [
          '일이 생길 때마다 날짜·시간·장소·발언 내용·목격자를 바로 기록하세요.',
          '내가 참여한 대화는 녹음해도 돼요. 다만 내가 빠진 다른 사람들끼리의 대화를 몰래 녹음하면 불법이에요.',
          '업무 메신저·이메일은 퇴사하면 볼 수 없게 되니 미리 캡처해 두세요.',
          '병원 진료를 받았다면 진단서와 진료 기록을 받아두세요.',
          '회사에 신고했다면 신고한 날짜와 방법(메일 등)도 기록으로 남기세요.',
        ],
        checklist: [
          { id: 'work_diary', text: '일이 생길 때마다 날짜·내용 기록' },
          { id: 'work_recording', text: '내가 참여한 대화 녹음' },
          { id: 'work_message', text: '메신저·이메일 캡처해서 따로 보관' },
          { id: 'work_witness', text: '목격한 동료 이름 적어두기' },
          { id: 'work_medical', text: '진료를 받았다면 진단서 받기' },
          { id: 'work_report_record', text: '회사에 신고했다면 신고 기록 남기기' },
        ],
      },
      {
        id: 'school',
        label: '학교폭력',
        icon: '🏫',
        summary: '다친 곳은 바로 사진을 찍고 병원 진단서를 받아두세요.',
        tips: [
          '다친 곳은 날짜가 보이게 바로 사진을 찍고 병원에서 진단서를 받으세요.',
          '단톡방·SNS 괴롭힘은 삭제되기 전에 화면을 캡처하세요.',
          '같이 본 친구가 있다면 이름을 기록해 두세요.',
          '학교폭력 신고는 117(학교폭력 신고센터)이나 담임 선생님께 할 수 있어요.',
        ],
        checklist: [
          { id: 'school_injury_photo', text: '다친 곳 사진 찍기' },
          { id: 'school_medical', text: '병원 진단서 받기' },
          { id: 'school_chat_capture', text: '단톡방·SNS 메시지 캡처' },
          { id: 'school_witness', text: '목격한 친구 이름 기록' },
          { id: 'school_report', text: '117 또는 학교에 신고하고 기록 남기기' },
        ],
      },
      {
        id: 'online',
        label: '온라인 괴롭힘',
        icon: '🌐',
        summary: '게시물은 언제든 지워질 수 있어서 보자마자 저장하는 게 중요해요.',
        tips: [
          '게시글·댓글은 주소(URL)와 날짜가 함께 보이게 캡처하세요.',
          '가해 계정의 아이디와 프로필 화면도 캡처해 두세요.',
          '상대에게 직접 대응하기보다 증거를 먼저 모은 뒤 신고하세요.',
        ],
        checklist: [
          { id: 'online_capture', text: '게시글·댓글 캡처 (URL·날짜 포함)' },
          { id: 'online_account', text: '가해 계정 아이디·프로필 캡처' },
          { id: 'online_report_platform', text: '플랫폼 신고 기록 남기기' },
        ],
      },
    ],
  },

  신변위협: {
    requiredEvidence: [
      { icon: '💬', title: '협박 연락 기록', desc: '문자·메신저·통화 목록 캡처' },
      { icon: '📹', title: 'CCTV·블랙박스', desc: '영상은 보관 기간이 짧으니 빨리 요청' },
      { icon: '📷', title: '상처 사진·진단서', desc: '다친 곳이 있다면 바로' },
      { icon: '🚓', title: '112 신고 기록', desc: '신고한 날짜·시간, 출동 여부' },
      { icon: '📍', title: '발생 장소·시간', desc: '따라온 경로, 마주친 장소 등' },
    ],
    scenarios: [
      {
        id: 'stalking',
        label: '스토킹',
        icon: '👣',
        summary: '위험하다고 느끼면 망설이지 말고 112에 신고하세요. 신고 자체가 기록이 돼요.',
        tips: [
          '위협을 느끼면 바로 112에 신고하세요. 신고 기록이 나중에 중요한 증거가 돼요.',
          '연락·방문·따라온 일이 있을 때마다 날짜·시간·장소를 기록하세요.',
          '집 주변·다니는 길의 CCTV 위치를 알아두세요. CCTV 영상은 보관 기간이 짧아 빨리 요청해야 해요.',
          '홈 화면의 "위급 상황 자동 알림"(데드맨 스위치)을 켜두면 응답이 없을 때 보호자에게 알릴 수 있어요.',
        ],
        checklist: [
          { id: 'stalk_log', text: '연락·방문이 있을 때마다 일시·장소 기록' },
          { id: 'stalk_capture', text: '문자·통화 목록·SNS 메시지 캡처' },
          { id: 'stalk_cctv', text: '주변 CCTV 위치 확인, 필요하면 영상 보관 요청' },
          { id: 'stalk_112', text: '위협을 느끼면 112 신고 (신고 기록 남기기)' },
          { id: 'stalk_deadman', text: '위급 상황 자동 알림 켜고 보호자 등록' },
        ],
      },
      {
        id: 'dating',
        label: '협박·데이트폭력',
        icon: '💔',
        summary: '다친 곳 사진과 진단서, 협박 메시지는 지워지기 전에 저장하세요.',
        tips: [
          '다친 곳은 바로 사진을 찍고 병원에서 진단서를 받으세요.',
          '협박 문자·음성 메시지는 지우지 말고 캡처와 녹음 파일로 따로 저장하세요.',
          '여성긴급전화 1366에서 24시간 상담과 보호 지원을 받을 수 있어요.',
        ],
        checklist: [
          { id: 'dating_injury_photo', text: '다친 곳 사진 찍기' },
          { id: 'dating_medical', text: '병원 진단서 받기' },
          { id: 'dating_threat_capture', text: '협박 메시지 캡처·녹음 저장' },
          { id: 'dating_support', text: '1366 상담 또는 112 신고' },
        ],
      },
    ],
  },

  기타: {
    requiredEvidence: [
      { icon: '📝', title: '사건 경위 메모', desc: '언제, 어디서, 무슨 일이 있었는지' },
      { icon: '📷', title: '사진·영상', desc: '현장, 물건, 피해 상태' },
      { icon: '💬', title: '대화 기록', desc: '문자·메신저 캡처, 통화 녹음' },
      { icon: '🧾', title: '거래·지출 내역', desc: '돈이 오갔다면 이체 내역' },
    ],
    scenarios: [
      {
        id: 'general',
        label: '기본 예방 수칙',
        icon: '🛡️',
        summary: '어떤 일이든 "그때그때 바로 기록"이 가장 좋은 예방이에요.',
        tips: [
          '일이 생기면 기억이 흐려지기 전에 날짜·시간·내용을 바로 기록하세요.',
          '중요한 약속은 말로만 하지 말고 문자나 문서로 남기세요.',
          '돈을 보낼 때는 이체 내역이 남는 방법을 쓰세요.',
          '사진·음성·영상 원본 파일은 지우지 말고 보관하세요.',
        ],
        checklist: [
          { id: 'general_memo', text: '사건 경위 메모 남기기' },
          { id: 'general_photo', text: '관련 사진·영상 찍기' },
          { id: 'general_chat', text: '대화 내용 캡처' },
          { id: 'general_transfer', text: '거래 내역 저장' },
        ],
      },
    ],
  },
};

export function getPreventionGuide(caseType) {
  return PREVENTION_GUIDES[caseType] ?? PREVENTION_GUIDES['기타'];
}

export function getRequiredEvidence(caseType) {
  return getPreventionGuide(caseType).requiredEvidence;
}

// 체크리스트 진행도 — { done, total } (저장된 완료 맵: { [itemId]: true })
export function getScenarioProgress(scenario, checkedMap = {}) {
  const total = scenario.checklist.length;
  const done = scenario.checklist.filter((item) => checkedMap[item.id]).length;
  return { done, total };
}
