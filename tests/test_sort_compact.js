'use strict';
// Phase 1.6: 정렬 체인에 sum(compactShapeScore) 주입 검증
// 정렬 키: B+/B- → ICC 위반 → total_score → sum(compactShapeScore) 내림차순 → m_distinct
const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));
G.loadSpec();

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

function sumCompact(cand, pitch, arr) {
  return cand.groups.reduce((s, g) => s + G.compactShapeScore(g.cells, pitch, arr), 0);
}

// ── 케이스 1: S=3 P=3, 3×3 정배열 ──────────────────────────
// total_score 동점 후보에서 compact_score 높은 것이 앞에 와야 함
(function case1() {
  const cells = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      cells.push({ x: c * 20, y: r * 20, row: r, col: c });

  const res = G.enumerateGroupAssignments({ cells, S: 3, P: 3, arrangement: 'square' });
  check('케이스1 후보 존재', res.candidates.length >= 2);

  if (res.candidates.length >= 2) {
    // m_distinct + total_score 동점 그룹 추출 (m_distinct가 상위 정렬 키)
    const m0 = res.candidates[0].m_distinct;
    const ts0 = res.candidates[0].total_score;
    const tied = res.candidates.filter(c => c.m_distinct === m0 && c.total_score === ts0);
    check('케이스1 동점 후보 2개 이상', tied.length >= 2,
      `동점 후보: ${tied.length}`);

    if (tied.length >= 2) {
      // 동점 후보 내 compact_score 내림차순 정렬 여부 확인
      const cs = tied.map(c => sumCompact(c, 20, 'square'));
      let sorted = true;
      for (let i = 0; i < cs.length - 1; i++) {
        if (cs[i] < cs[i + 1] - 0.01) { sorted = false; break; }
      }
      check('케이스1 동점 후보 compact_score 내림차순', sorted,
        `실제 compact scores: ${cs.map(v => v.toFixed(2)).join(', ')}`);
    }
  }
})();

// ── 케이스 2: S=2 P=4, 4×2 정배열 ──────────────────────────
// total_score=0 후보(L자, T자 등)에서 compact_score 더 높은 것이 앞에 와야 함
(function case2() {
  const cells = [];
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++)
      cells.push({ x: c * 20, y: r * 20, row: r, col: c });

  const res = G.enumerateGroupAssignments({ cells, S: 2, P: 4, arrangement: 'square' });
  check('케이스2 후보 존재', res.candidates.length >= 2);

  if (res.candidates.length >= 2) {
    const ts0 = res.candidates[0].total_score;
    const tied = res.candidates.filter(c => c.total_score === ts0);
    if (tied.length >= 2) {
      const cs = tied.map(c => sumCompact(c, 20, 'square'));
      let sorted = true;
      for (let i = 0; i < cs.length - 1; i++) {
        if (cs[i] < cs[i + 1] - 0.01) { sorted = false; break; }
      }
      check('케이스2 동점 후보 compact_score 내림차순', sorted,
        `실제 compact scores: ${cs.map(v => v.toFixed(2)).join(', ')}`);
    } else {
      check('케이스2 동점 후보 없음 (스킵)', true);
    }
  }
})();

console.log(`\n총 ${pass + fail}개 중 ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
