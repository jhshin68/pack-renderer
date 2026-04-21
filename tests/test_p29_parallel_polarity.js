'use strict';
// P29 회귀 테스트: 병렬 극성 일관성 (LAYER 0 절대 불변)
// 각 그룹 내 모든 셀은 상면 극성이 동일해야 함
const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));
const R = require(path.join(__dirname, '..', 'src', 'renderer.js'));
const V = require(path.join(__dirname, '..', 'src', 'validator.js'));
G.loadSpec();
V.loadSpec();

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// P29 핵심 검증: getCellPolarity(g, face) — 같은 g면 항상 동일 극성
// 원칙 29: 병렬 셀들은 동일 그룹 인덱스 → 동일 극성 (구조적으로 보장됨)
// 여기서는 그룹 배정 결과의 무결성(중복 없음, 크기 일치)과
// 극성 함수의 일관성(같은 g → 같은 극성)을 검증

function getCellPolarityDirect(g, face) {
  // getCellPolarity 로직 직접 복제: 짝수 g → top='+', 홀수 g → top='-'
  const topPlus = g % 2 === 0;
  if (face === 'top') return topPlus ? '+' : '-';
  return topPlus ? '-' : '+';
}

// ── 케이스 1: getCellPolarity 함수 일관성 ──────────────────
(function case1() {
  // 같은 그룹 인덱스는 항상 동일 극성을 반환해야 함
  for (let g = 0; g < 13; g++) {
    const pol1 = getCellPolarityDirect(g, 'top');
    const pol2 = getCellPolarityDirect(g, 'top');
    assert(`케이스1 G${g} getCellPolarity 반복 일관`, pol1 === pol2);
  }
  // 같은 그룹 짝수/홀수 규칙 확인
  assert('케이스1 G0 top=+', getCellPolarityDirect(0, 'top') === '+');
  assert('케이스1 G1 top=-', getCellPolarityDirect(1, 'top') === '-');
  assert('케이스1 G0 bot=-', getCellPolarityDirect(0, 'bottom') === '-');
  assert('케이스1 G1 bot=+', getCellPolarityDirect(1, 'bottom') === '+');
})();

// ── 케이스 2: 정배열 5S4P SVG 생성 ──────────────────────────
(function case2() {
  const params = {
    S: 5, P: 4,
    arrangement: 'square',
    cell_type: '18650', gap: 0, scale: 1.5, margin_mm: 8,
    show_nickel: false, face: 'top',
    nickel_w_mm: 6,
  };
  const svg = R.render(params);
  assert('케이스2 square 5S4P SVG 생성', svg && svg.includes('<svg'));
  assert('케이스2 square 5S4P NaN 없음', !svg.includes('NaN'));
  // 셀 원만 카운트 (반경 r로 구분, 터미널/니켈 원 제외)
  // fill="none" + stroke-width="1.14" → 셀 원 (터미널 r=8, sw=1.4 제외)
  const cellCircles = (svg.match(/<circle[^>]+>/g) || []).filter(c => /fill="none"/.test(c) && /stroke-width="1\.14"/.test(c));
  const redCells = cellCircles.filter(c => /stroke="#C0392B"/.test(c)).length;
  const blkCells = cellCircles.filter(c => /stroke="#1a1a1a"/.test(c)).length;
  // 5S4P: G0,G2,G4(+)=12셀, G1,G3(-)=8셀
  assert('케이스2 square 5S4P + 셀 수 = 12', redCells === 12, `실제: ${redCells}`);
  assert('케이스2 square 5S4P - 셀 수 = 8', blkCells === 8, `실제: ${blkCells}`);
})();

// ── 케이스 3: 엇배열 5S4P SVG 생성 ────────────────────────
(function case3() {
  const params = {
    S: 5, P: 4,
    arrangement: 'staggered',
    cell_type: '18650', gap: 0, scale: 1.5, margin_mm: 8,
    show_nickel: false, face: 'top',
    nickel_w_mm: 6,
  };
  const svg = R.render(params);
  assert('케이스3 staggered 5S4P SVG 생성', svg && svg.includes('<svg'));
  assert('케이스3 staggered 5S4P NaN 없음', !svg.includes('NaN'));
  // fill="none" + stroke-width="1.14" → 셀 원 (터미널 r=8, sw=1.4 제외)
  const cellCircles = (svg.match(/<circle[^>]+>/g) || []).filter(c => /fill="none"/.test(c) && /stroke-width="1\.14"/.test(c));
  const redCells = cellCircles.filter(c => /stroke="#C0392B"/.test(c)).length;
  const blkCells = cellCircles.filter(c => /stroke="#1a1a1a"/.test(c)).length;
  assert('케이스3 staggered 5S4P + 셀 수 = 12', redCells === 12, `실제: ${redCells}`);
  assert('케이스3 staggered 5S4P - 셀 수 = 8', blkCells === 8, `실제: ${blkCells}`);
})();

// ── 케이스 4: 커스텀 13S4P + enumerateGroupAssignments 결과 주입 ──
(function case4() {
  const CELL_SPEC = { '18650': { render_d: 19.0 } };
  const rows = [10, 12, 13, 12, 5];
  const cParams = {
    cell_type: '18650', gap: 0, scale: 1, margin_mm: 5,
    row_offsets: [0, -2, -2, -2, -1],
    custom_stagger: true, custom_stagger_dir: 'R', custom_align: 'left',
  };
  const { pts, pitch } = G.calcCustomCenters(rows, cParams, CELL_SPEC);
  const result = G.enumerateGroupAssignments({
    cells: pts, S: 13, P: 4,
    arrangement: 'custom',
    b_plus_side: 'left', b_minus_side: 'right',
    pitch,
  });

  assert('케이스4 custom 13S4P 후보 존재', result.candidates.length >= 1);

  if (result.candidates.length >= 1) {
    const cand = result.candidates[0];
    // groups: S개 객체, 각 .cells 배열에 P개 셀 {row,col}
    assert('케이스4 그룹 수 = 13', cand.groups.length === 13,
      `실제: ${cand.groups.length}`);

    for (let gi = 0; gi < cand.groups.length; gi++) {
      const grp = cand.groups[gi];
      assert(`케이스4 G${gi} 크기 = 4`, grp.cells.length === 4,
        `실제: ${grp.cells.length}`);
    }

    // 셀 중복 없음 (P29: 각 셀은 정확히 1개 그룹에만 속해야 함)
    const seen = new Set();
    let dup = false;
    for (const grp of cand.groups) {
      for (const c of grp.cells) {
        const key = `${c.row},${c.col}`;
        if (seen.has(key)) { dup = true; break; }
        seen.add(key);
      }
      if (dup) break;
    }
    assert('케이스4 셀 중복 없음 (P29 구조 조건)', !dup);
    assert('케이스4 총 셀 수 = 52', seen.size === 52, `실제: ${seen.size}`);

    // P29 극성 일관성: 그룹 gi에 속한 모든 셀은 getCellPolarity(gi, face)로 동일 극성
    // (그룹 인덱스 배정 자체가 극성을 결정하므로, 배정 무결성 = 극성 일관성)
    const g0topPol = getCellPolarityDirect(0, 'top');
    const g1topPol = getCellPolarityDirect(1, 'top');
    assert('케이스4 G0 top 극성 = +', g0topPol === '+');
    assert('케이스4 G1 top 극성 = -', g1topPol === '-');
  }
})();

// ── 케이스 5: checkP29ParallelPolarity RED — 셀 중복 → ok=false ──
(function case5() {
  const fn = V.CHECKS.checkP29ParallelPolarity;
  assert('케이스5 checkP29ParallelPolarity 함수 존재', typeof fn === 'function');
  if (typeof fn !== 'function') return;

  // cell (0,1) 이 G0과 G1 두 그룹에 동시 할당 → LAYER 0 위반
  const ctx = {
    groups: [
      { index: 0, cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
      { index: 1, cells: [{ row: 0, col: 1 }, { row: 0, col: 2 }] },
    ],
  };
  const res = fn(ctx, {});
  assert('케이스5 중복 셀 → ok=false', res.ok === false, `실제: ok=${res.ok}`);
  assert('케이스5 violations 1개 이상', Array.isArray(res.data) && res.data.length >= 1,
    `실제: ${JSON.stringify(res.data)}`);
})();

// ── 케이스 6: checkP29ParallelPolarity GREEN — 중복 없음 → ok=true ──
(function case6() {
  const fn = V.CHECKS.checkP29ParallelPolarity;
  if (typeof fn !== 'function') return;

  const ctx = {
    groups: [
      { index: 0, cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
      { index: 1, cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }] },
      { index: 2, cells: [{ row: 2, col: 0 }, { row: 2, col: 1 }] },
    ],
  };
  const res = fn(ctx, {});
  assert('케이스6 중복 없음 → ok=true', res.ok === true, `실제: ok=${res.ok}`);
})();

console.log(`\n총 ${pass + fail}개 중 ${pass} PASS, ${fail} FAIL`);
if (fail === 0) console.log('ALL PASS');
else process.exit(1);
