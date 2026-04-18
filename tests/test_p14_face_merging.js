/**
 * Tier 2c — P14 checkFaceMerging 실구현 검증 (RED→GREEN)
 *   원칙 14 — 면별 병합 불변
 *     P14.1 상면 패턴 [G0] | [G1∪G2] | ... | (S짝수→[G_{S-1}])
 *     P14.2 하면 패턴 [G0∪G1] | [G2∪G3] | ... | (S홀수→[G_{S-1}])
 *     P14.3 B+ 기본 상면 G0 (b_plus_face='bottom'이면 P04 override)
 *     P14.4 B- S짝수 → 상면 G_{S-1} / S홀수 → 하면 G_{S-1}
 *     P14.5 bridge anchor (P22 LAYER 3 위임 — 현재 skip)
 *   갭 #1 해결 후속: calcNickelPattern 출력이 원칙 14를 전수 충족하는지 박제
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
// 1) skip — face_pattern / S 부재
// ═══════════════════════════════════════════════
{
  const r1 = C.checkFaceMerging({});
  assert('P14-skip: 빈 ctx', r1.ok && /skipped/.test(r1.detail || ''));

  const r2 = C.checkFaceMerging({ face_pattern: { top: [], bot: [] } });
  assert('P14-skip: S 없음', r2.ok && /skipped/.test(r2.detail || ''));

  const r3 = C.checkFaceMerging({ S: 3 });
  assert('P14-skip: face_pattern 없음', r3.ok && /skipped/.test(r3.detail || ''));
}

// ═══════════════════════════════════════════════
// 2) ok — calcNickelPattern 출력 전수 통과 (S=2,3,4,5,8,13)
// ═══════════════════════════════════════════════
{
  for (const S of [2, 3, 4, 5, 8, 13]) {
    const fp = G.calcNickelPattern(S, 3);
    const r = C.checkFaceMerging({ S, face_pattern: fp });
    assert(`P14-ok: calcNickelPattern(S=${S})`, r.ok, r.detail);
  }
}

// ═══════════════════════════════════════════════
// 3) fail P14.1 — 상면 플레이트 수 불일치
// ═══════════════════════════════════════════════
{
  // S=4 짝수 → 기대 top=[G0, G1∪G2, G3] (3개). 아래는 2개만 → fail
  const badFp = {
    top: [
      { groups: [0], type: 'I', terminal: 'B+' },
      { groups: [1, 2], type: 'U' },
    ],
    bot: [
      { groups: [0, 1], type: 'U' },
      { groups: [2, 3], type: 'U', terminal: 'B-' },
    ],
  };
  const r = C.checkFaceMerging({ S: 4, face_pattern: badFp });
  assert('P14-fail: S=4 상면 플레이트 수 부족', !r.ok);
  assert('P14-fail: data.axis === "P14.1"',
    r.data && r.data.axis === 'P14.1', `axis=${r.data && r.data.axis}`);
}

// ═══════════════════════════════════════════════
// 4) fail P14.1 — 상면 중간 플레이트 groups 순서 뒤집힘
// ═══════════════════════════════════════════════
{
  // S=5 홀수 → 기대 top=[G0, G1∪G2, G3∪G4]. [1,2] 대신 [2,1]
  const badFp = {
    top: [
      { groups: [0], type: 'I', terminal: 'B+' },
      { groups: [2, 1], type: 'U' },       // 순서 뒤집힘
      { groups: [3, 4], type: 'U' },
    ],
    bot: [
      { groups: [0, 1], type: 'U' },
      { groups: [2, 3], type: 'U' },
      { groups: [4], type: 'I', terminal: 'B-' },
    ],
  };
  const r = C.checkFaceMerging({ S: 5, face_pattern: badFp });
  assert('P14-fail: 상면 그룹 순서 위반', !r.ok);
  assert('P14-fail: detail에 "상면" 포함',
    /상면/.test(r.detail || ''), `detail=${r.detail}`);
}

// ═══════════════════════════════════════════════
// 5) fail P14.3 — B+ 가 상면 G0 아닌 곳에
// ═══════════════════════════════════════════════
{
  // S=4 짝수. B+ 를 상면 [1,2] 플레이트에 잘못 놓음
  const badFp = {
    top: [
      { groups: [0], type: 'I' },                  // B+ 없음
      { groups: [1, 2], type: 'U', terminal: 'B+' }, // 잘못된 위치
      { groups: [3], type: 'I', terminal: 'B-' },
    ],
    bot: [
      { groups: [0, 1], type: 'U' },
      { groups: [2, 3], type: 'U' },
    ],
  };
  const r = C.checkFaceMerging({ S: 4, face_pattern: badFp });
  assert('P14-fail: B+ 위치 위반', !r.ok);
  assert('P14-fail: axis P14.3',
    r.data && r.data.axis === 'P14.3', `axis=${r.data && r.data.axis}`);
}

// ═══════════════════════════════════════════════
// 6) ok P14.3 — b_plus_face='bottom' override (P04)
// ═══════════════════════════════════════════════
{
  // B+를 하면에 둔 경우 — P04 override로 허용
  const overrideFp = {
    top: [
      { groups: [0], type: 'I' },                  // B+ 없음
      { groups: [1, 2], type: 'U' },
      { groups: [3], type: 'I', terminal: 'B-' },
    ],
    bot: [
      { groups: [0, 1], type: 'U', terminal: 'B+' }, // 하면 B+
      { groups: [2, 3], type: 'U' },
    ],
  };
  const r = C.checkFaceMerging({
    S: 4, face_pattern: overrideFp, b_plus_face: 'bottom',
  });
  assert('P14-ok: b_plus_face=bottom override 허용', r.ok, r.detail);
}

// ═══════════════════════════════════════════════
// 7) fail P14.4 — S짝수인데 B-가 하면에 (갭 #1 회귀 방어)
// ═══════════════════════════════════════════════
{
  // S=4 짝수 → B- 상면 G3 기대. 하면에 잘못 놓음
  const badFp = {
    top: [
      { groups: [0], type: 'I', terminal: 'B+' },
      { groups: [1, 2], type: 'U' },
      { groups: [3], type: 'I' },                  // B- 있어야 함
    ],
    bot: [
      { groups: [0, 1], type: 'U' },
      { groups: [2, 3], type: 'U', terminal: 'B-' }, // 잘못된 위치
    ],
  };
  const r = C.checkFaceMerging({ S: 4, face_pattern: badFp });
  assert('P14-fail: S짝수 B- 하면 배치 감지 (갭 #1 회귀)', !r.ok);
  assert('P14-fail: axis P14.4',
    r.data && r.data.axis === 'P14.4', `axis=${r.data && r.data.axis}`);
}

// ═══════════════════════════════════════════════
// 8) fail P14.4 — S홀수인데 B-가 상면에
// ═══════════════════════════════════════════════
{
  // S=5 홀수 → B- 하면 G4 기대. 상면에 잘못 놓음
  const badFp = {
    top: [
      { groups: [0], type: 'I', terminal: 'B+' },
      { groups: [1, 2], type: 'U' },
      { groups: [3, 4], type: 'U', terminal: 'B-' }, // 잘못된 위치
    ],
    bot: [
      { groups: [0, 1], type: 'U' },
      { groups: [2, 3], type: 'U' },
      { groups: [4], type: 'I' },                  // B- 있어야 함
    ],
  };
  const r = C.checkFaceMerging({ S: 5, face_pattern: badFp });
  assert('P14-fail: S홀수 B- 상면 배치 감지', !r.ok);
  assert('P14-fail: axis P14.4 (홀수)',
    r.data && r.data.axis === 'P14.4', `axis=${r.data && r.data.axis}`);
}

// ═══════════════════════════════════════════════
// 9) 통합 — runValidation 에서 P14 abort_design 동작
// ═══════════════════════════════════════════════
{
  // 정상 ctx: passed true
  const goodCtx = {
    S: 4, P: 3,
    arrangement: 'square',
    pitch: 100, render_d: 100, gap: 0,
    b_plus_side: 'left', b_minus_side: 'right',
    allow_mirror: false,
    cells: (() => {
      const out = [];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 4; c++)
          out.push({
            x: c * 100, y: r * 100,
            top_polarity: (r * 4 + c) % 2 === 0 ? '+' : '-',
            bottom_polarity: (r * 4 + c) % 2 === 0 ? '-' : '+',
          });
      return out;
    })(),
    groups: G.assignGroupNumbers({
      S: 4, P: 3, arrangement: 'square',
      cell_centers: (() => {
        const out = [];
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 4; c++) out.push({ x: c * 100, y: r * 100 });
        return out;
      })(),
    }).groups,
    face_pattern: G.calcNickelPattern(4, 3),
  };
  const rg = V.runValidation(goodCtx);
  assert('통합-P14 ok: passed=true', rg.passed,
    `violations=${JSON.stringify(rg.violations.map(v => v.rule_id))}`);
  assert('통합-P14 ok: P14 violations 없음',
    !rg.violations.some(v => v.rule_id === 'P14'));

  // 위반 ctx: 상면 패턴 손상 → abort_design (passed=false)
  const badCtx = {
    ...goodCtx,
    face_pattern: {
      top: [{ groups: [0, 1, 2, 3], type: 'U', terminal: 'B+' }],  // 4그룹 병합
      bot: [],
    },
  };
  const rb = V.runValidation(badCtx);
  assert('통합-P14 fail: passed=false (abort_design)', !rb.passed);
  assert('통합-P14 fail: P14 violations 포함',
    rb.violations.some(v => v.rule_id === 'P14'));
}

// ─── 결과 ──────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
