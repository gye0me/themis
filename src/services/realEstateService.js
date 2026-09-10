// src/services/realEstateService.js
//
// 국토교통부 매매 실거래가 공공데이터 API 연동 (아파트 + 연립다세대/빌라).
// ContractAnalysisScreen에서 "전월세" 계약서를 분석할 때, 전세보증금이 같은 건물의
// 실제 매매 시세 대비 얼마나 높은지(전세가율)를 계산해 깡통전세 위험을 참고할 수 있게 한다.
//
// 실제 전세사기 피해는 시세가 투명한 아파트보다 빌라·다세대주택에서 훨씬 많이
// 발생하므로, 아파트(RTMSDataSvcAptTradeDev)뿐 아니라 연립다세대(RTMSDataSvcRHTrade)도
// 함께 조회한다. 두 API는 건물명 태그(aptNm/mhouseNm)만 다르고 나머지 구조는 동일하다.
//
// 구 단위 평균만으로는 오차가 커서, 같은 건물 + 비슷한 전용면적끼리만 묶어서
// 비교하는 것을 기본 정확도 전략으로 삼는다.
//
// 이 파일은 순수 API 호출만 담당한다 (UI 없음).

// 주택유형별 API 엔드포인트와, 건물명이 담기는 XML 태그명.
const TRADE_ENDPOINTS = {
  apt: {
    url: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
    nameTag: 'aptNm',
  },
  villa: {
    url: 'http://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
    nameTag: 'mhouseNm',
  },
};

export const HOUSING_TYPE_LABELS = {
  apt: '아파트',
  villa: '연립다세대·빌라',
};

// 서울 25개 자치구의 법정동코드(앞 5자리, 시군구 단위).
// 경기·인천 등 일부 시는 구 단위로 세분화돼 있어 정확한 코드를 알 수 없는 경우
// 잘못된 정보를 보여줄 수 있으므로, 코드가 명확한 서울 지역만 우선 지원한다.
export const REGION_CODES = {
  '종로구': '11110',
  '중구': '11140',
  '용산구': '11170',
  '성동구': '11200',
  '광진구': '11215',
  '동대문구': '11230',
  '중랑구': '11260',
  '성북구': '11290',
  '강북구': '11305',
  '도봉구': '11320',
  '노원구': '11350',
  '은평구': '11380',
  '서대문구': '11410',
  '마포구': '11440',
  '양천구': '11470',
  '강서구': '11500',
  '구로구': '11530',
  '금천구': '11545',
  '영등포구': '11560',
  '동작구': '11590',
  '관악구': '11620',
  '서초구': '11650',
  '강남구': '11680',
  '송파구': '11710',
  '강동구': '11740',
};

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`);
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function parseItemBlock(block, nameTag) {
  return {
    buildingName: extractTag(block, nameTag),
    dealAmount: extractTag(block, 'dealAmount').replace(/,/g, ''), // 만원 단위
    area: extractTag(block, 'excluUseAr'),
    floor: extractTag(block, 'floor'),
    buildYear: extractTag(block, 'buildYear'),
    dealYear: extractTag(block, 'dealYear'),
    dealMonth: extractTag(block, 'dealMonth'),
    dealDay: extractTag(block, 'dealDay'),
    dong: extractTag(block, 'umdNm'),
    jibun: extractTag(block, 'jibun'),
  };
}

function parseItems(xmlText, nameTag) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    items.push(parseItemBlock(match[1], nameTag));
  }
  return items;
}

/**
 * 만원 단위 숫자(문자열)를 "8억 4,000만원" 형태의 한글 표기로 변환한다.
 * @param {string|number} manwonValue
 */
export function formatManwonToKorean(manwonValue) {
  const manwon = Number(String(manwonValue ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(manwon) || manwon <= 0) return '';
  const eok = Math.floor(manwon / 10000);
  const rest = manwon % 10000;
  if (eok > 0 && rest > 0) return `${eok}억 ${rest.toLocaleString()}만원`;
  if (eok > 0) return `${eok}억원`;
  return `${manwon.toLocaleString()}만원`;
}

/**
 * 오늘 기준 전월(YYYYMM)을 반환한다.
 * 국토부 실거래가 데이터는 신고 지연으로 당월 데이터가 비어있는 경우가 많아
 * 기본 조회월로 전월을 사용한다.
 */
export function getPreviousYearMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}${mm}`;
}

/**
 * 지역(법정동코드)·계약년월 기준 매매 실거래가를 조회한다.
 * @param {'apt'|'villa'} housingType
 * @param {{lawdCd: string, dealYmd: string, numOfRows?: number}} params
 * @returns {Promise<Array<{buildingName, dealAmount, dealAmountKorean, area, floor, buildYear, dong, jibun, dealDate}>>}
 */
async function fetchTrades(housingType, { lawdCd, dealYmd, numOfRows = 100 }) {
  const config = TRADE_ENDPOINTS[housingType];
  if (!config) return [];

  const serviceKey = process.env.EXPO_PUBLIC_REALESTATE_API_KEY;
  if (!serviceKey) {
    console.warn('EXPO_PUBLIC_REALESTATE_API_KEY가 설정되지 않아 실거래가 조회를 건너뜁니다.');
    return [];
  }
  if (!lawdCd || !dealYmd) return [];

  // .env의 키는 이미 URL 인코딩된 형태(Encoding 키)이므로 재인코딩하지 않고 그대로 붙인다.
  const url = `${config.url}?serviceKey=${serviceKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=${numOfRows}&pageNo=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`실거래가 API 오류 (${res.status})`);
      return [];
    }
    const xmlText = await res.text();

    if (!/<item>/.test(xmlText)) {
      // 정상 응답이지만 결과가 없는 경우와, 인증/파라미터 오류로 item이 아예 없는 경우를 함께 처리
      const resultMsg = extractTag(xmlText, 'resultMsg') || extractTag(xmlText, 'returnAuthMsg');
      if (resultMsg && !/^(NORMAL|정상)/i.test(resultMsg)) {
        console.warn('실거래가 API 응답 오류:', resultMsg);
      }
      return [];
    }

    return parseItems(xmlText, config.nameTag)
      .filter((item) => item.buildingName)
      .map((item) => ({
        ...item,
        housingType,
        dealAmountKorean: formatManwonToKorean(item.dealAmount),
        dealDate:
          item.dealYear && item.dealMonth && item.dealDay
            ? `${item.dealYear}.${item.dealMonth.padStart(2, '0')}.${item.dealDay.padStart(2, '0')}`
            : '',
      }))
      .sort((a, b) => (a.dealDate < b.dealDate ? 1 : -1));
  } catch (err) {
    console.warn('실거래가 API 호출 실패:', err.message);
    return []; // 실패해도 계약서 분석 자체는 계속 진행되도록 빈 배열 반환
  }
}

/** 아파트 매매 실거래가를 조회한다. @param {{lawdCd: string, dealYmd: string, numOfRows?: number}} params */
export async function fetchAptTrades(params) {
  return fetchTrades('apt', params);
}

/** 연립다세대(빌라) 매매 실거래가를 조회한다. @param {{lawdCd: string, dealYmd: string, numOfRows?: number}} params */
export async function fetchVillaTrades(params) {
  return fetchTrades('villa', params);
}

/**
 * 실거래 목록의 평균 거래금액(만원)을 계산한다.
 * @param {Array<{dealAmount: string}>} trades
 * @returns {number|null}
 */
export function calcAverageDealAmount(trades) {
  const amounts = (trades ?? [])
    .map((t) => Number(String(t.dealAmount).replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!amounts.length) return null;
  return Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
}

function buildRecentYmds(baseYmd, months) {
  const year = Number(baseYmd.slice(0, 4));
  const month = Number(baseYmd.slice(4, 6));
  const list = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(year, month - 1 - i, 1);
    list.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return list;
}

/**
 * 기준월 포함 최근 N개월치 실거래가를 합쳐서 가져온다.
 * 단일 월만 보면 특정 건물의 거래 건수가 0~1건에 그쳐 시세 비교가 부정확해지므로,
 * 표본을 늘려 정확도를 높이는 용도로 쓴다.
 * @param {{housingType: 'apt'|'villa', lawdCd: string, baseYmd: string, months?: number}} params
 */
export async function fetchRecentTrades({ housingType = 'apt', lawdCd, baseYmd, months = 3 }) {
  if (!lawdCd || !baseYmd) return [];
  const ymds = buildRecentYmds(baseYmd, months);
  const results = await Promise.all(ymds.map((dealYmd) => fetchTrades(housingType, { lawdCd, dealYmd })));
  return results.flat();
}

/**
 * 실거래 목록을 "동 + 건물명" 단위로 묶는다.
 * 구 전체 평균은 건물별 가격 편차가 커서 의미가 약하므로, 계약서와 같은 건물끼리만
 * 비교하는 것이 정확도의 핵심이다.
 * @param {Array} trades
 * @returns {Array<{buildingName: string, dong: string, trades: Array, count: number, avgAmount: number|null}>}
 */
export function groupTradesByBuilding(trades) {
  const map = new Map();
  (trades ?? []).forEach((t) => {
    if (!t.buildingName) return;
    const key = `${t.dong}|${t.buildingName}`;
    if (!map.has(key)) map.set(key, { buildingName: t.buildingName, dong: t.dong, trades: [] });
    map.get(key).trades.push(t);
  });
  return Array.from(map.values())
    .map((group) => ({ ...group, count: group.trades.length, avgAmount: calcAverageDealAmount(group.trades) }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 같은 단지 거래 중 계약서상 전용면적과 비슷한(기본 ±5㎡) 거래만 남긴다.
 * 같은 단지라도 평형별 가격 차이가 커서, 면적까지 맞춰야 비교가 정확해진다.
 * 근접 면적 거래가 하나도 없으면 정확도가 떨어지더라도 전체 거래로 폴백한다.
 * @param {Array<{area: string}>} trades
 * @param {string|number} targetArea
 * @param {number} tolerance
 */
export function filterTradesByArea(trades, targetArea, tolerance = 5) {
  const target = Number(targetArea);
  if (!Number.isFinite(target) || target <= 0) return trades ?? [];
  const filtered = (trades ?? []).filter((t) => {
    const area = Number(t.area);
    return Number.isFinite(area) && Math.abs(area - target) <= tolerance;
  });
  return filtered.length > 0 ? filtered : (trades ?? []);
}

/**
 * 전세가율(%) = 전세보증금 / 매매 실거래 평균가 * 100
 * @param {string|number} depositManwon - 전세보증금(만원 단위)
 * @param {string|number} avgDealManwon - 비교 대상 매매 평균가(만원 단위)
 * @returns {number|null} 소수 첫째자리까지의 비율. 계산 불가하면 null
 */
export function calcJeonseRatio(depositManwon, avgDealManwon) {
  const deposit = Number(String(depositManwon ?? '').replace(/,/g, ''));
  const avg = Number(avgDealManwon);
  if (!Number.isFinite(deposit) || deposit <= 0 || !Number.isFinite(avg) || avg <= 0) return null;
  return Math.round((deposit / avg) * 1000) / 10;
}

// 전세가율 위험 기준. 80% 이상은 흔히 "깡통전세" 위험 신호로 보도되는 수치,
// 70~80%는 전세보증보험 가입 등 추가 확인이 필요한 주의 구간으로 잡았다.
const JEONSE_RATIO_DANGER = 80;
const JEONSE_RATIO_WARNING = 70;

/**
 * 전세가율에 따른 위험도를 반환한다.
 * @param {number|null} ratio - calcJeonseRatio()의 반환값
 * @returns {'danger'|'warning'|'safe'|null}
 */
export function getJeonseRiskLevel(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  if (ratio >= JEONSE_RATIO_DANGER) return 'danger';
  if (ratio >= JEONSE_RATIO_WARNING) return 'warning';
  return 'safe';
}
