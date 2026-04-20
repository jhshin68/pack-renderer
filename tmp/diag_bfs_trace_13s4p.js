/**
 * BFS-MRV 단계 추적기 — 13S4P 엇배열 커스텀
 * rows=[10,12,13,12,5], row_offsets=[0,-2,-2,-2,-1], stagDir='R'
 *
 * 실제 generator.js 코드와 동일한 로직을 tracing 로그와 함께 재현한다.
 * 코드 변경 없음 — 진단 전용.
 */

'use strict';
const path = require('path');
const Generator = require(path.join(__dirname, '..', 'src', 'generator.js'));
Generator.loadSpec();

const CELL_SPEC = { '18650': { render_d: 19.0 }, '21700': { render_d: 22.0 } };
const rows = [10, 12, 13, 12, 5];
const params = {
  cell_type: '18650',
  gap: 0,
  scale: 1,
  margin_mm: 5,
  row_offsets: [0, -2, -2, -2, -1],
  custom_stagger: true,
  custom_stagger_dir: 'R',
  custom_align: 'left',
};

const { pts, pitch } = Generator.calcCustomCenters(rows, params, CELL_SPEC);
const N = pts.length;

// 1-based 셀 번호 (행×열 순서)
const cellName = (i) => `#${i + 1}`;

console.log(`\n${'═'.repeat(60)}`);
console.log(`13S4P BFS-MRV 단계 추적 (N=${N}, pitch=${pitch.toFixed(3)})`);
console.log(`${'═'.repeat(60)}`);

// ── STEP 0: ASCII 맵 출력 ───────────────────────────────────────
console.log('\n[STEP 0] 셀 배치 ASCII 맵 (pitch 단위 x좌표 기준)\n');
const minX = Math.min(...pts.map(p => p.x));
const charPerPitch = 5; // 칸 너비

// 행별로 출력
let rowBounds = [];
let r = 0, idx = 0;
for (const n of rows) {
  rowBounds.push({ r, start: idx, n });
  idx += n;
  r++;
}

for (const { r, start, n } of rowBounds) {
  const rowPts = pts.slice(start, start + n);
  const minRowX = Math.min(...rowPts.map(p => p.x));
  const offsetChars = Math.round((minRowX - minX) / pitch * charPerPitch);
  let line = `Row${r}: ` + ' '.repeat(Math.max(0, offsetChars));
  for (let i = 0; i < n; i++) {
    const cellNum = start + i + 1;
    line += `[${String(cellNum).padStart(2)}]`;
  }
  console.log(line);
}

// ── 인접성 구축 ───────────────────────────────────────────────────
const thr = pitch * 1.5;
const adjL = Array.from({ length: N }, () => []);
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++) {
    const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
    if (Math.hypot(dx, dy) <= thr) {
      adjL[i].push(j); adjL[j].push(i);
    }
  }
}

// ── B+/B- 경계 셀 ─────────────────────────────────────────────────
// 각 행의 최소x = B+, 최대x = B-
const bPlus = new Set(), bMinus = new Set();
for (const { start, n } of rowBounds) {
  let minXi = start, maxXi = start;
  for (let i = start; i < start + n; i++) {
    if (pts[i].x < pts[minXi].x) minXi = i;
    if (pts[i].x > pts[maxXi].x) maxXi = i;
  }
  bPlus.add(minXi); bMinus.add(maxXi);
}

console.log(`\nB+ (left 경계): ${[...bPlus].map(i => cellName(i)).join(', ')}`);
console.log(`B- (right 경계): ${[...bMinus].map(i => cellName(i)).join(', ')}`);

// ── scanByX ───────────────────────────────────────────────────────
const scanByX = [...Array(N).keys()]
  .sort((a, b) => pts[a].x - pts[b].x || pts[a].y - pts[b].y);

const bPlusStartCells = scanByX.filter(i => bPlus.has(i));
console.log(`\nbPlusStartCells (scanByX 순): ${bPlusStartCells.map(i => cellName(i)).join(', ')}`);

// ── BFS-MRV 트레이스 ──────────────────────────────────────────────
const S = 13, P = 4;

function pickMRV(candidates, used) {
  let best = -1, bestD = Infinity;
  for (const c of candidates) {
    const d = adjL[c].filter(j => !used[j]).length;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

let stepNum = 0;
const allResults = [];

for (const g0start of bPlusStartCells) {
  const used = new Uint8Array(N);
  const allSnaps = [];
  let ok = true;
  let prevGroup = null;
  const stepLog = [];

  for (let g = 0; g < S; g++) {
    // 그룹 시작점 결정
    let start = -1;
    let startReason = '';
    if (g === 0) {
      start = g0start;
      startReason = 'B+ 시작점';
    } else {
      for (const i of scanByX) {
        if (!used[i] && prevGroup.some(pi => adjL[pi].includes(i))) {
          start = i; startReason = `prevGroup 인접 (scanByX 최소x)`; break;
        }
      }
      if (start < 0) {
        for (const i of scanByX) if (!used[i]) { start = i; startReason = 'fallback (비인접)'; break; }
      }
    }
    if (start < 0) { ok = false; break; }

    stepNum++;
    const group = [start];
    used[start] = 1;
    const frontier = new Set(adjL[start].filter(j => !used[j]));

    stepLog.push({
      step: stepNum, g, cellInGroup: 1, cell: start,
      how: startReason,
      frontier: [...frontier],
      mrv_candidates: null, mrv_scores: null,
    });

    while (group.length < P && frontier.size > 0) {
      const candidates = [...frontier];
      // MRV 점수 계산
      const scores = candidates.map(c => ({
        idx: c, d: adjL[c].filter(j => !used[j]).length
      }));
      const next = pickMRV(candidates, used);
      if (next < 0) break;

      group.push(next); used[next] = 1; frontier.delete(next);
      for (const nb of adjL[next]) if (!used[nb]) frontier.add(nb);

      stepNum++;
      stepLog.push({
        step: stepNum, g, cellInGroup: group.length, cell: next,
        how: 'BFS-MRV',
        mrv_candidates: scores,
        frontier: [...frontier],
      });
    }

    if (group.length < P) { ok = false; break; }
    if (g === S - 1 && !group.some(i => bMinus.has(i))) { ok = false; break; }

    allSnaps.push([...group]);
    prevGroup = [...group];
  }

  allResults.push({ g0start, ok, steps: stepLog, groups: allSnaps });
  if (ok) break; // 첫 성공 후보만 추적
}

// ── 출력 ─────────────────────────────────────────────────────────
const result = allResults[0];
if (!result) {
  console.log('\n[ERROR] 결과 없음');
  process.exit(1);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`g0start: ${cellName(result.g0start)} | 최종 상태: ${result.ok ? '성공 ✓' : '실패 ✗'}`);
console.log(`${'─'.repeat(60)}`);

for (const s of result.steps) {
  const cell = pts[s.cell];
  const isBPlus = bPlus.has(s.cell) ? ' [B+]' : '';
  const isBMinus = bMinus.has(s.cell) ? ' [B-]' : '';
  const connType = s.g > 0 && s.cellInGroup === 1 ? '직렬(S) — 새 그룹' : '병렬(P) — 그룹 내';

  console.log(`\n[Step ${String(s.step).padStart(2)} / 52]`);
  console.log(`  그룹: G${s.g} (P기준 ${s.cellInGroup}/${P}번째 셀)`);
  console.log(`  선택 셀: ${cellName(s.cell)} (Row${cell.row}, Col${cell.col})${isBPlus}${isBMinus}`);
  console.log(`  연결 유형: ${connType}`);
  console.log(`  선택 근거: ${s.how}`);

  if (s.mrv_candidates) {
    const sorted = [...s.mrv_candidates].sort((a, b) => a.d - b.d);
    const winner = s.mrv_candidates.find(c => c.idx === s.cell);
    console.log(`  MRV 후보 (d=미사용이웃수):`);
    for (const c of sorted) {
      const mark = c.idx === s.cell ? ' ← 선택' : '';
      console.log(`    ${cellName(c.idx)} d=${c.d}${mark}`);
    }
  }

  if (s.frontier.length > 0) {
    console.log(`  다음 frontier: ${s.frontier.map(i => cellName(i)).join(', ')}`);
  }

  // 그룹 완성 시 요약
  if (s.cellInGroup === P) {
    const gCells = result.groups[s.g];
    console.log(`  ★ G${s.g} 완성: [${gCells.map(i => cellName(i)).join(', ')}]`);
  }
}

console.log(`\n${'═'.repeat(60)}`);
if (result.ok) {
  console.log('\n최종 그룹 배정:');
  for (let g = 0; g < result.groups.length; g++) {
    const bpMark = result.groups[g].some(i => bPlus.has(i)) ? ' [B+]' : '';
    const bmMark = result.groups[g].some(i => bMinus.has(i)) ? ' [B-]' : '';
    console.log(`  G${g}: [${result.groups[g].map(i => cellName(i)).join(', ')}]${bpMark}${bmMark}`);
  }
} else {
  console.log('[FAIL] 완전한 52-step 배정 실패');
  const lastStep = result.steps[result.steps.length - 1];
  if (lastStep) console.log(`마지막 step: ${lastStep.step}, G${lastStep.g}`);
}
