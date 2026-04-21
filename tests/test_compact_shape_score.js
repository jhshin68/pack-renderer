'use strict';
// compactShapeScore() 단위 테스트
// HANDOFF §4.3 14케이스 + 엇배열 지그재그
// S(G) = 10·D·√A − 10·σ
//   D = |G| / (wCells × hCells)
//   A = min(w,h) / max(w,h)
//   σ = 1 if (maxDeg≥3 AND D<0.95 AND !hasCycle)
const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));
G.loadSpec();
const assert = require('assert');

let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}
function near(a, b, eps = 0.15) { return Math.abs(a - b) < eps; }

const P = 20; // pitch (mm)

// 정배열 셀 생성 헬퍼
function sq(col, row) {
  return { x: col * P, y: row * P, row, col };
}

// --- Case 1: 1×3 가로 I형 ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('1×3 horiz: S in [5.5, 6.1]', s >= 5.5 && s <= 6.1);
  check('1×3 horiz: near 5.77', near(s, 5.77, 0.05));
}

// --- Case 2: 1×3 세로 I형 ---
{
  const cells = [sq(0,0), sq(0,1), sq(0,2)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('1×3 vert: same as horiz ~5.77', near(s, 5.77, 0.05));
}

// --- Case 3: L자 P=3 (2+1 코너) ---
{
  const cells = [sq(0,0), sq(1,0), sq(0,1)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('L P=3 (2+1): S in [7.0, 8.0]', s >= 7.0 && s <= 8.0);
  check('L P=3 (2+1): near 7.50', near(s, 7.5, 0.05));
}

// --- Case 4: 1×4 가로 I형 ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0), sq(3,0)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('1×4 horiz: S in [4.8, 5.2]', s >= 4.8 && s <= 5.2);
  check('1×4 horiz: near 5.00', near(s, 5.0, 0.05));
}

// --- Case 5: L자 P=4 (3+1) ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0), sq(2,1)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('L P=4 (3+1): S in [4.0, 6.5]', s >= 4.0 && s <= 6.5);
}

// --- Case 6: 2×2 블록 (P=4) — 최우수 형상 ---
{
  const cells = [sq(0,0), sq(1,0), sq(0,1), sq(1,1)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('2×2 (P=4): S >= 9.5', s >= 9.5);
  check('2×2 (P=4): exact 10.0', near(s, 10.0, 0.01));
}

// --- Case 7: 1×5 가로 I형 ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0), sq(3,0), sq(4,0)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('1×5 horiz: S in [3, 5]', s >= 3 && s <= 5);
  check('1×5 horiz: near 4.47', near(s, 4.47, 0.05));
}

// --- Case 8: T자 P=5 (1×4 + 중앙 아래) — σ=1, 돌기 ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0), sq(3,0), sq(1,1)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('T P=5 (1×4+중앙): S <= -4', s <= -4);
  check('T P=5 (1×4+중앙): near -5.58', near(s, -5.58, 0.15));
}

// --- Case 9: T자 P=5 (1×4 + 끝 아래) — σ=1, 돌기 ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0), sq(3,0), sq(3,1)];
  const s = G.compactShapeScore(cells, P, 'square');
  // HANDOFF: T자(1×4+끝)은 T자가 아니라 L자처럼 보일 수 있지만
  // (3,0)의 이웃: (2,0),(3,1) → degree=2 → σ=0
  // 실제로는 L자와 같은 계산 → D=5/8=0.625, A=0.5
  // No T/Y node → σ=0 → S = 10*0.625*√0.5 = 4.42
  // (HANDOFF 표의 -5.58은 재검토 필요)
  check('T P=5 (1×4+끝): S in [4.0, 5.0] (L자 형태, σ=0)', s >= 4.0 && s <= 5.0);
}

// --- Case 10: P-펜토미노 P=5 (2×2+1) — 사이클 있음, σ=0 ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0), sq(0,1), sq(1,1)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('P-pent P=5 (2×2+1): S in [6, 7.5]', s >= 6 && s <= 7.5);
  check('P-pent P=5: near 6.80', near(s, 6.80, 0.05));
}

// --- Case 11: 1×6 가로 I형 ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0), sq(3,0), sq(4,0), sq(5,0)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('1×6 horiz: near 4.08', near(s, 4.08, 0.05));
}

// --- Case 12: 2×3 블록 (P=6) ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0), sq(0,1), sq(1,1), sq(2,1)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('2×3 (P=6): S in [7, 9]', s >= 7 && s <= 9);
  check('2×3 (P=6): near 8.16', near(s, 8.16, 0.05));
}

// --- Case 13: T자 P=6 (1×5 + 중앙 아래) — σ=1 ---
{
  const cells = [sq(0,0), sq(1,0), sq(2,0), sq(3,0), sq(4,0), sq(2,1)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('T P=6 (1×5+중앙): S <= -4', s <= -4);
  check('T P=6 (1×5+중앙): near -6.21', near(s, -6.21, 0.15));
}

// --- Case 14: 단일 셀 (P=1) → 0 ---
{
  const cells = [sq(0,0)];
  const s = G.compactShapeScore(cells, P, 'square');
  check('Single cell (P=1): S === 0', s === 0);
}

// --- Case 15: 엇배열 대각 지그재그 3셀 (D=0.75, A=1.0) → ~7.5 ---
{
  const pitchY = P * Math.sqrt(3) / 2;
  const cells = [
    { x: 0,       y: 0,       row: 0, col: 0 },
    { x: P / 2,   y: pitchY,  row: 1, col: 0 },
    { x: P,       y: 0,       row: 0, col: 1 },
  ];
  const s = G.compactShapeScore(cells, P, 'staggered');
  check('Staggered 3-cell zigzag: S in [7.0, 8.0]', s >= 7.0 && s <= 8.0);
}

// --- Case 16: 2×2 vs 1×4 — 컴팩트가 더 높아야 함 ---
{
  const compact = [sq(0,0), sq(1,0), sq(0,1), sq(1,1)];
  const linear  = [sq(0,0), sq(1,0), sq(2,0), sq(3,0)];
  const sc = G.compactShapeScore(compact, P, 'square');
  const sl = G.compactShapeScore(linear, P, 'square');
  check('2×2 score > 1×4 score', sc > sl);
}

// --- Case 17: T자 < L자 (돌기 페널티 효과) ---
{
  const tShape = [sq(0,0), sq(1,0), sq(2,0), sq(3,0), sq(1,1)];
  const lShape = [sq(0,0), sq(1,0), sq(2,0), sq(3,0), sq(3,1)];
  const st = G.compactShapeScore(tShape, P, 'square');
  const sl = G.compactShapeScore(lShape, P, 'square');
  check('T-shape score < L-shape score (T is penalized)', st < sl);
}

console.log(`\ncompactShapeScore: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
