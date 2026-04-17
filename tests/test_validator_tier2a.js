/**
 * Tier 2a — validator 실구현 검증
 *   7 checks: P01·P04·P06·P08·P09·P17·P21
 *   각 check에 대해 (1) skip (2) happy path (3) fail path 검증
 *   + runValidation 통합 집계 검증
 *
 * 전제: test_validator_stub.js의 빈 ctx 호환성은 유지됨 (별도 파일에서 검증)
 */
'use strict';

const path = require('path');
const V = require(path.join(__dirname, '..', 'src', 'validator.js'));
V.loadSpec();  // principles_spec.json 로드

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

const C = V.CHECKS;

// ═══════════════════════════════════════════════
// P01 — 극성 불변
// ═══════════════════════════════════════════════
{
  // skip: cells 없음
  const r1 = C.checkPolarityInversion({});
  assert('P01-skip: 빈 ctx → ok + skipped detail',
    r1.ok && /skipped/.test(r1.detail || ''));

  // happy: top/+, bottom/-
  const r2 = C.checkPolarityInversion({
    cells: [
      { top_polarity: '+', bottom_polarity: '-' },
      { top_polarity: '-', bottom_polarity: '+' },
    ],
  });
  assert('P01-ok: 정상 반전 쌍', r2.ok && !r2.detail);

  // fail: same sign
  const r3 = C.checkPolarityInversion({
    cells: [
      { top_polarity: '+', bottom_polarity: '-' },
      { top_polarity: '+', bottom_polarity: '+' },  // 위반
    ],
  });
  assert('P01-fail: 동일 극성 → ok=false', !r3.ok);
  assert('P01-fail: data.index === 1', r3.data && r3.data.index === 1);
}

// ═══════════════════════════════════════════════
// P04 — B+/B− 출력 방향 사전 확정
// ═══════════════════════════════════════════════
{
  const r1 = C.checkOutputDirectionDecided({});
  assert('P04-skip: 빈 ctx → ok + skipped', r1.ok && /skipped/.test(r1.detail));

  const r2 = C.checkOutputDirectionDecided({ b_plus_side: 'left', b_minus_side: 'right' });
  assert('P04-ok: left/right 유효', r2.ok);

  const r3 = C.checkOutputDirectionDecided({ b_plus_side: 'left' });
  assert('P04-fail: b_minus_side 누락', !r3.ok);

  const r4 = C.checkOutputDirectionDecided({ b_plus_side: 'diagonal', b_minus_side: 'right' });
  assert('P04-fail: invalid b_plus_side 값', !r4.ok);
}

// ═══════════════════════════════════════════════
// P06 — 맞닿음 (gap=0, pitch=render_d)
// ═══════════════════════════════════════════════
{
  const r1 = C.checkContact({});
  assert('P06-skip: 빈 ctx', r1.ok && /skipped/.test(r1.detail));

  const r2 = C.checkContact({ pitch: 21, render_d: 21, gap: 0 });
  assert('P06-ok: pitch=render_d, gap=0', r2.ok);

  const r3 = C.checkContact({ pitch: 25, render_d: 21 });
  assert('P06-fail: pitch ≠ render_d', !r3.ok);

  const r4 = C.checkContact({ pitch: 21, render_d: 21, gap: 2 });
  assert('P06-fail: gap ≠ 0', !r4.ok);
}

// ═══════════════════════════════════════════════
// P08 — 셀 수 (N=S×P, 각 그룹 P개)
// ═══════════════════════════════════════════════
{
  const r1 = C.checkCellCount({});
  assert('P08-skip: 빈 ctx', r1.ok && /skipped/.test(r1.detail));

  const r2 = C.checkCellCount({
    S: 3, P: 2,
    cells: Array(6).fill({ x: 0, y: 0 }),
    groups: [
      { index: 0, cells: [{}, {}] },
      { index: 1, cells: [{}, {}] },
      { index: 2, cells: [{}, {}] },
    ],
  });
  assert('P08-ok: S=3·P=2·N=6·각 그룹 2셀', r2.ok);

  // cells 부족 (S×P 미만)
  const r3 = C.checkCellCount({ S: 3, P: 2, cells: Array(5).fill({}) });
  assert('P08-fail: cells 부족', !r3.ok);

  // groups 중 하나 P 다름
  const r4 = C.checkCellCount({
    S: 2, P: 3,
    groups: [
      { index: 0, cells: [{}, {}, {}] },
      { index: 1, cells: [{}, {}] },  // 2 ≠ 3
    ],
  });
  assert('P08-fail: G1 셀 수 불일치', !r4.ok);
  assert('P08-fail: data.group === 1', r4.data && r4.data.group === 1);

  // 빈 슬롯 허용: cells.length > S×P (원칙 8 ②)
  const r5 = C.checkCellCount({
    S: 2, P: 2,
    cells: Array(10).fill({}),  // 홀더 10셀, S×P=4
    groups: [
      { index: 0, cells: [{}, {}] },
      { index: 1, cells: [{}, {}] },
    ],
  });
  assert('P08-ok: 홀더 빈 슬롯 허용 (cells > S×P)', r5.ok);
}

// ═══════════════════════════════════════════════
// P09 — 인접성 (격리 셀 금지)
// ═══════════════════════════════════════════════
{
  const r1 = C.checkAdjacency({});
  assert('P09-skip: 빈 ctx', r1.ok && /skipped/.test(r1.detail));

  // 정상: 2×2 square 전부 이웃 있음
  const r2 = C.checkAdjacency({
    cells: [
      { x: 0, y: 0 }, { x: 100, y: 0 },
      { x: 0, y: 100 }, { x: 100, y: 100 },
    ],
    arrangement: 'square',
    pitch: 100,
  });
  assert('P09-ok: 2×2 square 격리 없음', r2.ok);

  // 격리 셀 1개 (거리 500 >> pitch)
  const r3 = C.checkAdjacency({
    cells: [
      { x: 0, y: 0 }, { x: 100, y: 0 },
      { x: 500, y: 500 },  // 격리
    ],
    arrangement: 'square',
    pitch: 100,
  });
  assert('P09-fail: 격리 셀 감지', !r3.ok);
  assert('P09-fail: data.isolated_count === 1',
    r3.data && r3.data.isolated_count === 1);
}

// ═══════════════════════════════════════════════
// P17 — 배열 선택
// ═══════════════════════════════════════════════
{
  const r1 = C.checkArrangementDecided({});
  assert('P17-skip: 빈 ctx', r1.ok && /skipped/.test(r1.detail));

  assert('P17-ok: square', C.checkArrangementDecided({ arrangement: 'square' }).ok);
  assert('P17-ok: staggered', C.checkArrangementDecided({ arrangement: 'staggered' }).ok);
  assert('P17-ok: custom + rows',
    C.checkArrangementDecided({ arrangement: 'custom', rows: [3, 3, 3] }).ok);

  assert('P17-fail: invalid value',
    !C.checkArrangementDecided({ arrangement: 'hexagonal' }).ok);
  assert('P17-fail: custom without rows',
    !C.checkArrangementDecided({ arrangement: 'custom' }).ok);
}

// ═══════════════════════════════════════════════
// P21 — 그룹 형태 유효성 (조건 A + B)
// ═══════════════════════════════════════════════
{
  const r1 = C.checkGroupValidity({});
  assert('P21-skip: 빈 ctx', r1.ok && /skipped/.test(r1.detail));

  // 정상: 2그룹 각 2셀, 조건 A + B 만족
  const r2 = C.checkGroupValidity({
    groups: [
      { index: 0, cells: [{ x: 0, y: 0 }, { x: 0, y: 100 }] },
      { index: 1, cells: [{ x: 100, y: 0 }, { x: 100, y: 100 }] },
    ],
    arrangement: 'square',
    pitch: 100,
  });
  assert('P21-ok: 2그룹 조건 A·B 만족', r2.ok);

  // 조건 A 위반: G0 셀 비연결
  const r3 = C.checkGroupValidity({
    groups: [
      { index: 0, cells: [{ x: 0, y: 0 }, { x: 500, y: 500 }] },  // 비연결
      { index: 1, cells: [{ x: 100, y: 0 }, { x: 100, y: 100 }] },
    ],
    arrangement: 'square',
    pitch: 100,
  });
  assert('P21-fail: 조건 A 위반', !r3.ok);
  assert('P21-fail: detail 포함 "조건 A"',
    /조건 A/.test(r3.detail));
}

// ═══════════════════════════════════════════════
// runValidation 통합 테스트
// ═══════════════════════════════════════════════
{
  // 통합 케이스: 유효한 ctx 전달 → Tier 2a 7건 실검증 + 나머지 스텁 ok
  const goodCtx = {
    S: 2, P: 2,
    arrangement: 'square',
    pitch: 100,
    render_d: 100,
    gap: 0,
    b_plus_side: 'left',
    b_minus_side: 'right',
    cells: [
      { x: 0, y: 0, top_polarity: '+', bottom_polarity: '-' },
      { x: 100, y: 0, top_polarity: '-', bottom_polarity: '+' },
      { x: 0, y: 100, top_polarity: '-', bottom_polarity: '+' },
      { x: 100, y: 100, top_polarity: '+', bottom_polarity: '-' },
    ],
    groups: [
      { index: 0, cells: [{ x: 0, y: 0 }, { x: 0, y: 100 }], is_b_plus: true },
      { index: 1, cells: [{ x: 100, y: 0 }, { x: 100, y: 100 }], is_b_minus: true },
    ],
  };
  const r = V.runValidation(goodCtx);
  assert('통합-ok: goodCtx → passed=true', r.passed);
  assert('통합-ok: violations === 0',
    r.violations.length === 0, `violations=${JSON.stringify(r.violations)}`);
  assert('통합-ok: executed === 14', r.summary.executed === 14);

  // 실패 케이스: 극성 불일치 + 잘못된 arrangement
  const badCtx = {
    ...goodCtx,
    arrangement: 'triangle',  // P17 fail
    cells: [
      { x: 0, y: 0, top_polarity: '+', bottom_polarity: '+' },  // P01 fail
      ...goodCtx.cells.slice(1),
    ],
  };
  const rBad = V.runValidation(badCtx);
  assert('통합-fail: badCtx → passed=false', !rBad.passed);
  const ids = rBad.violations.map(v => v.rule_id);
  assert('통합-fail: P01 위반 포함', ids.includes('P01'));
  assert('통합-fail: P17 위반 포함', ids.includes('P17'));
}

// ─── 결과 ──────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
