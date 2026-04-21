'use strict';
/**
 * stagger fix 유효성 검증:
 * custom_stagger=false 좌표로 찾은 후보를 custom_stagger=true 좌표에서
 * checkPlanarNoCrossing으로 교차 여부 확인.
 */
const renderer = require('../src/renderer');
const _layout  = require('../src/gen-layout');
const _enum    = require('../src/gen-enum');
const _math    = require('../src/gen-math');
const { calcCustomCenters } = _layout;
const { enumerateGroupAssignments } = _enum;
const { checkPlanarNoCrossing } = _math;
const { CELL_SPEC } = renderer;

const rows    = [5, 12, 13, 12, 10];
const offsets = [-1, -2, -2, -2, 0];
const S = 13, P = 4;

const cp_flat = {
  cell_type: '21700', gap: 0, scale: 1.5, margin_mm: 8.0,
  custom_stagger: false, custom_stagger_dir: 'R',
  custom_align: 'center', row_offsets: offsets,
};
const cp_stag = {
  ...cp_flat,
  custom_stagger: true,
};

const cc_flat = calcCustomCenters(rows, cp_flat, CELL_SPEC);
const cc_stag = calcCustomCenters(rows, cp_stag, CELL_SPEC);

// 1) flat 좌표로 후보 열거 (시간제한 30초)
console.log('flat 좌표로 후보 열거 중 (최대 30초)...');
const result = enumerateGroupAssignments({
  cells: cc_flat.pts, S, P,
  arrangement: 'custom',
  b_plus_side: 'left', b_minus_side: 'right',
  icc1: true, icc2: true, icc3: false,
  allow_I: false, allow_U: false,
  pitch: cc_flat.pitch,
  custom_stagger: false,
  max_candidates: 999999,
  budget_ms: 30000,
  exhaustive: false,
});

const candidates = result.candidates || [];
console.log(`  후보 ${candidates.length}개 발견\n`);

if (candidates.length === 0) {
  console.log('후보 없음 — 검증 불가');
  process.exit(0);
}

// 2) 각 후보의 셀 인덱스를 stagger 좌표로 매핑 후 crossing check
let failCount = 0;
let passCount = 0;

for (const cand of candidates) {
  // 그룹별 셀 좌표를 stagger cc로 교체
  const groupsStag = cand.groups.map(g => {
    return g.cells.map(c => {
      // c는 {row, col, x, y} — row/col로 stagger 좌표에서 해당 셀 찾기
      const match = cc_stag.pts.find(p => p.row === c.row && p.col === c.col);
      return match || c;
    });
  });

  // checkPlanarNoCrossing expects [{cells:[{x,y},...]}]
  const groupObjs = groupsStag.map(cells => ({ cells }));
  const crossed = !checkPlanarNoCrossing(groupObjs, cc_stag.pitch * 1.1);

  if (crossed) {
    failCount++;
    console.log(`  [FAIL] 후보 m_distinct=${cand.m_distinct} quality=${cand.total_score} → stagger에서 교차 발생`);
  } else {
    passCount++;
  }
}

console.log(`\n검증 결과: PASS=${passCount}  FAIL=${failCount} / 총 ${candidates.length}개`);
if (failCount > 0) {
  console.log('⚠ 일부 후보가 stagger 좌표에서 교차합니다. enumeration 좌표 수정 필요.');
} else {
  console.log('✓ 모든 후보가 stagger 좌표에서도 교차 없음 — fix 유효');
}
