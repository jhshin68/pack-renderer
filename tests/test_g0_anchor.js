/**
 * test_g0_anchor.js
 * Phase 2: G0 앵커 제약 (1번 셀 위치) 검증
 *
 * 검증 항목:
 *   1. anchor=TL + B+=left → 모든 candidates의 groups[0].cells[0].row=0,col=0
 *   2. anchor=BR + B+=left → warning 발생, candidates 감소 또는 0
 *   3. anchor=TL vs 없음 → 후보 수 같거나 감소
 *   4. anchor=auto(null) → 앵커 제약 무효 (기존 동작과 동일)
 *   5. 커스텀 {row, col} 앵커 → 해당 셀로 시작하는 후보만
 */
'use strict';

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
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

function run(code) {
  ctx.__result = null;
  vm.runInContext(`__result = (function(){ ${code} })();`, ctx);
  return ctx.__result;
}

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`[PASS] ${label}`); }
  else       { fail++; console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); }
}

// 공통: 3S3P square 셀 생성
const cells3x3 = run(`
  return Generator.buildHolderGrid(3, 3, 'square', [], {
    cell_type: '18650', scale: 1.5, gap: 0.0, margin_mm: 8.0
  }, CELL_SPEC);
`);
check('buildHolderGrid 3×3 returns 9 cells', cells3x3 && cells3x3.length === 9);

// ─── Test 1: anchor=TL + B+=left ───
{
  const r = run(`
    return Generator.enumerateGroupAssignments({
      cells: ${JSON.stringify(cells3x3)},
      S: 3, P: 3, arrangement: 'square',
      b_plus_side: 'left', b_minus_side: 'right',
      icc1: true, icc2: true, icc3: false,
      g0_anchor: 'TL', max_candidates: 20
    });
  `);
  check('T1a: TL anchor returns candidates',
    r && Array.isArray(r.candidates) && r.candidates.length > 0,
    `got ${r?.candidates?.length ?? 0}`);
  const allTL = r && r.candidates.every(c =>
    c.groups[0].cells[0].row === 0 && c.groups[0].cells[0].col === 0
  );
  check('T1b: all candidates start at (0,0)', !!allTL);
  check('T1c: no warning for valid TL+left', r && r.warning == null,
    `warning=${r?.warning}`);
}

// ─── Test 2: anchor=BR + B+=left → warning ───
{
  const r = run(`
    return Generator.enumerateGroupAssignments({
      cells: ${JSON.stringify(cells3x3)},
      S: 3, P: 3, arrangement: 'square',
      b_plus_side: 'left', b_minus_side: 'right',
      icc1: true, icc2: true, icc3: false,
      g0_anchor: 'BR', max_candidates: 20
    });
  `);
  check('T2: BR anchor + left boundary → outside_boundary warning',
    r && r.warning === 'g0_anchor_outside_boundary',
    `warning=${r?.warning}`);
}

// ─── Test 3: anchor=null → 제약 없음 ───
{
  const rWith = run(`
    return Generator.enumerateGroupAssignments({
      cells: ${JSON.stringify(cells3x3)},
      S: 3, P: 3, arrangement: 'square',
      b_plus_side: 'left', b_minus_side: 'right',
      icc1: true, icc2: true, icc3: false,
      g0_anchor: 'TL', max_candidates: 20
    });
  `);
  const rNone = run(`
    return Generator.enumerateGroupAssignments({
      cells: ${JSON.stringify(cells3x3)},
      S: 3, P: 3, arrangement: 'square',
      b_plus_side: 'left', b_minus_side: 'right',
      icc1: true, icc2: true, icc3: false,
      g0_anchor: null, max_candidates: 20
    });
  `);
  check('T3a: anchor=TL count ≤ anchor=null count',
    rWith.candidates.length <= rNone.candidates.length,
    `with=${rWith.candidates.length}, none=${rNone.candidates.length}`);
  check('T3b: anchor=null has no warning',
    rNone.warning == null,
    `warning=${rNone.warning}`);
}

// ─── Test 4: 커스텀 {row, col} 앵커 ───
{
  const r = run(`
    return Generator.enumerateGroupAssignments({
      cells: ${JSON.stringify(cells3x3)},
      S: 3, P: 3, arrangement: 'square',
      b_plus_side: 'left', b_minus_side: 'right',
      icc1: true, icc2: true, icc3: false,
      g0_anchor: { row: 0, col: 0 }, max_candidates: 20
    });
  `);
  check('T4a: custom anchor returns candidates',
    r && r.candidates.length > 0);
  const allMatch = r && r.candidates.every(c =>
    c.groups[0].cells[0].row === 0 && c.groups[0].cells[0].col === 0
  );
  check('T4b: all candidates start at (0,0) for custom anchor', !!allMatch);
}

// ─── Test 5: 5S5P anchor=TL vs 없음 (더 큰 케이스 감소 효과) ───
{
  const cells5x5 = run(`
    return Generator.buildHolderGrid(5, 5, 'square', [], {
      cell_type: '18650', scale: 1.5, gap: 0.0, margin_mm: 8.0
    }, CELL_SPEC);
  `);
  const rTL = run(`
    return Generator.enumerateGroupAssignments({
      cells: ${JSON.stringify(cells5x5)},
      S: 5, P: 5, arrangement: 'square',
      b_plus_side: 'left', b_minus_side: 'right',
      icc1: true, icc2: true, icc3: false,
      g0_anchor: 'TL', max_candidates: 20
    });
  `);
  check('T5: 5×5 + TL anchor — 모든 후보 row=0,col=0 에서 시작',
    rTL && rTL.candidates.every(c =>
      c.groups[0].cells[0].row === 0 && c.groups[0].cells[0].col === 0
    ));
}

// ─── 결과 요약 ────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
