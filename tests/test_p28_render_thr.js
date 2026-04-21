/**
 * test_p28_render_thr.js
 * P28③ 렌더 임계값 정합성 테스트
 *
 * 버그: generator.js P28③는 pitch*1.5로 U판 연결성 검증,
 *       renderer.js isAdj는 pitch*1.05(non-stagger)를 사용.
 *       1.05P~1.5P 사이 대각 접촉 후보가 generator에서 합격하지만
 *       renderer에서 연결선 미표시 → 4셀 섬처럼 보이는 Principle 28 위반.
 *
 * 수정 후 기대: P28③ 검증이 renderThr(1.05P non-stagger)를 사용하므로
 *              해당 후보가 enumerateGroupAssignments에서 제외된다.
 */
'use strict';
const path = require('path');
const assert = require('assert');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));
G.loadSpec();

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); fail++; }
}

// ── 헬퍼: 격자 셀 생성 ────────────────────────────────────────────────
function makeCell(row, col, pitch) {
  return { row, col, x: col * pitch, y: row * pitch };
}

// ── TC1: 비인접 대각(1.42P) cross-group 쌍 — 수정 후 후보 제외돼야 함 ──────
// pitch=33, S=2, P=2, arrangement='custom', custom_stagger=false
// G0: (0,0)+(0,1) = row0 col0,1
// G1: (1,1)+(1,2) — G0[1]=(33,0) ↔ G1[0]=(33,33): dist=33=1.0P  ← 이건 인접
// 실제 비인접 케이스: y-gap을 1.05P 초과로 설정
//   G0: row=0, G1: row=2 (y=66=2P), cross-min dist = 1행 건너뜀 = 2P > 1.5P
//   그러면 P21B도 실패하므로 너무 극단적. 정확히 1.05P~1.5P 사이를 테스트해야 함.
//
// 방법: custom pitch가 아닌 실제 pixel 좌표로 직접 셀 생성
//   pitch=33, G0: x=[0,33],y=0 / G1: x=[33,66],y=47
//   cross-min: (33,0)↔(33,47) = 47px = 1.424P → 1.05P~1.5P 사이
test('TC1: cross-group 거리 1.42P — non-stagger custom은 후보 제외돼야 함', () => {
  const P = 33;
  const cells = [
    // G0 cells
    { x: 0,  y: 0,  row: 0, col: 0 },
    { x: P,  y: 0,  row: 0, col: 1 },
    // G1 cells — y=47 (1.424P) above G0
    { x: P,  y: 47, row: 1, col: 1 },
    { x: 2*P, y: 47, row: 1, col: 2 },
  ];

  const result = G.enumerateGroupAssignments({
    cells, S: 2, P: 2,
    arrangement: 'custom',
    custom_stagger: false,
    pitch: P,
    b_plus_side: 'left', b_minus_side: 'right',
    icc1: false, icc2: false, icc3: false,
    max_candidates: 10,
  });

  // 수정 전: snake candidate 합격 → candidates > 0
  // 수정 후: renderThr(1.05P) 기준 P28③ 실패 → candidates = 0 또는 해당 그룹 쌍 제외
  const hasProblematicCand = result.candidates.some(cand => {
    // G0=[cells[0],cells[1]], G1=[cells[2],cells[3]] 조합인지 확인
    const g0 = cand.groups[0].cells;
    const g1 = cand.groups[1].cells;
    const g0Keys = new Set(g0.map(c => `${c.x},${c.y}`));
    const isG0 = g0Keys.has('0,0') && g0Keys.has('33,0');
    const g1Keys = new Set(g1.map(c => `${c.x},${c.y}`));
    const isG1 = g1Keys.has('33,47') && g1Keys.has('66,47');
    return isG0 && isG1;
  });

  assert.strictEqual(hasProblematicCand, false,
    `cross-group 1.42P 후보가 결과에 포함됨 — P28③ renderThr 미적용 버그`);
});

// ── TC2: 인접(1.0P) cross-group 쌍 — 정상 후보로 남아야 함 ─────────────
test('TC2: cross-group 거리 1.0P — non-stagger custom 후보 포함돼야 함', () => {
  const P = 33;
  const cells = [
    { x: 0,  y: 0,  row: 0, col: 0 },
    { x: P,  y: 0,  row: 0, col: 1 },
    { x: P,  y: P,  row: 1, col: 1 },
    { x: 2*P, y: P, row: 1, col: 2 },
  ];

  const result = G.enumerateGroupAssignments({
    cells, S: 2, P: 2,
    arrangement: 'custom',
    custom_stagger: false,
    pitch: P,
    b_plus_side: 'left', b_minus_side: 'right',
    icc1: false, icc2: false, icc3: false,
    max_candidates: 10,
  });

  const hasCand = result.candidates.some(cand => {
    const g0 = cand.groups[0].cells;
    const g0Keys = new Set(g0.map(c => `${c.x},${c.y}`));
    return g0Keys.has('0,0') && g0Keys.has('33,0');
  });

  assert.strictEqual(hasCand, true, '1.0P 인접 후보가 결과에서 제외됨 — 과도한 필터링 버그');
});

// ── TC3: stagger 모드 — cross-group 1.15P는 허용(1.2P 이하) ─────────────
test('TC3: stagger custom, cross-group 1.15P — stagger는 1.2P까지 허용돼야 함', () => {
  const P = 33;
  const dist = Math.round(P * 1.15); // ≈38px, 1.15P
  const cells = [
    { x: 0,  y: 0,  row: 0, col: 0 },
    { x: P,  y: 0,  row: 0, col: 1 },
    { x: P,  y: dist, row: 1, col: 1 },
    { x: 2*P, y: dist, row: 1, col: 2 },
  ];

  const result = G.enumerateGroupAssignments({
    cells, S: 2, P: 2,
    arrangement: 'custom',
    custom_stagger: true,
    pitch: P,
    b_plus_side: 'left', b_minus_side: 'right',
    icc1: false, icc2: false, icc3: false,
    max_candidates: 10,
  });

  const hasCand = result.candidates.some(cand => {
    const g0 = cand.groups[0].cells;
    const g0Keys = new Set(g0.map(c => `${c.x},${c.y}`));
    return g0Keys.has('0,0') && g0Keys.has(`${P},0`);
  });

  assert.strictEqual(hasCand, true, 'stagger 1.15P 후보가 제외됨 — stagger renderThr 1.2P 미적용');
});

console.log(`\n테스트 완료: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
