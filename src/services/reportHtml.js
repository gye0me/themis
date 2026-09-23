// src/services/reportHtml.js
//
// 사건 타임라인(증거 기록 + 완료된 대응 퀘스트)을 HTML 보고서로 변환한다.
// 순수 함수만 제공 (파일 저장/공유는 화면단(TimelineScreen)에서 expo-file-system으로 처리).

const TYPE_LABEL = { image: '📷 사진', audio: '🎵 음성', video: '🎬 영상', text: '📝 메모', contract: '📑 계약분석' };
const CASE_TYPE_ICON = { 전세사기: '🏠', 금전사기: '💸', 괴롭힘: '👥', 신변위협: '🚨' };

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateOnly(value) {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

// 워터마크 SVG를 data URI로 생성한다. 호출할 때마다 회전 각도·글자 위치·타일 크기가
// 랜덤하게 바뀌어서, 같은 자리를 오려내는 방식으로 지우기 어렵게 한다(위변조 방지 목적).
function buildWatermarkDataUri({ opacityMin = 0.05, opacityMax = 0.09 } = {}) {
  const rand = (min, max) => Math.random() * (max - min) + min;
  const wmRotate = Math.round(rand(-50, -10));
  const wmX = Math.round(rand(-40, 20));
  const wmY = Math.round(rand(110, 190));
  const wmTile = Math.round(rand(220, 300));
  const wmOpacity = rand(opacityMin, opacityMax).toFixed(2);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${wmTile}' height='${wmTile}'>` +
    `<text x='${wmX}' y='${wmY}' font-size='24' fill='rgba(30,58,95,${wmOpacity})' ` +
    `transform='rotate(${wmRotate} ${wmTile / 2} ${wmTile / 2})' font-family='sans-serif' font-weight='700'>THEMIS 원본</text>` +
    "</svg>";
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// 사건 발생 시각(eventTime)이 없는 구버전 문서는 업로드 시각(capturedAt)으로 대체
function resolveEventDate(record) {
  return toDate(record.eventTime ?? record.capturedAt);
}

function buildEvidenceCard(record) {
  const typeLabel = TYPE_LABEL[record.evidenceType] ?? '📄 기타';
  const eventDate = resolveEventDate(record);
  const uploadDate = toDate(record.capturedAt);
  const dateStr = formatDateTime(eventDate);
  // 사건 발생 시각과 업로드 시각이 다를 때만(자동 추출/AI 판독/직접 입력이 실제로 적용된 경우)
  // 업로드 시각을 별도로 함께 표기해 근거를 남긴다.
  const uploadDiffers = eventDate && uploadDate && Math.abs(eventDate - uploadDate) > 60 * 1000;
  const uploadStr = uploadDiffers ? formatDateTime(uploadDate) : '';
  const contractDateStr = record.contractDate ? escapeHtml(String(record.contractDate)) : '';
  const gpsStr = record.location
    ? `📍 위도 ${record.location.latitude?.toFixed(5)}, 경도 ${record.location.longitude?.toFixed(5)}`
    : '';

  let mediaHtml = '';
  if (record.evidenceType === 'image' && record.downloadURL) {
    // 사진 자체는 업로드 시점에 이미 워터마크가 픽셀로 합성되어 저장된다 (photoWatermark.js 참고).
    // 여기서 또 겹쳐 찍으면 이중 워터마크가 되므로, 보고서에서는 페이지 전체 워터마크만 유지한다.
    mediaHtml = `<a href="${escapeHtml(record.downloadURL)}" target="_blank"><img class="thumb" src="${escapeHtml(record.downloadURL)}" alt="증거 사진" /></a>`;
  } else if (record.evidenceType === 'audio' && record.downloadURL) {
    mediaHtml = `<audio controls src="${escapeHtml(record.downloadURL)}"></audio>`;
  } else if (record.evidenceType === 'video' && record.downloadURL) {
    mediaHtml = `<video controls class="thumb" src="${escapeHtml(record.downloadURL)}"></video>`;
  }

  const transcript = record.transcript ?? record.transcribedText ?? null;
  const aiSummary = record.aiSummary ?? record.analysisSummary ?? null;

  return `
  <div class="card evidence-card">
    <div class="card-meta">📅 사건 발생: ${escapeHtml(dateStr)}${uploadStr ? ` &nbsp;·&nbsp; 업로드: ${escapeHtml(uploadStr)}` : ''} ${gpsStr ? `&nbsp;&nbsp;${escapeHtml(gpsStr)}` : ''}</div>
    ${contractDateStr ? `<div class="card-meta">📑 계약서상 날짜: ${contractDateStr}</div>` : ''}
    <div class="card-type">${typeLabel}${record.title ? ` — ${escapeHtml(record.title)}` : ''}</div>
    ${mediaHtml ? `<div class="media">${mediaHtml}</div>` : ''}
    ${transcript ? `<div class="transcript">📝 음성 인식 텍스트: ${escapeHtml(transcript)}</div>` : ''}
    ${aiSummary ? `<div class="summary">🤖 AI 요약: ${escapeHtml(aiSummary)}</div>` : ''}
    ${!aiSummary && record.note ? `<div class="summary">📝 메모: ${escapeHtml(record.note)}</div>` : ''}
  </div>`;
}

function buildQuestCard(step) {
  return `
  <div class="card quest-card">
    <div class="card-meta">📅 ${escapeHtml(formatDateTime(step.completedAt) || '완료일 미기록')}</div>
    <div class="card-type">✅ ${escapeHtml(step.title)} 완료</div>
  </div>`;
}

/**
 * @param {Object} caseData - { title, caseType, createdAt }
 * @param {Array} records - evidenceRecords 배열
 * @param {Array} questItems - responseGuideSteps.buildQuestSteps().items (완료된 것만 타임라인에 포함)
 */
export function buildCaseReportHtml({ caseData = {}, records = [], questItems = [], signatureDataUrl = null }) {
  // 숨김 처리된 증거(hidden === true)는 보고서에서 제외한다 — 삭제는 무결성이 깨질 수 있어
  // 대신 hidden 플래그로 처리하는 항목이라, 타임라인 화면에는 흐릿하게 남아있어도 정식 보고서에는 안 나가야 한다.
  const visibleRecords = records.filter((r) => !r.hidden);

  const counts = visibleRecords.reduce((acc, r) => {
    const key = r.evidenceType ?? 'default';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const completedQuests = (questItems ?? []).filter((q) => q.completed);

  // 타임라인 항목을 "사건 발생 시각" 기준 오름차순으로 병합 (업로드 순서가 아니라 실제 사건 순서)
  const timelineEntries = [
    ...visibleRecords.map((r) => ({ type: 'evidence', date: resolveEventDate(r), html: buildEvidenceCard(r) })),
    ...completedQuests.map((q) => ({ type: 'quest', date: toDate(q.completedAt), html: buildQuestCard(q) })),
  ]
    .filter((e) => e.date)
    .sort((a, b) => a.date - b.date);

  const caseTypeIcon = CASE_TYPE_ICON[caseData.caseType] ?? '📁';
  const now = new Date();

  // 반복 타일 워터마크 — SVG를 data URI 배경으로 깔아서 내용 길이와 무관하게 전체 페이지에 반복된다.
  const watermarkDataUri = buildWatermarkDataUri();

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(caseData.title || '사건 보고서')} - Themis 증거 보고서</title>
<style>
  :root {
    --ink-950: #0A1628; --brand-700: #1E3A72; --brand-600: #2A50B8; --brand-500: #3D6FE0;
    --sky-100: #E9F1FD; --sky-050: #F4F9FE; --surface: #FFFFFF;
    --ink-900: #101828; --ink-700: #33405C; --ink-500: #5B6B8C; --ink-400: #8894AC; --line: #E7ECF5;
    --danger-600: #DC2626; --safe-600: #16A672;
  }
  body {
    font-family: "IBM Plex Sans KR", -apple-system, 'Malgun Gothic', sans-serif;
    background: var(--sky-050); color: var(--ink-900); margin: 0; padding: 20px; position: relative;
  }
  .watermark {
    position: fixed; inset: 0; z-index: 0;
    background-image: url("${watermarkDataUri}");
    background-repeat: repeat;
    pointer-events: none;
  }
  .container { max-width: 720px; margin: 0 auto; position: relative; z-index: 1; }

  .report-summary {
    background: linear-gradient(160deg, var(--ink-950), var(--brand-700));
    color: #fff; border-radius: 18px; padding: 22px; margin-bottom: 20px;
  }
  .report-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #9DB3E8; }
  .report-name { display: block; font-size: 20px; font-weight: 700; margin: 6px 0 10px; }
  .report-meta { font-size: 12.5px; color: #B9CBF2; margin: 2px 0; }
  .report-counts { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.18); font-size: 12.5px; color: #E9F1FD; }

  .section-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--ink-400); margin: 22px 0 12px;
  }

  .tl-item { display: flex; gap: 10px; }
  .tl-left { display: flex; flex-direction: column; align-items: center; padding-top: 4px; flex-shrink: 0; width: 12px; }
  .tl-dot { width: 12px; height: 12px; border-radius: 999px; border: 2.5px solid #fff; box-shadow: 0 0 0 1.5px var(--line); flex-shrink: 0; }
  .tl-line { width: 2px; flex: 1; background: var(--line); margin-top: 4px; min-height: 20px; }
  .card {
    flex: 1; background: rgba(255,255,255,0.94); border: 1px solid var(--line); border-radius: 14px;
    padding: 14px 16px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px;
  }
  .quest-card { background: rgba(228,247,239,0.94); border-color: var(--safe-600); }
  .card-meta { font-size: 11px; color: var(--ink-400); }
  .card-type { font-size: 14px; font-weight: 700; color: var(--ink-900); }
  .thumb { max-width: 100%; border-radius: 10px; margin: 4px 0; }
  audio, video { width: 100%; margin: 4px 0; border-radius: 10px; }
  .transcript { font-size: 12px; color: var(--ink-700); margin: 2px 0; }
  .summary { font-size: 12px; color: var(--brand-600); margin: 2px 0; }
  .empty-note { text-align: center; color: var(--ink-400); font-size: 13px; }

  .signature-section { margin-top: 28px; border-top: 1px solid var(--line); padding-top: 20px; }
  .signature-legal { font-size: 11px; color: var(--ink-500); line-height: 1.8; margin-bottom: 16px; }
  .signature-box { border: 1px solid var(--line); border-radius: 14px; padding: 16px; max-width: 280px; }
  .signature-label { font-size: 11px; color: var(--ink-400); margin-bottom: 8px; }
  .signature-img { max-width: 100%; height: 80px; object-fit: contain; }
  .signature-empty {
    height: 56px; border: 1.5px dashed var(--line); border-radius: 10px;
    display: flex; align-items: center; justify-content: center; color: var(--ink-400); font-size: 11.5px;
  }
  .signature-date { font-size: 10.5px; color: var(--ink-400); margin-top: 8px; }
</style>
</head>
<body>
<div class="watermark"></div>
<div class="container">

  <div class="report-summary">
    <span class="report-eyebrow">${caseTypeIcon} 사건 보고서</span>
    <span class="report-name">${escapeHtml(caseData.title || '이름 없는 사건')}</span>
    <div class="report-meta">사건 유형: ${escapeHtml(caseData.caseType || '미지정')}</div>
    <div class="report-meta">기록 시작일: ${escapeHtml(formatDateOnly(caseData.createdAt) || '-')} · 보고서 생성일: ${formatDateOnly(now)}</div>
    <div class="report-counts">
      증거 총 ${visibleRecords.length}건 (사진 ${counts.image ?? 0} · 음성 ${counts.audio ?? 0} · 영상 ${counts.video ?? 0} · 메모 ${counts.text ?? 0})
    </div>
  </div>

  <div class="section-label">증거 타임라인</div>
  ${timelineEntries.length === 0
    ? '<p class="empty-note">등록된 증거 또는 완료된 대응 조치가 없습니다.</p>'
    : timelineEntries.map((e, i) => `
  <div class="tl-item">
    <div class="tl-left"><div class="tl-dot" style="background:${e.type === 'quest' ? 'var(--safe-600)' : 'var(--brand-500)'};"></div>${i < timelineEntries.length - 1 ? '<div class="tl-line"></div>' : ''}</div>
    ${e.html}
  </div>`).join('\n')}

  <div class="signature-section">
    <p class="signature-legal">
      본 보고서는 Themis 앱에서 자동 생성된 증거 정리 자료이며, 수집된 증거의 무결성은 SHA-256 해시값 및 서버 타임스탬프로 보장됩니다.<br />
      아래 서명자는 본 보고서의 내용이 사실임을 확인합니다.<br />
      법적 효력은 담당 기관에 문의하세요.
    </p>
    <div class="signature-box">
      <div class="signature-label">서명</div>
      ${signatureDataUrl ? `<img src="${signatureDataUrl}" class="signature-img" alt="서명" />` : '<div class="signature-empty">서명 없음</div>'}
      <div class="signature-date">서명일: ${formatDateOnly(now)}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}
