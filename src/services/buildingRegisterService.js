// 건축물대장 조회 서비스 — 계약하려는 집의 "건물 자체" 위험(위반건축물, 신축 여부, 주거용 여부)을 확인한다.
// 1) 도로명주소 검색 API(행정안전부)로 주소 → 법정동코드·지번을 얻고
// 2) 건축HUB 건축물대장정보 서비스(국토교통부, 공공데이터포털)의 표제부를 조회한다.
// 공공데이터포털 키는 실거래가 조회와 같은 EXPO_PUBLIC_REALESTATE_API_KEY를 쓰되,
// 포털에서 "건축물대장정보 서비스" 활용 신청을 따로 해야 한다.

const JUSO_URL = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';
const TITLE_URL = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';

// 신축 판단 기준(년) — 신축 빌라는 거래 이력이 없어 시세를 부풀리기 쉬운 대표적인 전세 위험 패턴이다.
const NEW_BUILDING_YEARS = 2;

// 주거용으로 볼 수 있는 주용도. 근린생활시설 등은 전입·보증보험 가입에 문제가 생길 수 있다.
const RESIDENTIAL_PURPOSES = ['단독주택', '다가구주택', '다중주택', '공동주택', '아파트', '연립주택', '다세대주택', '오피스텔', '도시형생활주택'];

export async function searchAddress(keyword) {
  const confmKey = process.env.EXPO_PUBLIC_JUSO_API_KEY;
  if (!confmKey) throw new Error('주소 검색 키(EXPO_PUBLIC_JUSO_API_KEY)가 설정되지 않았습니다.');
  const query = keyword.trim();
  if (query.length < 2) return [];

  const url = `${JUSO_URL}?confmKey=${encodeURIComponent(confmKey)}&currentPage=1&countPerPage=10`
    + `&keyword=${encodeURIComponent(query)}&resultType=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`주소 검색 실패 (상태코드 ${res.status})`);
  const data = await res.json();
  const common = data?.results?.common;
  if (common && common.errorCode !== '0') throw new Error(`주소 검색 오류: ${common.errorMessage}`);

  return (data?.results?.juso ?? []).map((j) => ({
    roadAddr: j.roadAddr,
    jibunAddr: j.jibunAddr,
    buildingName: j.bdNm,
    admCd: j.admCd, // 법정동코드 10자리 (시군구 5 + 법정동 5)
    isMountain: j.mtYn === '1',
    mainNo: j.lnbrMnnm,
    subNo: j.lnbrSlno,
  }));
}

export async function fetchBuildingTitles(address) {
  const serviceKey = process.env.EXPO_PUBLIC_REALESTATE_API_KEY;
  if (!serviceKey) throw new Error('공공데이터포털 키(EXPO_PUBLIC_REALESTATE_API_KEY)가 설정되지 않았습니다.');

  const pad4 = (v) => String(v ?? 0).padStart(4, '0');
  const params = [
    `serviceKey=${serviceKey}`,
    `sigunguCd=${address.admCd.slice(0, 5)}`,
    `bjdongCd=${address.admCd.slice(5, 10)}`,
    `platGbCd=${address.isMountain ? '1' : '0'}`,
    `bun=${pad4(address.mainNo)}`,
    `ji=${pad4(address.subNo)}`,
    'numOfRows=20', 'pageNo=1', '_type=json',
  ].join('&');

  const res = await fetch(`${TITLE_URL}?${params}`);
  if (!res.ok) throw new Error(`건축물대장 조회 실패 (상태코드 ${res.status})`);
  const data = await res.json();

  const authError = data?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (authError) throw new Error(`건축물대장 API 오류: ${authError.returnAuthMsg || authError.errMsg}`);
  const header = data?.response?.header;
  if (header && header.resultCode !== '00') throw new Error(`건축물대장 API 오류: ${header.resultMsg}`);

  const item = data?.response?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function parseYmd(value) {
  const s = String(value ?? '').trim();
  if (!/^\d{8}$/.test(s)) return null;
  return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
}

// 위반건축물 표시는 응답 버전에 따라 항목명이 다를 수 있어, "viol"이 들어간 항목을 찾아 판단한다.
// 항목이 아예 없으면 null(확인 불가)로 돌려준다 — 없다고 "안전"으로 표시하지 않기 위함.
function findViolationFlag(item) {
  const entry = Object.entries(item).find(([key]) => /viol/i.test(key));
  if (!entry) return null;
  const value = String(entry[1] ?? '').trim();
  if (!value) return null;
  return ['Y', '1', '위반', '위반건축물'].includes(value);
}

// 표제부 한 건을 사용자에게 보여줄 점검 항목 목록으로 바꾼다. level: 'safe' | 'warning' | 'danger' | 'unknown'
export function assessBuilding(item, now = new Date()) {
  const checks = [];

  const violation = findViolationFlag(item);
  checks.push(violation === null
    ? { label: '위반건축물', level: 'unknown', text: '조회 결과에 표시가 없습니다. 정부24에서 건축물대장을 열람해 "위반건축물" 표시를 꼭 확인하세요.' }
    : violation
      ? { label: '위반건축물', level: 'danger', text: '위반건축물로 등재돼 있습니다. 전세보증보험 가입이 거절되거나 이행강제금 문제가 생길 수 있습니다.' }
      : { label: '위반건축물', level: 'safe', text: '위반건축물 표시가 없습니다.' });

  const approved = parseYmd(item.useAprDay);
  if (!approved) {
    checks.push({ label: '사용승인일', level: 'unknown', text: '사용승인일 정보가 없습니다.' });
  } else {
    const years = (now - approved) / (365.25 * 24 * 3600 * 1000);
    const dateText = `${approved.getFullYear()}.${String(approved.getMonth() + 1).padStart(2, '0')}.${String(approved.getDate()).padStart(2, '0')}`;
    checks.push(years < NEW_BUILDING_YEARS
      ? { label: '사용승인일', level: 'warning', text: `${dateText} — 신축 건물입니다. 거래 이력이 적어 시세 판단이 어려우니 보증금이 매매가에 비해 과하지 않은지 특히 확인하세요.` }
      : { label: '사용승인일', level: 'safe', text: `${dateText} 사용승인 (약 ${Math.floor(years)}년 경과)` });
  }

  const purpose = [item.mainPurpsCdNm, item.etcPurps].filter(Boolean).join(' / ');
  if (!purpose) {
    checks.push({ label: '주용도', level: 'unknown', text: '용도 정보가 없습니다.' });
  } else {
    const residential = RESIDENTIAL_PURPOSES.some((p) => purpose.includes(p));
    checks.push(residential
      ? { label: '주용도', level: 'safe', text: purpose }
      : { label: '주용도', level: 'danger', text: `${purpose} — 주거용 건물이 아닐 수 있습니다. 근린생활시설 등은 전입신고·보증보험에 문제가 생길 수 있어요.` });
  }

  return {
    name: item.bldNm || item.dongNm || '건물명 없음',
    address: item.newPlatPlc || item.platPlc || '',
    households: Number(item.hhldCnt || 0) + Number(item.fmlyCnt || 0) || null,
    checks,
  };
}
