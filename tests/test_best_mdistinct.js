'use strict';
/**
 * test_best_mdistinct.js — 우선순위 축출 검증
 *
 * 요구사항: max_candidates=K 반환 시 전체 탐색 공간 중
 * m_distinct가 가장 작은 K개를 반환해야 한다.
 *
 * RED: 처음 찾은 K개 후 조기 종료 → m_distinct=8,9 혼입
 * GREEN: 우선순위 축출 + 10s 예산으로 m=6 후보까지 발견
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
  max_candidates: 10,
  icc1: false, icc2: false, icc3: false, allow_I: true,
});
const elapsed = Date.now() - t0;

const mArr = res.candidates.map(c => c.m_distinct);
console.log(`후보 수: ${res.count}  경과: ${elapsed}ms`);
console.log(`m_distinct 분포: [${mArr.join(',')}]`);

assert('BM1: 후보 10개 반환', res.count === 10, `실제: ${res.count}`);

if (res.count > 0) {
  const minM = Math.min(...mArr);
  const maxM = Math.max(...mArr);

  // BM2: 합판 단위 plate-level m_distinct — S=13 기준 14장 플레이트, 최솟값 ≤ 13
  assert('BM2: 최상위 m_distinct ≤ 13 (plate-level, 축출로 비최적 차단)', minM <= 13,
    `실제 최솟값: ${minM}`);
  // BM3: 스프레드 ≤ 1 — 최솟값 슬롯이 다 차면 바로 위 tier만 허용
  assert('BM3: m_distinct 스프레드 ≤ 1 (축출 정확성)', maxM - minM <= 1,
    `분포: [${mArr.join(',')}]  (maxM=${maxM}, minM=${minM})`);
}

// BM4: 탐색 예산 10s + 오버헤드 허용
assert('BM4: 런타임 < 12000ms', elapsed < 12000, `실제: ${elapsed}ms`);

console.log('─'.repeat(40));
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
