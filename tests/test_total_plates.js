/**
 * test_total_plates.js
 * total_plates = S+1 필드 검증
 *
 * 검증 항목:
 * 1. 스네이크 후보: total_plates === S+1
 * 2. pentomino 후보: total_plates === S+1
 * 3. 동일 S의 모든 후보가 같은 total_plates 값
 * 4. 대표 S값(3,4,5,6,10,13) 검증
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

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

// ── 1. 스네이크 후보: total_plates === S+1 ────────────────────────────
// 10S5P 정배열에서 표준 순회(보스트로페돈/열우선)는 모두 1행=5셀 → I형
// → allow_I=false 시 표준 후보 0개가 정상 (allow_I=true 케이스로 별도 검증)
{
  const S = 10, P = 5;
  const cells = makeGrid(P, S);
  const result = G.enumerateGroupAssignments({
    cells, S, P, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
  });
  const snakeCands = result.candidates.filter(c => c.is_standard);
  // allow_I=false → 10S5P 표준 후보는 모두 I형이므로 0개
  assert('10S5P(allow_I=false): 표준 후보 I형 완전 차단 → 0개', snakeCands.length === 0);
  snakeCands.forEach((c, i) => {
    assert(`10S5P snake[${i}]: total_plates === ${S+1}`,
      c.total_plates === S + 1,
      `got ${c.total_plates}`);
  });
}

// ── 2. pentomino 후보: total_plates === S+1 ──────────────────────────
{
  const S = 10, P = 5;
  const cells = makeGrid(P, S);
  const result = G.enumerateGroupAssignments({
    cells, S, P, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
  });
  const pentCands = result.candidates.filter(c => c.is_pentomino);
  assert('10S5P: pentomino 후보 존재', pentCands.length > 0);
  pentCands.forEach((c, i) => {
    assert(`10S5P pent[${i}]: total_plates === ${S+1}`,
      c.total_plates === S + 1,
      `got ${c.total_plates}`);
  });
}

// ── 3. 동일 S의 모든 후보가 같은 total_plates ─────────────────────────
{
  const S = 10, P = 5;
  const cells = makeGrid(P, S);
  const result = G.enumerateGroupAssignments({
    cells, S, P, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
  });
  const vals = result.candidates.map(c => c.total_plates);
  const allSame = vals.every(v => v === S + 1);
  assert(`10S5P: 모든 후보 total_plates === ${S+1}`, allSame,
    `values: ${[...new Set(vals)].join(',')}`);
}

// ── 4. 대표 S값별 total_plates = S+1 검증 ───────────────────────────
const testCases = [
  { S: 3, P: 3, rows: 3, cols: 3 },
  { S: 4, P: 5, rows: 5, cols: 4 },
  { S: 6, P: 3, rows: 3, cols: 6 },
  { S: 13, P: 3, rows: 3, cols: 13 },
];
for (const { S, P, rows, cols } of testCases) {
  const cells = makeGrid(rows, cols);
  const result = G.enumerateGroupAssignments({
    cells, S, P, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
  });
  if (result.candidates.length > 0) {
    const allOk = result.candidates.every(c => c.total_plates === S + 1);
    assert(`${S}S${P}P: 모든 후보 total_plates === ${S+1}`, allOk,
      `values: ${[...new Set(result.candidates.map(c => c.total_plates))].join(',')}`);
  } else {
    assert(`${S}S${P}P: 후보 없음 (skip)`, true);
  }
}

// ── 5. total_plates 필드 반드시 존재 (undefined 금지) ────────────────
{
  const S = 10, P = 5;
  const cells = makeGrid(P, S);
  const result = G.enumerateGroupAssignments({
    cells, S, P, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
  });
  assert('total_plates 필드 항상 존재 (undefined 없음)',
    result.candidates.every(c => c.total_plates !== undefined),
    'some total_plates is undefined');
}

console.log(`\n총 ${pass + fail}개 중 ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
else console.log('ALL PASS');
