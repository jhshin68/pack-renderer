'use strict';
/**
 * Phase 2 acceptance criteria (HANDOFF §8.2)
 *  C1: 13S4P 커스텀 배열 후보 수 >= 40
 *  C2: 런타임 < 3000ms
 *  C3: 사용자 예시 G0={48,49,36,37}(1-idx) top-3 이내
 *  C4: G0 비I형 (non-linear)
 */
const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));
G.loadSpec();

const CELL_SPEC = { '18650': { render_d: 19.0 } };
const rows = [10, 12, 13, 12, 5];
const params = {
  cell_type: '18650', gap: 0, scale: 1, margin_mm: 5,
  row_offsets: [0, -2, -2, -2, -1],
  custom_stagger: true, custom_stagger_dir: 'R', custom_align: 'left',
};
const { pts, pitch } = G.calcCustomCenters(rows, params, CELL_SPEC);

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

const t0 = Date.now();
const res = G.enumerateGroupAssignments({
  cells: pts, S: 13, P: 4,
  arrangement: 'custom',
  b_plus_side: 'left', b_minus_side: 'right',
  pitch,
  max_candidates: 40,
  icc1: false, icc2: false, icc3: false, allow_I: true,  // HANDOFF §8.2 완료 기준 파라미터
});
const elapsed = Date.now() - t0;

console.log(`후보 수: ${res.count}  경과: ${elapsed}ms`);

// C1: 후보 수 >= 40
assert('C1: 후보 수 >= 40', res.count >= 40, `실제: ${res.count}`);

// C2: 런타임 < 3000ms
assert('C2: 런타임 < 3000ms', elapsed < 3000, `실제: ${elapsed}ms`);

// C3: 사용자 예시 G0 top-3 이내
const TARGET_1IDX = new Set([48, 49, 36, 37]);
let found = -1;
for (let i = 0; i < Math.min(3, res.candidates.length); i++) {
  const g0Idxs = new Set(res.candidates[i].groups[0].cells.map(c => pts.indexOf(c) + 1));
  const match = [...TARGET_1IDX].every(v => g0Idxs.has(v)) && g0Idxs.size === 4;
  if (match) { found = i + 1; break; }
}
assert('C3: G0={48,49,36,37} top-3 이내', found > 0,
  found > 0 ? `순위 ${found}` : `미발견 — top-3 G0: ${res.candidates.slice(0, 3).map(c => c.groups[0].cells.map(x => pts.indexOf(x)+1).join(',')).join(' | ')}`);

// C4: G0 비I형
if (res.count >= 1) {
  const g0Cells = res.candidates[0].groups[0].cells;
  const isLinear = G._isLinearGroup ? G._isLinearGroup(g0Cells) : false;
  assert('C4: G0 비I형', !isLinear, isLinear ? 'I형 (직선)' : '');
}

console.log('─'.repeat(40));
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
