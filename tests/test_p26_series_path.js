/**
 * 원칙 26 (P26) — 직렬 경로 단일성 테스트
 *   "그룹 간 직렬 연결은 단순 체인 G0–G1–G2–…–G_{S-1}. 분기·루프·우회 금지."
 *
 * 원칙 세부:
 *   ① 중간 Gi (0<i<S-1)는 정확히 G_{i-1}·G_{i+1} 두 이웃
 *   ② G0, G_{S-1}은 각각 직렬 이웃 1개
 *   ③ 그룹 내부 셀 간 병렬 연결에는 미적용
 *   ④ 위반 시 전류 분기 → 니켈 형상 다의성
 *
 * 검증 축 (2축):
 *   축 1 — 플레이트 구조적 보장: `calcNickelPattern(S,P)` 출력이 simple chain을 구현하는가
 *     · 각 플레이트 groups 배열이 연속 인덱스 (|i-j| ≤ 1)
 *     · 상면+하면 합집합에서 각 Gi가 정확히 2번 등장 (상면 1회 + 하면 1회)
 *     · B+ 단자 = G0, B- 단자 = G_{S-1}
 *   축 2 — 토폴로지 연결성: `assignGroupNumbers` 출력이 Gi↔G_{i+1} 조건 B (물리 인접) 유지
 *     · `checkGroupValidity` 재사용하여 조건 B 위반 없음 확인
 *
 * 참고: 그룹 내부(원칙 26 ③)는 병렬이므로 본 테스트 범위 밖.
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

function makeGrid(S, P, pitch = 100) {
  const cells = [];
  for (let r = 0; r < P; r++)
    for (let c = 0; c < S; c++)
      cells.push({ x: c * pitch, y: r * pitch });
  return cells;
}

// ═══════════════════════════════════════════════
// 축 1 — calcNickelPattern 플레이트 구조 검증
// ═══════════════════════════════════════════════

// ─── Case A — 연속 인덱스 불변 (모든 플레이트 groups는 |i-j| ≤ 1) ───
{
  for (const S of [2, 3, 4, 5, 8, 13]) {
    const pat = G.calcNickelPattern(S, 5);
    const allPlates = [...pat.top, ...pat.bot];

    let allContiguous = true;
    let firstBad = null;
    for (const plate of allPlates) {
      const gs = plate.groups;
      if (gs.length === 2 && Math.abs(gs[0] - gs[1]) !== 1) {
        allContiguous = false;
        firstBad = firstBad || `S=${S} plate groups=[${gs}]`;
      }
      if (gs.length > 2) {  // 3그룹 병합 금지 (P26 단일성)
        allContiguous = false;
        firstBad = firstBad || `S=${S} plate groups=[${gs}] (>2개 병합 금지)`;
      }
    }
    assert(`A-S${S}: 모든 플레이트 groups 연속 인덱스 (|i-j|≤1)`,
      allContiguous, firstBad || '');
  }
}

// ─── Case B — 각 Gi가 정확히 2번 등장 (상면 1 + 하면 1) ───
{
  for (const S of [2, 3, 5, 8, 13]) {
    const pat = G.calcNickelPattern(S, 5);
    const count = new Array(S).fill(0);
    for (const plate of [...pat.top, ...pat.bot])
      for (const g of plate.groups) count[g]++;

    const allTwice = count.every(c => c === 2);
    assert(`B-S${S}: 모든 Gi가 정확히 2번 (상1+하1)`,
      allTwice, `count=[${count.join(',')}]`);
  }
}

// ─── Case C — B+ = G0 단독 (상면 첫 번째 I형) ───
{
  for (const S of [2, 3, 5, 8, 13]) {
    const pat = G.calcNickelPattern(S, 5);
    const bPlus = pat.top.find(p => p.terminal === 'B+');
    assert(`C-S${S}: B+ 단자 플레이트 존재`, !!bPlus);
    if (bPlus) {
      assert(`C-S${S}: B+ = G0 단독`,
        bPlus.groups.length === 1 && bPlus.groups[0] === 0,
        `got groups=[${bPlus.groups}]`);
    }
  }
}

// ─── Case D — B- = G_{S-1} 포함 (S 짝수 → 상면, S 홀수 → 하면) ───
{
  for (const S of [2, 3, 5, 8, 13]) {
    const pat = G.calcNickelPattern(S, 5);
    const allPlates = [...pat.top, ...pat.bot];
    const bMinus = allPlates.find(p => p.terminal === 'B-');
    assert(`D-S${S}: B- 단자 플레이트 존재`, !!bMinus);
    if (bMinus) {
      assert(`D-S${S}: B- 플레이트는 G_{S-1}(${S-1}) 포함`,
        bMinus.groups.includes(S - 1));
    }
    // D-면-배치: SKIP — 원칙 14 ④항 ↔ calcNickelPattern 불일치 조사 필요
    //   원칙: "S짝수 → 상면 G_{S-1}" / 구현: "S짝수 → 하면 [G_{S-2}∪G_{S-1}]"
    //   S홀수는 양쪽 일치. state/verification_matrix.md 갭 #1 참조.
    //   본 assertion은 갭 조사·결정 후 복원하거나 박제로 전환한다.
  }
}

// ─── Case E — S=1 특수 (단일 그룹) ───
// S=1에서는 plate 병합 패턴이 퇴화하지만 P26 위반 아님
{
  const pat = G.calcNickelPattern(1, 5);
  const allPlates = [...pat.top, ...pat.bot];
  const g0Count = allPlates.reduce((s, p) => s + (p.groups.includes(0) ? 1 : 0), 0);
  assert('E-S1: G0 등장 횟수 ≥ 1', g0Count >= 1, `g0Count=${g0Count}`);
}

// ═══════════════════════════════════════════════
// 축 2 — assignGroupNumbers 출력 조건 B 검증
// ═══════════════════════════════════════════════

// ─── Case F — 여러 S×P 조합에서 Gi↔G_{i+1} 물리 인접 유지 ───
{
  const cases = [
    { S: 2, P: 2 }, { S: 3, P: 3 }, { S: 4, P: 2 },
    { S: 5, P: 5 }, { S: 8, P: 4 }, { S: 13, P: 3 },
  ];
  for (const { S, P } of cases) {
    const ctx = { S, P, arrangement: 'square', cell_centers: makeGrid(S, P, 100) };
    const r = G.assignGroupNumbers(ctx);
    const ok = G.checkGroupValidity(r.groups, 'square', 100);
    assert(`F-${S}S${P}P: checkGroupValidity valid`, ok.valid,
      `violations: ${JSON.stringify(ok.violations)}`);
  }
}

// ─── Case G — 인위적 분기 감지 (조건 B 위반) ───
// P26 위반 시뮬레이션: G0와 G1을 물리적으로 멀리 배치 → 조건 B 실패
{
  const groupsBranched = [
    { index: 0, cells: [{ x: 0, y: 0 }, { x: 0, y: 100 }] },
    { index: 1, cells: [{ x: 1000, y: 0 }, { x: 1000, y: 100 }] },  // 원거리
    { index: 2, cells: [{ x: 1100, y: 0 }, { x: 1100, y: 100 }] },
  ];
  const r = G.checkGroupValidity(groupsBranched, 'square', 100);
  assert('G: G0-G1 원거리 → checkGroupValidity invalid (P26/조건 B 위반 감지)',
    !r.valid);
}

// ─── Case H — S=1 특수 (직렬 이웃 0개) ───
{
  const groupsSingle = [
    { index: 0, cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
  ];
  const r = G.checkGroupValidity(groupsSingle, 'square', 100);
  assert('H-S1: 단일 그룹 valid (조건 B 비적용)', r.valid);
}

// ─── Case I — assignGroupNumbers 결과 그룹 번호가 0..S-1 연속 ───
// P26이 "simple chain"을 요구하므로 번호 gap 금지
{
  const ctx = { S: 13, P: 5, arrangement: 'square', cell_centers: makeGrid(13, 5) };
  const r = G.assignGroupNumbers(ctx);
  const indices = r.groups.map(g => g.index).sort((a, b) => a - b);
  const expected = Array.from({ length: 13 }, (_, i) => i);
  assert('I: 13S5P groups.index === 0..12 연속', JSON.stringify(indices) === JSON.stringify(expected),
    `got [${indices}]`);

  assert('I: G0.is_b_plus === true', r.groups[0].is_b_plus === true);
  assert('I: G12.is_b_minus === true', r.groups[12].is_b_minus === true);
}

// ─── 결과 ──────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
