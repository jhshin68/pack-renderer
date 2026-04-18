/**
 * test_pentomino_icc.js
 * ICC① min(rowSpan, colSpan) ≤ 2 검증
 *
 * 변경: rowSpan ≤ 2  →  Math.min(rowSpan, colSpan) ≤ 2
 *
 * 핵심 케이스:
 *   - 세로 P-pentomino (rowSpan=3, colSpan=2): min=2 → 통과해야 함
 *   - 가로 P-pentomino (rowSpan=2, colSpan=3): min=2 → 통과 (기존도 통과)
 *   - 3×3 solid (rowSpan=3, colSpan=3):        min=3 → 실패 (의도 배제)
 *   - 1×5 I-스트립 (rowSpan=1, colSpan=5):     min=1 → 통과
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

const P = 100;
function makeGroup(coords, index = 0) {
  return {
    index,
    cells: coords.map(([r, c]) => ({ x: c * P, y: r * P })),
    quality_score: null,  // buildPairFirst가 자체 계산
  };
}

function hasICC1Violation(group) {
  const ctx = {
    groups: [group],
    arrangement: 'square',
    nickel_w: 10,
  };
  const result = G.buildPairFirst(ctx, null, []);
  return result.icc_violations.some(v => v.rule === 'ICC①_rowSpan' || v.rule === 'ICC①_minSpan');
}

// ── 세로 P-pentomino (rowSpan=3, colSpan=2) ─────────────────────────────
// 변경 전: rowSpan=3 > 2 → 위반 (잘못됨)
// 변경 후: min(3,2)=2 ≤ 2 → 통과 (올바름)
{
  const verticalP = makeGroup([[0,0],[0,1],[1,0],[1,1],[2,0]]);
  const violated = hasICC1Violation(verticalP);
  assert('세로 P-pentomino (3×2 bbox) ICC① 통과 — 변경 후',
    !violated,
    violated ? 'ICC①_minSpan 위반 발생 (구 rowSpan≤2 버그 아직 존재)' : null);
}

// ── 세로 P-pent 반사 (rowSpan=3, colSpan=2) ─────────────────────────────
{
  const verticalPr = makeGroup([[0,0],[0,1],[1,0],[1,1],[2,1]]);
  const violated = hasICC1Violation(verticalPr);
  assert('세로 P-pentomino 반사 (3×2) ICC① 통과', !violated);
}

// ── 가로 P-pentomino (rowSpan=2, colSpan=3) — 기존도 통과해야 함 ─────────
{
  const horizP = makeGroup([[0,0],[0,1],[0,2],[1,0],[1,1]]);
  const violated = hasICC1Violation(horizP);
  assert('가로 P-pentomino (2×3 bbox) ICC① 통과', !violated);
}

// ── 1×5 가로 I-스트립 (rowSpan=1, colSpan=5) ─────────────────────────────
{
  const iH = makeGroup([[0,0],[0,1],[0,2],[0,3],[0,4]]);
  const violated = hasICC1Violation(iH);
  assert('가로 I-스트립 (1×5) ICC① 통과', !violated);
}

// ── 5×1 세로 I-스트립 (rowSpan=5, colSpan=1) ─────────────────────────────
{
  const iV = makeGroup([[0,0],[1,0],[2,0],[3,0],[4,0]]);
  const violated = hasICC1Violation(iV);
  assert('세로 I-스트립 (5×1) ICC① 통과', !violated);
}

// ── 2×2 compact — 통과 ───────────────────────────────────────────────────
{
  const sq = makeGroup([[0,0],[0,1],[1,0],[1,1]]);
  const violated = hasICC1Violation(sq);
  assert('2×2 compact (rowSpan=2, colSpan=2) ICC① 통과', !violated);
}

// ── 3×3 solid (rowSpan=3, colSpan=3) — 의도적 실패 ──────────────────────
{
  const solid3x3 = makeGroup([[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]]);
  const violated = hasICC1Violation(solid3x3);
  assert('3×3 solid (rowSpan=3, colSpan=3) ICC① 실패 (의도적 배제)',
    violated,
    violated ? null : '3×3 solid이 통과됨 — ICC① 규칙이 너무 느슨함');
}

// ── L-pentomino (4×1 + 1) (rowSpan=4, colSpan=2) — 기존 rowSpan>2 버그와 동일 케이스 ──
// 변경 전: rowSpan=4 → 위반
// 변경 후: min(4,2)=2 → 통과
{
  const lPent = makeGroup([[0,0],[1,0],[2,0],[3,0],[3,1]]);
  const violated = hasICC1Violation(lPent);
  // L-pentomino는 min(4,2)=2 → ICC① 통과. 하지만 quality_score=0 (체인)
  // 이 테스트는 ICC①만 검사 (quality_score -10에 의한 위반은 별도)
  assert('L-pentomino (4×2 bbox, min=2) ICC① 통과', !violated);
}

// ── 논리 검증 (수식 직접 확인) ────────────────────────────────────────────
{
  function icc1(r, c) { return Math.min(r, c) <= 2; }
  assert('논리: min(3,2)=2 ≤ 2 → true',  icc1(3, 2) === true);
  assert('논리: min(2,3)=2 ≤ 2 → true',  icc1(2, 3) === true);
  assert('논리: min(3,3)=3 ≤ 2 → false', icc1(3, 3) === false);
  assert('논리: min(1,5)=1 ≤ 2 → true',  icc1(1, 5) === true);
  assert('논리: min(5,1)=1 ≤ 2 → true',  icc1(5, 1) === true);
  assert('논리: min(2,2)=2 ≤ 2 → true',  icc1(2, 2) === true);
  assert('논리: min(4,2)=2 ≤ 2 → true',  icc1(4, 2) === true);
  assert('논리: min(4,4)=4 ≤ 2 → false', icc1(4, 4) === false);
}

console.log(`\n총 ${pass + fail}개 중 ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  console.log('RED — ICC① 구 규칙 버그 재현됨');
  process.exit(1);
} else {
  console.log('ALL PASS');
}
