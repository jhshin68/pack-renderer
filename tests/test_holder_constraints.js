/**
 * 홀더 배열 제약 TDD 소급 (F31·F32·F33)
 *
 * 세션 9에 3 함수 모두 구현 완료됐으나 단위 테스트 없이 브라우저 육안 검증만 있었음.
 * 본 파일은 세션 12에 도입된 tdd-first.md 규율을 소급 적용한다.
 *
 * 검증 대상:
 *   F31 — buildHolderGrid(hRows, hCols, pattern, emptyCells, params, cellSpec)
 *         원칙 8·17 Level 1 (홀더 형상 분리)
 *   F32 — calcBoundarySet(cells, side)
 *         원칙 4 ④항·17 Level 2 (B+/B- 경계 도출)
 *   F33 — enumerateGroupAssignments(ctx)
 *         원칙 17 Level 3 (Hamiltonian 배정 열거)
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// ─── 테스트용 최소 CELL_SPEC ───
const CELL_SPEC = {
  '21700': { render_d: 21 },
  '18650': { render_d: 18 },
};

// ═══════════════════════════════════════════════
// F31 — buildHolderGrid
// ═══════════════════════════════════════════════

// ─── Case A — square 3×4 (12셀, 빈 슬롯 0) ───────────
{
  const params = { cell_type: '21700', gap: 0, scale: 1, margin_mm: 0 };
  const cells = G.buildHolderGrid(3, 4, 'square', [], params, CELL_SPEC);
  assert('F31-A1: 3×4 square → 12 cells', cells.length === 12);
  // 첫 셀 좌표 (row=0,col=0): x = margin + 0 + 0 + R = 10.5, y = margin + 0 + R = 10.5
  assert('F31-A2: 첫 셀 row=0, col=0',
    cells[0].row === 0 && cells[0].col === 0);
  // 마지막 셀 row=2, col=3
  const last = cells[cells.length - 1];
  assert('F31-A3: 마지막 셀 row=2, col=3',
    last.row === 2 && last.col === 3);
  // pitch = render_d × scale = 21
  const c0 = cells[0], c1 = cells[1];
  assert('F31-A4: 수평 pitch === 21',
    Math.abs((c1.x - c0.x) - 21) < 0.01, `got ${c1.x - c0.x}`);
}

// ─── Case B — 빈 슬롯 처리 ───────────────────────────
{
  const params = { cell_type: '21700', gap: 0, scale: 1, margin_mm: 0 };
  // 3×4에서 (1,1), (1,2) 제외 → 10 cells
  const cells = G.buildHolderGrid(3, 4, 'square', [[1, 1], [1, 2]], params, CELL_SPEC);
  assert('F31-B1: 빈 슬롯 2개 제외 → 10 cells', cells.length === 10);
  // (1,1), (1,2) 존재 안 함 검증
  const hasEmpty = cells.some(c => (c.row === 1 && (c.col === 1 || c.col === 2)));
  assert('F31-B2: 빈 슬롯 (1,1)·(1,2) 미포함', !hasEmpty);
}

// ─── Case C — staggered 오프셋 ──────────────────────
{
  const params = { cell_type: '21700', gap: 0, scale: 1, margin_mm: 0 };
  const cells = G.buildHolderGrid(2, 3, 'staggered', [], params, CELL_SPEC);
  assert('F31-C1: 2×3 staggered → 6 cells', cells.length === 6);
  const row0 = cells.filter(c => c.row === 0);
  const row1 = cells.filter(c => c.row === 1);
  assert('F31-C2: row0·row1 각 3셀',
    row0.length === 3 && row1.length === 3);
  // staggered: row1은 pitch/2 = 10.5 만큼 오른쪽 오프셋
  const row0_first_x = row0.sort((a, b) => a.col - b.col)[0].x;
  const row1_first_x = row1.sort((a, b) => a.col - b.col)[0].x;
  assert('F31-C3: row1 offset = pitch/2 (10.5)',
    Math.abs((row1_first_x - row0_first_x) - 10.5) < 0.01,
    `diff = ${row1_first_x - row0_first_x}`);
  // row0·row1 수직 pitch = pitch × √3/2 ≈ 18.187
  const expectedY = 21 * Math.sqrt(3) / 2;
  assert('F31-C4: staggered pitchY === pitch×√3/2',
    Math.abs((row1[0].y - row0[0].y) - expectedY) < 0.01);
}

// ─── Case D — 에러 경로 ─────────────────────────────
{
  const params = { cell_type: '21700', gap: 0, scale: 1, margin_mm: 0 };
  let threw = false;
  try { G.buildHolderGrid(2, 2, 'square', [], params, null); }
  catch (e) { threw = /cellSpec/.test(e.message); }
  assert('F31-D1: cellSpec 미제공 → throw', threw);

  threw = false;
  try { G.buildHolderGrid(2, 2, 'square', [], { cell_type: 'unknown' }, CELL_SPEC); }
  catch (e) { threw = /cell_type/.test(e.message); }
  assert('F31-D2: 알 수 없는 cell_type → throw', threw);
}

// ═══════════════════════════════════════════════
// F32 — calcBoundarySet
// ═══════════════════════════════════════════════

// ─── Case E — 3×3 square 각 방향 경계 ─────────────────
{
  const P = 100;
  const cells = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      cells.push({ x: c * P, y: r * P });

  // top: y=0 (0,1,2) → size 3
  const top = G.calcBoundarySet(cells, 'top');
  assert('F32-E1: 3×3 top boundary size === 3', top.size === 3,
    `got ${top.size}`);
  // bottom: y=200 (6,7,8) → size 3
  const bot = G.calcBoundarySet(cells, 'bottom');
  assert('F32-E2: 3×3 bottom boundary size === 3', bot.size === 3);
  // left: x=0 (0,3,6) → size 3
  const left = G.calcBoundarySet(cells, 'left');
  assert('F32-E3: 3×3 left boundary size === 3', left.size === 3);
  // right: x=200 (2,5,8) → size 3
  const right = G.calcBoundarySet(cells, 'right');
  assert('F32-E4: 3×3 right boundary size === 3', right.size === 3);

  // 네 모서리는 2개 경계에 동시 소속 (예: cells[0]은 top∩left)
  assert('F32-E5: (0,0) ∈ top AND left', top.has(0) && left.has(0));
  assert('F32-E6: (2,2) ∈ bottom AND right',
    bot.has(8) && right.has(8));
}

// ─── Case F — 빈 입력 / 1셀 ─────────────────────────
{
  assert('F32-F1: cells=[] → empty set',
    G.calcBoundarySet([], 'top').size === 0);
  const single = G.calcBoundarySet([{ x: 0, y: 0 }], 'top');
  // estimatePitch returns 1 when length<2 → tol = 0.5, 단일 셀은 자기 자신이 min==max → 경계
  assert('F32-F2: 단일 셀 → 자기 자신 포함 (size 1)', single.size === 1);
}

// ─── Case G — 1×5 가로 행 (top/bottom 동일, left/right 다름) ───
{
  const P = 100;
  const cells = [
    { x: 0, y: 0 }, { x: P, y: 0 }, { x: 2*P, y: 0 },
    { x: 3*P, y: 0 }, { x: 4*P, y: 0 },
  ];
  const top = G.calcBoundarySet(cells, 'top');
  const bot = G.calcBoundarySet(cells, 'bottom');
  assert('F32-G1: 1행 top === bottom (5개 모두)',
    top.size === 5 && bot.size === 5);
  const left = G.calcBoundarySet(cells, 'left');
  const right = G.calcBoundarySet(cells, 'right');
  assert('F32-G2: left === {0}, right === {4}',
    left.size === 1 && left.has(0) && right.size === 1 && right.has(4));
}

// ═══════════════════════════════════════════════
// F33 — enumerateGroupAssignments
// ═══════════════════════════════════════════════

function makeGrid(rows, cols, pitch = 100) {
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push({ x: c * pitch, y: r * pitch });
  return out;
}

// ─── Case H — 표준 4종 생성 (square) ─────────────────
{
  const ctx = {
    cells: makeGrid(3, 4, 100),
    S: 4, P: 3, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
  };
  const r = G.enumerateGroupAssignments(ctx);
  assert('F33-H1: square → candidates 배열 반환',
    Array.isArray(r.candidates));
  assert('F33-H2: square → 최소 4종 standard 후보',
    r.candidates.length >= 4, `got ${r.candidates.length}`);

  // 표준 후보 이름 검증
  const names = r.candidates.map(c => c.name);
  const hasBL = names.some(n => n.includes('보스트로페돈 L→R'));
  const hasBR = names.some(n => n.includes('보스트로페돈 R→L'));
  const hasCL = names.some(n => n.includes('열 우선 L→R'));
  const hasCR = names.some(n => n.includes('열 우선 R→L'));
  assert('F33-H3: 표준 4종 이름 전부 포함',
    hasBL && hasBR && hasCL && hasCR,
    `names=[${names.join(' | ')}]`);

  // 각 후보에 groups 배열 존재, 길이 S === 4
  const allGroupsOK = r.candidates.every(c =>
    Array.isArray(c.groups) && c.groups.length === 4);
  assert('F33-H4: 모든 후보 groups.length === S',
    allGroupsOK);
}

// ─── Case I — B+/B- 경계 준수 ────────────────────────
{
  const ctx = {
    cells: makeGrid(3, 4, 100),
    S: 4, P: 3, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
  };
  const r = G.enumerateGroupAssignments(ctx);
  // 열 우선 L→R: G0 = 좌측 열(x=0) → b_plus_side=left 준수
  const colLR = r.candidates.find(c => c.name.includes('열 우선 L→R'));
  assert('F33-I1: 열 우선 L→R — b_plus_ok === true', colLR && colLR.b_plus_ok);
  assert('F33-I2: 열 우선 L→R — b_minus_ok === true', colLR && colLR.b_minus_ok);
  // 열 우선 R→L: G0 = 우측 열 → b_plus_side=left와 불일치
  const colRL = r.candidates.find(c => c.name.includes('열 우선 R→L'));
  assert('F33-I3: 열 우선 R→L — b_plus_ok === false', colRL && !colRL.b_plus_ok);
}

// ─── Case J — 셀 부족 에러 ──────────────────────────
{
  const ctx = {
    cells: makeGrid(2, 2, 100),  // 4셀
    S: 5, P: 2, arrangement: 'square',  // 필요: 10셀
  };
  const r = G.enumerateGroupAssignments(ctx);
  assert('F33-J1: 셀 부족 → candidates 빈 배열',
    r.candidates.length === 0);
  assert('F33-J2: 셀 부족 → error 메시지',
    typeof r.error === 'string' && r.error.includes('셀 부족'));
}

// ─── Case K — 잘못된 ctx 방어 ───────────────────────
{
  const r1 = G.enumerateGroupAssignments(null);
  assert('F33-K1: ctx=null → candidates 빈 배열', r1.candidates.length === 0);
  const r2 = G.enumerateGroupAssignments({});
  assert('F33-K2: ctx={} → candidates 빈 배열', r2.candidates.length === 0);
  const r3 = G.enumerateGroupAssignments({ cells: makeGrid(2,2), S: 0, P: 0 });
  assert('F33-K3: S=0,P=0 → invalid error', r3.error === 'invalid ctx');
}

// ─── Case L — ICC 위반 카운트 (행스팬 초과) ──────────
{
  // 6×2 격자 → 12셀을 S=2, P=6으로 강제 (행스팬 6 → ICC① 위반)
  const ctx = {
    cells: makeGrid(6, 2, 100),
    S: 2, P: 6, arrangement: 'square',
    icc1: true, icc2: true,
  };
  const r = G.enumerateGroupAssignments(ctx);
  assert('F33-L1: 후보 존재', r.candidates.length > 0);
  // 열 우선 배치는 P=6 세로 컬럼 → rowSpan=6 → ICC① 위반
  const colCand = r.candidates.find(c => c.name.includes('열 우선 L→R'));
  assert('F33-L2: 열 우선 P=6 → icc_violations > 0',
    colCand && colCand.icc_violations > 0,
    `icc_violations=${colCand && colCand.icc_violations}`);
}

// ─── 결과 ──────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
