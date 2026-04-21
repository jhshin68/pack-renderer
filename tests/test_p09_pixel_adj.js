/**
 * test_p09_pixel_adj.js
 * 원칙 9 픽셀-거리 기반 인접성 검증
 *
 * 버그: isAdj가 row-local col index를 사용 → center-aligned 레이아웃에서
 *      같은 col 번호지만 물리적으로 비인접인 셀 쌍을 "인접"으로 오판 → 대각선 니켈선 생성
 *
 * Fix: isAdj를 픽셀 거리 기반으로 교체 (pitchPx * 1.05 threshold)
 */
'use strict';

const { render }  = require('../src/renderer.js');
const Gen         = require('../src/generator.js');

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}`); fail++; }
}

// SVG에서 모든 <line> 원소의 픽셀 거리 목록을 추출
function lineDistances(svg) {
  const re = /<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g;
  const dists = [];
  let m;
  while ((m = re.exec(svg)) !== null) {
    const [, x1, y1, x2, y2] = m.map(Number);
    dists.push(Math.hypot(x2 - x1, y2 - y1));
  }
  return dists;
}

function pitchPx(cell_type, scale) {
  const spec = { '18650': { render_d: 19.0 }, '21700': { render_d: 22.0 } }[cell_type];
  return spec.render_d * scale; // gap=0 기본
}

// ─────────────────────────────────────────────
// PA1: center-aligned rows=[5,8] S=2 face=bottom
//      → 모든 선이 pitch*1.1 이하여야 함
//      RED 단계에서는 long-diagonal(≈1.80P) 선이 존재하여 FAIL 예상
// ─────────────────────────────────────────────
{
  const scale = 3, cell_type = '18650';
  const pPx = pitchPx(cell_type, scale);
  const threshold = pPx * 1.1;

  const svg = render({
    arrangement: 'custom',
    rows: [5, 8],
    S: 2, P: 1,
    cell_type, scale,
    show_nickel: true,
    face: 'bottom',
    custom_align: 'center',
  });

  const dists = lineDistances(svg);
  const longLines = dists.filter(d => d > threshold);

  check('PA1: center rows=[5,8] S=2 — 비인접 대각선 선 없음 (count=0)',
    longLines.length === 0);

  if (longLines.length > 0) {
    console.log(`  └─ 비인접 선 ${longLines.length}개 발견: [${longLines.map(d => d.toFixed(1)).join(', ')}]px (threshold=${threshold.toFixed(1)}px)`);
  }
}

// ─────────────────────────────────────────────
// PA2: center-aligned rows=[5,8,10,13,13,13] S=13
//      → '원칙 9 위반' 오류 배너 OR 모든 선이 pitch*1.1 이하
//      (두 경우 모두 올바른 동작)
// ─────────────────────────────────────────────
{
  const scale = 3, cell_type = '18650';
  const pPx = pitchPx(cell_type, scale);
  const threshold = pPx * 1.1;

  const svg = render({
    arrangement: 'custom',
    rows: [5, 8, 10, 13, 13, 13],
    S: 13, P: 1,
    cell_type, scale,
    show_nickel: true,
    face: 'bottom',
    custom_align: 'center',
  });

  const hasError  = svg.includes('원칙 9 위반');
  const dists     = lineDistances(svg);
  const longLines = dists.filter(d => d > threshold);

  check('PA2: center rows=[5,8,10,13,13,13] S=13 — 오류 배너 OR 유효 선만 존재',
    hasError || longLines.length === 0);

  if (!hasError && longLines.length > 0) {
    console.log(`  └─ 오류 배너 없이 비인접 선 ${longLines.length}개 발견`);
  }
}

// ─────────────────────────────────────────────
// PA3 회귀: left-aligned rows=[5,8] S=2 → 정상 선만 (수정 전/후 모두 PASS여야 함)
// ─────────────────────────────────────────────
{
  const scale = 3, cell_type = '18650';
  const pPx = pitchPx(cell_type, scale);
  const threshold = pPx * 1.1;

  const svg = render({
    arrangement: 'custom',
    rows: [5, 8],
    S: 2, P: 1,
    cell_type, scale,
    show_nickel: true,
    face: 'bottom',
    custom_align: 'left',
  });

  const dists = lineDistances(svg);
  const longLines = dists.filter(d => d > threshold);

  check('PA3 회귀: left-aligned rows=[5,8] — 비인접 선 없음', longLines.length === 0);
}

// ─────────────────────────────────────────────
// PA4 회귀: rows=[10,3] S=13 → 원칙 9 위반 탐지 (수정 전/후 모두 PASS여야 함)
// ─────────────────────────────────────────────
{
  const svg = render({
    arrangement: 'custom',
    rows: [10, 3],
    S: 13, P: 1,
    cell_type: '18650', scale: 3,
    show_nickel: true,
    face: 'top',
  });

  check('PA4 회귀: rows=[10,3] S=13 — 원칙 9 위반 탐지', svg.includes('원칙 9 위반'));
}

// ─────────────────────────────────────────────
// PA5: 동일 폭 인접 행 rows=[5,5] S=2 → 유효 인접 선 반드시 존재 (선이 하나도 없으면 과잉 차단)
// ─────────────────────────────────────────────
{
  const scale = 3, cell_type = '18650';
  const pPx = pitchPx(cell_type, scale);

  const svg = render({
    arrangement: 'custom',
    rows: [5, 5],
    S: 2, P: 1,
    cell_type, scale,
    show_nickel: true,
    face: 'bottom',
    custom_align: 'center',
  });

  const dists = lineDistances(svg);
  check('PA5: 동일 폭 rows=[5,5] — 유효 인접 선 존재 (과잉 차단 아님)',
    dists.length > 0 && dists.every(d => d <= pPx * 1.1));
}

// ─────────────────────────────────────────────
// PA6: P9 에러 SVG 메시지에 "극성 표시 없음 (P9 위반 상태)" 포함 (Phase 1.5)
// ─────────────────────────────────────────────
{
  const svg = render({
    arrangement: 'custom',
    rows: [10, 3],
    S: 13, P: 1,
    cell_type: '18650', scale: 3,
    show_nickel: false, face: 'top',
  });
  check('PA6: P9 위반 SVG — "극성 표시 없음" 메시지 포함', svg.includes('극성 표시 없음'));
}

// ─────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
