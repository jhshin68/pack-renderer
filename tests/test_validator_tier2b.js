/**
 * Tier 2b — validator 실구현 검증 (P10·P12·P26)
 *   P07 checkNickelThicknessUniform은 Tier 2c (ctx.plates 스키마 확장 필요)
 */
'use strict';

const path = require('path');
const V = require(path.join(__dirname, '..', 'src', 'validator.js'));
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));
V.loadSpec();

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

const C = V.CHECKS;

// ═══════════════════════════════════════════════
// P10 — 사다리 구조 (그룹 내 단일 연결성)
// ═══════════════════════════════════════════════
{
  const r1 = C.checkLadderStructure({});
  assert('P10-skip: 빈 ctx', r1.ok && /skipped/.test(r1.detail));

  // 정상: 2그룹 각 3셀 세로 연결
  const r2 = C.checkLadderStructure({
    groups: [
      { index: 0, cells: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 0, y: 200 }] },
      { index: 1, cells: [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 200 }] },
    ],
    arrangement: 'square',
    pitch: 100,
  });
  assert('P10-ok: 2그룹 사다리 연결', r2.ok);

  // 비연결: G0 셀 분리
  const r3 = C.checkLadderStructure({
    groups: [
      { index: 0, cells: [{ x: 0, y: 0 }, { x: 500, y: 0 }] },  // 500 > threshold
      { index: 1, cells: [{ x: 100, y: 0 }, { x: 200, y: 0 }] },
    ],
    arrangement: 'square',
    pitch: 100,
  });
  assert('P10-fail: G0 셀 분리 감지', !r3.ok);
  assert('P10-fail: data.group === 0', r3.data && r3.data.group === 0);

  // 단일 셀 그룹은 유효
  const r4 = C.checkLadderStructure({
    groups: [
      { index: 0, cells: [{ x: 0, y: 0 }] },
      { index: 1, cells: [{ x: 100, y: 0 }] },
    ],
    arrangement: 'square',
    pitch: 100,
  });
  assert('P10-ok: 단일 셀 그룹 (스킵)', r4.ok);
}

// ═══════════════════════════════════════════════
// P12 — 엠보 불가역성
// ═══════════════════════════════════════════════
{
  const r1 = C.checkEmbossIrreversibility({});
  assert('P12-skip: allow_mirror 없음', r1.ok && /skipped/.test(r1.detail));

  const r2 = C.checkEmbossIrreversibility({ allow_mirror: false });
  assert('P12-ok: allow_mirror=false', r2.ok && !r2.detail);

  const r3 = C.checkEmbossIrreversibility({ allow_mirror: true });
  assert('P12-fail: allow_mirror=true → 원칙 12 위반', !r3.ok);
  assert('P12-fail: detail 언급 "원칙 12"', /원칙 12/.test(r3.detail));
}

// ═══════════════════════════════════════════════
// P26 — 직렬 경로 단일성
// ═══════════════════════════════════════════════
{
  const r1 = C.checkSeriesPathSingleness({});
  assert('P26-skip: face_pattern/groups 없음',
    r1.ok && /skipped/.test(r1.detail));

  // 정상: calcNickelPattern 출력 그대로
  const fp = G.calcNickelPattern(5, 3);
  const r2 = C.checkSeriesPathSingleness({ face_pattern: fp });
  assert('P26-ok: calcNickelPattern(5,3) 출력 통과', r2.ok,
    `detail=${r2.detail}`);

  // 여러 S 조합 모두 통과
  for (const S of [2, 3, 5, 8, 13]) {
    const pat = G.calcNickelPattern(S, 5);
    const res = C.checkSeriesPathSingleness({ face_pattern: pat });
    assert(`P26-ok: S=${S} calcNickelPattern 통과`, res.ok,
      `detail=${res.detail}`);
  }

  // 위반: 3그룹 병합 플레이트
  const badFp = {
    top: [{ groups: [0, 1, 2] }],  // 3그룹 병합 — P26 위반
    bot: [],
  };
  const r3 = C.checkSeriesPathSingleness({ face_pattern: badFp });
  assert('P26-fail: 3그룹 병합 감지', !r3.ok);
  assert('P26-fail: data.violation === ">2 merge"',
    r3.data && r3.data.violation === '>2 merge');

  // 위반: 비연속 그룹 병합
  const badFp2 = {
    top: [{ groups: [0, 2] }],  // 0과 2 (gap) — P26 위반
    bot: [],
  };
  const r4 = C.checkSeriesPathSingleness({ face_pattern: badFp2 });
  assert('P26-fail: 비연속 그룹 병합 감지 (0,2)', !r4.ok);
  assert('P26-fail: data.violation === "non-contiguous"',
    r4.data && r4.data.violation === 'non-contiguous');

  // 축 2: groups.index 연속성
  const r5 = C.checkSeriesPathSingleness({
    groups: [
      { index: 0, cells: [] },
      { index: 2, cells: [] },  // gap (index 1 누락)
      { index: 3, cells: [] },
    ],
  });
  assert('P26-fail: groups.index 비연속', !r5.ok);

  // assignGroupNumbers 결과는 통과
  const ag = G.assignGroupNumbers({
    S: 4, P: 3, arrangement: 'square',
    cell_centers: (() => {
      const out = [];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 4; c++)
          out.push({ x: c * 100, y: r * 100 });
      return out;
    })(),
  });
  const r6 = C.checkSeriesPathSingleness({ groups: ag.groups });
  assert('P26-ok: assignGroupNumbers(4S3P) 통과', r6.ok);
}

// ═══════════════════════════════════════════════
// runValidation 통합
// ═══════════════════════════════════════════════
{
  const fullCtx = {
    S: 3, P: 3,
    arrangement: 'square',
    pitch: 100, render_d: 100, gap: 0,
    b_plus_side: 'left', b_minus_side: 'right',
    allow_mirror: false,
    cells: (() => {
      const out = [];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          out.push({
            x: c * 100, y: r * 100,
            top_polarity: (r * 3 + c) % 2 === 0 ? '+' : '-',
            bottom_polarity: (r * 3 + c) % 2 === 0 ? '-' : '+',
          });
      return out;
    })(),
    groups: G.assignGroupNumbers({
      S: 3, P: 3, arrangement: 'square',
      cell_centers: (() => {
        const out = [];
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 3; c++) out.push({ x: c * 100, y: r * 100 });
        return out;
      })(),
    }).groups,
    face_pattern: G.calcNickelPattern(3, 3),
  };
  const r = V.runValidation(fullCtx);
  assert('통합-fullCtx: passed === true', r.passed,
    `violations=${JSON.stringify(r.violations.map(v => v.rule_id))}`);
  assert('통합-fullCtx: violations === 0', r.violations.length === 0);

  // P12 fail (LAYER 2 prune_candidate — passed는 true 유지, violations만 기록)
  const badCtxP12 = { ...fullCtx, allow_mirror: true };
  const rP12 = V.runValidation(badCtxP12);
  assert('통합-P12 fail: passed === true (prune_candidate)',
    rP12.passed, `passed=${rP12.passed}`);
  assert('통합-P12 fail: P12 violations 포함',
    rP12.violations.some(v => v.rule_id === 'P12'));

  // P10 fail (abort_design — passed=false)
  const badCtxP10 = {
    ...fullCtx,
    groups: [
      { index: 0, cells: [{ x: 0, y: 0 }, { x: 500, y: 500 }] },  // 분리
      { index: 1, cells: [{ x: 100, y: 0 }, { x: 100, y: 100 }] },
    ],
  };
  const rP10 = V.runValidation(badCtxP10);
  assert('통합-P10 fail: passed === false (abort_design)', !rP10.passed);
  assert('통합-P10 fail: P10 violations 포함',
    rP10.violations.some(v => v.rule_id === 'P10'));
}

// ─── 결과 ──────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
