'use strict';
/**
 * test_mdistinct_plate.js — _plateMdistinct 원칙 14 합판 단위 검증
 *
 * m_distinct 정의: 원칙 14 상/하면 합판(플레이트) 단위 distinct 형상 수
 *   - G0: 상면 B+ 단독 (I형)
 *   - G(S-1): 하면 B- 단독 (I형, S홀수) 또는 상면 B- 단독 (I형, S짝수)
 *   - 나머지: 인접 2그룹 합판 (U형)
 * rotSteps=4: 0°/90°/180°/270° 회전 동일 취급, 미러는 별도 형상
 *
 * RED → GREEN: gen-enum.js _plateMdistinct 헬퍼 추출 전까지 fail
 */
const path = require('path');
const GE = require(path.join(__dirname, '..', 'src', 'gen-enum.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

function mkGroup(coords) {
  return { cells: coords.map(([x, y]) => ({ x, y })) };
}

assert('API: _plateMdistinct 함수 노출됨',
  typeof GE._plateMdistinct === 'function',
  `실제 타입: ${typeof GE._plateMdistinct}`);

if (typeof GE._plateMdistinct !== 'function') {
  console.log('─'.repeat(40));
  console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
  process.exit(1);
}

// ── MD1: S=2 (짝수), 2개 그룹 모두 2-cell 가로 스트립 ──
// calcNickelPattern(2): top=[G0(I,B+), G1(I,B-)], bot=[[G0+G1](U)]
// G0 alone: 2-cell → sig_A
// G1 alone: 2-cell → sig_A (같음)
// [G0+G1]: 4-cell 2×2 블록 → sig_B (다름)
// 기대: m=2, 구(per-group) 방식은 m=1
{
  const groups = [
    mkGroup([[0, 0], [20, 0]]),
    mkGroup([[0, 20], [20, 20]]),
  ];
  const m = GE._plateMdistinct(groups, 2);
  assert('MD1: S=2 동일 그룹 → plate m=2 (not 1)', m === 2, `실제: ${m}`);
}

// ── MD2: S=3 (홀수), 3개 그룹 모두 2-cell 가로 스트립 ──
// calcNickelPattern(3): top=[G0(I), [G1+G2](U)], bot=[[G0+G1](U), G2(I,B-)]
// G0 alone: sig_A, G2 alone: sig_A, [G1+G2]: sig_B, [G0+G1]: sig_B
// 기대: m=2
{
  const groups = [
    mkGroup([[0, 0], [20, 0]]),
    mkGroup([[0, 20], [20, 20]]),
    mkGroup([[0, 40], [20, 40]]),
  ];
  const m = GE._plateMdistinct(groups, 3);
  assert('MD2: S=3 (홀수) 동일 그룹 → plate m=2', m === 2, `실제: ${m}`);
}

// ── MD3: S=4 (짝수), 4개 그룹 모두 2-cell 가로 스트립 ──
// calcNickelPattern(4): top=[G0(I), [G1+G2](U), G3(I,B-)], bot=[[G0+G1](U), [G2+G3](U)]
// I형 플레이트: sig_A, U형 플레이트: sig_B (4셀 합판)
// 기대: m=2
{
  const groups = [
    mkGroup([[0, 0], [20, 0]]),
    mkGroup([[0, 20], [20, 20]]),
    mkGroup([[0, 40], [20, 40]]),
    mkGroup([[0, 60], [20, 60]]),
  ];
  const m = GE._plateMdistinct(groups, 4);
  assert('MD3: S=4 (짝수) 동일 그룹 → plate m=2', m === 2, `실제: ${m}`);
}

// ── MD4: rotSteps=4 — 가로/세로 2-cell은 같은 형상 ──
// G0: 가로 2-cell, G1: 세로 2-cell (90° 회전 = 동일)
// S=2: top=[G0,G1], bot=[[G0+G1]]
// G0 alone: sig_A (2-cell), G1 alone: sig_A (같음)
// [G0+G1]: 셀이 L형 또는 2×1+1×2 — sig_B
// 기대: m=2
{
  const groups = [
    mkGroup([[0, 0], [20, 0]]),   // G0: 가로
    mkGroup([[40, 0], [40, 20]]), // G1: 세로 (90° = 같은 sig)
  ];
  const m = GE._plateMdistinct(groups, 2);
  assert('MD4: 가로/세로 2-cell 90°동일 → plate m=2', m === 2, `실제: ${m}`);
}

// ── MD5: 그룹 형상이 다르면 m_distinct > per-group 값과 무관 ──
// S=4, G0/G3는 2-cell 가로, G1은 3-cell L형, G2는 3-cell 직선
// 플레이트 형상이 실제로 여러 종류임을 확인
{
  const groups = [
    mkGroup([[0, 0], [20, 0]]),
    mkGroup([[0, 20], [20, 20], [40, 20]]),  // G1: 3-cell 가로
    mkGroup([[60, 0], [60, 20], [60, 40]]),  // G2: 3-cell 세로 (rotSteps=4→같은 sig)
    mkGroup([[80, 0], [100, 0]]),
  ];
  const m = GE._plateMdistinct(groups, 4);
  // [G1+G2]: G1(3-cell)+G2(3-cell)=6-cell 비대칭 → 별도 sig
  // G0/G3 alone: 2-cell
  // [G0+G1]: 5-cell 비대칭 → 별도 sig (또는 [G2+G3]과 다를 수 있음)
  assert('MD5: 이종 그룹 S=4 → plate m_distinct ≥ 2', m >= 2, `실제: ${m}`);
}

// ── MD6: S=5 (홀수), 범용성 확인 ──
// calcNickelPattern(5): top=[G0, [G1+G2], [G3+G4]], bot=[[G0+G1], [G2+G3], G4(I,B-)]
// 모든 그룹이 같은 2-cell: I형(G0,G4)=sig_A, U형(합판)=sig_B → m=2
{
  const groups = [
    mkGroup([[0, 0], [20, 0]]),
    mkGroup([[0, 20], [20, 20]]),
    mkGroup([[0, 40], [20, 40]]),
    mkGroup([[0, 60], [20, 60]]),
    mkGroup([[0, 80], [20, 80]]),
  ];
  const m = GE._plateMdistinct(groups, 5);
  assert('MD6: S=5 (홀수) 동일 그룹 → plate m=2', m === 2, `실제: ${m}`);
}

console.log('─'.repeat(40));
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
