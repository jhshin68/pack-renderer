/**
 * P07 — checkNickelThicknessUniform (원칙 7 — 니켈 두께 동일 불변)
 *
 *   ctx: { plates:[{h_w, v_w}], nickel_w? }
 *   skip: plates 없음 / 빈 배열
 *   ok  : 모든 plates h_w === v_w (=== nickel_w 있으면 추가 확인)
 *   fail: h_w ≠ v_w (가로·세로 두께 불일치)
 *   fail: h_w/v_w ≠ nickel_w (설계 파라미터 불일치)
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

// ── skip ──────────────────────────────────────────
assert('P07-skip: 빈 ctx',
  C.checkNickelThicknessUniform({}).ok);
assert('P07-skip: plates 없음',
  C.checkNickelThicknessUniform({ plates: [] }).ok);
assert('P07-skip: plates 없는 key',
  C.checkNickelThicknessUniform({ nickel_w: 5 }).ok);

// ── ok ───────────────────────────────────────────
assert('P07-ok: h_w === v_w (단일 plate)',
  C.checkNickelThicknessUniform({ plates: [{ h_w: 5, v_w: 5 }] }).ok);

assert('P07-ok: 복수 plate 모두 동일',
  C.checkNickelThicknessUniform({
    plates: [{ h_w: 5, v_w: 5 }, { h_w: 5, v_w: 5 }, { h_w: 5, v_w: 5 }],
  }).ok);

assert('P07-ok: nickel_w 일치',
  C.checkNickelThicknessUniform({
    plates: [{ h_w: 5, v_w: 5 }],
    nickel_w: 5,
  }).ok);

// ── fail ─────────────────────────────────────────
{
  const r = C.checkNickelThicknessUniform({ plates: [{ h_w: 5, v_w: 4 }] });
  assert('P07-fail: h_w ≠ v_w', !r.ok);
  assert('P07-fail: data.h_w=5 data.v_w=4',
    r.data && r.data.h_w === 5 && r.data.v_w === 4,
    `data=${JSON.stringify(r.data)}`);
  assert('P07-fail: stub 제거됨', !r.stub, `stub=${r.stub}`);
}

{
  // 복수 plate 중 두 번째가 위반
  const r = C.checkNickelThicknessUniform({
    plates: [{ h_w: 5, v_w: 5 }, { h_w: 5, v_w: 6 }],
  });
  assert('P07-fail: 두 번째 plate 위반 감지', !r.ok);
}

{
  // nickel_w 불일치
  const r = C.checkNickelThicknessUniform({
    plates: [{ h_w: 5, v_w: 5 }],
    nickel_w: 6,
  });
  assert('P07-fail: nickel_w 불일치', !r.ok);
}

console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
