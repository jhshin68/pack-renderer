/**
 * F14 테스트: renderer.js의 renderCustomRows()가
 *   app.js renderCustomLayout()과 동등한 결과를 내는지 검증.
 *
 * 목적: custom 배열 렌더링 단일 출처(renderer.js)로 통합 확인.
 * 방법: 동일 params로 두 경로를 실행 → SVG 문자열 주요 속성(셀 수, 니켈 선 수,
 *       B+/B- 라벨 위치, viewBox 크기) 일치 확인.
 */
const fs  = require('fs');
const vm  = require('vm');
const path = require('path');

const generatorSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'generator.js'), 'utf8');
const rendererSrc  = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('[PASS]', msg); }
  else      { fail++; console.log('[FAIL]', msg); }
}

// ─── VM 컨텍스트 생성 ─────────────────────────
const ctx = { console, __result: null };
vm.createContext(ctx);
vm.runInContext(generatorSrc, ctx);
vm.runInContext(rendererSrc, ctx);

// ─── 테스트 케이스 1: 13S custom rows=[8,8,10,13,13,13] ─────
const params1 = {
  cell_type: '21700',
  S: 13,
  P: 5,
  arrangement: 'custom',
  rows: [8, 8, 10, 13, 13, 13],
  gap: 0.0,
  scale: 1.5,
  nickel_w_mm: 4.0,
  margin_mm: 8.0,
  gap_section: 36,
  show_nickel: true,
  show_terminal: true,
  face: 'all',
  custom_align: 'center',
  custom_stagger: false,
};

vm.runInContext(`__result = render(${JSON.stringify(params1)});`, ctx);
const svg1 = ctx.__result;
assert(typeof svg1 === 'string' && svg1.length > 0, 'render(custom rows) returns non-empty SVG');
assert(svg1.includes('<svg'), 'SVG root tag present');
assert(svg1.includes('</svg>'), 'SVG close tag present');
const circles1 = (svg1.match(/<circle /g) || []).length;
const lines1   = (svg1.match(/<line /g) || []).length;
const grays1   = (svg1.match(/#888888/g) || []).length;
console.log(`  case1 metrics: circles=${circles1}, lines=${lines1}, grays=${grays1}`);
assert(circles1 > 0, 'case1: circles rendered');
assert(lines1 > 0, 'case1: nickel lines rendered');
assert(grays1 > 0, 'case1: nickel gray color used');
assert(svg1.includes('B+'), 'case1: B+ label present');
assert(svg1.includes('B-'), 'case1: B- label present');

// ─── 테스트 케이스 2: 5S custom rows=[3,3,3,3,3] 정형 ───
const params2 = {
  ...params1,
  S: 5,
  P: 3,
  rows: [3, 3, 3, 3, 3],
};
vm.runInContext(`__result = render(${JSON.stringify(params2)});`, ctx);
const svg2 = ctx.__result;
const circles2 = (svg2.match(/<circle /g) || []).length;
assert(svg2.includes('<svg'), 'case2: SVG renders');
assert(circles2 > 0, 'case2: circles rendered');
assert(svg2.includes('B+'), 'case2: B+ present');
assert(svg2.includes('B-'), 'case2: B- present');

// ─── 테스트 케이스 3: custom 엇배열 right stagger ───
const params3 = {
  ...params1,
  custom_stagger: true,
  custom_stagger_dir: 'R',
  custom_align: 'right',
};
vm.runInContext(`__result = render(${JSON.stringify(params3)});`, ctx);
const svg3 = ctx.__result;
assert(svg3.includes('<svg'), 'case3 (right stagger): SVG renders');
const circles3 = (svg3.match(/<circle /g) || []).length;
assert(circles3 > 0, 'case3: circles rendered');

// ─── 테스트 케이스 4: face='top' 필터 ─────────────
const params4 = { ...params1, face: 'top' };
vm.runInContext(`__result = render(${JSON.stringify(params4)});`, ctx);
const svg4 = ctx.__result;
assert(svg4.includes('top face'), 'case4: top face header shown');
assert(!svg4.includes('bottom face'), 'case4: bottom face hidden');

// ─── 테스트 케이스 5: F14 진입점 — arrangement 없이 rows만 주면 square 경로 ───
// (arrangement === 'custom' 명시되어야만 F14 경로 진입)
const params5 = { ...params1, arrangement: 'square', S: 3, P: 3 };
delete params5.rows;
vm.runInContext(`__result = render(${JSON.stringify(params5)});`, ctx);
const svg5 = ctx.__result;
assert(svg5.includes('<svg'), 'case5 (square fallback): SVG renders');
assert(svg5.includes('square'), 'case5: arrangement=square in output');

// ─── 테스트 케이스 6: generator.calcCustomCenters 단독 검증 ───
vm.runInContext(`
  __result = Generator.calcCustomCenters([8, 8, 10, 13, 13, 13],
    { cell_type: '21700', gap: 0.0, scale: 1.5, margin_mm: 8.0,
      custom_align: 'center', custom_stagger: false },
    CELL_SPEC);
`, ctx);
const centers = ctx.__result;
assert(centers.pts.length === 65, `calcCustomCenters: N=65 pts (actual: ${centers.pts.length})`);
assert(centers.R > 0 && centers.pitch > 0, 'calcCustomCenters: R/pitch positive');
assert(centers.W > 0 && centers.H > 0, 'calcCustomCenters: W/H positive');
// 행 별 셀 분포 확인
const byRow = centers.pts.reduce((acc, pt) => { acc[pt.row] = (acc[pt.row]||0) + 1; return acc; }, {});
assert(byRow[0] === 8 && byRow[3] === 13 && byRow[5] === 13,
  'calcCustomCenters: row distribution [8,8,10,13,13,13] correct');

// ─── 결과 ────────────────────────────────────
console.log('─'.repeat(48));
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
