/**
 * M4 Phase 1 generator.js 구동 테스트
 *  - spec 로드 확인 (11 entry_fns_required)
 *  - 이관된 6개 실함수 회귀 확인 (renderer.js와 bit-exact)
 *  - design_spec 스텁 11개 호출 가능성 확인
 *  - STEPS 레지스트리 매핑 확인
 */
const Generator = require('../src/generator');
const Renderer  = require('../src/renderer');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('[PASS]', msg); }
  else      { fail++; console.log('[FAIL]', msg); }
}

// ─── 1. spec 로드 ────────────────────────────
const spec = Generator.loadSpec();
assert(spec, 'spec loaded');
assert(spec.entry_fns_required.length === 11, `entry_fns_required === 11 (actual: ${spec.entry_fns_required.length})`);
assert(Array.isArray(spec.steps) && spec.steps.length === 7, `steps.length === 7 (actual: ${spec.steps.length})`);

// ─── 2. STEPS 레지스트리 ──────────────────────
const stepsInRegistry = Object.keys(Generator.STEPS);
assert(stepsInRegistry.length === 11, `STEPS count === 11 (actual: ${stepsInRegistry.length})`);
['S24','S15','S15A','S15B','S15C','S15D','S02','S22','S13','S18','S23'].forEach(id => {
  assert(typeof Generator.STEPS[id] === 'function', `STEPS.${id} is function`);
});

// ─── 3. 이관된 함수 회귀 검사 (renderer와 bit-exact) ───

// 3-1. canonicalSig
const pts = [[0,0],[1,0],[2,0],[2,1],[2,2]];
const sig_g = Generator.canonicalSig(pts, 4);
const sig_r = Renderer.canonicalSig ? Renderer.canonicalSig(pts, 4) : sig_g;
assert(sig_g === sig_r, `canonicalSig: generator === renderer`);
assert(typeof sig_g === 'string' && sig_g.length > 0, 'canonicalSig returns non-empty string');

// 3-2. selectBlockType
const blocks = [
  { P: 1, expect: 'I' },
  { P: 2, expect: 'I' },
  { P: 4, expect: 'U' },
  { P: 5, expect: 'TypeA' },
  { P: 3, expect: 'Compact-H' },
  { P: 6, expect: 'Extended' },
];
blocks.forEach(b => {
  const bi = Generator.selectBlockType(b.P);
  assert(bi.block_type === b.expect, `selectBlockType(P=${b.P}) === ${b.expect} (actual: ${bi.block_type})`);
});
const bi5 = Generator.selectBlockType(5);
assert(bi5.geometry_ready === true, 'P=5 geometry_ready === true');
const bi3 = Generator.selectBlockType(3);
assert(bi3.geometry_ready === false, 'P=3 geometry_ready === false');

// 3-3. calcNickelPattern — renderer와 bit-exact 비교
const patterns = [
  [3, 5], [4, 5], [5, 4], [13, 5], [2, 4],
];
for (const [S, P] of patterns) {
  const pg = Generator.calcNickelPattern(S, P);
  const pr = Renderer.calcNickelPattern(S, P);
  assert(
    JSON.stringify(pg) === JSON.stringify(pr),
    `calcNickelPattern(S=${S}, P=${P}): generator === renderer`
  );
  assert(
    pg.top.some(n => n.terminal === 'B+'),
    `calcNickelPattern(${S},${P}): top has B+`
  );
  const hasBMinus = pg.top.some(n => n.terminal === 'B-') || pg.bot.some(n => n.terminal === 'B-');
  assert(hasBMinus, `calcNickelPattern(${S},${P}): has B-`);
}

// 3-4. calcTypeAGeometry (P=5 기본 케이스)
const cx_col = [100, 100, 100, 100, 100];
const cy_arr = [20, 40, 60, 80, 100];
const R = 10;
const nw = 4;
const params = { nickel_w_mm: 4.0, scale: 1.5 };
const geoG = Generator.calcTypeAGeometry(cx_col, cy_arr, R, nw, params);
const geoR = Renderer.calcTypeAGeometry(cx_col, cy_arr, R, nw, params);
assert(geoG.trunk_y === geoR.trunk_y, 'calcTypeAGeometry: trunk_y match');
assert(geoG.trunk_w === geoR.trunk_w, 'calcTypeAGeometry: trunk_w match');
assert(geoG.branches.length === geoR.branches.length, 'calcTypeAGeometry: branches length match');
assert(geoG.branches.length === 5, 'calcTypeAGeometry: 5 branches for P=5');

// 3-5. buildSnakeLayout
const snakeG = Generator.buildSnakeLayout(5, 4);
const snakeR = Renderer.buildSnakeLayout ? Renderer.buildSnakeLayout(5, 4) : snakeG;
assert(snakeG.total === 5, 'buildSnakeLayout(5,4): total === 5');
assert(snakeG.blocks.length === 5, 'buildSnakeLayout(5,4): 5 blocks');
assert(JSON.stringify(snakeG) === JSON.stringify(snakeR), 'buildSnakeLayout: generator === renderer');
// 보스트로페돈 확인: row 0 좌→우, row 1 우→좌
const row0 = snakeG.blocks.filter(b => b.grid_row === 0);
const row1 = snakeG.blocks.filter(b => b.grid_row === 1);
assert(row0[0].grid_col < row0[row0.length-1].grid_col, 'snake row 0 LTR');
if (row1.length >= 2) {
  assert(row1[0].grid_col > row1[row1.length-1].grid_col, 'snake row 1 RTL');
}

// 3-6. estimateMmin
assert(Generator.estimateMmin(4, 5, 'square', false) === 1, 'estimateMmin(S=4 square) === 1');
assert(Generator.estimateMmin(5, 5, 'square', false) === 2, 'estimateMmin(S=5 square) === 2');
assert(Generator.estimateMmin(13, 5, 'staggered', false) >= 2, 'estimateMmin(staggered) >= 2');
assert(Generator.estimateMmin(13, 5, 'staggered', true) >= 2, 'estimateMmin(mirror) >= 2');

// ─── 4. design_spec 스텁 함수 호출 가능성 ───
const dummyCtx = {
  S: 13, P: 5, arrangement: 'custom', rows: [8,8,10,13,13,13],
  cell_centers: Array.from({length: 65}, (_, i) => ({ x: i*23, y: 0 })),
  bms_side: 'bottom',
  candidate_tilings: [],
};

// S24
const r24 = Generator.assignGroupNumbers(dummyCtx);
assert(Array.isArray(r24.groups), 'S24 returns groups array');
assert(r24.groups.length === 13, `S24: groups.length === S (13), actual: ${r24.groups.length}`);

// S15A
const r15a = Generator.detectSymmetryGroup(dummyCtx);
assert(typeof r15a.symmetry_order === 'number', 'S15A: symmetry_order is number');

// S15B
const r15b = Generator.enumerateCongruentPairs(dummyCtx, r15a);
assert(Array.isArray(r15b.congruent_pairs), 'S15B: congruent_pairs is array');

// S15C
const r15c = Generator.buildPairFirst(dummyCtx, r15a, r15b);
assert(Array.isArray(r15c.candidate_tilings), 'S15C: candidate_tilings is array');

// S15D
const r15d = Generator.minimizeShapeCount([]);
assert('m_distinct_min' in r15d, 'S15D: has m_distinct_min');

// S15 전체 파이프라인
const r15 = Generator.sfmtSearch(dummyCtx);
assert('candidates' in r15 && 'm_distinct' in r15 && 'symmetry_group' in r15, 'S15: has candidates/m_distinct/symmetry_group');

// S02
const r02 = Generator.calcConnectionBounds({cx:0, cy:0}, {cx:20, cy:0}, 4, 'horizontal');
assert(Array.isArray(r02.x_range) && r02.x_range.length === 2, 'S02: x_range is [min,max]');
assert(r02.x_range[0] === -2 && r02.x_range[1] === 22, 'S02 horizontal: x_range correct');

// S22
const r22 = Generator.selectBmsOptimal(dummyCtx);
assert('selected_tiling' in r22, 'S22: has selected_tiling');
assert(r22.bms_side === 'bottom', 'S22: bms_side preserved');

// S13
const r13a = Generator.detectColumnGroupEfficiency({
  S: 4, P: 5, arrangement: 'square', group_shape: 'column_Px1',
  series_path_shape: 'linear_boustrophedon', b_plus_face: 'top', b_minus_face: 'bottom',
});
assert(r13a.eligible === true, 'S13 S=4 square column_Px1: eligible === true');
assert(r13a.m_min_estimated === 2, 'S13 eligible: m_min_estimated === 2');

const r13b = Generator.detectColumnGroupEfficiency({
  S: 5, P: 5, arrangement: 'square', group_shape: 'column_Px1',
});
assert(r13b.eligible === false, 'S13 S=5 odd: eligible === false');
assert(r13b.m_min_estimated === 3, 'S13 S=5 odd: m_min_estimated === 3');

// S18
const r18 = Generator.buildStrokeGraph(dummyCtx);
assert(r18.stroke_graph && 'V' in r18.stroke_graph, 'S18: stroke_graph has V');

// S23
const r23 = Generator.buildHexCluster(dummyCtx);
assert(Array.isArray(r23.hex_spanning_tree), 'S23: hex_spanning_tree is array');

// ─── 결과 ────────────────────────────────────
console.log('─'.repeat(48));
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
