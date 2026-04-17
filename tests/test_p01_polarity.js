/**
 * 원칙 1 (P01) — 극성 불변 테스트
 *   "셀 상면이 + 이면 하면은 반드시 −. 이 관계는 어떤 경우에도 바뀌지 않는다."
 *
 * 검증 대상: renderer.js `getCellPolarity(groupIndex, face)`
 * 검증 방법:
 *   A. Happy path — 짝수 그룹 상면+/하면−, 홀수 그룹 상면−/하면+
 *   B. P01 반전 불변 — 동일 groupIndex에서 top과 bottom은 항상 반대 극성
 *   C. 교번 불변 — 인접 그룹 Gi, G_{i+1}의 상면 극성은 항상 반대 (원칙 24 번호부여 일관성)
 *   D. B+ 기본 위치 — G0 상면은 + (원칙 14 ③항)
 *   E. 대형 팩 전수 — S=13까지 불변 유지
 *
 * 참고: P01은 "단일 셀" 속성이 아니라 "상-하면 관계"의 불변이다.
 *       따라서 이 테스트는 getCellPolarity의 출력 쌍(top, bottom)의 상관관계를 검증한다.
 */
'use strict';

const path = require('path');
const R = require(path.join(__dirname, '..', 'src', 'renderer.js'));
const { getCellPolarity } = R;

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// ─── Case A — Happy path ───────────────────────────────
{
  assert('A1: G0 top === +', getCellPolarity(0, 'top') === '+');
  assert('A2: G0 bottom === -', getCellPolarity(0, 'bottom') === '-');
  assert('A3: G1 top === -', getCellPolarity(1, 'top') === '-');
  assert('A4: G1 bottom === +', getCellPolarity(1, 'bottom') === '+');
  assert('A5: G2 top === +', getCellPolarity(2, 'top') === '+');
  assert('A6: G3 top === -', getCellPolarity(3, 'top') === '-');
}

// ─── Case B — P01 반전 불변 (핵심) ─────────────────────
// 모든 groupIndex에 대해 top과 bottom이 반드시 반대여야 함
{
  for (let i = 0; i < 20; i++) {
    const t = getCellPolarity(i, 'top');
    const b = getCellPolarity(i, 'bottom');
    const ok = (t === '+' && b === '-') || (t === '-' && b === '+');
    assert(`B: G${i} top(${t}) ≠ bottom(${b})`, ok,
      ok ? '' : `P01 위반: ${t}/${b}`);
  }
}

// ─── Case C — 교번 불변 ────────────────────────────────
// 인접 그룹 Gi, G_{i+1}의 상면 극성은 항상 반대
// (원칙 14 "상면 플레이트: [G0][G1∪G2][G3∪G4]..." 전제와 일관됨)
{
  for (let i = 0; i < 10; i++) {
    const a = getCellPolarity(i, 'top');
    const b = getCellPolarity(i + 1, 'top');
    assert(`C: G${i} top(${a}) ≠ G${i+1} top(${b}) — 교번`,
      a !== b, `교번 위반: ${a}/${b}`);
  }
}

// ─── Case D — B+ 기본 위치 (원칙 14 ③항) ────────────────
{
  assert('D: G0 상면 === + (B+ 기본 위치)',
    getCellPolarity(0, 'top') === '+');
}

// ─── Case E — 대형 팩 전수 (S=13, 20그룹까지) ───────────
{
  let allInvariantHolds = true;
  let firstViolation = null;
  for (let i = 0; i < 20; i++) {
    const t = getCellPolarity(i, 'top');
    const b = getCellPolarity(i, 'bottom');
    const inverted = (t !== b);
    const onlyPlusMinus = (t === '+' || t === '-') && (b === '+' || b === '-');
    if (!inverted || !onlyPlusMinus) {
      allInvariantHolds = false;
      firstViolation = firstViolation || `G${i}: top=${t}, bottom=${b}`;
    }
  }
  assert('E: 20 그룹 P01 전수 불변', allInvariantHolds,
    firstViolation || '');
}

// ─── Case F — 잘못된 face 값은 하면 취급 (현재 동작 박제) ───
// 현재 구현: face !== 'top' 이면 하면으로 처리.
// 이 동작이 바뀌면 본 테스트가 RED로 알려줌.
{
  assert('F: face 미지정 시 하면 취급 (G0)',
    getCellPolarity(0, undefined) === '-');
  assert('F: face 오타 시 하면 취급 (G0)',
    getCellPolarity(0, 'TOP') === '-');
}

// ─── 결과 ──────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
