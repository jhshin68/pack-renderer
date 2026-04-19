/**
 * 13S4P 커스텀 엇배열 후보 열거 테스트
 * 배열: (10, 12:-2, 13:-2, 12:-2, 5:-1)
 */
'use strict';
const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const genSrc = fs.readFileSync(path.join(__dirname, '../src/generator.js'), 'utf8');

// require를 주지 않아 UMD의 global 경로 사용 → pentomino require 우회
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(genSrc, ctx);
const Generator = ctx.Generator;

const CELL_SPEC = {
  '21700': { render_d: 21, nominal_d: 21.0 },
  '18650': { render_d: 18.65, nominal_d: 18.65 },
  '26650': { render_d: 26, nominal_d: 26.0 },
};

const S = 13, P = 4;
const rows        = [10, 12, 13, 12, 5];
const row_offsets = [0, -2, -2, -2, -1];

const customParams = {
  S, P,
  cell_type: '21700',
  arrangement: 'custom',
  custom_stagger: true,
  custom_stagger_dir: 'R',
  layout: 'auto',
  scale: 1.5,
  nickel_w_mm: 4.0,
  margin_mm: 8.0,
  gap: 0.5,
  rows,
  row_offsets,
  b_plus_side: 'left',
  b_minus_side: 'right',
};

// 1. 셀 좌표 계산
const cc    = Generator.calcCustomCenters(rows, customParams, CELL_SPEC);
const cells = cc.pts;
console.log(`셀 수: ${cells.length} (기대: ${S*P} = ${S}×${P})`);
console.log(`pitch: ${cc.pitch.toFixed(2)} px`);

// 행별 셀 수 확인
const rowCounts = {};
cells.forEach(c => { rowCounts[c.row] = (rowCounts[c.row]||0) + 1; });
console.log('행별 셀:', Object.entries(rowCounts).map(([r,n]) => `r${r}:${n}`).join(', '));

// 2. 그룹 배정 열거
const t0 = Date.now();
const result = Generator.enumerateGroupAssignments({
  cells, S, P,
  arrangement: 'custom',
  b_plus_side: 'left',
  b_minus_side: 'right',
  icc1: true, icc2: true, icc3: false,
  nickel_w: 4.0 * 1.5,
  max_candidates: 40,
  g0_anchor: null,
  allow_I: false,
  allow_U: false,
});
const elapsed = Date.now() - t0;

console.log(`\n--- 열거 결과 ---`);
console.log(`전략: ${result.strategy}`);
console.log(`총 후보 (count): ${result.count}개`);
console.log(`반환 후보: ${(result.candidates||[]).length}개`);
console.log(`소요 시간: ${elapsed}ms`);
if (result.error) console.log(`오류: ${result.error}`);

// 후보별 품질 점수
const cands = result.candidates || [];
cands.slice(0, 15).forEach((c, i) => {
  const scores = (c.groups||[]).map(g =>
    g.quality_score > 0 ? '+' : g.quality_score < 0 ? '-' : '0'
  ).join('');
  const posN = (c.groups||[]).filter(g => g.quality_score > 0).length;
  console.log(`  #${i+1}: [${scores}]  +그룹: ${posN}`);
});
if (cands.length > 15) console.log(`  ... 이후 ${cands.length - 15}개 생략`);
