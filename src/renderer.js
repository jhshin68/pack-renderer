/**
 * BatteryPack SVG Renderer
 * 배터리팩 셀 배치 · 니켈플레이트 렌더링 이론 v0.2.18 (md 동기화)
 * SL Power Co., Ltd. — SELA
 *
 * 버전 이력:
 *   v0.2    (2026-04-14): 5대 불변 원칙 (극성·니켈위치·ㄷ자폭·양면표시·S홀짝패턴)
 *   v0.2.1  (2026-04-14): 셀 심볼 단순화(+빨강테두리·검정채움), gap=0 맞닿음
 *   v0.2.2  (2026-04-14): −면 흰색+검정테두리, +면 내부원 R×0.50
 *   v0.2.3  (2026-04-14): −면 fill=none, +면 캡 직경 10mm 고정
 *   v0.2.4  (2026-04-14): 니켈 색상 회색(#888888 / #555555)으로 표준화
 *   v0.2.5  (2026-04-14): ㄷ자 니켈 사다리형 — 모든 row에 수평 브리지 (P개)
 *   v0.2.6  (2026-04-14): 니켈 경로는 셀 중앙만 통과 — 스파인 cy[0]~cy[P-1], 확장 폐기
 *   v0.2.7  (2026-04-14): 니켈 두께 세로·가로 동일 — bar_h 폐기, nickel_w로 통일
 *   v0.2.8  (2026-04-14): grid_cols/grid_rows 오버라이드 — N=S×P 불변, 잉여 슬롯 공란
 *   v0.2.9  (2026-04-14): 커스텀 격자에서도 극성·니켈·단자 렌더 (그룹 polyline + 직렬 브리지)
 *   v0.2.12 (2026-04-14): ★ 불변 원칙 14 — 면별 니켈 플레이트 병합.
 *                          상면 [G0][G1∪G2][G3∪G4]...[G_{S-1} if S짝수]
 *                          하면 [G0∪G1][G2∪G3]...[G_{S-1} if S홀수]
 *                          하나의 니켈판이 병렬(그룹내) + 직렬브리지(그룹쌍) 겸함.
 *                          그룹 배정: 행-단위 boustrophedon 스네이크 (연속 직렬 보장).
 *                          플레이트 연결성 BFS 검증: 단절 시 경고 라벨.
 *   v0.2.11 (2026-04-14): ★ 최우선 원칙 12·13 — 니켈 인접성(대각선 금지)·점프 금지.
 *                          커스텀 격자 그룹 배정을 인접성 그리디로 재설계.
 *                          그룹 내 병렬은 인접 셀 쌍만 line. 직렬 브리지는 인접 그룹 셀 쌍만.
 *                          비인접 시 빨강 경고선 + "비인접 (점프 불가)" 라벨.
 *                          −면 심볼: 중앙 검정 점(R×0.25) 추가 (공란과 구별, +10mm 캡 대칭).
 *   v0.3    (2026-04-14): staggered 엇배열 확장 (cx 2D화, polyline 스파인)
 *   v0.2.13 (2026-04-14): ★ 원칙 16 — BMS 근접 단자 선택 (다수 유효 타일링 중 맨해튼 최소화)
 *   v0.2.14 (2026-04-14): ★ 원칙 17 — 엇배열 그룹 형상 = hex 펜토미노, 인접성 = 6-이웃(hex)
 *                          arrangement==='staggered'일 때 adjacency 그래프를 4-이웃 → 6-이웃으로 전환.
 *                          P-그룹 확장 시 hex 클러스터(2-1-2, 1-2-2 등) 형태 허용.
 *                          플레이트 병합·B± 선택 공식은 정배열과 동일 유지.
 *   v0.2.15 (2026-04-14): ★ 원칙 18 — SFMT(Symmetry-First Minimum-Type) 4단계 최소 형상 타일링 알고리즘.
 *                          Step A: 팩 대칭군 G 탐지 (C1/C2/D1/D2/C6/D6).
 *                          Step B: 국소 합동 쌍 열거 — 크기 2P 연결 부분집합의 캐노니컬 서명(회전×거울) 기반.
 *                          Step C: 쌍-우선 구성 — 합동 쌍을 시드로 고정 후 나머지 백트래킹, Hamilton 순서 제약 해석.
 *                          Step D: 종수 최소화 m_distinct 선택, tie-break (BMS 근접, 쌍 거리, 대칭형).
 *                          이론 하한: m_distinct ≥ ⌈(plates−1)/k_local⌉ + 1.
 *                          13S5P C1 팩에서도 k_local=1에 의해 6종 7판 달성 (실물 사진 검증).
 *   v0.2.16 (2026-04-14): ★ 원칙 19 — ICC(Industrial Compactness Constraint) 산업 실무 제약.
 *                          행 스팬 ≤ 2 (엣지 수직 리본 예외 ≤ 3), 종횡비 ≤ 2.0, 볼록성 ≥ 0.75.
 *                          SFMT 수학해를 실무 제조(스탬핑/스폿용접/써멀/Jig) 기준으로 필터링.
 *                          Tie-breaker: 행스팬 합 → 평균 종횡비 → BMS 근접 → 합동쌍 대칭거리.
 *                          실물 사진 대조: 2행 수평 밴드 중심 + 1개 엣지 리본 예외 구조.
 *   v0.2.17 (2026-04-14): ★ 원칙 20 — 형상수 최소화 최우선 (금형 비용 지배).
 *                          목적함수: m_distinct 최소화 → ICC → BMS → Hamilton 존재성.
 *                          입력 제약: `max_plate_types: K` 파라미터. K 지정 시 K개 형상만 반복 사용.
 *                          비용 모델: m_distinct × ₩20M(금형) + N_plates × ₩300 + m_distinct × ₩5M(SKU).
 *                         ★ 원칙 21 — 엠보 불가역성 (거울반사 = 별개 형상).
 *                          캐노니컬 서명 σ(set) = min{회전k(점집합) : k ∈ 0..5}  (거울반사 제거).
 *                          정배열은 k ∈ 0..3. 변환군 크기 |T| = 12 → 6 (hex) 또는 8 → 4 (rect).
 *                          좌·우 대칭 배치 플레이트는 실제로 거울상이면 별도 금형 필요 → 회전 대칭 우선 설계.
 *   v0.3.1  (2026-04-15): ★ 범용 엔진 1순위 — P값 기반 블록 타입 선택 + Type-A geometry.
 *                          selectBlockType(P): P→블록타입 라우팅 진입점.
 *                          calcTypeAGeometry() + drawNickelTypeA(): 결론.md 확정 스펙 구현.
 *                            trunk(수평bar) + dual feed + branch(등임피던스폭보정) + fuse neck.
 *                          buildSnakeLayout(S,P): S×P→직렬순서(grid_row,grid_col) 반환.
 *                          calcNickelPattern(S,P): P 파라미터 추가, block_type 포함.
 *                          drawFace(): TypeA dispatcher + 직렬bridge 추가.
 *                          DEFAULT_PARAMS: trunk_w_mm, branch_w_ratio_center/outer, fuse_neck_w/l.
 *                          기존 I/U 동작 완전 유지 (P≠5 폴백).
 *   v0.2.18 (2026-04-14): ★ 원칙 22 — 사각 정배열 컬럼 파티션 최적성 정리.
 *                          N=S×P 사각 정배열 + 컬럼 단위 직렬 연결 시 m_distinct 하한:
 *                          m_min = 1 (S 짝수, 전면 ㄷ자 쌍)
 *                          m_min = 2 (S 홀수, 양끝 I자 + ㄷ자)
 *                          증명: 컬럼 P×1 P-오미노 모두 합동 → m≤1; S홀수면 양끝 단독 I자 불가피 → m≥2.
 *                          비용: S짝=₩20M(1종), S홀=₩40M(2종). 엇배열·스태거케이스 대비 3~6배 절감.
 *                          설계 권고: 신규 팩 S짝수 사각 정배열 1순위, 불가 시 2순위 S홀수 정배열.
 *                         ★ 원칙 23 — 3-way 배열 선택 + 커스텀 행별 셀 수 지원.
 *                          arrangement ∈ {'square','staggered','custom'}.
 *                          square/staggered: (S,P) 규칙 격자.
 *                          custom: rows=[n1,n2,...] 행별 셀 수 배열 + S 수동 지정.
 *                          실무 케이스 맞춤(8·8·10·13·13·13 등 비정형 홀더) 대응.
 *                          니켈 패턴 매핑(S-그룹→물리셀)은 수동/스네이크/DXF 중 택1 (후속 버전).
 *
 * 본 파일은 md 이론문서와 버전을 동기화한다. md 수정 시 js도 함께 버전업.
 */

const RENDERER_VERSION = 'v0.3.1+TypeAEngine';

// ═══════════════════════════════════════════════
// Generator 의존성 (M4 Phase 2) — 형상 생성 로직은 generator.js가 단일 출처
//   Node:   require('./generator')
//   Browser: window.Generator (HTML에서 generator.js를 renderer.js보다 먼저 로드)
//   VM(test): globalThis.Generator 또는 스크립트 전역 식별자 Generator
// ═══════════════════════════════════════════════
const __Generator = (function () {
  if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    try { return require('./generator'); } catch (_) { /* fallthrough */ }
  }
  if (typeof window !== 'undefined' && window.Generator) return window.Generator;
  if (typeof globalThis !== 'undefined' && globalThis.Generator) return globalThis.Generator;
  if (typeof Generator !== 'undefined') return Generator;  // VM context 전역
  return null;
})();

if (!__Generator) {
  throw new Error('[renderer] Generator dependency not loaded. ' +
    'Load src/generator.js before src/renderer.js in HTML, or require it first in Node.');
}

// 원칙 20 — 목적함수 가중치 (낮을수록 우선)
const OBJECTIVE_WEIGHTS = {
  m_distinct:   1000000,  // 최우선 (₩M 단위 금형비용 반영)
  icc_rowspan:      100,
  icc_aspect:        50,
  bms_manhattan:     10,
  hamilton_cost:      1,
};

// 원칙 20 — 금형 비용 모델
const COST_MODEL = {
  mold_cost_per_type_krw_M: 20,    // 금형 1종당 ₩20M
  material_per_plate_krw:   300,   // 플레이트 1개 재료+가공
  sku_cost_per_type_krw_M:   5,    // 형상 1종당 SKU 관리 ₩5M/년
};

// 원칙 20 — 사용자 제약 파라미터 기본값
const USER_CONSTRAINTS_DEFAULT = {
  max_plate_types: null,           // null = 자동 최소화, 정수 K = K개로 제한
  allow_mirror: false,             // ★ 원칙 21: 기본 false (거울반사 금지)
};

// 원칙 21 — 캐노니컬 서명: 회전 전용 (거울 제거)
// M4 Phase 2: generator.js로 단일화 — shim
const canonicalSig = __Generator.canonicalSig;

// 니켈 색상 표준 — 회색(#888888) 단일색
const NICKEL_PALETTE = [
  { fill: '#888888' },
  { fill: '#888888' },
];
const NICKEL_FILL   = '#888888';
const NICKEL_STROKE = '#555555';
const NICKEL_SW     = 0.7;

// ═══════════════════════════════════════════════
// P값 → 블록 타입 선택 (범용 엔진 진입점)
// M4 Phase 2: generator.js로 단일화 — shim
// ═══════════════════════════════════════════════
const selectBlockType = __Generator.selectBlockType;

// + 양극 캡 실치수 (이론 §5, v0.2.3)
const PLUS_CAP_DIAMETER_MM = 10.0;

// ═══════════════════════════════════════════════
// 1. 셀 규격
// ═══════════════════════════════════════════════
const CELL_SPEC = {
  '18650': { actual_d: 18.0, render_d: 19.0, pitch_default: 20.0, pitch_min: 19.5 },
  '21700': { actual_d: 21.0, render_d: 22.0, pitch_default: 23.0, pitch_min: 22.5 },
};

// ═══════════════════════════════════════════════
// 2. 기본 파라미터
// ═══════════════════════════════════════════════
const DEFAULT_PARAMS = {
  cell_type:     '21700',
  S:             3,
  P:             3,
  grid_cols:     null,       // ★ v0.2.8: 물리 격자 오버라이드 (null이면 S)
  grid_rows:     null,       // ★ v0.2.8: 물리 격자 오버라이드 (null이면 P)
  gap:           0.0,        // ★ 불변 원칙: 셀-셀 맞닿음 (pitch = render_d)
  layout:        'auto',        // 'auto' | 'side_by_side' | 'top_bottom'
  arrangement:   'square',      // 'square' | 'staggered'  ★ v0.3
  show_nickel:   true,
  show_terminal: true,
  scale:         4.0,
  nickel_w_mm:   5.0,
  // bar_h_mm 폐기 (v0.2.7): 가로 브리지 두께 = 세로 스파인 두께 = nickel_w_mm
  margin_mm:     12.0,
  gap_section:   60,
  // ── Type-A (P=5) 전용 파라미터 (결론.md 확정 스펙) ──
  trunk_w_mm:            null,  // null = auto (nickel_w_mm × 1.5)
  branch_w_ratio_center: 0.75,  // 중앙 셀 branch 폭 비율 — 등임피던스 보정
  branch_w_ratio_outer:  1.30,  // 외곽 셀 branch 폭 비율 — 등임피던스 보정
  fuse_neck_w_mm:        1.5,   // 퓨즈 neck 폭 (mm)
  fuse_neck_l_mm:        3.0,   // 퓨즈 neck 길이 (mm)
};

// ═══════════════════════════════════════════════
// 3. 좌표·패턴 계산
// ═══════════════════════════════════════════════
function resolveLayout(S, P, layout) {
  if (layout !== 'auto') return layout;
  return (S >= 5 || P >= 4) ? 'top_bottom' : 'side_by_side';
}

/**
 * 셀 중심 좌표 (이론 v0.3 §9 확장)
 *   square:    cx[g][p] = margin + g×pitch + R   (p 무관)
 *              cy[p]    = margin + p×pitch + R
 *   staggered: cx[g][p] = margin + g×pitch + R + (p%2===1 ? pitch/2 : 0)
 *              cy[p]    = margin + p × (pitch × √3/2) + R
 */
function calcCellCenters(S, P, params) {
  const spec   = CELL_SPEC[params.cell_type];
  const pitch  = (spec.render_d + params.gap) * params.scale;
  const R      = (spec.render_d / 2) * params.scale;
  const margin = params.margin_mm * params.scale;
  const isStag = params.arrangement === 'staggered';
  const pitchY = isStag ? pitch * Math.sqrt(3) / 2 : pitch;
  const offOdd = isStag ? pitch / 2 : 0;

  const cx = [], cy = [];
  for (let p = 0; p < P; p++) cy.push(margin + p * pitchY + R);
  for (let g = 0; g < S; g++) {
    const col = [];
    for (let p = 0; p < P; p++) {
      const off = (p % 2 === 1) ? offOdd : 0;
      col.push(margin + g * pitch + R + off);
    }
    cx.push(col);
  }
  return { cx, cy, R, pitch, pitchY, arrangement: params.arrangement };
}

function getCellPolarity(groupIndex, face) {
  const topIsPlus = (groupIndex % 2 === 0);
  return face === 'top' ? (topIsPlus ? '+' : '-') : (topIsPlus ? '-' : '+');
}

// M4 Phase 2: generator.js로 단일화 — shim
const calcNickelPattern = __Generator.calcNickelPattern;

// ═══════════════════════════════════════════════
// 4. SVG 드로잉
// ═══════════════════════════════════════════════
function drawCell(cx, cy, R, polarity, scale) {
  // v0.2.11 불변 원칙 6:
  //   + 단자부 = 빨강 테두리 + 빨강 캡(직경 10mm 고정)
  //   − 단자부 = 검정 테두리 + 내부 무채움(fill=none) + 중앙 검정 점(R×0.25)
  const isPlus = polarity === '+';
  const sw = (R * 0.08).toFixed(2);
  if (isPlus) {
    const capR = (PLUS_CAP_DIAMETER_MM / 2) * scale; // 직경 10mm 고정
    return [
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#C0392B" stroke-width="${sw}"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${capR.toFixed(2)}" fill="#C0392B"/>`,
    ].join('\n');
  }
  const dotR = (R * 0.25).toFixed(2);
  return [
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#1a1a1a" stroke-width="${sw}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${dotR}" fill="#1a1a1a"/>`,
  ].join('\n');
}

/**
 * I자 니켈 — square: 수직 rect / staggered: 지그재그 polyline stroke
 * cx_col: 해당 그룹의 P개 x좌표 배열
 */
/**
 * 단일 그룹 니켈 — 원칙 25: P개 셀을 세로 thick-line(2R) + 원형 배경으로 렌더
 * fill: 원칙 26 팔레트에서 전달받은 색상
 */
function drawNickelI(cx_col, cy_arr, R, nw, barH, arrangement, fill) {
  const P  = cx_col.length;
  const sw = nw.toFixed(1);
  const fc = fill || NICKEL_FILL;
  if (P === 0) return '';
  const parts = [];
  // ① 인접 셀 쌍 연결선 (stroke-width=nw, 얇은 니켈 스트립)
  for (let p = 0; p < P - 1; p++) {
    parts.push(`<line x1="${cx_col[p].toFixed(1)}" y1="${cy_arr[p].toFixed(1)}" x2="${cx_col[p+1].toFixed(1)}" y2="${cy_arr[p+1].toFixed(1)}" stroke="${fc}" stroke-width="${sw}" stroke-linecap="round"/>`);
  }
  // ② 단일 셀(P=1)은 짧은 세로 스트립으로 표시
  if (P === 1) {
    const capLen = nw * 0.8;
    parts.push(`<line x1="${cx_col[0].toFixed(1)}" y1="${(cy_arr[0]-capLen).toFixed(1)}" x2="${cx_col[0].toFixed(1)}" y2="${(cy_arr[0]+capLen).toFixed(1)}" stroke="${fc}" stroke-width="${sw}" stroke-linecap="round"/>`);
  }
  return parts.join('');
}

/**
 * ㄷ자 니켈 — 원칙 25: 좌/우 컬럼 + 가로 연결 모두 thick-line(2R)
 * fill: 원칙 26 팔레트에서 전달받은 색상
 */
function drawNickelU(cx_colL, cx_colR, cy_arr, R, nw, barH, arrangement, fill) {
  const P  = cx_colL.length;
  const sw = nw.toFixed(1);
  const fc = fill || NICKEL_FILL;
  if (P === 0) return '';
  const parts = [];
  // ① 좌측 그룹 내 인접 연결선 (얇은 니켈 스트립)
  for (let p = 0; p < P - 1; p++) {
    parts.push(`<line x1="${cx_colL[p].toFixed(1)}" y1="${cy_arr[p].toFixed(1)}" x2="${cx_colL[p+1].toFixed(1)}" y2="${cy_arr[p+1].toFixed(1)}" stroke="${fc}" stroke-width="${sw}" stroke-linecap="round"/>`);
  }
  // ② 우측 그룹 내 인접 연결선
  for (let p = 0; p < P - 1; p++) {
    parts.push(`<line x1="${cx_colR[p].toFixed(1)}" y1="${cy_arr[p].toFixed(1)}" x2="${cx_colR[p+1].toFixed(1)}" y2="${cy_arr[p+1].toFixed(1)}" stroke="${fc}" stroke-width="${sw}" stroke-linecap="round"/>`);
  }
  // ③ 그룹 간 가로 연결선 (모든 row)
  for (let p = 0; p < P; p++) {
    parts.push(`<line x1="${cx_colL[p].toFixed(1)}" y1="${cy_arr[p].toFixed(1)}" x2="${cx_colR[p].toFixed(1)}" y2="${cy_arr[p].toFixed(1)}" stroke="${fc}" stroke-width="${sw}" stroke-linecap="round"/>`);
  }
  return parts.join('');
}

/**
 * Type-A 블록 geometry 계산 (P=5 전용, 결론.md 확정 스펙)
 *   셀 배치: P개 세로 컬럼 → 중앙 기준 2-3 분할 (trunk 위치 결정)
 *   등임피던스: 거리 비례 branch 폭 보정 (중앙 ×0.75, 외곽 ×1.30)
 *   반환: trunk 위치, feed 좌표, branch 배열
 */
// M4 Phase 2: generator.js로 단일화 — shim
const calcTypeAGeometry = __Generator.calcTypeAGeometry;

/**
 * 닫힌 사다리(Closed Ladder) 니켈 렌더링
 *
 * 구조:
 *   좌/우 세로 레일 (cy[0]~cy[P-1] 전체 연결) → 닫힌 구조 보장
 *   각 셀 위치에 가로 접점 bar (등임피던스 높이 보정)
 *   각 셀 중앙에 퓨즈 넥 (수직 슬롯 방식)
 *   중앙 trunk (가장 두꺼운 가로 bar — 직렬 연결 수집점)
 *
 * SVG 레이어 순서: 레일 → 접점 bar(외측 먼저) → 트렁크 → 퓨즈 넥
 *
 * 범용성: cx_col[i]가 모두 같은 값(정배열)이든 다른 값(엇배열)이든 동일 로직 적용.
 */
function drawNickelTypeA(cx_col, cy_arr, R, nw, params, fill) {
  const fc  = fill || NICKEL_FILL;
  const sw  = NICKEL_SW;
  const geo = calcTypeAGeometry(cx_col, cy_arr, R, nw, params);
  const parts = [];

  const P   = cy_arr.length;
  const x1  = geo.trunk_x1;
  const x2  = geo.trunk_x2;
  const pw  = x2 - x1;   // 판 전체 가로 폭

  // ① 좌측 세로 레일 (cy[0] ~ cy[P-1])
  parts.push(
    `<rect x="${(x1 - nw / 2).toFixed(1)}" y="${cy_arr[0].toFixed(1)}"` +
    ` width="${nw.toFixed(1)}" height="${(cy_arr[P - 1] - cy_arr[0]).toFixed(1)}"` +
    ` fill="${fc}" stroke="${NICKEL_STROKE}" stroke-width="${sw}"/>`
  );
  // ② 우측 세로 레일
  parts.push(
    `<rect x="${(x2 - nw / 2).toFixed(1)}" y="${cy_arr[0].toFixed(1)}"` +
    ` width="${nw.toFixed(1)}" height="${(cy_arr[P - 1] - cy_arr[0]).toFixed(1)}"` +
    ` fill="${fc}" stroke="${NICKEL_STROKE}" stroke-width="${sw}"/>`
  );

  // ③ 셀 접점 가로 bar (등임피던스 높이 보정: 외측 먼저 → 내측이 위에 덮여 계단 단면)
  const sorted = [...geo.branches].sort((a, b) => b.branch_w - a.branch_w);
  for (const b of sorted) {
    const ch  = b.branch_w;   // 접점 bar 높이 (등임피던스 보정)
    const cx  = b.cell_x;
    const cy  = b.cell_y;
    const nwn = b.neck_w;     // 퓨즈 넥 폭 (x방향)

    // 좌반 접점 bar (레일 ~ 퓨즈 슬롯 좌측)
    const left_w = cx - nwn / 2 - x1;
    if (left_w > 0) {
      parts.push(
        `<rect x="${x1.toFixed(1)}" y="${(cy - ch / 2).toFixed(1)}"` +
        ` width="${left_w.toFixed(1)}" height="${ch.toFixed(1)}"` +
        ` fill="${fc}" stroke="${NICKEL_STROKE}" stroke-width="${sw}"/>`
      );
    }
    // 우반 접점 bar (퓨즈 슬롯 우측 ~ 레일)
    const right_w = x2 - cx - nwn / 2;
    if (right_w > 0) {
      parts.push(
        `<rect x="${(cx + nwn / 2).toFixed(1)}" y="${(cy - ch / 2).toFixed(1)}"` +
        ` width="${right_w.toFixed(1)}" height="${ch.toFixed(1)}"` +
        ` fill="${fc}" stroke="${NICKEL_STROKE}" stroke-width="${sw}"/>`
      );
    }
  }

  // ④ 트렁크 (중앙 가로 bar — 레일/접점 bar 위에 덮어 가장 두꺼운 부분 강조)
  parts.push(
    `<rect x="${x1.toFixed(1)}" y="${(geo.trunk_y - geo.trunk_w / 2).toFixed(1)}"` +
    ` width="${pw.toFixed(1)}" height="${geo.trunk_w.toFixed(1)}"` +
    ` rx="1" fill="${fc}" stroke="${NICKEL_STROKE}" stroke-width="${sw}"/>`
  );

  // ⑤ 퓨즈 넥 (셀 중앙 수직 슬롯 — 맨 위에 그려 가시성 확보)
  for (const b of geo.branches) {
    parts.push(
      `<rect x="${(b.cell_x - b.neck_w / 2).toFixed(1)}" y="${(b.cell_y - b.neck_l / 2).toFixed(1)}"` +
      ` width="${b.neck_w.toFixed(1)}" height="${b.neck_l.toFixed(1)}"` +
      ` rx="0.5" fill="${fc}" stroke="${NICKEL_STROKE}" stroke-width="${sw}"/>`
    );
  }

  return parts.join('\n');
}

/**
 * S×P Snake 배치 순서 반환 (결론.md: 2열 Snake, centroid 직렬 연결 기준)
 *   기본 2행: 첫 행 ceil(S/2)개 좌→우, 둘째 행 floor(S/2)개 우→좌
 *   options.max_rows: 최대 행 수 (기본 2, 공간 제약 시 3 이상 가능)
 *
 *   반환: {
 *     blocks: [{ serial_idx, grid_row, grid_col }],  // 전기 직렬 순서
 *     rows:   [rowSize, ...],                         // 행별 블록 수
 *     total:  S,
 *   }
 */
// M4 Phase 2: generator.js로 단일화 — shim
const buildSnakeLayout = __Generator.buildSnakeLayout;

function drawTerminal(cx, cy_center, R, nw, side, label) {
  const tabW  = nw * 1.8, tabH = nw * 0.85, dotR = nw * 0.28, boxW = 38, boxH = 22;
  const isPlus = label === 'B+';
  const fill   = isPlus ? '#C0392B' : '#0C447C';
  const stroke = isPlus ? '#7B241C' : '#042C53';
  let tabX, boxX, dotX;
  if (side === 'left') { dotX = cx - nw / 2; tabX = dotX - tabW; boxX = tabX - boxW; }
  else                 { dotX = cx + nw / 2; tabX = dotX;        boxX = tabX + tabW; }
  const tabY = cy_center - tabH / 2, boxY = cy_center - boxH / 2;
  return [
    `<rect x="${tabX.toFixed(1)}" y="${tabY.toFixed(1)}" width="${tabW.toFixed(1)}" height="${tabH.toFixed(1)}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>`,
    `<circle cx="${dotX.toFixed(1)}" cy="${cy_center.toFixed(1)}" r="${dotR.toFixed(1)}" fill="#1a1a18"/>`,
    `<rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW}" height="${boxH}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>`,
    `<text font-family="Arial" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle" x="${(boxX+boxW/2).toFixed(1)}" y="${(cy_center+5).toFixed(1)}">${label}</text>`,
  ].join('\n');
}

function drawFace(S, P, face, cx, cy, R, params) {
  const nw   = params.nickel_w_mm * params.scale;
  const barH = nw;                           // v0.2.7: 가로 = 세로 동일 두께
  const arr  = params.arrangement || 'square';
  const midP = Math.floor(P / 2);
  const lines = [];

  // ★ 레이어 순서:
  //   I/U 모드(P≠5): 원칙 27 — 니켈(최하단) → 셀 → 단자탭
  //   TypeA 모드(P=5): 니켈이 첫 셀~마지막 셀을 모두 덮어야 함 → 셀 → 니켈(위) → 단자탭
  const blockInfo = selectBlockType(P);
  const isTypeA   = blockInfo.block_type === 'TypeA' && blockInfo.geometry_ready;

  // ── 헬퍼: TypeA 니켈 SVG 조각 수집 ──
  const buildTypeANickel = () => {
    const buf = [];
    const pattern     = calcNickelPattern(S, P);
    const nickels     = face === 'top' ? pattern.top : pattern.bot;
    const drawnGroups = new Set();
    for (const n of nickels) {
      for (const g of n.groups) {
        if (!drawnGroups.has(g)) {
          buf.push(drawNickelTypeA(cx[g], cy, R, nw, params, NICKEL_FILL));
          drawnGroups.add(g);
        }
      }
      if (n.type === 'U') {
        const gL      = n.groups[0], gR = n.groups[1];
        const split   = Math.floor(P / 2);
        const trunk_y = (cy[split - 1] + cy[split]) / 2;
        const trunk_w = ((params.trunk_w_mm || params.nickel_w_mm * 1.5)) * params.scale;
        const feed_e  = nw * 1.5;
        const x1      = Math.max(...cx[gL]) + feed_e;
        const x2      = Math.min(...cx[gR]) - feed_e;
        if (x2 > x1) {
          buf.push(
            `<rect x="${x1.toFixed(1)}" y="${(trunk_y - trunk_w / 2).toFixed(1)}"` +
            ` width="${(x2 - x1).toFixed(1)}" height="${trunk_w.toFixed(1)}"` +
            ` fill="${NICKEL_FILL}" stroke="${NICKEL_STROKE}" stroke-width="${NICKEL_SW}"/>`
          );
        }
      }
    }
    return buf;
  };

  // ① I/U 니켈 (셀 아래, Principle 27)
  if (params.show_nickel && !isTypeA) {
    const pattern = calcNickelPattern(S, P);
    const nickels = face === 'top' ? pattern.top : pattern.bot;
    let pi = 0;  // 원칙 26: plate index → 2색 팔레트 교번
    for (const n of nickels) {
      const fill = NICKEL_PALETTE[pi % 2].fill;
      if (n.type === 'I') {
        const g = n.groups[0];
        lines.push(drawNickelI(cx[g], cy, R, nw, barH, arr, fill));
      } else {
        const gL = n.groups[0], gR = n.groups[1];
        lines.push(drawNickelU(cx[gL], cx[gR], cy, R, nw, barH, arr, fill));
      }
      pi++;
    }
  }

  // ② 셀 렌더
  for (let g = 0; g < S; g++) {
    const polarity = getCellPolarity(g, face);
    for (let p = 0; p < P; p++) lines.push(drawCell(cx[g][p], cy[p], R, polarity, params.scale));
  }

  // ③ TypeA 니켈 (셀 위 — 첫 셀~마지막 셀 연결 가시성 확보)
  if (params.show_nickel && isTypeA) {
    lines.push(...buildTypeANickel());
  }

  // ④ 단자탭 (최상단)
  if (params.show_nickel && params.show_terminal) {
    const pattern = calcNickelPattern(S, P);
    const nickels = face === 'top' ? pattern.top : pattern.bot;
    for (const n of nickels) {
      if (n.terminal) {
        if (n.type === 'I') {
          const g = n.groups[0];
          const side = n.terminal === 'B+' ? 'left' : 'right';
          lines.push(drawTerminal(cx[g][midP], cy[midP], R, nw, side, n.terminal));
        } else {
          const gL = n.groups[0], gR = n.groups[1];
          const side  = n.terminal === 'B+' ? 'left' : 'right';
          const gRef  = n.terminal === 'B-' ? gR : gL;
          lines.push(drawTerminal(cx[gRef][midP], cy[midP], R, nw, side, n.terminal));
        }
      }
    }
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════
// 4b. 커스텀 격자 렌더 (v0.2.9)
//    N=S×P 셀을 cols×rows 격자에 row-major로 배치. 잉여 슬롯은 공란.
//    그룹 배정: 셀 순번 i → group_index = floor(i/P), parallel_index = i%P
//    극성: group_index 짝/홀로 상·하면 교차 적용
//    니켈: 그룹별 polyline (병렬 연결) + 직렬 브리지 (상면 짝수쌍, 하면 홀수쌍)
// ═══════════════════════════════════════════════
function renderCustomGrid(params, spec, N, cols, rows) {
  const { S, P } = params;
  const pitch  = (spec.render_d + params.gap) * params.scale;
  const R      = (spec.render_d / 2) * params.scale;
  const margin = params.margin_mm * params.scale;
  const isStag = params.arrangement === 'staggered';
  const pitchY = isStag ? pitch * Math.sqrt(3) / 2 : pitch;
  const nw     = params.nickel_w_mm * params.scale;

  // v0.2.11: 셀 좌표 생성
  const cells = [];
  const gridMap = Array.from({length: rows}, () => Array(cols).fill(null));
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const off = (isStag && r % 2 === 1) ? pitch / 2 : 0;
    const cell = {
      i, r, c, g: -1,
      cx: margin + c * pitch + R + off,
      cy: margin + r * pitchY + R,
    };
    cells.push(cell);
    gridMap[r][c] = cell;
  }

  // v0.2.12 행-단위 스네이크(boustrophedon) 그룹 배정
  // r 짝수: L→R, r 홀수: R→L. 실셀만 추려 일렬화한 뒤 P개씩 끊어 S그룹.
  const snake = [];
  for (let r = 0; r < rows; r++) {
    const rowCells = [];
    for (let c = 0; c < cols; c++) if (gridMap[r][c]) rowCells.push(gridMap[r][c]);
    if (r % 2 === 1) rowCells.reverse();
    snake.push(...rowCells);
  }
  const groups = [];
  for (let gi = 0; gi < S; gi++) {
    const grp = snake.slice(gi * P, (gi + 1) * P);
    if (grp.length === 0) break;
    grp.forEach(c => { c.g = gi; });
    groups.push(grp);
  }

  // 인접 판정 (격자 좌표 기준)
  const isAdj = (a, b) => (Math.abs(a.r - b.r) + Math.abs(a.c - b.c)) === 1;

  // 공란 슬롯 좌표
  const empties = [];
  for (let i = N; i < cols * rows; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const off = (isStag && r % 2 === 1) ? pitch / 2 : 0;
    empties.push({
      cx: margin + c * pitch + R + off,
      cy: margin + r * pitchY + R
    });
  }

  const faceW = margin * 2 + cols * pitch + (isStag ? pitch / 2 : 0);
  const faceH = margin * 2 + (rows - 1) * pitchY + 2 * R;

  // 한 면(top/bottom) 내부 구성 요소 생성
  function buildFace(face) {
    const parts = [];

    // ★ 원칙 27: 레이어 순서 = 니켈(최하단) → 셀 → 단자탭(최상단)
    if (params.show_nickel) {
      // 면별 니켈 플레이트: 그룹 병합 후 isAdj 연결선 (얇은 스트립)
      // 상면: [G0], [G1∪G2], [G3∪G4], ...  / 하면: [G0∪G1], [G2∪G3], ...
      const sw = nw.toFixed(1);
      const fc = NICKEL_FILL;
      const plates = [];
      const paired = new Set();
      const pairStart = (face === 'top') ? 1 : 0;
      for (let g = pairStart; g + 1 < S; g += 2) {
        plates.push([...groups[g], ...groups[g + 1]]);
        paired.add(g); paired.add(g + 1);
      }
      for (let g = 0; g < S; g++) {
        if (!paired.has(g)) plates.splice(g === 0 ? 0 : plates.length, 0, [...groups[g]]);
      }
      plates.forEach(plate => {
        if (!plate.length) return;
        // ① 인접 셀 쌍 연결선 (얇은 니켈 스트립)
        for (let a = 0; a < plate.length; a++) {
          for (let b = a + 1; b < plate.length; b++) {
            if (isAdj(plate[a], plate[b])) {
              parts.push(`<line x1="${plate[a].cx.toFixed(1)}" y1="${plate[a].cy.toFixed(1)}" x2="${plate[b].cx.toFixed(1)}" y2="${plate[b].cy.toFixed(1)}" stroke="${fc}" stroke-width="${sw}" stroke-linecap="round"/>`);
            }
          }
        }
      });
    }  // end if (params.show_nickel)

    // 셀 렌더 (니켈 위에 표시, 원칙 27)
    for (const cell of cells) {
      const topIsPlus = (cell.g % 2 === 0);
      const polarity = face === 'top'
        ? (topIsPlus ? '+' : '-')
        : (topIsPlus ? '-' : '+');
      parts.push(drawCell(cell.cx, cell.cy, R, polarity, params.scale));
    }
    // 공란 점선
    for (const e of empties) {
      parts.push(`<circle cx="${e.cx.toFixed(1)}" cy="${e.cy.toFixed(1)}" r="${R.toFixed(1)}" fill="none" stroke="#bbbbbb" stroke-width="1" stroke-dasharray="4 3"/>`);
    }

    // v0.2.12 단자 탭 (최상단, 원칙 27)
    //   B+ 항상 top face G0 시작셀 (G0는 top에서 solo)
    //   B- S 짝수 → top face G_{S-1} 끝셀 / S 홀수 → bottom face G_{S-1} 끝셀
    if (params.show_terminal) {
      if (face === 'top') {
        const c0 = groups[0][0];
        parts.push(`<circle cx="${c0.cx.toFixed(1)}" cy="${c0.cy.toFixed(1)}" r="${(nw*0.7).toFixed(1)}" fill="#C0392B" stroke="#7B241C" stroke-width="1"/>`);
        parts.push(`<text font-family="Arial" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" x="${c0.cx.toFixed(1)}" y="${(c0.cy+4).toFixed(1)}">B+</text>`);
      }
      const bMinusOnTop = (S % 2 === 0);
      if ((face === 'top' && bMinusOnTop) || (face === 'bottom' && !bMinusOnTop)) {
        const lastG = groups[groups.length - 1];
        const cL = lastG[lastG.length - 1];
        parts.push(`<circle cx="${cL.cx.toFixed(1)}" cy="${cL.cy.toFixed(1)}" r="${(nw*0.7).toFixed(1)}" fill="#0C447C" stroke="#042C53" stroke-width="1"/>`);
        parts.push(`<text font-family="Arial" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" x="${cL.cx.toFixed(1)}" y="${(cL.cy+4).toFixed(1)}">B-</text>`);
      }
    }
    return parts.join('\n');
  }

  const headerH = 40;
  const gapSec  = params.gap_section;
  const svgW    = faceW;
  const svgH    = faceH * 2 + gapSec + headerH + 40;
  const topDY   = headerH;
  const botDY   = headerH + faceH + gapSec;

  const ln = [];
  ln.push(`<svg width="100%" viewBox="0 0 ${Math.ceil(svgW)} ${Math.ceil(svgH)}" xmlns="http://www.w3.org/2000/svg" role="img">`);
  ln.push(`<title>${S}S${P}P (${cols}×${rows}, ${params.arrangement})</title>`);
  ln.push(`<desc>전기: ${S}S${P}P=${N}셀, 격자: ${cols}×${rows}, 공란: ${cols*rows - N}개</desc>`);
  ln.push(`<text font-family="Arial" font-size="13" fill="#5F5E5A" text-anchor="middle" x="${svgW/2}" y="18">top face</text>`);
  ln.push(`<text font-family="Arial" font-size="13" fill="#5F5E5A" text-anchor="middle" x="${svgW/2}" y="${faceH+topDY+gapSec/2+12}">bottom face</text>`);
  const divY = faceH + topDY + gapSec/2 - 5;
  ln.push(`<line x1="20" y1="${divY}" x2="${svgW-20}" y2="${divY}" stroke="#cccccc" stroke-width="1" stroke-dasharray="4 3"/>`);
  ln.push(`<g transform="translate(0, ${topDY})">`);
  ln.push(buildFace('top'));
  ln.push(`</g>`);
  ln.push(`<g transform="translate(0, ${botDY})">`);
  ln.push(buildFace('bottom'));
  ln.push(`</g>`);
  ln.push(`<text font-family="Arial" font-size="9" fill="#27AE60" text-anchor="middle" x="${svgW/2}" y="${svgH-6}">이론 ${RENDERER_VERSION} · ${S}S${P}P · ${cols}×${rows} · ${N}셀 + ${cols*rows-N}공란 · ${params.arrangement}</text>`);
  ln.push('</svg>');
  return ln.join('\n');
}

// ═══════════════════════════════════════════════
// 4c. 커스텀 행별 셀 수(rows=[n1,n2,...]) 직접 렌더 (F14, M4 Phase 3)
//    - params.arrangement==='custom' && params.rows=[...] 입력 지원
//    - 좌표 계산: generator.calcCustomCenters (단일 출처)
//    - 니켈 병합 패턴: 상면 [G0][G1∪G2]..., 하면 [G0∪G1]..., isAdj 인접 쌍 stroke
// ═══════════════════════════════════════════════
function renderCustomRows(params) {
  const rows = params.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('[renderer.renderCustomRows] params.rows must be non-empty array');
  }
  const { pts, R, W, H } = __Generator.calcCustomCenters(rows, params, CELL_SPEC);
  const S  = params.S;
  const N  = pts.length;
  const nw = params.nickel_w_mm * params.scale;
  const cellsPerGroup = Math.ceil(N / S);

  // 행-단위 보스트로페돈(snake) 그룹 배정 (app.js renderCustomLayout과 동일)
  const byRow = rows.map(() => []);
  pts.forEach(pt => byRow[pt.row].push(pt));
  const snake = [];
  for (let r = 0; r < byRow.length; r++) {
    const row = [...byRow[r]];
    if (r % 2 === 1) row.reverse();
    snake.push(...row);
  }

  const groupCells = Array.from({ length: S }, () => []);
  snake.forEach((pt, i) => {
    const g = Math.min(S - 1, Math.floor(i / cellsPerGroup));
    groupCells[g].push(pt);
  });

  const isAdj = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

  function buildNickel(face) {
    if (!params.show_nickel) return '';
    const parts = [];
    const sw = nw.toFixed(1);
    const fc = NICKEL_FILL;
    const plates = [];
    const paired = new Set();
    const pStart = (face === 'top') ? 1 : 0;
    for (let g = pStart; g + 1 < S; g += 2) {
      plates.push([...groupCells[g], ...groupCells[g + 1]]);
      paired.add(g); paired.add(g + 1);
    }
    for (let g = 0; g < S; g++) {
      if (!paired.has(g))
        plates.splice(g === 0 ? 0 : plates.length, 0, [...groupCells[g]]);
    }
    plates.forEach(plate => {
      if (!plate.length) return;
      for (let a = 0; a < plate.length; a++) {
        for (let b = a + 1; b < plate.length; b++) {
          if (isAdj(plate[a], plate[b])) {
            parts.push(`<line x1="${plate[a].x.toFixed(1)}" y1="${plate[a].y.toFixed(1)}" x2="${plate[b].x.toFixed(1)}" y2="${plate[b].y.toFixed(1)}" stroke="${fc}" stroke-width="${sw}" stroke-linecap="round"/>`);
          }
        }
      }
    });
    return parts.join('');
  }

  function buildTerminals(face) {
    if (!params.show_terminal) return '';
    const parts = [];
    if (face === 'top') {
      const c0 = groupCells[0]?.[0];
      if (c0) {
        parts.push(`<circle cx="${c0.x.toFixed(1)}" cy="${c0.y.toFixed(1)}" r="${(nw*0.7).toFixed(1)}" fill="#C0392B" stroke="#7B241C" stroke-width="1"/>`);
        parts.push(`<text font-family="Arial" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" x="${c0.x.toFixed(1)}" y="${(c0.y+4).toFixed(1)}">B+</text>`);
      }
    }
    const bMinusOnTop = (S % 2 === 0);
    if ((face === 'top' && bMinusOnTop) || (face === 'bottom' && !bMinusOnTop)) {
      const lastG = groupCells[S - 1];
      const cL    = lastG?.[lastG.length - 1];
      if (cL) {
        parts.push(`<circle cx="${cL.x.toFixed(1)}" cy="${cL.y.toFixed(1)}" r="${(nw*0.7).toFixed(1)}" fill="#0C447C" stroke="#042C53" stroke-width="1"/>`);
        parts.push(`<text font-family="Arial" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" x="${cL.x.toFixed(1)}" y="${(cL.y+4).toFixed(1)}">B-</text>`);
      }
    }
    return parts.join('');
  }

  const topCells = snake.map((pt, i) => {
    const g = Math.min(S - 1, Math.floor(i / cellsPerGroup));
    return drawCell(pt.x, pt.y, R, getCellPolarity(g, 'top'), params.scale);
  });
  const botCells = snake.map((pt, i) => {
    const g = Math.min(S - 1, Math.floor(i / cellsPerGroup));
    return drawCell(pt.x, pt.y, R, getCellPolarity(g, 'bottom'), params.scale);
  });

  const faceFilter = params.face || 'all';
  const showTop    = faceFilter !== 'bottom';
  const showBot    = faceFilter !== 'top';
  const gap        = params.gap_section;
  const svgH       = (showTop && showBot) ? H * 2 + gap + 50 : H + 44;
  const ln         = [];
  ln.push(`<svg width="100%" viewBox="0 0 ${Math.ceil(W)} ${Math.ceil(svgH)}" xmlns="http://www.w3.org/2000/svg" role="img">`);
  ln.push(`<title>${S}S custom rows=[${rows.join(',')}] (${params.cell_type})</title>`);
  ln.push(`<desc>커스텀 행별 셀 수, N=${N}, ${S}S, 이론 ${RENDERER_VERSION}</desc>`);

  if (showTop && showBot) {
    ln.push(`<text font-family="Arial" font-size="12" fill="#5F5E5A" text-anchor="middle" x="${W/2}" y="18">top face</text>`);
    ln.push(`<g transform="translate(0,24)">${buildNickel('top')}${topCells.join('')}${buildTerminals('top')}</g>`);
    const divY = H + 24 + gap / 2;
    ln.push(`<line x1="20" y1="${divY}" x2="${W-20}" y2="${divY}" stroke="#cccccc" stroke-width="1" stroke-dasharray="4 3"/>`);
    ln.push(`<text font-family="Arial" font-size="12" fill="#5F5E5A" text-anchor="middle" x="${W/2}" y="${H + 24 + gap / 2 + 14}">bottom face</text>`);
    ln.push(`<g transform="translate(0,${H + 24 + gap})">${buildNickel('bottom')}${botCells.join('')}${buildTerminals('bottom')}</g>`);
  } else if (showTop) {
    ln.push(`<text font-family="Arial" font-size="12" fill="#5F5E5A" text-anchor="middle" x="${W/2}" y="18">top face</text>`);
    ln.push(`<g transform="translate(0,24)">${buildNickel('top')}${topCells.join('')}${buildTerminals('top')}</g>`);
  } else {
    ln.push(`<text font-family="Arial" font-size="12" fill="#5F5E5A" text-anchor="middle" x="${W/2}" y="18">bottom face</text>`);
    ln.push(`<g transform="translate(0,24)">${buildNickel('bottom')}${botCells.join('')}${buildTerminals('bottom')}</g>`);
  }

  ln.push(`<text font-family="Arial" font-size="8" fill="#27AE60" text-anchor="middle" x="${W/2}" y="${svgH - 6}">`
    + `${RENDERER_VERSION} · custom · rows=[${rows.join(',')}] · N=${N} · ${S}S`
    + `</text>`);
  ln.push('</svg>');
  return ln.join('\n');
}

// ═══════════════════════════════════════════════
// 5. 메인 render
// ═══════════════════════════════════════════════
function render(userParams = {}) {
  const params = { ...DEFAULT_PARAMS, ...userParams };
  const spec   = CELL_SPEC[params.cell_type];
  if (!spec) throw new Error(`Unknown cell_type: ${params.cell_type}`);

  // F14 (M4 Phase 3): custom 행별 셀 수 직접 지원
  if (params.arrangement === 'custom' && Array.isArray(params.rows) && params.rows.length > 0) {
    return renderCustomRows(params);
  }

  const { S, P } = params;
  const N        = S * P;
  const cols     = params.grid_cols || S;
  const rows     = params.grid_rows || P;
  const isCanonical = (cols === S && rows === P);
  if (cols * rows < N) throw new Error(`grid_cols×grid_rows (${cols}×${rows}=${cols*rows}) < N=${N}`);

  // 커스텀 격자(canonical이 아님) → 셀만 그리고 니켈 생략
  if (!isCanonical) return renderCustomGrid(params, spec, N, cols, rows);

  const layout   = resolveLayout(S, P, params.layout);
  const { cx, cy, R } = calcCellCenters(S, P, params);

  const nw     = params.nickel_w_mm * params.scale;
  const margin = params.margin_mm   * params.scale;

  // 엇배열 시 마지막 그룹의 최대 x는 오프셋 row가 더 큼
  let maxCx = 0;
  for (let p = 0; p < P; p++) if (cx[S-1][p] > maxCx) maxCx = cx[S-1][p];
  const faceW = maxCx + R + margin + nw * 2;
  const faceH = cy[P - 1] + R + margin;

  let svgW, svgH, topDY, botDY, botDX = 0;
  if (layout === 'side_by_side') {
    svgW  = faceW * 2 + params.gap_section;
    svgH  = faceH + 40;
    topDY = botDY = 30;
    botDX = faceW + params.gap_section;
  } else {
    svgW  = faceW + nw * 2 + 60;
    svgH  = faceH * 2 + params.gap_section + 60;
    topDY = 30;
    botDY = faceH + params.gap_section + 30;
  }

  const ln = [];
  ln.push(`<svg width="100%" viewBox="0 0 ${Math.ceil(svgW)} ${Math.ceil(svgH)}" xmlns="http://www.w3.org/2000/svg" role="img">`);
  ln.push(`<title>${S}S${P}P 배터리팩 조합도 (${params.arrangement})</title>`);
  ln.push(`<desc>${params.cell_type} ${S}S${P}P, ${S*P}셀, ${params.arrangement}, 이론 v0.3</desc>`);

  if (layout === 'side_by_side') {
    const divX = faceW + params.gap_section / 2;
    ln.push(`<line x1="${divX}" y1="10" x2="${divX}" y2="${svgH-10}" stroke="#cccccc" stroke-width="1" stroke-dasharray="4 3"/>`);
    ln.push(`<text font-family="Arial" font-size="12" fill="#5F5E5A" text-anchor="middle" x="${faceW/2}" y="20">top face</text>`);
    ln.push(`<text font-family="Arial" font-size="12" fill="#5F5E5A" text-anchor="middle" x="${faceW+params.gap_section+faceW/2}" y="20">bottom face</text>`);
  } else {
    const divY = faceH + topDY + params.gap_section / 2 - 5;
    ln.push(`<line x1="20" y1="${divY}" x2="${svgW-20}" y2="${divY}" stroke="#cccccc" stroke-width="1" stroke-dasharray="4 3"/>`);
    ln.push(`<text font-family="Arial" font-size="12" fill="#5F5E5A" text-anchor="middle" x="${svgW/2}" y="18">top face</text>`);
    ln.push(`<text font-family="Arial" font-size="12" fill="#5F5E5A" text-anchor="middle" x="${svgW/2}" y="${faceH+topDY+params.gap_section/2+12}">bottom face</text>`);
  }

  ln.push(`<g transform="translate(0, ${topDY})">`);
  ln.push(drawFace(S, P, 'top', cx, cy, R, params));
  ln.push('</g>');
  ln.push(`<g transform="translate(${botDX}, ${botDY})">`);
  ln.push(drawFace(S, P, 'bottom', cx, cy, R, params));
  ln.push('</g>');

  const legY = svgH - 28;
  ln.push(`<circle cx="30" cy="${legY}" r="8" fill="#FFFFFF" stroke="#C0392B" stroke-width="1.4"/><circle cx="30" cy="${legY}" r="2.8" fill="#C0392B"/><text font-family="Arial" font-size="10" fill="#5F5E5A" x="44" y="${legY+4}">+ face</text>`);
  ln.push(`<circle cx="120" cy="${legY}" r="8" fill="none" stroke="#1a1a1a" stroke-width="1.4"/><text font-family="Arial" font-size="10" fill="#5F5E5A" x="134" y="${legY+4}">- face</text>`);
  ln.push(`<text font-family="Arial" font-size="9" fill="#27AE60" text-anchor="middle" x="${svgW/2}" y="${svgH-6}">이론 ${RENDERER_VERSION} · ${S}S${P}P · ${params.cell_type} · ${params.arrangement} · ${S*P}셀</text>`);
  ln.push('</svg>');
  return ln.join('\n');
}

// ═══════════════════════════════════════════════
// 6. CLI
// ═══════════════════════════════════════════════
if (typeof module !== 'undefined' && require.main === module) {
  const fs = require('fs');
  const args = {};
  process.argv.slice(2).forEach(a => {
    const [k, v] = a.split('=');
    if (k && v !== undefined) args[k] = isNaN(v) ? v : Number(v);
  });
  const params = { ...args };
  const S = params.S || DEFAULT_PARAMS.S;
  const P = params.P || DEFAULT_PARAMS.P;
  const arr = params.arrangement || DEFAULT_PARAMS.arrangement;
  const gc = params.grid_cols, gr = params.grid_rows;
  const gridDesc = (gc && gr) ? `, grid=${gc}×${gr}` : '';
  console.log(`렌더링: ${S}S${P}P (${params.cell_type || DEFAULT_PARAMS.cell_type}, ${arr}${gridDesc})`);
  const svg = render(params);
  const suffix = arr === 'staggered' ? '_stag' : '';
  const gridSuf = (gc && gr) ? `_g${gc}x${gr}` : '';
  const filename = `${S}s${P}p${suffix}${gridSuf}.svg`;
  fs.writeFileSync(filename, svg, 'utf8');
  console.log(`저장 완료: ${filename}`);
}

if (typeof module !== 'undefined') module.exports = {
  render, calcNickelPattern, getCellPolarity, calcCellCenters, CELL_SPEC,
  // M4 Phase 1 — generator.js 회귀 검증용 추가 export
  canonicalSig, selectBlockType, calcTypeAGeometry, buildSnakeLayout,
  // M4 Phase 3 — F14 custom rows 직접 렌더
  renderCustomRows, resolveLayout,
};
