/**
 * test_group_quality_score.js
 * 12종 펜토미노 × groupQualityScore 점수 매트릭스 검증
 *
 * RED 케이스: P-pentomino가 +10을 반환해야 하지만 현재 -10을 반환 (버그)
 *
 * 기대 점수표:
 *   +10: P (사이클 + compact fillRatio ≥ 0.75)
 *     0: I, L, N, U, V, W, Z  (체인, 분기 없음)
 *   -10: F, T, X, Y  (degree ≥ 3 분기 노드, 사이클 없음)
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// pitch=100 기준 셀 생성 헬퍼
function cells(coords) {
  return coords.map(([r, c]) => ({ x: c * 100, y: r * 100 }));
}
function edges(cellArr) {
  return G.buildAdjacency(cellArr, 'square', 100);
}
function qs(cellArr) {
  return G.groupQualityScore(cellArr, edges(cellArr));
}

// ──────────────────────────────────────────────────
// Tier A: P-pentomino (+10)  ← 핵심 버그 케이스
// ──────────────────────────────────────────────────
{
  // P (2×2 + 아래 1):
  //   XX
  //   XX
  //   X.
  const p = cells([[0,0],[0,1],[1,0],[1,1],[2,0]]);
  const score = qs(p);
  assert('P-pentomino → +10', score === +10,
    `got ${score} (degree≥3 조기컷 버그 시 -10)`);
}

{
  // P 반사(2×2 + 아래-우):
  //   XX
  //   XX
  //   .X
  const p = cells([[0,0],[0,1],[1,0],[1,1],[2,1]]);
  const score = qs(p);
  assert('P-pentomino 반사 → +10', score === +10, `got ${score}`);
}

{
  // P 90° 회전(1×2 + 3열):
  //   XXX
  //   XX.
  const p = cells([[0,0],[0,1],[0,2],[1,0],[1,1]]);
  const score = qs(p);
  assert('P-pentomino 90° 회전 → +10', score === +10, `got ${score}`);
}

// ──────────────────────────────────────────────────
// 점수 0: 선형/체인 형태
// ──────────────────────────────────────────────────
{
  // I: XXXXX 가로
  const p = cells([[0,0],[0,1],[0,2],[0,3],[0,4]]);
  assert('I-pentomino (가로) → 0', qs(p) === 0);
}

{
  // I: 세로
  const p = cells([[0,0],[1,0],[2,0],[3,0],[4,0]]);
  assert('I-pentomino (세로) → 0', qs(p) === 0);
}

{
  // L:
  //   X.
  //   X.
  //   X.
  //   XX
  const p = cells([[0,0],[1,0],[2,0],[3,0],[3,1]]);
  assert('L-pentomino → 0', qs(p) === 0);
}

{
  // N:
  //   .X
  //   .X
  //   XX
  //   X.
  const p = cells([[0,1],[1,1],[2,0],[2,1],[3,0]]);
  assert('N-pentomino → 0', qs(p) === 0);
}

{
  // U:
  //   X.X
  //   XXX
  const p = cells([[0,0],[0,2],[1,0],[1,1],[1,2]]);
  assert('U-pentomino → 0', qs(p) === 0);
}

{
  // V:
  //   X..
  //   X..
  //   XXX
  const p = cells([[0,0],[1,0],[2,0],[2,1],[2,2]]);
  assert('V-pentomino → 0', qs(p) === 0);
}

{
  // W:
  //   X..
  //   XX.
  //   .XX
  const p = cells([[0,0],[1,0],[1,1],[2,1],[2,2]]);
  assert('W-pentomino → 0', qs(p) === 0);
}

{
  // Z:
  //   XX.
  //   .X.
  //   .XX
  const p = cells([[0,0],[0,1],[1,1],[2,1],[2,2]]);
  assert('Z-pentomino → 0', qs(p) === 0);
}

// ──────────────────────────────────────────────────
// 점수 -10: 분기형 (T/Y/F/X)
// ──────────────────────────────────────────────────
{
  // F:
  //   .XX
  //   XX.
  //   .X.
  const p = cells([[0,1],[0,2],[1,0],[1,1],[2,1]]);
  assert('F-pentomino → -10', qs(p) === -10);
}

{
  // T:
  //   XXX
  //   .X.
  //   .X.
  const p = cells([[0,0],[0,1],[0,2],[1,1],[2,1]]);
  assert('T-pentomino → -10', qs(p) === -10);
}

{
  // X (+):
  //   .X.
  //   XXX
  //   .X.
  const p = cells([[0,1],[1,0],[1,1],[1,2],[2,1]]);
  assert('X-pentomino (+형) → -10', qs(p) === -10);
}

{
  // Y:
  //   .X
  //   XX
  //   .X
  //   .X
  const p = cells([[0,1],[1,0],[1,1],[2,1],[3,1]]);
  assert('Y-pentomino → -10', qs(p) === -10);
}

// ──────────────────────────────────────────────────
// 경계 케이스
// ──────────────────────────────────────────────────
{
  // 단일 셀 → 0
  assert('단일 셀 → 0', G.groupQualityScore([{ x: 0, y: 0 }], []) === 0);
}

{
  // 2×3 solid (6셀, fillRatio=1.0 → +10)
  const p = cells([[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]]);
  assert('2×3 solid (6셀) → +10', qs(p) === +10);
}

{
  // 2×2 compact (4셀) → +10
  const p = cells([[0,0],[0,1],[1,0],[1,1]]);
  assert('2×2 compact (4셀) → +10', qs(p) === +10);
}

// ──────────────────────────────────────────────────
console.log(`\n총 ${pass + fail}개 중 ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  console.log('RED 확인됨 — P-pentomino 버그 재현 완료');
  process.exit(1);
} else {
  console.log('ALL PASS');
}
