/**
 * S15B enumerateCongruentPairs 테스트
 *   원칙 15 Step B — 회전 대칭 하에서 서로 매핑되는 그룹 쌍(Gi ↔ Gj) 열거
 *
 * 입력: ctx = { groups, arrangement }, symmetry = { symmetry_order, rotation_center }
 * 출력: { congruent_pairs: [{ groupA, groupB, rotation }] }
 *   · groupA / groupB: 그룹 index (groupA < groupB)
 *   · rotation: 정수 c (1..k-1), Gi를 c·(2π/k)만큼 회전하면 Gj의 셀 집합과 일치
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// ─── Case A — C2 대칭, 2 그룹 (2×2 가로 분할) ─────────────────────
// G0(상단행) ↔ G1(하단행) 180° 회전 매핑 → 1쌍 예상
{
  const groups = [
    { index: 0, cells: [{ x: 0, y: 0 },   { x: 100, y: 0   }] },
    { index: 1, cells: [{ x: 0, y: 100 }, { x: 100, y: 100 }] },
  ];
  const ctx = { groups, arrangement: 'square' };
  const sym = { symmetry_order: 2, rotation_center: { x: 50, y: 50 } };
  const r = G.enumerateCongruentPairs(ctx, sym);

  assert('Case A: pairs.length === 1', r.congruent_pairs.length === 1,
    `got ${r.congruent_pairs.length}`);
  if (r.congruent_pairs.length === 1) {
    const p = r.congruent_pairs[0];
    assert('Case A: pair (0,1)', p.groupA === 0 && p.groupB === 1,
      `got (${p.groupA},${p.groupB})`);
    assert('Case A: rotation === 1', p.rotation === 1, `got ${p.rotation}`);
  }
}

// ─── Case B — C4 대칭, 4 단일셀 그룹 (2×2 네 모서리) ──────────────
// C4 회전 하 모든 그룹이 서로 매핑 → 6쌍 전부 예상
{
  const groups = [
    { index: 0, cells: [{ x: 0,   y: 0   }] },
    { index: 1, cells: [{ x: 100, y: 0   }] },
    { index: 2, cells: [{ x: 100, y: 100 }] },
    { index: 3, cells: [{ x: 0,   y: 100 }] },
  ];
  const ctx = { groups, arrangement: 'square' };
  const sym = { symmetry_order: 4, rotation_center: { x: 50, y: 50 } };
  const r = G.enumerateCongruentPairs(ctx, sym);

  assert('Case B: pairs.length === 6', r.congruent_pairs.length === 6,
    `got ${r.congruent_pairs.length}`);

  const keys = new Set(r.congruent_pairs.map(p => `${p.groupA},${p.groupB}`));
  const expected = ['0,1', '0,2', '0,3', '1,2', '1,3', '2,3'];
  assert('Case B: 모든 쌍 {i<j} 포함', expected.every(k => keys.has(k)),
    `keys=${[...keys].join(' ')}`);

  // 모든 groupA < groupB 정규화 확인
  assert('Case B: groupA < groupB 정규화',
    r.congruent_pairs.every(p => p.groupA < p.groupB));
  // rotation 값이 1..3 범위
  assert('Case B: rotation ∈ [1, k-1]',
    r.congruent_pairs.every(p => p.rotation >= 1 && p.rotation <= 3));
}

// ─── Case C — 비대칭 (symmetry_order=1) ─────────────────────────
// 회전 대칭 없음 → 빈 배열
{
  const groups = [
    { index: 0, cells: [{ x: 0,   y: 0 }] },
    { index: 1, cells: [{ x: 500, y: 0 }] },
  ];
  const ctx = { groups, arrangement: 'custom' };
  const sym = { symmetry_order: 1, rotation_center: null };
  const r = G.enumerateCongruentPairs(ctx, sym);

  assert('Case C: order=1 → empty', r.congruent_pairs.length === 0,
    `got ${r.congruent_pairs.length}`);
}

// ─── Case D — 단일 그룹 ─────────────────────────────────────────
// 쌍을 구성할 짝이 없음 → 빈 배열
{
  const groups = [
    { index: 0, cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
  ];
  const ctx = { groups, arrangement: 'square' };
  const sym = { symmetry_order: 2, rotation_center: { x: 50, y: 0 } };
  const r = G.enumerateCongruentPairs(ctx, sym);

  assert('Case D: 단일 그룹 → empty', r.congruent_pairs.length === 0,
    `got ${r.congruent_pairs.length}`);
}

// ─── Case E — C2 대칭, 중앙 그룹 self-map ───────────────────────
// 1×3 가로 행: G0 ↔ G2 (180° 매핑), G1 자기 자신 → 1쌍(0,2)
{
  const groups = [
    { index: 0, cells: [{ x: 0,   y: 0 }] },
    { index: 1, cells: [{ x: 100, y: 0 }] },
    { index: 2, cells: [{ x: 200, y: 0 }] },
  ];
  const ctx = { groups, arrangement: 'square' };
  const sym = { symmetry_order: 2, rotation_center: { x: 100, y: 0 } };
  const r = G.enumerateCongruentPairs(ctx, sym);

  assert('Case E: pairs.length === 1', r.congruent_pairs.length === 1,
    `got ${r.congruent_pairs.length}`);
  if (r.congruent_pairs.length === 1) {
    const p = r.congruent_pairs[0];
    assert('Case E: pair (0,2)', p.groupA === 0 && p.groupB === 2,
      `got (${p.groupA},${p.groupB})`);
  }
}

// ─── Case F — stub 플래그 제거 확인 ─────────────────────────────
// 실구현 완료 시 결과에 stub 필드가 없어야 함
{
  const ctx = { groups: [], arrangement: 'square' };
  const sym = { symmetry_order: 1, rotation_center: null };
  const r = G.enumerateCongruentPairs(ctx, sym);
  assert('Case F: stub 플래그 제거', r.stub === undefined, `stub=${r.stub}`);
}

// ─── 결과 ────────────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
