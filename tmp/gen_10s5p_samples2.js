/**
 * 10S5P 정배열 샘플 5종 (batch 2) — 1자 배열 제외
 * 각 배열별 니켈플레이트 수 + 종수(m_distinct) 출력
 */
const fs   = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const Generator = require(path.join(root, 'src', 'generator.js'));
const Renderer  = require(path.join(root, 'src', 'renderer.js'));

const S = 10, P = 5;
const base = {
  cell_type: '21700', S, P,
  gap: 0.0, scale: 3.8, margin_mm: 4, nickel_w_mm: 3.5,
  gap_section: 24, show_nickel: true, show_terminal: true,
  face: 'all', custom_stagger: false,
};
const CELL_SPEC = Renderer.CELL_SPEC;

// ─── 정배열 신규 5종 ───────────────────────────────────
const samples = [
  { name: '06_rect_5x10',        label: '직사각 5행×10열',          rows: [10,10,10,10,10],       custom_align: 'center' },
  { name: '07_step_btm_wide',    label: '계단 하단폭 (8행)',         rows: [5,5,5,5,5,5,10,10],   custom_align: 'left'   },
  { name: '08_step_top_wide',    label: '계단 상단폭 (8행)',         rows: [10,10,5,5,5,5,5,5],   custom_align: 'left'   },
  { name: '09_step_7rows',       label: '계단 7행 (하단폭)',         rows: [5,5,5,5,10,10,10],    custom_align: 'left'   },
  { name: '10_uniform_6rows',    label: '균등 6행 [8,8,8,8,9,9]',   rows: [8,8,8,8,9,9],         custom_align: 'left'   },
];

// ─── 그룹 셀 추출 (renderCustomRows와 동일 로직) ────────
function getGroupCells(rows, params) {
  const { pts, pitch } = Generator.calcCustomCenters(rows, params, CELL_SPEC);
  const N = pts.length;
  const cellsPerGroup = Math.ceil(N / S);

  const byRow = rows.map(() => []);
  pts.forEach(pt => byRow[pt.row].push(pt));
  const snake = [];
  for (let r = 0; r < byRow.length; r++) {
    const row = [...byRow[r]];
    if (r % 2 === 1) row.reverse();
    snake.push(...row);
  }
  const groupCells = Array.from({ length: S }, () => []);
  snake.forEach((pt, i) => {
    const g = Math.min(S - 1, Math.floor(i / cellsPerGroup));
    groupCells[g].push(pt);
  });
  return { groupCells, pitch };
}

// ─── 플레이트 목록 생성 (renderer buildNickel 로직 재현) ─
function getPlates(groupCells, face) {
  const plates = [];
  const paired = new Set();
  const pStart = face === 'top' ? 1 : 0;
  for (let g = pStart; g + 1 < S; g += 2) {
    plates.push({ cells: [...groupCells[g], ...groupCells[g + 1]], face, idx: g });
    paired.add(g); paired.add(g + 1);
  }
  for (let g = 0; g < S; g++) {
    if (!paired.has(g))
      plates.splice(g === 0 ? 0 : plates.length, 0,
        { cells: [...groupCells[g]], face, idx: g });
  }
  return plates;
}

// ─── 정수 그리드 좌표 정규화 ─────────────────────────────
function toGrid(cells, pitch) {
  return cells.map(c => ({
    col: Math.round(c.x / pitch),
    row: Math.round(c.y / pitch),
  }));
}

function normalize(pts) {
  const minC = Math.min(...pts.map(p => p.col));
  const minR = Math.min(...pts.map(p => p.row));
  return pts.map(p => ({ col: p.col - minC, row: p.row - minR }))
    .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
}

function sigOf(pts) {
  return normalize(pts).map(p => `${p.col},${p.row}`).join('|');
}

function rot90(pts)  { return pts.map(p => ({ col: -p.row, row:  p.col })); }
function rot180(pts) { return pts.map(p => ({ col: -p.col, row: -p.row })); }
function rot270(pts) { return pts.map(p => ({ col:  p.row, row: -p.col })); }

function canonical(cells, pitch) {
  const base = toGrid(cells, pitch);
  const sigs = [base, rot90(base), rot180(base), rot270(base)].map(r => sigOf(r));
  return sigs.sort()[0];
}

// ─── 메인 ────────────────────────────────────────────────
const outDir = path.join(__dirname);
console.log('\n10S5P 정배열 샘플 batch 2\n');
console.log(`${'배열'.padEnd(22)} ${'총 셀'.padEnd(6)} ${'플레이트 수'.padEnd(12)} ${'종수(m_distinct)'.padEnd(16)} ${'원칙9'}`);
console.log('─'.repeat(72));

samples.forEach(({ name, label, rows, custom_align }) => {
  const params = { ...base, rows, custom_align };
  const total = rows.reduce((a, b) => a + b, 0);

  // SVG 생성
  let violated = false;
  try {
    const svg = Renderer.renderCustomRows(params);
    violated = svg.includes('원칙 9 위반');
    const outPath = path.join(outDir, `10s5p_${name}.svg`);
    fs.writeFileSync(outPath, svg, 'utf8');
  } catch (e) {
    console.log(`${label.padEnd(22)} ERROR: ${e.message}`);
    return;
  }

  // 플레이트 분석
  const { groupCells, pitch } = getGroupCells(rows, params);
  const topPlates = getPlates(groupCells, 'top');
  const botPlates = getPlates(groupCells, 'bottom');
  const allPlates = [...topPlates, ...botPlates];
  const plateCount = allPlates.length;   // = S+1 = 11

  const sigSet = new Set(allPlates.map(pl => canonical(pl.cells, pitch)));
  const mDistinct = sigSet.size;

  const p9 = violated ? '❌ 위반' : '✅ OK';
  console.log(`${label.padEnd(22)} ${String(total).padEnd(6)} ${String(plateCount).padEnd(12)} ${String(mDistinct).padEnd(16)} ${p9}`);
});

console.log('\nSVG 5종 저장 완료 → tmp/10s5p_06~10.svg');
