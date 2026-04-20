'use strict';
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

const result = G.enumerateGroupAssignments({
  cells: pts, S: 13, P: 4,
  arrangement: 'custom',
  b_plus_side: 'left', b_minus_side: 'right',
  pitch,
});

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

assert('후보 존재', result.candidates.length >= 1);

if (result.candidates.length >= 1) {
  const g0cells = result.candidates[0].groups[0].cells;
  const g0indices = g0cells.map(c => pts.indexOf(c) + 1);
  console.log(`G0 셀: [${g0indices.join(', ')}]`);

  // max pairwise distance in G0 ≤ 2*pitch (compact cluster, not spanning 4 rows)
  const dists = g0cells.flatMap((a, i) =>
    g0cells.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.y - b.y))
  );
  const maxDist = Math.max(...dists);
  console.log(`G0 max pairwise dist = ${maxDist.toFixed(1)}mm, 2*pitch = ${(2 * pitch).toFixed(1)}mm`);
  assert('G0 컴팩트: max pairwise dist ≤ 2*pitch', maxDist <= 2 * pitch,
    `maxDist=${maxDist.toFixed(1)}mm > ${(2 * pitch).toFixed(1)}mm`);

  // G0 must NOT be an I-shape (linear chain / zigzag path)
  // Same algorithm as generator._isLinearGroup
  function isLinearGroup(gc) {
    if (gc.length < 4) return false;
    const xs = gc.map(c => Math.round(c.x * 10));
    const ys = gc.map(c => Math.round(c.y * 10));
    if (new Set(xs).size === 1 || new Set(ys).size === 1) return true;
    let minDist = Infinity;
    for (let i = 0; i < gc.length; i++)
      for (let j = i + 1; j < gc.length; j++) {
        const d = Math.hypot(gc[i].x - gc[j].x, gc[i].y - gc[j].y);
        if (d < minDist) minDist = d;
      }
    const localThr = minDist * 1.6;
    const deg = new Array(gc.length).fill(0);
    for (let i = 0; i < gc.length; i++)
      for (let j = i + 1; j < gc.length; j++)
        if (Math.hypot(gc[i].x - gc[j].x, gc[i].y - gc[j].y) <= localThr) {
          deg[i]++; deg[j]++;
        }
    return !deg.some(d => d > 2) && deg.filter(d => d === 1).length === 2;
  }
  assert('G0 I형(직선 체인) 아님', !isLinearGroup(g0cells),
    `G0 rows=[${[...new Set(g0cells.map(c => c.row))].join(',')}]`);

  // G0 must span at most 2 rows (horizontal-first: same-row picks before diagonal)
  const g0Rows = new Set(g0cells.map(c => c.row));
  console.log(`G0 행 구성: [${[...g0Rows].join(', ')}]`);
  assert('G0 행 스팬 ≤ 2개', g0Rows.size <= 2,
    `행 스팬=${g0Rows.size} (rows: [${[...g0Rows].join(',')}])`);

  // Full assignment: all 52 cells covered
  const allCells = new Set();
  for (const grp of result.candidates[0].groups) {
    for (const c of grp.cells) allCells.add(pts.indexOf(c));
  }
  assert('전체 52셀 배정', allCells.size === 52, `배정 셀 수=${allCells.size}`);

  // G12 (last group) must contain a B- boundary cell
  const lastGroup = result.candidates[0].groups[12];
  if (lastGroup) {
    const xVals = pts.map(c => c.x);
    const rowStarts = [];
    let idx = 0;
    for (const n of rows) { rowStarts.push(idx); idx += n; }
    const bMinus = new Set();
    for (let r = 0; r < rows.length; r++) {
      let maxXi = rowStarts[r];
      for (let i = rowStarts[r]; i < rowStarts[r] + rows[r]; i++) {
        if (pts[i].x > pts[maxXi].x) maxXi = i;
      }
      bMinus.add(maxXi);
    }
    const g12HasBMinus = lastGroup.cells.some(c => bMinus.has(pts.indexOf(c)));
    assert('G12에 B- 셀 포함', g12HasBMinus);
  }
}

console.log(`\n총 ${pass + fail}개 중 ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
else console.log('ALL PASS');
