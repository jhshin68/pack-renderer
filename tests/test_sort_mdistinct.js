'use strict';
/**
 * m_distinct 정렬 우선순위 검증
 * 정렬 순서: B+/B- → m_distinct 오름차순 → ICC → total_score → compact
 * candidate.m_distinct 필드를 직접 사용 (generator.js가 annotate)
 */
const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));
G.loadSpec();

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// ── 케이스: 3×3 정배열, S=3, P=3 ──
(function() {
  const cells = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      cells.push({ x: c * 20, y: r * 20, row: r, col: c });

  const res = G.enumerateGroupAssignments({
    cells, S: 3, P: 3, arrangement: 'square',
    max_candidates: 100,
  });

  assert('SD1: 후보 2개 이상 존재', res.candidates.length >= 2, `실제: ${res.candidates.length}`);
  assert('SD2: m_distinct 필드 존재', res.candidates[0] && res.candidates[0].m_distinct != null,
    `실제: ${JSON.stringify(res.candidates[0] && res.candidates[0].m_distinct)}`);

  if (res.candidates.length >= 2 && res.candidates[0].m_distinct != null) {
    const mArr = res.candidates.map(c => c.m_distinct);
    const okArr = res.candidates.map(c => (c.b_plus_ok && c.b_minus_ok) ? 0 : 1);

    // B+/B- 동등 그룹 내에서 m_distinct 오름차순 확인
    let sorted = true, firstBad = -1;
    for (let i = 0; i + 1 < res.candidates.length; i++) {
      if (okArr[i] !== okArr[i + 1]) continue;
      if (mArr[i] > mArr[i + 1]) {
        sorted = false; firstBad = i; break;
      }
    }
    assert('SD3: m_distinct 오름차순 (B+/B- 동등 내)', sorted,
      sorted ? '' :
      `i=${firstBad}: m_distinct[${firstBad}]=${mArr[firstBad]} > [${firstBad+1}]=${mArr[firstBad+1]}  ` +
      `(분포: ${[...new Set(mArr)].sort((a,b)=>a-b).join(',')})`
    );

    // m_distinct 최솟값 후보가 최상위
    const minM = Math.min(...mArr);
    assert('SD4: m_distinct 최솟값 후보가 최상위', mArr[0] === minM,
      `mArr[0]=${mArr[0]}, minM=${minM}`);
  }
})();

console.log('─'.repeat(40));
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
