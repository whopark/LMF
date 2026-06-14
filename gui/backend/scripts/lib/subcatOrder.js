// 중분류 → 10개 코드 분류 통합. 심사점검표 순서 = 코드 01~10(+11 제공서비스).
// Design Ref: §3 (Option C 통합) — item_number(MMM)에서 코드 결정 → 멱등. Plan SC: SC-1·SC-2·SC-4.

// 코드 → 표시 라벨("NN 이름"). 05는 사용자 표기 오타('일빈')를 '일반'으로 교정.
const CATEGORY = {
  '01': '01 심사범위',
  '02': '02 질관리:일반',
  '03': '03 질관리:검사단계',
  '04': '04 질관리:검사전후단계',
  '05': '05 일반기구 및 장비',
  '06': '06 검사수행 및 장비운용',
  '07': '07 인력',
  '08': '08 시설 및 환경',
  '09': '09 안전',
  '10': '10 검사실이전',   // 2026 데이터 없음 — 코드만 예약
  '11': '11 제공서비스',
};

// MMM 백자리 → 코드 (1xx는 데이터 없음).
const BY_HUNDREDS = { 0: '01', 2: '02', 3: '03', 4: '04', 5: '05', 6: '06', 7: '07', 8: '08', 9: '09' };

// "NN.MMM.NNN" → MMM(int). 비표준(예: '01.제공.001') → null.
function middleCode(itemNumber) {
  const m = /^\d{2}\.(\d{3})\.\d{3}$/.exec(String(itemNumber || ''));
  return m ? parseInt(m[1], 10) : null;
}

// item_number → 코드('01'~'11'). 전부 item_number 기반이라 멱등(재실행 동일).
function categoryCode(itemNumber) {
  const mid = middleCode(itemNumber);
  if (mid === null) return '11';   // 비숫자 중분류('제공') → 제공서비스
  if (mid === 5) return '06';      // 005 기타 → 검사수행 및 장비운용
  if (mid === 980) return '04';    // 980 검사결과 보고 → 질관리:검사전후단계
  return BY_HUNDREDS[Math.floor(mid / 100)] || '06';
}

// item_number → { code, label, order }.
function categoryFor(itemNumber) {
  const code = categoryCode(itemNumber);
  return { code, label: CATEGORY[code], order: parseInt(code, 10) };
}

module.exports = { middleCode, categoryCode, categoryFor, CATEGORY };
