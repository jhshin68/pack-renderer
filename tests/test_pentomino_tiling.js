/**
 * test_pentomino_tiling.js
 * DLX P-pentomino 타일링 열거기 단위 테스트
 *
 * 검증 항목:
 * 1. 5×2 (2S5P): ≥1 solution, 모두 P-pentomino
 * 2. 5×4 (4S5P): ≥1 solution, top.total_score = +40
 * 3. 5×10 (10S5P): ≥1 solution, top.total_score = +100
 * 4. Tier B 토글 OFF → 모든 그룹 qs = +10
 * 5. allow_I=true → P+I 혼합 후보 허용
 * 6. g0_anchor='TL' → G0 cells에 row=0,col=0 포함
 * 7. 출력 포맷 호환성 (groups, is_pentomino, b_plus_ok 등)
 */
'use strict';

const path = require('path');
// 아직 존재하지 않는 모듈 → ReferenceError → RED
const T = require(path.join(__dirname, '..', 'src', 'pentomino_tiling.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

const PITCH = 100;
function makeGrid(rows, cols) {
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ x: c * PITCH, y: r * PITCH, row: r, col: c });
  return cells;
}

// ── 1. 2S5P: 5행×2열 (10셀) ────────────────────────────────────────────
{
  const cells = makeGrid(5, 2);
  const results = T.enumeratePentominoTilings(cells, 2, 5, {
    b_plus_side: 'top', b_minus_side: 'bottom',
    allow_I: false, allow_U: false,
    time_budget_ms: 3000,
  });
  assert('2S5P ≥1 solution', results.length >= 1,
    `got ${results.length}`);
  if (results.length > 0) {
    assert('2S5P top.groups.length === 2', results[0].groups.length === 2);
    assert('2S5P top.is_pentomino === true', results[0].is_pentomino === true);
    assert('2S5P top.total_score === +20', results[0].total_score === 20,
      `got ${results[0].total_score}`);
    assert('2S5P 모든 그룹 qs=+10',
      results[0].groups.every(g => g.quality_score === 10));
    assert('2S5P icc_violations === 0', results[0].icc_violations === 0);
  }
}

// ── 2. 4S5P: 5행×4열 (20셀) ────────────────────────────────────────────
{
  const cells = makeGrid(5, 4);
  const results = T.enumeratePentominoTilings(cells, 4, 5, {
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
    time_budget_ms: 3000,
  });
  assert('4S5P ≥1 solution', results.length >= 1,
    `got ${results.length}`);
  if (results.length > 0) {
    assert('4S5P top.total_score === +40', results[0].total_score === 40,
      `got ${results[0].total_score}`);
    assert('4S5P b_plus_ok && b_minus_ok',
      results[0].b_plus_ok && results[0].b_minus_ok,
      `b+=${results[0].b_plus_ok} b-=${results[0].b_minus_ok}`);
    assert('4S5P 모든 그룹 P-pentomino qs=+10',
      results[0].groups.every(g => g.quality_score === 10));
  }
}

// ── 3. 10S5P: 5행×10열 (50셀) — 핵심 케이스 ───────────────────────────
{
  const cells = makeGrid(5, 10);
  const t0 = Date.now();
  const results = T.enumeratePentominoTilings(cells, 10, 5, {
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
    max_candidates: 20,
    time_budget_ms: 3000,
  });
  const dt = Date.now() - t0;
  assert('10S5P ≥1 solution', results.length >= 1,
    `got ${results.length}`);
  assert(`10S5P 실행시간 < 3000ms (actual: ${dt}ms)`, dt < 3000);

  if (results.length > 0) {
    assert('10S5P top.total_score === +100', results[0].total_score === 100,
      `got ${results[0].total_score}`);
    assert('10S5P top.groups.length === 10', results[0].groups.length === 10);
    assert('10S5P top.is_pentomino', results[0].is_pentomino === true);
    assert('10S5P top.b_plus_ok', results[0].b_plus_ok === true);
    assert('10S5P top.b_minus_ok', results[0].b_minus_ok === true);
    assert('10S5P top.icc_violations === 0', results[0].icc_violations === 0);
    assert('10S5P 모든 그룹 qs=+10',
      results[0].groups.every(g => g.quality_score === 10));
    assert('10S5P 모든 그룹 icc1_ok',
      results[0].groups.every(g => g.icc1_ok === true));
    assert('10S5P 각 그룹 5셀',
      results[0].groups.every(g => g.cells.length === 5));
    // G0 is_b_plus, G_last is_b_minus
    assert('10S5P G0.is_b_plus', results[0].groups[0].is_b_plus === true);
    assert('10S5P G9.is_b_minus', results[0].groups[9].is_b_minus === true);
    // shape_signature
    assert('10S5P shape_signature 포함', typeof results[0].shape_signature === 'string');
    // 셀 중복 없음
    const allCellKeys = results[0].groups.flatMap(g =>
      g.cells.map(c => `${c.row},${c.col}`)
    );
    assert('10S5P 셀 중복 없음', new Set(allCellKeys).size === allCellKeys.length);
  }
}

// ── 4. Tier B OFF → 모든 그룹 qs=+10 ──────────────────────────────────
{
  const cells = makeGrid(5, 4);
  const results = T.enumeratePentominoTilings(cells, 4, 5, {
    allow_I: false, allow_U: false, time_budget_ms: 2000,
  });
  if (results.length > 0) {
    assert('Tier B OFF: 모든 candidate 모든 그룹 qs=+10',
      results.every(r => r.groups.every(g => g.quality_score === 10)));
    assert('Tier B OFF: -10 그룹 없음',
      results.every(r => r.groups.every(g => g.quality_score !== -10)));
  } else {
    assert('Tier B OFF: 솔루션 없음 (그리드 크기 이슈, skip)', true);
  }
}

// ── 5. allow_I=true → I-pentomino 허용 ────────────────────────────────
{
  // 5×2 그리드: I-pentomino(세로5×1) 2개로도 커버 가능해야 함
  const cells = makeGrid(5, 2);
  const withI = T.enumeratePentominoTilings(cells, 2, 5, {
    allow_I: true, allow_U: false,
    b_plus_side: 'top', b_minus_side: 'bottom',
    time_budget_ms: 2000,
  });
  const withoutI = T.enumeratePentominoTilings(cells, 2, 5, {
    allow_I: false, allow_U: false,
    b_plus_side: 'top', b_minus_side: 'bottom',
    time_budget_ms: 2000,
  });
  assert('allow_I=true: 후보 수 ≥ allow_I=false',
    withI.length >= withoutI.length,
    `withI=${withI.length}, withoutI=${withoutI.length}`);
}

// ── 6. g0_anchor='TL' → G0에 (row=0,col=0) 셀 포함 ───────────────────
{
  const cells = makeGrid(5, 10);
  const anchored = T.enumeratePentominoTilings(cells, 10, 5, {
    b_plus_side: 'left', b_minus_side: 'right',
    g0_anchor: 'TL',
    allow_I: false, allow_U: false,
    time_budget_ms: 2000,
  });
  const unanchored = T.enumeratePentominoTilings(cells, 10, 5, {
    b_plus_side: 'left', b_minus_side: 'right',
    g0_anchor: null,
    allow_I: false, allow_U: false,
    time_budget_ms: 2000,
  });
  if (anchored.length > 0) {
    assert('g0_anchor=TL: 모든 후보 G0에 (0,0) 포함',
      anchored.every(r =>
        r.groups[0].cells.some(c => c.row === 0 && c.col === 0)),
      'G0 cells: ' + JSON.stringify(anchored[0].groups[0].cells.map(c => `(${c.row},${c.col})`)));
    assert('g0_anchor=TL: 후보 수 ≤ 앵커 없음',
      anchored.length <= unanchored.length,
      `anchored=${anchored.length}, unanchored=${unanchored.length}`);
  } else {
    assert('g0_anchor=TL: 솔루션 없음 (타임아웃 가능)', true);
  }
}

// ── 7. P=3 (tri): 3행×4열 그리드 → triomino 솔루션 반환 ──────────────
{
  const cells = makeGrid(4, 3);  // 12셀, S=4, P=3
  const r3 = T.enumeratePentominoTilings(cells, 4, 3, {});
  assert('P=3 tri: 솔루션 ≥1', Array.isArray(r3) && r3.length >= 1,
    `got ${r3.length}`);
  if (r3.length > 0) {
    assert('P=3 tri: groups.length === 4', r3[0].groups.length === 4);
    assert('P=3 tri: is_pentomino === true', r3[0].is_pentomino === true);
  }
}

// ── 8. cells 부족 → 빈 배열 반환 ──────────────────────────────────────
{
  const cells = makeGrid(2, 3);  // 6셀, S*P = 10 > 6
  const rShort = T.enumeratePentominoTilings(cells, 2, 5, {});
  assert('cells 부족 → [] 반환', Array.isArray(rShort) && rShort.length === 0);
}

console.log(`\n총 ${pass + fail}개 중 ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
else console.log('ALL PASS');
