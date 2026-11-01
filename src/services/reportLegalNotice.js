// src/services/reportLegalNotice.js
//
// 보고서를 내려받기 전 확인 서명에서 보여주는 "법적 효력 안내" 문구.
// 예전 손글씨 서명은 보고서가 법적 효력이 있는 문서처럼 오해될 수 있다는 법학 교수님 피드백으로 뺐다.
// 지금의 이름 서명은 내용을 보증하는 서명이 아니라 "증거 내용을 확인했고 효력이 없을 수 있음을
// 알고 있다"는 확인 기록이므로, 보고서에도 그렇게 표기한다 (reportHtml.js).
// 앱 화면(ReportPreviewScreen)과 보고서 HTML(reportHtml.js)이 같은 문구를 쓰도록 여기서만 관리한다.
// 문구를 바꾸면 VERSION도 올려서, 어떤 문구에 확인했는지 확정 기록에 남도록 한다.

export const REPORT_LEGAL_NOTICE_VERSION = '2026-10-v2';

export const REPORT_LEGAL_NOTICE_TITLE = '법적 효력 안내';

export const REPORT_LEGAL_NOTICE_ITEMS = [
  '이 보고서는 사용자가 직접 수집·입력한 자료를 Themis가 시간순으로 정리한 참고 자료입니다. 공문서나 공증 문서가 아니며, 그 자체로 법적 효력을 갖지 않습니다.',
  '보고서에 담긴 자료가 증거로 인정되는지, 얼마나 믿을 만한지는 수사기관과 법원이 개별적으로 판단합니다. 모든 증거가 효력을 인정받지 못할 수도 있습니다.',
  '해시값과 서버 시각은 "확정 이후 내용이 바뀌지 않았다"는 것을 확인하는 기술적 수단일 뿐, 내용이 사실이라는 것을 증명하지는 않습니다.',
  '사진·음성·영상 원본 파일은 지우지 말고 따로 보관하세요. 제출할 때 원본을 요구받을 수 있습니다.',
  '사실과 다른 내용으로 신고·고소하면 무고죄 등으로 처벌받을 수 있습니다.',
];

export const REPORT_LEGAL_NOTICE_FOOTER =
  '구체적인 법적 판단은 변호사 또는 대한법률구조공단(국번 없이 132)과 상담하세요.';

export const REPORT_LEGAL_NOTICE_ACK =
  '보고서의 증거 내용을 확인했으며, 모든 증거가 법적 효력이 없을 수 있음을 인지했습니다. 이 자료는 제가 직접 수집한 것으로 제가 아는 사실과 다르지 않습니다.';

// 서명 화면에 보여주는 안내 전문. 확인 문구(ACK)는 체크박스로 따로 보여준다.
export function buildReportNoticeStatement(evidenceCount) {
  return [
    `확인 대상: 이 보고서의 증거 ${evidenceCount}건`,
    ...REPORT_LEGAL_NOTICE_ITEMS.map((item) => `• ${item}`),
    REPORT_LEGAL_NOTICE_FOOTER,
  ].join('\n\n');
}
