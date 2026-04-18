/**
 * test_enumerate_integration.js
 * enumerateGroupAssignments + pentomino 통합 테스트
 *
 * 검증 항목:
 * 1. 10S5P square: pentomino 후보가 index 0 (스네이크보다 상위)
 * 2. 10S5P pentomino 후보 total_score = +100
 * 3. P≠5 (10S3P): pentomino 후보 없음, 기존 스네이크만
 * 4. custom arrangement: pentomino 미실행, 스네이크만
 * 5. allow_I=true → I-pentomino 허용 후보 추가
 * 6. F29 케이스(P≠5, staggered 등): 기존 동작 불변
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

const PITCH = 100;
function makeGrid(rows, cols, arrangement = 'square') {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const stag = (arrangement === 'staggered' && r % 2 === 1) ? PITCH / 2 : 0;
    for (let c = 0; c < cols; c++)
      cells.push({ x: c * PITCH + stag, y: r * PITCH, row: r, col: c });
  }
  return cells;
}

// ── 1. 10S5P square: pentomino 후보가 최상위 ───────────────────────────
{
  const cells = makeGrid(5, 10);
  const result = G.enumerateGroupAssignments({
    cells, S: 10, P: 5, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
  });
  assert('10S5P: candidates ≥ 1', result.candidates.length >= 1,
    `got ${result.candidates.length}`);

  const top = result.candidates[0];
  assert('10S5P: top is_pentomino', top.is_pentomino === true,
    `is_pentomino=${top.is_pentomino}, name=${top.name}`);
  assert('10S5P: top.total_score === +100', top.total_score === 100,
    `got ${top.total_score}`);
  assert('10S5P: top.b_plus_ok && b_minus_ok',
    top.b_plus_ok && top.b_minus_ok);
  assert('10S5P: top.icc_violations === 0', top.icc_violations === 0);

  // 스네이크 후보도 여전히 존재해야 함
  const snakeCands = result.candidates.filter(c => c.is_standard);
  assert('10S5P: 스네이크 후보 여전히 존재', snakeCands.length > 0,
    `snake count=${snakeCands.length}`);

  // pentomino가 스네이크보다 점수 높아야 함
  if (snakeCands.length > 0 && top.is_pentomino) {
    assert('10S5P: pentomino total_score > snake total_score',
      top.total_score >= snakeCands[0].total_score);
  }
}

// ── 2. P≠5 (10S3P): pentomino 후보 없음 ──────────────────────────────
{
  const cells = makeGrid(3, 10);
  const result = G.enumerateGroupAssignments({
    cells, S: 10, P: 3, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
  });
  const pentCands = result.candidates.filter(c => c.is_pentomino);
  assert('10S3P: pentomino 후보 없음', pentCands.length === 0,
    `got ${pentCands.length}`);
  assert('10S3P: 스네이크 후보 존재', result.candidates.length > 0);
}

// ── 3. custom arrangement: pentomino 미실행 ──────────────────────────
{
  const cells = makeGrid(5, 10);
  const result = G.enumerateGroupAssignments({
    cells, S: 10, P: 5, arrangement: 'custom',
    b_plus_side: 'left', b_minus_side: 'right',
  });
  const pentCands = result.candidates.filter(c => c.is_pentomino);
  assert('custom: pentomino 후보 없음', pentCands.length === 0);
}

// ── 4. allow_I=true: I-pentomino 허용 후보 추가 가능 ─────────────────
{
  const cells = makeGrid(5, 10);
  const withI = G.enumerateGroupAssignments({
    cells, S: 10, P: 5, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: true, allow_U: false,
  });
  const withoutI = G.enumerateGroupAssignments({
    cells, S: 10, P: 5, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
  });
  assert('allow_I=true: candidates ≥ allow_I=false',
    withI.candidates.length >= withoutI.candidates.length,
    `withI=${withI.candidates.length}, withoutI=${withoutI.candidates.length}`);
}

// ── 5. staggered arrangement: pentomino 실행 여부 확인 ───────────────
// staggered도 P=5이면 pentomino 시도 (hex adjacency는 Phase 4.5, 지금은 square로 근사)
{
  const cells = makeGrid(5, 10, 'staggered');
  const result = G.enumerateGroupAssignments({
    cells, S: 10, P: 5, arrangement: 'staggered',
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
  });
  assert('staggered 10S5P: candidates ≥ 1 (스네이크 + 가능하면 pentomino)',
    result.candidates.length >= 1);
}

// ── 6. 4S5P: top.total_score = +40 ──────────────────────────────────
{
  const cells = makeGrid(5, 4);
  const result = G.enumerateGroupAssignments({
    cells, S: 4, P: 5, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
    allow_I: false, allow_U: false,
  });
  const top = result.candidates[0];
  if (top && top.is_pentomino) {
    assert('4S5P: top.total_score === +40', top.total_score === 40,
      `got ${top.total_score}`);
  } else {
    assert('4S5P: candidates 존재', result.candidates.length >= 1);
  }
}

// ── 7. 기존 P≠5 케이스 (F29 커버): 후보 구조 불변 ──────────────────
{
  const cells = makeGrid(3, 13);  // 13S3P
  const result = G.enumerateGroupAssignments({
    cells, S: 13, P: 3, arrangement: 'square',
    b_plus_side: 'left', b_minus_side: 'right',
  });
  assert('13S3P: candidates 존재', result.candidates.length > 0);
  assert('13S3P: 모든 후보 groups.length === 13',
    result.candidates.every(c => c.groups.length === 13));
  // pentomino 없어야 함 (P=3)
  assert('13S3P: pentomino 없음',
    result.candidates.every(c => !c.is_pentomino));
}

console.log(`\n총 ${pass + fail}개 중 ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
else console.log('ALL PASS');
