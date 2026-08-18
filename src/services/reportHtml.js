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

function buildEvidenceCard(record) {
  const typeLabel = TYPE_LABEL[record.evidenceType] ?? '📄 기타';
  const dateStr = formatDateTime(record.capturedAt);
  const gpsStr = record.location
    ? `📍 위도 ${record.location.latitude?.toFixed(5)}, 경도 ${record.location.longitude?.toFixed(5)}`
    : '';

  let mediaHtml = '';
  if (record.evidenceType === 'image' && record.downloadURL) {
    mediaHtml = `<a href="${escapeHtml(record.downloadURL)}" target="_blank"><img class="thumb" src="${escapeHtml(record.downloadURL)}" alt="증거 사진" /></a>`;
  } else if (record.evidenceType === 'audio' && record.downloadURL) {
    mediaHtml = `<audio controls src="${escapeHtml(record.downloadURL)}"></audio>`;
  } else if (record.evidenceType === 'video' && record.downloadURL) {
    mediaHtml = `<video controls class="thumb" src="${escapeHtml(record.downloadURL)}"></video>`;
  }

  const transcript = record.transcript ?? record.transcribedText ?? null;
  const aiSummary = record.aiSummary ?? record.analysisSummary ?? null;

  // 파일 실제 내용의 SHA-256(업로드 시점에 계산·저장됨). 텍스트 메모처럼 파일이 없는 기록이거나
  // 예전(이 기능 추가 전) 기록은 해시가 없을 수 있어, 있는 그대로만 정직하게 표시한다.
  const hashLine = record.contentHash
    ? `🔐 SHA-256(파일 무결성): ${escapeHtml(record.contentHash)}`
    : '🔐 SHA-256(파일 무결성): 계산 안 됨';

  return `
  <div class="card evidence-card">
    <div class="card-meta">📅 ${escapeHtml(dateStr)} ${gpsStr ? `&nbsp;&nbsp;${escapeHtml(gpsStr)}` : ''}</div>
    <div class="card-type">${typeLabel}${record.title ? ` — ${escapeHtml(record.title)}` : ''}</div>
    ${mediaHtml ? `<div class="media">${mediaHtml}</div>` : ''}
    ${transcript ? `<div class="transcript">📝 음성 인식 텍스트: ${escapeHtml(transcript)}</div>` : ''}
    ${aiSummary ? `<div class="summary">🤖 AI 요약: ${escapeHtml(aiSummary)}</div>` : ''}
    ${!aiSummary && record.note ? `<div class="summary">📝 메모: ${escapeHtml(record.note)}</div>` : ''}
    <div class="hash">${hashLine}</div>
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
export function buildCaseReportHtml({ caseData = {}, records = [], questItems = [] }) {
  const counts = records.reduce((acc, r) => {
    const key = r.evidenceType ?? 'default';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const completedQuests = (questItems ?? []).filter((q) => q.completed);

  // 타임라인 항목을 날짜순으로 병합
  const timelineEntries = [
    ...records.map((r) => ({ type: 'evidence', date: toDate(r.capturedAt), html: buildEvidenceCard(r) })),
    ...completedQuests.map((q) => ({ type: 'quest', date: toDate(q.completedAt), html: buildQuestCard(q) })),
  ]
    .filter((e) => e.date)
    .sort((a, b) => a.date - b.date);

  const caseTypeIcon = CASE_TYPE_ICON[caseData.caseType] ?? '📁';
  const now = new Date();

  // 반복 타일 워터마크 — SVG를 data URI 배경으로 깔아서 내용 길이와 무관하게 전체 페이지에 반복된다.
  // 매번 생성할 때마다 회전 각도·글자 위치·타일 크기를 랜덤하게 바꿔서, 같은 자리를 오려내는
  // 방식으로 지우기 어렵게 한다(위변조 방지 목적 — 매번 패턴이 달라짐).
  const rand = (min, max) => Math.random() * (max - min) + min;
  const wmRotate = Math.round(rand(-50, -10));
  const wmX = Math.round(rand(-40, 20));
  const wmY = Math.round(rand(110, 190));
  const wmTile = Math.round(rand(220, 300));
  const wmOpacity = rand(0.05, 0.09).toFixed(2);
  const watermarkSvg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${wmTile}' height='${wmTile}'>` +
    `<text x='${wmX}' y='${wmY}' font-size='24' fill='rgba(30,58,95,${wmOpacity})' ` +
    `transform='rotate(${wmRotate} ${wmTile / 2} ${wmTile / 2})' font-family='sans-serif' font-weight='700'>THEMIS 원본</text>` +
    "</svg>";
  const watermarkDataUri = `data:image/svg+xml,${encodeURIComponent(watermarkSvg)}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(caseData.title || '사건 보고서')} - Themis 증거 보고서</title>
<style>
  body { font-family: -apple-system, 'Malgun Gothic', sans-serif; background: #F1F5F9; color: #0F172A; margin: 0; padding: 20px; position: relative; }
  .watermark {
    position: fixed; inset: 0; z-index: 0;
    background-image: url("${watermarkDataUri}");
    background-repeat: repeat;
    pointer-events: none;
  }
  .container { max-width: 720px; margin: 0 auto; position: relative; z-index: 1; }
  .summary-card { background: #1E3A5F; color: #F1F5F9; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .summary-card h1 { margin: 0 0 8px; font-size: 20px; }
  .summary-card .meta { font-size: 13px; color: #B9D0EA; margin-bottom: 4px; }
  .summary-card .counts { margin-top: 12px; font-size: 13px; }
  .card { background: rgba(255,255,255,0.92); border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
  .quest-card { background: rgba(236,253,245,0.92); border-left: 4px solid #10B981; }
  .card-meta { font-size: 11px; color: #64748B; margin-bottom: 6px; }
  .card-type { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
  .thumb { max-width: 100%; border-radius: 8px; margin: 6px 0; }
  audio, video { width: 100%; margin: 6px 0; }
  .transcript { font-size: 12px; color: #475569; margin: 4px 0; }
  .summary { font-size: 12px; color: #1E3A5F; margin: 4px 0; }
  .hash { font-size: 10px; color: #94A3B8; margin-top: 6px; word-break: break-all; }
  .disclaimer { font-size: 11px; color: #94A3B8; text-align: center; margin-top: 24px; line-height: 1.6; }
</style>
</head>
<body>
<div class="watermark"></div>
<div class="container">

  <div class="summary-card">
    <h1>${escapeHtml(caseData.title || '이름 없는 사건')}</h1>
    <div class="meta">${caseTypeIcon} 사건 유형: ${escapeHtml(caseData.caseType || '미지정')}</div>
    <div class="meta">기록 시작일: ${escapeHtml(formatDateOnly(caseData.createdAt) || '-')}</div>
    <div class="meta">보고서 생성일: ${formatDateOnly(now)}</div>
    <div class="counts">
      증거 총 ${records.length}건
      (사진 ${counts.image ?? 0} · 음성 ${counts.audio ?? 0} · 영상 ${counts.video ?? 0} · 메모 ${counts.text ?? 0})
    </div>
  </div>

  ${timelineEntries.length === 0
    ? '<p style="text-align:center;color:#94A3B8;">등록된 증거 또는 완료된 대응 조치가 없습니다.</p>'
    : timelineEntries.map((e) => e.html).join('\n')}

  <p class="disclaimer">
    본 보고서는 Themis 앱에서 자동 생성된 증거 정리 자료입니다.<br />
    법적 효력은 담당 기관에 문의하세요.
  </p>
</div>
</body>
</html>`;
}
