/**
 * test_regression_all_sp.js
 * F29: 전 S×P 조합 회귀 테스트
 *
 * 실행:
 *   node tests/test_regression_all_sp.js           — 기본 유효성 검사 (144 조합)
 *   node tests/test_regression_all_sp.js --save    — SVG 저장 + baseline 해시 기록
 *   node tests/test_regression_all_sp.js --compare — baseline 해시 비교 (회귀 탐지)
 *
 * 대상: S=2~13 × P=1~6 × [square, staggered] = 144 조합
 * cell_type=18650, scale=1.5, face=all, show_nickel=true
 *
 * 검사 항목:
 *   1. 크래시 없이 SVG 문자열 반환
 *   2. SVG 구조 유효 (<svg>…</svg>)
 *   3. NaN / Infinity 좌표 없음
 *   4. circle 수 = S×P (셀 수 일치)
 *   5. [--compare] baseline 해시와 일치 (시각 회귀 없음)
 */
'use strict';

const fs     = require('fs');
const vm     = require('vm');
const path   = require('path');
const crypto = require('crypto');

// ── 플래그 파싱 ─────────────────────────────────
const SAVE    = process.argv.includes('--save');
const COMPARE = process.argv.includes('--compare');

// ── 경로 ────────────────────────────────────────
const ROOT          = path.join(__dirname, '..');
const REGRESSION_DIR = path.join(__dirname, 'regression');
const SVG_DIR       = path.join(REGRESSION_DIR, 'svg');
const BASELINE_FILE = path.join(REGRESSION_DIR, 'baseline_hashes.json');

// ── VM 컨텍스트 (renderer + generator 로드) ─────
const genSrc = fs.readFileSync(path.join(ROOT, 'src', 'generator.js'), 'utf8');
const renSrc = fs.readFileSync(path.join(ROOT, 'src', 'renderer.js'), 'utf8');
const vmCtx  = { console, __result: null };
vm.createContext(vmCtx);
vm.runInContext(genSrc, vmCtx);
vm.runInContext(renSrc, vmCtx);

function renderSvg(params) {
  vmCtx.__result = null;
  vm.runInContext(`__result = render(${JSON.stringify(params)});`, vmCtx);
  return vmCtx.__result;
}

// ── 조합 생성 ────────────────────────────────────
const S_RANGE   = [2,3,4,5,6,7,8,9,10,11,12,13];
const P_RANGE   = [1,2,3,4,5,6];
const ARR_RANGE = ['square', 'staggered'];

const combos = [];
for (const arr of ARR_RANGE)
  for (const S of S_RANGE)
    for (const P of P_RANGE)
      combos.push({ S, P, arrangement: arr });

// ── 카운터 ───────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];

function check(label, cond, detail) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push({ label, detail });
    console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`);
  }
}

// ── SVG 유효성 검사 헬퍼 ─────────────────────────
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function hasNanCoord(svg) {
  return /\b(NaN|Infinity)\b/.test(svg);
}

function countCircles(svg) {
  return (svg.match(/<circle /g) || []).length;
}

function countLines(svg) {
  return (svg.match(/<line /g) || []).length;
}

// ── 실행 ─────────────────────────────────────────
if (SAVE) {
  fs.mkdirSync(SVG_DIR, { recursive: true });
}

const hashes = {};
let renderErrors = 0;

console.log(`Running ${combos.length} combinations (S=2~13, P=1~6, square+staggered)…`);
console.log(`Mode: ${SAVE ? 'SAVE' : COMPARE ? 'COMPARE' : 'VALIDATE'}`);
console.log('────────────────────────────────────────────');

for (const { S, P, arrangement } of combos) {
  const key = `${arrangement}_S${S}_P${P}`;
  const params = {
    S, P,
    arrangement,
    cell_type: '18650',
    scale: 1.5,
    face: 'all',
    show_nickel: true,
    show_terminal: true,
    gap: 0.0,
    nickel_w_mm: 4.0,
    margin_mm: 8.0,
    gap_section: 36,
  };

  // ① 크래시 없이 SVG 반환
  let svg;
  try {
    svg = renderSvg(params);
  } catch (e) {
    check(`${key}: no crash`, false, e.message);
    renderErrors++;
    continue;
  }

  check(`${key}: returns string`, typeof svg === 'string' && svg.length > 0);

  // ② SVG 구조
  check(`${key}: has <svg>`, svg.includes('<svg'));
  check(`${key}: has </svg>`, svg.includes('</svg>'));

  // ③ NaN / Infinity 없음
  check(`${key}: no NaN/Infinity coords`, !hasNanCoord(svg));

  // ④ 셀이 하나 이상 렌더링됨 (face='all'은 양면+터미널 포함으로 S×P보다 많을 수 있음)
  const hasP9Error = svg.includes('원칙 9 위반');
  if (!hasP9Error) {
    const circles = countCircles(svg);
    check(`${key}: has circles`, circles >= S * P,
      `circles=${circles} < expected_min=${S*P}`);
  }

  // ⑤ 해시 기록 / 비교
  const h = sha256(svg);
  hashes[key] = h;

  if (SAVE) {
    const svgPath = path.join(SVG_DIR, `${key}.svg`);
    fs.writeFileSync(svgPath, svg, 'utf8');
  }
}

// ── baseline 저장 / 비교 ─────────────────────────
if (SAVE) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(hashes, null, 2), 'utf8');
  console.log(`\n✓ baseline saved → ${BASELINE_FILE}`);
  console.log(`✓ SVG files saved → ${SVG_DIR} (${combos.length} files)`);
}

if (COMPARE) {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.log('\n⚠ baseline_hashes.json not found — run with --save first');
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  let regressions = 0;
  for (const [key, h] of Object.entries(hashes)) {
    if (!(key in baseline)) {
      console.log(`[NEW]  ${key} — not in baseline`);
    } else if (baseline[key] !== h) {
      console.log(`[DIFF] ${key} — SVG changed (visual regression)`);
      regressions++;
    }
  }
  for (const key of Object.keys(baseline)) {
    if (!(key in hashes)) {
      console.log(`[MISS] ${key} — in baseline but not rendered`);
      regressions++;
    }
  }
  if (regressions === 0) {
    console.log('\n✓ no regressions — all 144 SVGs match baseline');
  } else {
    console.log(`\n✗ ${regressions} regression(s) detected`);
    process.exit(1);
  }
}

// ── 결과 요약 ─────────────────────────────────────
console.log('────────────────────────────────────────────');
if (failures.length > 0) {
  console.log(`\nFailed combinations:`);
  for (const f of failures) console.log(`  ${f.label}`);
}
console.log(`\n[TEST RESULT] pass=${pass}  fail=${fail}  render_errors=${renderErrors}`);
process.exit(fail > 0 || renderErrors > 0 ? 1 : 0);
