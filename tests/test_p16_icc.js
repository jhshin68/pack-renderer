/**
 * P16 — checkICC (원칙 16 — ICC 산업 실무 제약)
 *
 *   ctx: { groups:[{index, cells:[{x,y}]}], arrangement, pitch, delta_min? }
 *   skip: groups 없음 / arrangement 없음
 *
 *   ①항: 행 스팬 ≤ 2 (셀 y좌표 기준 unique row 수)
 *   ②항: 종횡비 ≤ 2.0 (bbox max_dim / min_dim, 1셀 그룹 skip)
 *   ③항: 볼록성 ≥ 0.75 (cells.length / bbox 내 격자점 수, 2셀 이하 skip)
 *   ④항: δ_min — delta_min 파라미터 없으면 skip
 *   ⑤항: 합동쌍 대칭 — 복잡도, skip
 *
 *   pitch=100 기준 테스트 케이스 좌표 사용
 */
'use strict';

const path = require('path');
const V = require(path.join(__dirname, '..', 'src', 'validator.js'));
V.loadSpec();
const C = V.CHECKS;

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

const P = 100; // pitch

// ── skip ──────────────────────────────────────────
assert('P16-skip: 빈 ctx',      C.checkICC({}).ok);
assert('P16-skip: groups 없음', C.checkICC({ arrangement: 'square' }).ok);
assert('P16-skip: arrangement 없음',
  C.checkICC({ groups: [{ index: 0, cells: [{ x: 0, y: 0 }] }] }).ok);

// ── ①항: 행 스팬 ≤ 2 ─────────────────────────────
{
  // ok: 2×2 = row_span 2
  const r = C.checkICC({
    groups: [{
      index: 0,
      cells: [{ x: 0, y: 0 }, { x: P, y: 0 }, { x: 0, y: P }, { x: P, y: P }],
    }],
    arrangement: 'square', pitch: P,
  });
  assert('P16①-ok: 2×2 row_span=2', r.ok, r.detail);
}
{
  // fail: 1×3 = row_span 3
  const r = C.checkICC({
    groups: [{
      index: 0,
      cells: [{ x: 0, y: 0 }, { x: 0, y: P }, { x: 0, y: 2*P }],
    }],
    arrangement: 'square', pitch: P,
  });
  assert('P16①-fail: row_span=3 > 2', !r.ok, r.detail);
  assert('P16①-fail: axis P16.1',
    r.data && r.data.axis === 'P16.1', `axis=${r.data && r.data.axis}`);
}
{
  // ok: I형 3셀 가로 (row_span=1)
  const r = C.checkICC({
    groups: [{
      index: 0,
      cells: [{ x: 0, y: 0 }, { x: P, y: 0 }, { x: 2*P, y: 0 }],
    }],
    arrangement: 'square', pitch: P,
  });
  assert('P16①-ok: I형 가로 row_span=1', r.ok);
}

// ── ②항: 종횡비 ≤ 2.0 ────────────────────────────
{
  // fail: 1행 4셀 가로 → row_span=1 ok, w=3P h→P(0→p fallback), aspect=3.0 > 2.0
  const r = C.checkICC({
    groups: [{
      index: 0,
      cells: [
        { x: 0, y: 0 }, { x: P, y: 0 }, { x: 2*P, y: 0 }, { x: 3*P, y: 0 },
      ],
    }],
    arrangement: 'square', pitch: P,
  });
  assert('P16②-fail: I형 4셀 가로 aspect=3.0 > 2.0', !r.ok, r.detail);
  assert('P16②-fail: axis P16.2',
    r.data && r.data.axis === 'P16.2', `axis=${r.data && r.data.axis}`);
}
{
  // ok: 2×2 aspect = 1.0
  const r = C.checkICC({
    groups: [{
      index: 0,
      cells: [{ x: 0, y: 0 }, { x: P, y: 0 }, { x: 0, y: P }, { x: P, y: P }],
    }],
    arrangement: 'square', pitch: P,
  });
  assert('P16②-ok: 2×2 aspect=1.0', r.ok);
}
{
  // ok: 1×2 I형 가로 (w=P, h=0→min=P, aspect=1.0)
  const r = C.checkICC({
    groups: [{
      index: 0,
      cells: [{ x: 0, y: 0 }, { x: P, y: 0 }],
    }],
    arrangement: 'square', pitch: P,
  });
  assert('P16②-ok: 2셀 가로 aspect=1.0', r.ok);
}

// ── ③항: 볼록성 ≥ 0.75 ───────────────────────────
{
  // fail: T형 (3×1 + 돌출 1) — 3×2 bbox = 6 slots, 4 cells → 4/6 ≈ 0.67 < 0.75
  //   (0,0) (P,0) (2P,0)
  //         (P,P)
  const r = C.checkICC({
    groups: [{
      index: 0,
      cells: [
        { x: 0, y: 0 }, { x: P, y: 0 }, { x: 2*P, y: 0 },
        { x: P, y: P },
      ],
    }],
    arrangement: 'square', pitch: P,
  });
  assert('P16③-fail: T형 4셀 볼록성 < 0.75', !r.ok, r.detail);
  assert('P16③-fail: axis P16.3',
    r.data && r.data.axis === 'P16.3', `axis=${r.data && r.data.axis}`);
}
{
  // ok: 2×2 볼록성 = 4/4 = 1.0
  const r = C.checkICC({
    groups: [{
      index: 0,
      cells: [{ x: 0, y: 0 }, { x: P, y: 0 }, { x: 0, y: P }, { x: P, y: P }],
    }],
    arrangement: 'square', pitch: P,
  });
  assert('P16③-ok: 2×2 볼록성=1.0', r.ok);
}
{
  // ok: 1셀 그룹 — ③항 skip (trivially ok)
  const r = C.checkICC({
    groups: [{ index: 0, cells: [{ x: 0, y: 0 }] }],
    arrangement: 'square', pitch: P,
  });
  assert('P16③-ok: 1셀 그룹 skip', r.ok);
}

// ── 복수 그룹: 첫 위반 그룹 감지 ─────────────────
{
  const r = C.checkICC({
    groups: [
      { index: 0, cells: [{ x: 0, y: 0 }, { x: P, y: 0 }] }, // ok
      {
        index: 1,
        cells: [
          { x: 200, y: 0 }, { x: 200, y: P }, { x: 200, y: 2*P },
          { x: 200, y: 3*P }, { x: 200, y: 4*P },
        ], // fail ②
      },
    ],
    arrangement: 'square', pitch: P,
  });
  assert('P16-fail: G1 종횡비 위반 감지', !r.ok);
  assert('P16-fail: 위반 그룹 index=1',
    r.data && r.data.group === 1, `group=${r.data && r.data.group}`);
}

// ── stub 제거 확인 ───────────────────────────────
{
  const r = C.checkICC({ groups: [], arrangement: 'square' });
  assert('P16-stub 제거됨', !r.stub, `stub=${r.stub}`);
}

console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
