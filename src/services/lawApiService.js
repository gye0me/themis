// src/services/lawApiService.js
//
// 법제처 국가법령정보 공동활용 Open API 연동.
// caseAssistantService.js가 AI 답변을 만들기 전에, 사건 유형과 관련된
// 핵심 법령의 최신 정보(시행일자·소관부처 등)를 조회해 프롬프트 근거로 붙이는 데 쓴다.
//
// 이 파일은 순수 API 호출만 담당한다 (UI 없음).

const LAW_SEARCH_URL = 'http://www.law.go.kr/DRF/lawSearch.do';

/**
 * 법령명(또는 키워드)으로 법령을 검색한다.
 * @param {string} query - 검색할 법령명/키워드 (예: '주택임대차보호법')
 * @param {number} display - 최대 결과 개수 (기본 3, 프롬프트에 너무 길게 넣지 않기 위해 적게 유지)
 * @returns {Promise<Array<{title: string, lawId: string, promulgationDate: string, effectiveDate: string, department: string}>>}
 */
export async function searchLaw(query, display = 3) {
  const oc = process.env.EXPO_PUBLIC_LAW_OC;
  if (!oc) {
    console.warn('EXPO_PUBLIC_LAW_OC가 설정되지 않아 법령 검색을 건너뜁니다.');
    return [];
  }

  const url = `${LAW_SEARCH_URL}?OC=${oc}&target=law&type=JSON&query=${encodeURIComponent(query)}&display=${display}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`법령 검색 API 오류 (${res.status})`);
      return [];
    }
    const data = await res.json();

    // law.go.kr JSON 응답은 결과가 1건이면 객체, 여러 건이면 배열로 내려오는
    // 특이한 구조라 방어적으로 배열화한다.
    const raw = data?.LawSearch?.law ?? [];
    const list = Array.isArray(raw) ? raw : [raw];

    return list
      .filter((item) => item && item['법령명한글'])
      .map((item) => ({
        title: item['법령명한글'] ?? '',
        lawId: item['법령ID'] ?? '',
        promulgationDate: item['공포일자'] ?? '',
        effectiveDate: item['시행일자'] ?? '',
        department: item['소관부처명'] ?? '',
      }));
  } catch (err) {
    console.warn('법령 검색 API 호출 실패:', err.message);
    return []; // 실패해도 AI 답변 자체는 계속 진행되도록 빈 배열 반환
  }
}

/**
 * 검색 결과를 프롬프트에 붙일 수 있는 짧은 텍스트 블록으로 변환한다.
 * @param {Array} laws - searchLaw()의 반환값
 */
export function formatLawContext(laws) {
  if (!laws || laws.length === 0) return '';
  const lines = laws.map(
    (l) => `- ${l.title} (시행일자: ${l.effectiveDate || '정보없음'}, 소관: ${l.department || '정보없음'})`
  );
  return `[국가법령정보센터 최신 조회 결과]\n${lines.join('\n')}`;
}
