/**
 * test_cell_group_override.js
 * Phase 1 MVP: 우측 패널 후보 선택이 SVG 렌더에 실제 반영되는지 검증
 *
 * 검증 항목:
 *   1. cell_groups 미전달 → 기존 canonical SVG 그대로 (회귀 차단)
 *   2. enumerateGroupAssignments 후보 2개 이상 확보
 *   3. 서로 다른 후보 → 서로 다른 SVG (cell_groups이 실제 그룹 배정에 영향)
 *   4. 무효 cell_groups(길이 ≠ S) → 폴백으로 기존 경로와 동일
 *   5. custom arrangement → cell_groups 무시됨
 */
'use strict';

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── VM 컨텍스트 ────────────────────────────────────
const ptSrc     = fs.readFileSync(path.join(ROOT, 'src', 'pentomino_tiling.js'), 'utf8');
const mathSrc   = fs.readFileSync(path.join(ROOT, 'src', 'gen-math.js'), 'utf8');
const layoutSrc = fs.readFileSync(path.join(ROOT, 'src', 'gen-layout.js'), 'utf8');
const enumSrc   = fs.readFileSync(path.join(ROOT, 'src', 'gen-enum.js'), 'utf8');
const genSrc    = fs.readFileSync(path.join(ROOT, 'src', 'generator.js'), 'utf8');
const renSrc    = fs.readFileSync(path.join(ROOT, 'src', 'renderer.js'), 'utf8');

const silent = { log: () => {}, warn: () => {}, error: () => {} };
const ctx = { console: silent, __result: null };
vm.createContext(ctx);
vm.runInContext(ptSrc, ctx);
vm.runInContext(mathSrc, ctx);
vm.runInContext(layoutSrc, ctx);
vm.runInContext(enumSrc, ctx);
vm.runInContext(genSrc, ctx);
vm.runInContext(renSrc, ctx);

function runRender(params) {
  ctx.__result = null;
  vm.runInContext(`__result = render(${JSON.stringify(params)});`, ctx);
  return ctx.__result;
}

function runGenApi(code) {
  ctx.__result = null;
  vm.runInContext(`__result = (function(){ ${code} })();`, ctx);
  return ctx.__result;
}

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`[PASS] ${label}`); }
  else       { fail++; console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); }
}

// ── 셀 배열 & 후보 준비 (3S3P square) ───────────
const baseParams = {
  cell_type: '18650',
  S: 3, P: 3,
  arrangement: 'square',
  scale: 1.5,
  gap: 0.0,
  nickel_w_mm: 4.0,
  margin_mm: 8.0,
  gap_section: 36,
  show_nickel: true,
  show_terminal: true,
  face: 'all',
};

// 1. buildHolderGrid → 셀 배열
const cells3x3 = runGenApi(`
  return Generator.buildHolderGrid(3, 3, 'square', [], {
    cell_type: '18650', scale: 1.5, gap: 0.0, margin_mm: 8.0
  }, CELL_SPEC);
`);
check('buildHolderGrid returns 9 cells', Array.isArray(cells3x3) && cells3x3.length === 9);

// 2. enumerateGroupAssignments → candidates
const enumResult = runGenApi(`
  return Generator.enumerateGroupAssignments({
    cells: ${JSON.stringify(cells3x3)},
    S: 3, P: 3,
    arrangement: 'square',
    b_plus_side: 'left',
    b_minus_side: 'right',
    icc1: true, icc2: true, icc3: false,
    max_candidates: 20
  });
`);
check('enumerateGroupAssignments returns candidates',
  enumResult && Array.isArray(enumResult.candidates) && enumResult.candidates.length >= 2,
  `got ${enumResult?.candidates?.length ?? 0} candidates`);

// ─── Test 1: cell_groups 미전달 → canonical SVG 그대로 (회귀 차단) ───
const svg_canonical = runRender(baseParams);
check('T1: canonical render returns SVG',
  typeof svg_canonical === 'string' && svg_canonical.includes('<svg'));

// ─── Test 2: 서로 다른 후보 → 서로 다른 SVG ───
if (enumResult && enumResult.candidates && enumResult.candidates.length >= 2) {
  const c0_cell_groups = enumResult.candidates[0].groups.map(g => g.cells);
  const c1_cell_groups = enumResult.candidates[1].groups.map(g => g.cells);

  const svg_c0 = runRender({ ...baseParams, cell_groups: c0_cell_groups, grid_cols: 3, grid_rows: 3 });
  const svg_c1 = runRender({ ...baseParams, cell_groups: c1_cell_groups, grid_cols: 3, grid_rows: 3 });

  check('T2a: candidate 0 render returns SVG',
    typeof svg_c0 === 'string' && svg_c0.includes('<svg'));
  check('T2b: candidate 1 render returns SVG',
    typeof svg_c1 === 'string' && svg_c1.includes('<svg'));
  check('T2c: different candidates produce different SVGs',
    svg_c0 !== svg_c1,
    'SVGs are identical — cell_groups override failed');
} else {
  check('T2: skipped (need ≥ 2 candidates)', false);
}

// ─── Test 3: 무효 cell_groups (길이 ≠ S) → 폴백 ───
const svg_invalid = runRender({
  ...baseParams,
  cell_groups: [[{ row: 0, col: 0, x: 0, y: 0 }]],  // 길이 1, S=3 불일치
  grid_cols: 3, grid_rows: 3
});
check('T3a: invalid cell_groups still returns SVG',
  typeof svg_invalid === 'string' && svg_invalid.includes('<svg'));
// 길이 불일치 시 canonical 라우팅 분기를 안 타므로 기존 canonical SVG와 동일해야 함
// (그러나 cell_groups 길이가 S와 다르면 renderCustomGrid 라우팅도 발동 안 됨)
check('T3b: invalid cell_groups → canonical path (SVG equals canonical)',
  svg_invalid === svg_canonical,
  'invalid cell_groups should not change output');

// ─── Test 4: cell_groups 길이=S이지만 무효 row/col → 폴백 경로 작동 ───
const svg_badrowcol = runRender({
  ...baseParams,
  cell_groups: [
    [{ row: 99, col: 99 }, { row: 99, col: 99 }, { row: 99, col: 99 }],
    [{ row: 99, col: 99 }, { row: 99, col: 99 }, { row: 99, col: 99 }],
    [{ row: 99, col: 99 }, { row: 99, col: 99 }, { row: 99, col: 99 }],
  ],
  grid_cols: 3, grid_rows: 3,
});
// gridMap[99][99] = undefined → grp 비어서 groups=null → 폴백(내부 snake) 경로
check('T4: out-of-range row/col → fallback to internal snake (valid SVG)',
  typeof svg_badrowcol === 'string' && svg_badrowcol.includes('<svg'));

// ─── Test 5: custom arrangement 은 cell_groups 주입을 지원함 ───
// renderCustomRows()는 cell_groups가 제공되면 그대로 사용 (후보 패널 연동).
// 그룹 배정이 다른 cell_groups → 다른 SVG 출력 확인.
const svg_custom_no_cg = runRender({
  ...baseParams,
  arrangement: 'custom',
  rows: [3, 3, 3],
  S: 3, P: 3,
});
// 역순 그룹: snake 기본(G0=row0, G2=row2)과 반대로 G0=row2, G2=row0
const svg_custom_reversed_cg = runRender({
  ...baseParams,
  arrangement: 'custom',
  rows: [3, 3, 3],
  S: 3, P: 3,
  cell_groups: [
    [{row:2,col:0},{row:2,col:1},{row:2,col:2}],  // G0 = row2 (B+ 위치 변경)
    [{row:1,col:0},{row:1,col:1},{row:1,col:2}],
    [{row:0,col:0},{row:0,col:1},{row:0,col:2}],  // G2 = row0 (B- 위치 변경)
  ],
});
check('T5: custom + cell_groups 역순 주입 → snake 기본과 다른 SVG (cell_groups 적용 확인)',
  svg_custom_no_cg !== svg_custom_reversed_cg,
  'cell_groups 역순 전달 시에도 SVG가 같으면 주입이 무시된 것');

// ─── 결과 요약 ────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
