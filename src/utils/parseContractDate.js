// src/utils/parseContractDate.js
//
// Gemini가 계약서에서 추출한 날짜 문자열(다양한 표기)을 Date로 변환한다.
// 예: "2026년 8월 1일", "2026.08.01", "2026-08-01", "2026/08/01",
//     "2026.08~2028.08" (기간 표기 — 시작일만 사용), "2026년 8월" (일자 없으면 1일로 간주)

/**
 * @param {string|null|undefined} raw
 * @returns {Date|null}
 */
export function parseContractDateString(raw) {
  if (typeof raw !== 'string') return null;
  const str = raw.trim();
  if (!str || /^(없음|null|미상|알 수 없음|해당 없음)$/i.test(str)) return null;

  // 기간 표기("2026.08~2028.08", "2026-08-01 ~ 2028-08-01")는 시작일만 사용
  const startPart = str.split(/[~\-–]{1}(?=\s*\d{4}|\s*\d{1,2}\s*[./]\s*\d{1,2})/)[0] || str;
  // 위 split은 과도하게 걸릴 수 있어(예: "2026-08-01"의 하이픈), 실패 시 원문 그대로 사용
  const candidates = [startPart, str];

  for (const candidate of candidates) {
    const parsed = tryParse(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function tryParse(text) {
  // "YYYY년 M월 D일" (일자 생략 가능)
  let m = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일)?/);
  if (m) {
    const [, y, mo, d] = m;
    return buildDate(y, mo, d ?? '1');
  }

  // "YYYY.MM.DD" / "YYYY-MM-DD" / "YYYY/MM/DD" (일자 생략 가능: "YYYY.MM")
  m = text.match(/(\d{4})\s*[.\-/]\s*(\d{1,2})(?:\s*[.\-/]\s*(\d{1,2}))?/);
  if (m) {
    const [, y, mo, d] = m;
    return buildDate(y, mo, d ?? '1');
  }

  return null;
}

function buildDate(yearStr, monthStr, dayStr) {
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  // 상식 범위를 벗어나면(예: OCR 오인식으로 연도가 이상하게 나온 경우) 폐기
  if (year < 1990 || year > 2100) return null;
  return date;
}
