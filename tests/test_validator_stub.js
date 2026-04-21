/**
 * M2 validator.js 구동 테스트
 *  - spec 로드 확인 (14 rules)
 *  - CHECKS 레지스트리 14개 함수 매핑 확인
 *  - runValidation() 레이어 선택 실행 확인
 *  - 스텁 단계에서 전원 ok 반환 확인
 *  - failFast / 레이어 필터 동작 확인
 *  - mock-fail 주입 테스트로 abort_design 흐름 확인
 */
const Validator = require('../src/validator');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('[PASS]', msg); }
  else      { fail++; console.log('[FAIL]', msg); }
}

// ─── 1. spec 로드 ────────────────────────────
const spec = Validator.loadSpec();
assert(spec, 'spec loaded');
assert(spec.rules.length === 15, `spec.rules.length === 15 (actual: ${spec.rules.length})`);

// ─── 2. CHECKS 레지스트리 완전성 ───────────────
const checksInRegistry = Object.keys(Validator.CHECKS);
assert(checksInRegistry.length === 15, `CHECKS count === 15 (actual: ${checksInRegistry.length})`);
const expectedChecks = spec.checks_registry_required;
for (const c of expectedChecks) {
  assert(typeof Validator.CHECKS[c] === 'function', `CHECKS.${c} is function`);
}

// ─── 3. 전 레이어 실행 (스텁은 전원 ok) ──────
const ctx = { S: 13, P: 5, N: 65, arrangement: 'custom', rows: [8,8,10,13,13,13] };
const r1 = Validator.runValidation(ctx);
assert(r1.passed === true, 'runValidation stub: passed === true');
assert(r1.violations.length === 0, `violations === 0 (actual: ${r1.violations.length})`);
assert(r1.summary.executed === 15, `summary.executed === 15 (actual: ${r1.summary.executed})`);
assert(r1.summary.passed === 15, `summary.passed === 15 (actual: ${r1.summary.passed})`);

// ─── 4. 레이어 필터 ──────────────────────────
const r2 = Validator.runValidation(ctx, { layers: [0] });
assert(r2.summary.executed === 6, `layer 0 only: executed === 6 (actual: ${r2.summary.executed})`);

const r3 = Validator.runValidation(ctx, { layers: [1] });
assert(r3.summary.executed === 2, `layer 1 only: executed === 2 (actual: ${r3.summary.executed})`);

const r4 = Validator.runValidation(ctx, { layers: [2] });
assert(r4.summary.executed === 7, `layer 2 only: executed === 7 (actual: ${r4.summary.executed})`);

// ─── 5. abort_design 흐름 mock (P01 강제 실패) ──
const origP01 = Validator.CHECKS.checkPolarityInversion;
Validator.CHECKS.checkPolarityInversion = () => ({ ok: false, detail: 'mock fail' });
const r5 = Validator.runValidation(ctx);
assert(r5.passed === false, 'mock P01 fail: passed === false (abort_design)');
assert(r5.violations.length === 1, 'violations.length === 1');
assert(r5.violations[0].rule_id === 'P01', 'violation rule_id === P01');
assert(r5.violations[0].fail_action === 'abort_design', 'violation fail_action === abort_design');
Validator.CHECKS.checkPolarityInversion = origP01;

// ─── 6. prune_candidate 흐름 mock (P07 강제 실패, passed는 유지) ──
const origP07 = Validator.CHECKS.checkNickelThicknessUniform;
Validator.CHECKS.checkNickelThicknessUniform = () => ({ ok: false, detail: 'mock prune' });
const r6 = Validator.runValidation(ctx);
assert(r6.passed === true, 'mock P07 prune: passed stays true (prune_candidate)');
assert(r6.violations.length === 1, 'violations.length === 1 (prune recorded)');
assert(r6.violations[0].fail_action === 'prune_candidate', 'fail_action === prune_candidate');
Validator.CHECKS.checkNickelThicknessUniform = origP07;

// ─── 7. failFast 동작 (LAYER 0에서 즉시 중단) ──
Validator.CHECKS.checkPolarityInversion = () => ({ ok: false, detail: 'fail fast test' });
const r7 = Validator.runValidation(ctx, { fail_fast: true });
assert(r7.passed === false, 'failFast: passed === false');
// P01은 layer 0 첫 번째 rule이므로 즉시 return → 이후 rule 실행 안 됨
assert(r7.summary.executed < 14, `failFast: executed (${r7.summary.executed}) < 14`);
Validator.CHECKS.checkPolarityInversion = origP01;

// ─── 8. not_implemented 경고 테스트 ───────────
delete Validator.CHECKS.checkPolarityInversion;
const r8 = Validator.runValidation(ctx);
assert(r8.warnings.length === 1, `missing check → warnings.length === 1 (actual: ${r8.warnings.length})`);
assert(r8.summary.not_implemented === 1, 'summary.not_implemented === 1');
Validator.CHECKS.checkPolarityInversion = origP01;

// ─── 결과 ────────────────────────────────────
console.log('─'.repeat(48));
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
