/**
 * 원칙 9 (P09) — 니켈 연결 인접성 절대 규칙 테스트
 *   "바로 인접한 셀끼리만 연결한다. 점프(셀 건너뜀) 절대 금지."
 *
 * 원칙 세부:
 *   ① 정배열: 상·하·좌·우 4방향 인접만 허용 (대각선 제외)
 *   ② 엇배열: 상·하·좌·우 + hex 대각선 6방향 인접 허용
 *   ③ 커스텀: 두 셀 중심 간 거리 ≤ pitch × 1.1 인 셀끼리만 인접 (제조 공차 ±10%)
 *   ④ 위반 시 열폭주
 *
 * 검증 대상: generator.js `buildAdjacency(cells, arrangement, pitch)`
 *   - 내부 threshold: custom → p×1.1, 그 외 → p×1.05 (공차)
 *   - staggered 6방향은 "hex 격자에서 인접 셀 중심 거리가 모두 pitch" 기하로 자동 성립
 *
 * 참고: test_m7_core.js에 기본 case 3개 있으나 staggered/custom 공차 검증 누락 → 본 파일 보완
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

const P = 100; // pitch

// ─── Case A — 정배열 4방향 (원칙 9 ①) ──────────────────
{
  // 3×3 정배열 9셀: 가로 6 + 세로 6 = 12 edges (대각선 4개 제외)
  const cells3x3 = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      cells3x3.push({ x: c * P, y: r * P });
  const e = G.buildAdjacency(cells3x3, 'square', P);
  assert('A1: 3×3 square → 12 edges (대각선 제외)', e.length === 12, `got ${e.length}`);

  // 2×2 square의 대각선 셀 쌍 (0,0)~(100,100)은 인접 아님
  // 거리 = √2 × P ≈ 141.4 > 1.05 × P = 105
  const diag = [{ x: 0, y: 0 }, { x: P, y: P }];
  const eDiag = G.buildAdjacency(diag, 'square', P);
  assert('A2: square 대각선 단독 쌍 → 0 edges', eDiag.length === 0);

  // 2×2 square 전체: 4 edges (기존 test_m7_core 재확인)
  const sq2x2 = [
    { x: 0, y: 0 }, { x: P, y: 0 },
    { x: 0, y: P }, { x: P, y: P },
  ];
  const e2x2 = G.buildAdjacency(sq2x2, 'square', P);
  assert('A3: 2×2 square → 4 edges (상/하/좌/우만)', e2x2.length === 4);
}

// ─── Case B — 엇배열 6방향 (원칙 9 ②) ──────────────────
// hex 격자: 행 간격 = P × √3/2, 홀수 행 P/2 오프셋
{
  const sqrt3_2 = Math.sqrt(3) / 2;
  // 중앙 셀 + 6 hex 이웃
  //   north (같은 x, -pitch)
  //   south (같은 x, +pitch)
  //   동일 행 좌/우 (±pitch, 0)
  //   NE/NW/SE/SW (hex): ±P/2, ±P×√3/2
  const cx = 200, cy = 200;
  const hex7 = [
    { x: cx, y: cy }, // 중앙
    { x: cx + P,     y: cy }, // 동
    { x: cx - P,     y: cy }, // 서
    { x: cx + P / 2, y: cy - P * sqrt3_2 }, // 북동
    { x: cx - P / 2, y: cy - P * sqrt3_2 }, // 북서
    { x: cx + P / 2, y: cy + P * sqrt3_2 }, // 남동
    { x: cx - P / 2, y: cy + P * sqrt3_2 }, // 남서
  ];
  const eHex = G.buildAdjacency(hex7, 'staggered', P);
  // 중앙 ↔ 6 이웃 = 6 edges. 추가로 외곽 hex 6개 중 인접 쌍도 일부 있음
  // 외곽 6점 간 최소 거리 검증: 인접 외곽 점(예: 동 ↔ 북동) 거리 = P (hex geometry)
  const centerEdges = eHex.filter(e => e.i === 0 || e.j === 0);
  assert('B1: hex 중앙 셀 ↔ 6 이웃 → 6 edges',
    centerEdges.length === 6, `got ${centerEdges.length}`);

  // 2×3 staggered (위 3셀 offset 0, 아래 3셀 offset P/2)
  //   상행: (0,0), (P,0), (2P,0)
  //   하행: (P/2, P×√3/2), (3P/2, P×√3/2), (5P/2, P×√3/2)
  const stag2x3 = [
    { x: 0,       y: 0 }, { x: P,     y: 0 }, { x: 2*P, y: 0 },
    { x: P/2,     y: P*sqrt3_2 }, { x: 3*P/2, y: P*sqrt3_2 }, { x: 5*P/2, y: P*sqrt3_2 },
  ];
  const eStag = G.buildAdjacency(stag2x3, 'staggered', P);
  // 기대 edges:
  //   상행 내 수평: (0,1), (1,2) — 2개
  //   하행 내 수평: (3,4), (4,5) — 2개
  //   상↔하 hex 대각선: 0↔3, 1↔3, 1↔4, 2↔4, 2↔5 — 5개
  //   합계 9
  assert('B2: 2×3 staggered → 9 edges (수평 4 + hex 대각선 5)',
    eStag.length === 9, `got ${eStag.length}`);
}

// ─── Case C — 커스텀 1.1 공차 (원칙 9 ③) ───────────────
{
  // C1: 거리 1.0×P → 인접
  const c1 = [{ x: 0, y: 0 }, { x: P * 1.0, y: 0 }];
  assert('C1: custom 거리 1.0×P → 인접',
    G.buildAdjacency(c1, 'custom', P).length === 1);

  // C2: 거리 1.1×P → 인접 (경계, 제조 공차 상한)
  const c2 = [{ x: 0, y: 0 }, { x: P * 1.1, y: 0 }];
  assert('C2: custom 거리 1.1×P → 인접 (경계 허용)',
    G.buildAdjacency(c2, 'custom', P).length === 1);

  // C3: 거리 1.15×P → 비인접 (공차 초과)
  const c3 = [{ x: 0, y: 0 }, { x: P * 1.15, y: 0 }];
  assert('C3: custom 거리 1.15×P → 비인접',
    G.buildAdjacency(c3, 'custom', P).length === 0);

  // C4: 거리 1.5×P → 비인접 (점프 금지)
  const c4 = [{ x: 0, y: 0 }, { x: P * 1.5, y: 0 }];
  assert('C4: custom 거리 1.5×P → 비인접 (점프 금지)',
    G.buildAdjacency(c4, 'custom', P).length === 0);
}

// ─── Case D — 점프 금지 공통 (원칙 9 ④) ────────────────
{
  // D1: square, 거리 2×P → 비인접
  const d1 = [{ x: 0, y: 0 }, { x: 2 * P, y: 0 }];
  assert('D1: square 거리 2×P → 비인접',
    G.buildAdjacency(d1, 'square', P).length === 0);

  // D2: staggered, 거리 2×P → 비인접
  const d2 = [{ x: 0, y: 0 }, { x: 2 * P, y: 0 }];
  assert('D2: staggered 거리 2×P → 비인접',
    G.buildAdjacency(d2, 'staggered', P).length === 0);

  // D3: square 1열 4셀 → 3 edges (점프 없음)
  const d3 = [
    { x: 0,     y: 0 }, { x: P,     y: 0 },
    { x: 2 * P, y: 0 }, { x: 3 * P, y: 0 },
  ];
  const e3 = G.buildAdjacency(d3, 'square', P);
  assert('D3: 1열 4셀 → 3 edges (점프 없음)', e3.length === 3);
}

// ─── Case E — 격리 셀 / 빈 입력 ─────────────────────────
{
  // E1: 2셀 격리 → 0 edges (test_m7_core에도 있음, 재확인)
  const e1 = [{ x: 0, y: 0 }, { x: 5 * P, y: 0 }];
  assert('E1: 격리 셀 (거리 5×P) → 0 edges',
    G.buildAdjacency(e1, 'square', P).length === 0);

  // E2: 셀 0개 → 빈 배열
  assert('E2: cells=[] → []',
    G.buildAdjacency([], 'square', P).length === 0);

  // E3: 셀 1개 → 빈 배열
  assert('E3: 단일 셀 → []',
    G.buildAdjacency([{ x: 0, y: 0 }], 'square', P).length === 0);
}

// ─── Case F — square vs custom 공차 차이 (경계 검증) ───
// square threshold 1.05×P, custom threshold 1.1×P
// 거리 1.08×P는 square에서 비인접, custom에서 인접이어야 함
{
  const cells = [{ x: 0, y: 0 }, { x: P * 1.08, y: 0 }];
  const eSquare = G.buildAdjacency(cells, 'square', P);
  const eCustom = G.buildAdjacency(cells, 'custom', P);
  assert('F1: 거리 1.08×P — square 비인접', eSquare.length === 0);
  assert('F2: 거리 1.08×P — custom 인접',   eCustom.length === 1);
}

// ─── Case G — pitch 자동 추정 후 동일 결과 ─────────────
{
  const cells = [
    { x: 0, y: 0 }, { x: P, y: 0 }, { x: 2 * P, y: 0 },
  ];
  const eExplicit = G.buildAdjacency(cells, 'square', P);
  const eAuto     = G.buildAdjacency(cells, 'square', null);
  assert('G: explicit vs auto-pitch 동일 결과',
    eExplicit.length === eAuto.length && eAuto.length === 2);
}

// ─── 결과 ──────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
