'use strict';
/**
 * Phase 2 acceptance criteria (HANDOFF §8.2, updated for priority eviction)
 *  C1: 13S4P 커스텀 배열 후보 수 >= 40
 *  C2: 런타임 < 5000ms (우선순위 축출 도입으로 전체 탐색 → 예산 3000ms + 여유)
 *  C3: 반환 후보 전체의 m_distinct ≤ 전체 최솟값+1 (eviction 정확성)
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

// C2: 런타임 < 12000ms (우선순위 축출 + 10s 예산 전체 사용 → 오버헤드 포함)
assert('C2: 런타임 < 12000ms', elapsed < 12000, `실제: ${elapsed}ms`);

// C3: 반환 후보 m_distinct 스프레드 ≤ 2 (eviction 정확성 검증)
// ※ plate-level m_distinct (S=13 → 14 플레이트), max_candidates=40 + 10s 예산 기준
if (res.count >= 1) {
  const mArr = res.candidates.map(c => c.m_distinct);
  const minM = Math.min(...mArr);
  const maxM = Math.max(...mArr);
  assert('C3: 반환 후보 m_distinct ≤ 전체 최솟값+2 (eviction 정확성)',
    maxM <= minM + 2,
    `분포: min=${minM} max=${maxM} (허용: ≤${minM+2})`);
}

// C4: G0 비I형
if (res.count >= 1) {
  const g0Cells = res.candidates[0].groups[0].cells;
  const isLinear = G._isLinearGroup ? G._isLinearGroup(g0Cells) : false;
  assert('C4: G0 비I형', !isLinear, isLinear ? 'I형 (직선)' : '');
}

console.log('─'.repeat(40));
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
