/**
 * test_pinned_groups.js — 부분 고정 탐색(pinned_groups) 회귀 테스트
 *
 * 검증:
 * 1. left-align: 비고정 13개, pinned G0 고정시 ≥1개 (일관성)
 * 2. center-align: 비고정 0개 (DLX 필터 검증), pinned도 0개 (P28③ 일관)
 * 3. P28③ 통과 여부 외부 검증
 */

'use strict';

const path = require('path');
const { enumerateGroupAssignments } = require(path.join(__dirname, '../src/gen-enum'));

const pitch = 32.5;
const renderThr = pitch * 1.05;

function makeCells(opts = {}) {
  const { centerAlign = false } = opts;
  const offsetX = centerAlign ? pitch / 2 : 0;
  const cells = [];
  for (let col = 0; col < 5; col++) cells.push({ x: col * pitch, y: 0, row: 0, col });
  for (let col = 0; col < 4; col++) cells.push({ x: offsetX + col * pitch, y: pitch, row: 1, col });
  return cells;
}

function checkP28iii(cand) {
  const groups = cand.groups;
  const S = groups.length;
  const t = renderThr + 0.5;
  for (let pStart = 0; pStart <= 1; pStart++) {
    for (let g = pStart; g + 1 < S; g += 2) {
      const merged = [...groups[g].cells, ...groups[g + 1].cells];
      const n = merged.length;
      const adj = Array.from({ length: n }, () => []);
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const d = Math.hypot(merged[i].x - merged[j].x, merged[i].y - merged[j].y);
          if (d <= t) { adj[i].push(j); adj[j].push(i); }
        }
      const vis = new Set([0]); const q = [0];
      while (q.length) { const nb = q.shift(); for (const x of adj[nb]) if (!vis.has(x)) { vis.add(x); q.push(x); } }
      if (vis.size !== n) return `FAIL g=${g} G${g}∪G${g+1}`;
    }
  }
  return 'PASS';
}

const BASE_CTX = {
  S: 3, P: 3, arrangement: 'custom',
  b_plus_side: 'left', b_minus_side: 'right',
  pitch, allow_I: true, exhaustive: true, budget_ms: 3000, max_candidates: 50,
};

let passed = 0, failed = 0;
function expect(label, got, expected) {
  const ok = expected === undefined ? got : got === expected;
  if (ok) { console.log(`  ✓ ${label}`); passed++; }
  else     { console.log(`  ✗ ${label}: got=${got}, want=${expected}`); failed++; }
}

// ── Test group 1: left-aligned ──────────────────────────────────────
console.log('\n[LEFT-ALIGNED layout]');
const cellsL = makeCells({ centerAlign: false });
const rL_none = enumerateGroupAssignments({ ...BASE_CTX, cells: cellsL });
console.log(`  no-pinned: ${rL_none.count} candidates`);
expect('left-align no-pinned ≥1', rL_none.count >= 1);
expect('left-align all pass P28③',
  rL_none.candidates.every(c => checkP28iii(c) === 'PASS'));

if (rL_none.count > 0) {
  const g0 = rL_none.candidates[0].groups[0].cells.map(c => ({ row: c.row, col: c.col }));
  const rL_pin = enumerateGroupAssignments({ ...BASE_CTX, cells: cellsL, pinned_groups: [g0] });
  console.log(`  pinned G0: ${rL_pin.count} candidates`);
  expect('left-align pinned ≥1', rL_pin.count >= 1);
  expect('left-align pinned all pass P28③',
    rL_pin.candidates.every(c => checkP28iii(c) === 'PASS'));
  // All pinned candidates must have G0 = pinned group
  const g0key = g0.map(({row,col}) => `r${row}c${col}`).sort().join(',');
  expect('left-align pinned G0 matches', rL_pin.candidates.every(c => {
    const k = c.groups[0].cells.map(cl => `r${cl.row}c${cl.col}`).sort().join(',');
    return k === g0key;
  }));
}

// ── Test group 2: center-aligned (P28③ blocks all cross-row) ────────
console.log('\n[CENTER-ALIGNED layout]');
const cellsC = makeCells({ centerAlign: true });
const rC_none = enumerateGroupAssignments({ ...BASE_CTX, cells: cellsC });
console.log(`  no-pinned: ${rC_none.count} candidates`);
expect('center-align no-pinned = 0 (P28③ blocks all)', rC_none.count, 0);

// With pinned, also 0 (consistent)
const dummyPin = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }];
const rC_pin = enumerateGroupAssignments({ ...BASE_CTX, cells: cellsC, pinned_groups: [dummyPin] });
console.log(`  pinned G0: ${rC_pin.count} candidates`);
expect('center-align pinned = 0 (consistent)', rC_pin.count, 0);

// ── Test group 3: all-same-row groups (no cross-row, should pass P28③) ─
// Layout: 2 rows of 3+3 = 6 cells left-aligned, S=2, P=3
console.log('\n[SAME-ROW groups: rows=[3,3] S=2 P=3]');
const cellsSR = [];
for (let col = 0; col < 3; col++) cellsSR.push({ x: col * pitch, y: 0, row: 0, col });
for (let col = 0; col < 3; col++) cellsSR.push({ x: col * pitch, y: pitch, row: 1, col });
const rSR = enumerateGroupAssignments({ ...BASE_CTX, S: 2, cells: cellsSR });
console.log(`  no-pinned: ${rSR.count} candidates`);
expect('same-row ≥1', rSR.count >= 1);
expect('same-row all pass P28③', rSR.candidates.every(c => checkP28iii(c) === 'PASS'));

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
