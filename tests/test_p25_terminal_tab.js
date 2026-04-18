/**
 * P25 — checkTerminalTab (원칙 25 — B+/B- 단자탭 기하학적 정의)
 *
 *   ctx: { terminal_tabs:[{width, length, polarity, direction}], nickel_w, tab_len }
 *   skip: terminal_tabs 없음 / 빈 배열
 *   ok  : width === nickel_w ①, length === tab_len ②
 *   fail: width ≠ nickel_w (①항 위반)
 *   fail: length ≠ tab_len (②항 위반)
 *   ④항: direction ∈ forbidden_directions 위반 (ctx.forbidden_tab_directions 있을 때)
 *   ③항: 서명 포함 여부 — validator 범위 외, skip
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
assert('P25-skip: 빈 ctx',    C.checkTerminalTab({}).ok);
assert('P25-skip: tabs 빈 배열', C.checkTerminalTab({ terminal_tabs: [] }).ok);
assert('P25-skip: nickel_w·tab_len 없으면 pass',
  C.checkTerminalTab({ terminal_tabs: [{ width: 5, length: 10, polarity: 'B+', direction: 'top' }] }).ok);

// ── ok ───────────────────────────────────────────
assert('P25-ok: width===nickel_w, length===tab_len',
  C.checkTerminalTab({
    terminal_tabs: [
      { width: 5, length: 10, polarity: 'B+', direction: 'top' },
      { width: 5, length: 10, polarity: 'B-', direction: 'bottom' },
    ],
    nickel_w: 5,
    tab_len: 10,
  }).ok);

// ── fail ①항 width ≠ nickel_w ────────────────────
{
  const r = C.checkTerminalTab({
    terminal_tabs: [{ width: 4, length: 10, polarity: 'B+', direction: 'top' }],
    nickel_w: 5,
    tab_len: 10,
  });
  assert('P25-fail ①: width(4) ≠ nickel_w(5)', !r.ok);
  assert('P25-fail ①: axis P25.1',
    r.data && r.data.axis === 'P25.1', `axis=${r.data && r.data.axis}`);
  assert('P25-fail: stub 제거됨', !r.stub, `stub=${r.stub}`);
}

// ── fail ②항 length ≠ tab_len ────────────────────
{
  const r = C.checkTerminalTab({
    terminal_tabs: [{ width: 5, length: 8, polarity: 'B-', direction: 'bottom' }],
    nickel_w: 5,
    tab_len: 10,
  });
  assert('P25-fail ②: length(8) ≠ tab_len(10)', !r.ok);
  assert('P25-fail ②: axis P25.2',
    r.data && r.data.axis === 'P25.2', `axis=${r.data && r.data.axis}`);
}

// ── fail ④항 방향 금지 ──────────────────────────
{
  // B+ 탭이 이종 극성(B-) 플레이트 방향(bottom)으로 돌출
  const r = C.checkTerminalTab({
    terminal_tabs: [{ width: 5, length: 10, polarity: 'B+', direction: 'bottom' }],
    nickel_w: 5,
    tab_len: 10,
    forbidden_tab_directions: { 'B+': ['bottom', 'left'] },
  });
  assert('P25-fail ④: B+ 금지 방향(bottom) 감지', !r.ok);
  assert('P25-fail ④: axis P25.4',
    r.data && r.data.axis === 'P25.4', `axis=${r.data && r.data.axis}`);
}

// ── ok ④항 허용 방향 ───────────────────────────
{
  const r = C.checkTerminalTab({
    terminal_tabs: [{ width: 5, length: 10, polarity: 'B+', direction: 'top' }],
    nickel_w: 5,
    tab_len: 10,
    forbidden_tab_directions: { 'B+': ['bottom', 'left'] },
  });
  assert('P25-ok ④: B+ 허용 방향(top)', r.ok);
}

console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
