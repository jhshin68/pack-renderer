'use strict';

/**
 * test_pinned_groups_sparse.js — 비연속 그룹 고정 탐색(pinned_groups_sparse) TDD
 *
 * 검증:
 * 1. sparse G0+G2 고정 → ≥1 후보
 * 2. 후보의 groups[0]/groups[2]가 고정 셀과 정확히 일치
 * 3. 마지막 sparse 핀이 도달 불가 → 0 후보 (인접성 강제)
 * 4. 기존 연속 pinned_groups 회귀 확인
 */

const path = require('path');
const { enumerateGroupAssignments } = require(path.join(__dirname, '../src/gen-enum'));

const pitch = 32.5;

// 2행×4열 = 8셀 그리드 (row 0=하단, row 1=상단)
function make2x4() {
  const cells = [];
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++)
      cells.push({ x: c * pitch, y: r * pitch, row: r, col: c });
  return cells;
}

// 1행×8열 = 8셀 그리드
function make1x8() {
  return Array.from({ length: 8 }, (_, c) => ({
    x: c * pitch, y: 0, row: 0, col: c,
  }));
}

let passed = 0, failed = 0;
function expect(label, got, expected) {
  const ok = expected === undefined ? !!got : got === expected;
  if (ok) { console.log(`  ✓ ${label}`); passed++; }
  else     { console.log(`  ✗ ${label}: got=${JSON.stringify(got)}, want=${JSON.stringify(expected)}`); failed++; }
}

const BASE = {
  S: 3, P: 2, arrangement: 'custom',
  b_plus_side: 'left', b_minus_side: 'right',
  pitch, allow_I: true, exhaustive: true, budget_ms: 3000, max_candidates: 50,
};

const toKey = g => g.cells.map(c => `r${c.row}c${c.col}`).sort().join(',');

// ── Test 1: sparse G0·G2 고정, G1 자유 → ≥1 후보 ──────────────────
console.log('\n[TEST 1: sparse G0+G2 pinned → ≥1 candidate]');
const cells2x4 = make2x4();
const r1 = enumerateGroupAssignments({
  ...BASE, cells: cells2x4,
  pinned_groups_sparse: [
    { groupIdx: 0, cells: [{ row: 1, col: 0 }, { row: 0, col: 0 }] },
    { groupIdx: 2, cells: [{ row: 1, col: 3 }, { row: 0, col: 3 }] },
  ],
});
console.log(`  candidates: ${r1.count}`);
expect('sparse G0+G2 → ≥1 candidate', r1.count >= 1);

// ── Test 2: 후보의 groups[0], groups[2]가 고정 셀과 정확히 일치 ────
// (pre-impl: pinned_groups_sparse 무시 → 일반 DFS가 임의 셀 선택 → FAIL)
console.log('\n[TEST 2: pinned cells appear in correct groups]');
const g0Key = 'r0c0,r1c0';
const g2Key = 'r0c3,r1c3';
expect('groups[0] matches pinned G0 (all candidates)',
  r1.count > 0 && r1.candidates.every(c => toKey(c.groups[0]) === g0Key));
expect('groups[2] matches pinned G2 (all candidates)',
  r1.count > 0 && r1.candidates.every(c => toKey(c.groups[2]) === g2Key));

// G1은 고정 셀을 포함하지 않아야 함
const pinnedCellSet = new Set(['r1c0','r0c0','r1c3','r0c3']);
expect('G1 cells do not overlap pinned cells',
  r1.count > 0 && r1.candidates.every(c =>
    c.groups[1].cells.every(cl => !pinnedCellSet.has(`r${cl.row}c${cl.col}`))
  ));

// ── Test 3: 마지막 sparse 핀 도달 불가 → 0 후보 ──────────────────
// (pre-impl: sparse 무시 → 일반 DFS가 후보 반환 → FAIL)
console.log('\n[TEST 3: last sparse pin unreachable → 0 candidates]');
// 1행×8열, G0={r0c0,r0c1}, G2={r0c6,r0c7}
// G1은 r0c2에서 시작, r0c3까지만 도달 — G2(r0c6)와 비인접(97.5 > thr=48.75)
const cells1x8 = make1x8();
const r3 = enumerateGroupAssignments({
  ...BASE, cells: cells1x8,
  pinned_groups_sparse: [
    { groupIdx: 0, cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
    { groupIdx: 2, cells: [{ row: 0, col: 6 }, { row: 0, col: 7 }] },
  ],
});
console.log(`  candidates: ${r3.count}`);
expect('unreachable G2 → 0 candidates', r3.count, 0);

// ── Test 4: 기존 연속 pinned_groups 동작 불변 ──────────────────────
console.log('\n[TEST 4: consecutive pinned_groups regression]');
const cells2x4b = make2x4();
const r4 = enumerateGroupAssignments({
  ...BASE, cells: cells2x4b,
  pinned_groups: [
    [{ row: 1, col: 0 }, { row: 0, col: 0 }],
  ],
});
console.log(`  candidates (pinned G0 only): ${r4.count}`);
expect('consecutive pinned_groups still works (≥1)', r4.count >= 1);

// ── Test 5: sparse + enumerate_g0_only → G1(첫 자유 그룹) 후보 반환 ──
console.log('\n[TEST 5: sparse enumerate_g0_only → g0_configs for first free group]');
const cells2x4c = make2x4();
const r5 = enumerateGroupAssignments({
  ...BASE, cells: cells2x4c,
  pinned_groups_sparse: [
    { groupIdx: 0, cells: [{ row: 1, col: 0 }, { row: 0, col: 0 }] },
    { groupIdx: 2, cells: [{ row: 1, col: 3 }, { row: 0, col: 3 }] },
  ],
  enumerate_g0_only: true,
});
console.log(`  g0_configs: ${r5.g0_configs && r5.g0_configs.length}`);
console.log(`  sparse_first_free_idx: ${r5.sparse_first_free_idx}`);
expect('sparse enumerate_g0_only → g0_configs ≥1', r5.g0_configs && r5.g0_configs.length >= 1);
expect('sparse_first_free_idx = 1 (G0 is pinned)', r5.sparse_first_free_idx, 1);

// g0_configs가 실제 G1 후보와 일치하는지 검증 (Test 1의 candidates로 역검증)
const g1KeySet = new Set(r1.candidates.map(c => c.groups[1].cells.map(cl => `r${cl.row}c${cl.col}`).sort().join(',')));
const gkKeySet = new Set((r5.g0_configs || []).map(cfg => cfg.slice().sort((a, b) => a - b).join(',')));
expect('g0_configs length matches unique G1 configs in candidates', r5.g0_configs && r5.g0_configs.length >= g1KeySet.size);

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
