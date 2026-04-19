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

// ══════════════════════════════════════════════════════
// 커스텀 배열 테스트 (F29 확장)
// ══════════════════════════════════════════════════════
const CUSTOM_COMBOS = [
  { S:3,  P:2, rows:[3,3],             offsets:[0,0],        label:'3S2P_2행' },
  { S:4,  P:3, rows:[6,6],             offsets:[0,0],        label:'4S3P_2행' },
  { S:4,  P:2, rows:[4,4],             offsets:[0,0],        label:'4S2P_2행' },
  { S:7,  P:3, rows:[7,7,7],           offsets:[0,0,0],      label:'7S3P_3행' },
  { S:10, P:3, rows:[10,10,10],        offsets:[0,0,0],      label:'10S3P_3행' },
  { S:13, P:4, rows:[5,12,13,12,10],   offsets:[-1,-2,-2,-2,0], label:'13S4P_비균일' },
  { S:2,  P:2, rows:[2,2],             offsets:[0,0],        label:'2S2P_최소' },
  { S:5,  P:1, rows:[5],               offsets:[0],          label:'5S1P_1행' },
  { S:6,  P:4, rows:[12,12],           offsets:[0,0],        label:'6S4P_2행' },
];

console.log('\n═══════════════════════════════════════════');
console.log(`커스텀 배열 테스트 (${CUSTOM_COMBOS.length} × stagger OFF/ON = ${CUSTOM_COMBOS.length * 2})`);
console.log('═══════════════════════════════════════════');

for (const tc of CUSTOM_COMBOS) {
  for (const stagger of [false, true]) {
    const key = `custom_${tc.label}_stag${stagger ? 'ON' : 'OFF'}`;
    const renderParams = {
      S: tc.S, P: tc.P, arrangement: 'custom',
      cell_type: '21700', scale: 1.5, face: 'all',
      show_nickel: true, show_terminal: true,
      gap: 0, nickel_w_mm: 4.0, margin_mm: 8.0, gap_section: 36,
      rows: tc.rows, row_offsets: tc.offsets,
      custom_align: 'center',
      custom_stagger: stagger, custom_stagger_dir: 'R',
    };

    // ① 크래시 없이 SVG 반환
    let svg;
    try { svg = renderSvg(renderParams); }
    catch(e) { check(`${key}: no crash`, false, e.message); continue; }
    check(`${key}: returns SVG`, typeof svg === 'string' && svg.includes('<svg'));
    check(`${key}: no NaN`, !hasNanCoord(svg));

    // ② 셀 수
    if (!svg.includes('원칙 9 위반')) {
      const circles = countCircles(svg);
      check(`${key}: circles >= S*P`, circles >= tc.S * tc.P,
        `circles=${circles}, expected>=${tc.S * tc.P}`);
    }

    // ③ 후보 열거 (enumerateGroupAssignments 직접 호출)
    let candCount = 0;
    try {
      const CELL_SPEC = {
        '18650': { actual_d: 18.0, render_d: 19.0, pitch_default: 20.0, pitch_min: 19.5 },
        '21700': { actual_d: 21.0, render_d: 22.0, pitch_default: 23.0, pitch_min: 22.5 },
      };
      const cc = vmCtx.Generator.calcCustomCenters(tc.rows,
        { ...renderParams, custom_stagger: stagger }, CELL_SPEC);
      const enumResult = vmCtx.Generator.enumerateGroupAssignments({
        cells: cc.pts, S: tc.S, P: tc.P, arrangement: 'custom',
        b_plus_side: 'left', b_minus_side: 'right',
        icc1: false, icc2: false, icc3: false,
        nickel_w: 4.0 * 1.5, max_candidates: 20,
        allow_I: true, allow_U: false,
        pitch: cc.pitch,
      });
      candCount = (enumResult.candidates || []).length;
      check(`${key}: candidates >= 1`, candCount >= 1, `got ${candCount}`);

      // ④ 원칙 28②: 모든 후보의 모든 그룹이 정확히 P개 셀
      let p28ii_ok = true;
      for (const cand of (enumResult.candidates || [])) {
        for (const g of cand.groups) {
          if (g.cells.length !== tc.P) {
            check(`${key}: P28② G${g.index} cell count`, false,
              `G${g.index}=${g.cells.length}셀, expected=${tc.P}`);
            p28ii_ok = false; break;
          }
        }
        if (!p28ii_ok) break;
      }
      if (p28ii_ok) check(`${key}: P28② all groups P=${tc.P}`, true);

      // ⑤ 원칙 28③: 인접 그룹 쌍 연결
      const thr = cc.pitch * 1.5;
      let p28iii_ok = true;
      for (const cand of (enumResult.candidates || [])) {
        const gc = cand.groups;
        for (let g = 0; g + 1 < gc.length; g++) {
          const ga = gc[g].cells, gb = gc[g + 1].cells;
          const ok = ga.some(a => gb.some(b =>
            Math.hypot(a.x - b.x, a.y - b.y) <= thr + 0.5));
          if (!ok) {
            check(`${key}: P28③ G${g}↔G${g+1}`, false, '비인접 → 플레이트 단절');
            p28iii_ok = false; break;
          }
        }
        if (!p28iii_ok) break;
      }
      if (p28iii_ok && candCount > 0) check(`${key}: P28③ all adjacent`, true);

      // ⑥ 원칙 28③ 강화: 병합 플레이트(2P) 전체 연결성 (상위 3개 후보만)
      let plate_ok = true;
      for (const cand of (enumResult.candidates || []).slice(0, 3)) {
        const gc = cand.groups;
        for (let pStart = 0; pStart <= 1; pStart++) {
          for (let g = pStart; g + 1 < gc.length; g += 2) {
            const merged = [...gc[g].cells, ...gc[g + 1].cells];
            const madj = Array.from({length: merged.length}, () => []);
            for (let i = 0; i < merged.length; i++)
              for (let j = i + 1; j < merged.length; j++)
                if (Math.hypot(merged[i].x - merged[j].x, merged[i].y - merged[j].y) <= thr + 0.5)
                  { madj[i].push(j); madj[j].push(i); }
            const vis = new Set([0]), q = [0];
            while(q.length) { const n=q.shift(); for(const nb of madj[n]) if(!vis.has(nb)){vis.add(nb);q.push(nb);} }
            if (vis.size !== merged.length) {
              const face = pStart === 0 ? 'bot' : 'top';
              check(`${key}: plate ${face} G${g}∪G${g+1} connected`, false,
                `${vis.size}/${merged.length} 연결`);
              plate_ok = false;
            }
          }
        }
        if (!plate_ok) break;
      }
      if (plate_ok && candCount > 0) check(`${key}: all 2P plates connected`, true);

    } catch(e) {
      check(`${key}: enum no crash`, false, e.message);
    }

    // ⑦ 해시
    if (svg) {
      const h = sha256(svg);
      hashes[key] = h;
      if (SAVE) {
        fs.mkdirSync(SVG_DIR, { recursive: true });
        fs.writeFileSync(path.join(SVG_DIR, `${key}.svg`), svg, 'utf8');
      }
    }
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
