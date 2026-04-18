/**
 * S15D — minimizeShapeCount (원칙 15 Step D — 종수 최소화)
 *   입력: ICC 통과 후보 타일링 배열 + options.rotSteps (4 square / 6 hex)
 *   출력: { m_distinct_min, optimal_tilings }
 *     - 각 candidate.groups의 cells를 centroid-shift 후 canonicalSig(회전만)로 분류
 *     - unique signature 개수 = m_distinct
 *     - 최소값 가진 후보만 optimal_tilings에 수록
 *     - candidates 빈 배열 → m_distinct_min === null
 *
 * 원칙: 엠보 불가역성(12)에 의해 회전만 허용, 거울 금지.
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// ═══════════════════════════════════════════════
// 케이스 A — 동일 형상 5그룹 (평행이동만 다름) → m_distinct === 1
// ═══════════════════════════════════════════════
{
  // I형 2셀 × 5 그룹, 서로 다른 위치
  const mkIat = (ox, oy) => ({ cells: [
    { x: ox, y: oy }, { x: ox + 100, y: oy }
  ]});
  const candidate = {
    groups: [
      mkIat(0, 0), mkIat(0, 100), mkIat(0, 200), mkIat(0, 300), mkIat(0, 400),
    ],
  };
  const r = G.minimizeShapeCount([candidate], { rotSteps: 4 });
  assert('A: m_distinct_min === 1 (동일 형상 5그룹)',
    r.m_distinct_min === 1, `min=${r.m_distinct_min}`);
  assert('A: optimal_tilings 1개',
    Array.isArray(r.optimal_tilings) && r.optimal_tilings.length === 1);
  assert('A: optimal[0].m_distinct === 1',
    r.optimal_tilings[0] && r.optimal_tilings[0].m_distinct === 1);
}

// ═══════════════════════════════════════════════
// 케이스 B — I형 vs 2×2 혼재 → m_distinct === 2
// ═══════════════════════════════════════════════
{
  const candidate = {
    groups: [
      // I형 2셀
      { cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      // I형 2셀 (평행이동)
      { cells: [{ x: 0, y: 500 }, { x: 100, y: 500 }] },
      // 2×2 컴팩트
      { cells: [
        { x: 300, y: 0 }, { x: 400, y: 0 },
        { x: 300, y: 100 }, { x: 400, y: 100 },
      ]},
      // 2×2 컴팩트 (평행이동)
      { cells: [
        { x: 300, y: 500 }, { x: 400, y: 500 },
        { x: 300, y: 600 }, { x: 400, y: 600 },
      ]},
    ],
  };
  const r = G.minimizeShapeCount([candidate], { rotSteps: 4 });
  assert('B: m_distinct_min === 2 (I형 + 2×2)',
    r.m_distinct_min === 2, `min=${r.m_distinct_min}`);
  assert('B: optimal_tilings 1개 (유일 후보)',
    r.optimal_tilings.length === 1);
}

// ═══════════════════════════════════════════════
// 케이스 C — 빈 candidates 배열 → null
// ═══════════════════════════════════════════════
{
  const r = G.minimizeShapeCount([], { rotSteps: 4 });
  assert('C: m_distinct_min === null (빈 배열)',
    r.m_distinct_min === null, `min=${r.m_distinct_min}`);
  assert('C: optimal_tilings 빈 배열',
    Array.isArray(r.optimal_tilings) && r.optimal_tilings.length === 0);
}

// ═══════════════════════════════════════════════
// 케이스 D — 회전 합동 (square rotSteps=4)
//   가로 I와 세로 I는 회전 합동이므로 canonicalSig 동일 → 1종
// ═══════════════════════════════════════════════
{
  const candidate = {
    groups: [
      // 가로 I (2셀)
      { cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      // 세로 I (2셀) — 회전 합동
      { cells: [{ x: 500, y: 0 }, { x: 500, y: 100 }] },
      // 가로 I (또 다른 위치)
      { cells: [{ x: 0, y: 500 }, { x: 100, y: 500 }] },
    ],
  };
  const r = G.minimizeShapeCount([candidate], { rotSteps: 4 });
  assert('D: 회전 합동 (가로I + 세로I) → m_distinct === 1',
    r.m_distinct_min === 1, `min=${r.m_distinct_min}`);
}

// ═══════════════════════════════════════════════
// 케이스 E — 다중 후보 중 최소 선택
// ═══════════════════════════════════════════════
{
  // 후보1: 3종 (I + L + 2×2)
  const c1 = {
    groups: [
      { cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },                      // I
      { cells: [{ x: 0, y: 200 }, { x: 100, y: 200 }, { x: 0, y: 300 }] }, // L
      { cells: [                                                          // 2×2
        { x: 300, y: 0 }, { x: 400, y: 0 },
        { x: 300, y: 100 }, { x: 400, y: 100 },
      ]},
    ],
    label: 'c1',
  };
  // 후보2: 1종 (I만 3개)
  const c2 = {
    groups: [
      { cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { cells: [{ x: 0, y: 200 }, { x: 100, y: 200 }] },
      { cells: [{ x: 0, y: 400 }, { x: 100, y: 400 }] },
    ],
    label: 'c2',
  };
  // 후보3: 2종 (I + 2×2)
  const c3 = {
    groups: [
      { cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { cells: [
        { x: 300, y: 0 }, { x: 400, y: 0 },
        { x: 300, y: 100 }, { x: 400, y: 100 },
      ]},
    ],
    label: 'c3',
  };
  const r = G.minimizeShapeCount([c1, c2, c3], { rotSteps: 4 });
  assert('E: 최소 선택 → c2 (m_distinct=1)',
    r.m_distinct_min === 1, `min=${r.m_distinct_min}`);
  assert('E: optimal_tilings 1개 (c2만)',
    r.optimal_tilings.length === 1 && r.optimal_tilings[0].label === 'c2',
    `picked=[${r.optimal_tilings.map(t => t.label).join(',')}]`);
}

// ═══════════════════════════════════════════════
// 케이스 F — 동률 후보 모두 포함
// ═══════════════════════════════════════════════
{
  const c1 = {
    groups: [{ cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }],
    label: 'c1',
  };
  const c2 = {
    groups: [{ cells: [{ x: 500, y: 500 }, { x: 600, y: 500 }] }],
    label: 'c2',
  };
  const r = G.minimizeShapeCount([c1, c2], { rotSteps: 4 });
  assert('F: 동률 후보 모두 포함 (m_distinct=1 둘)',
    r.m_distinct_min === 1 && r.optimal_tilings.length === 2,
    `min=${r.m_distinct_min} n=${r.optimal_tilings.length}`);
}

// ═══════════════════════════════════════════════
// 케이스 G — stub 플래그 제거 확인
// ═══════════════════════════════════════════════
{
  const r = G.minimizeShapeCount([], { rotSteps: 4 });
  assert('G: stub 플래그 없음',
    !('stub' in r), `keys=${Object.keys(r).join(',')}`);
}

// ─── 결과 ──────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
