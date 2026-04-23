/**
 * app-state.js — 전역 상태 + 공유 헬퍼
 * (browser-only, window 공유 스코프 — no exports)
 *
 * 모든 app-*.js 파일이 이 파일을 먼저 로드한 후 공유.
 * ★ 단일 출처 규칙: state / lastSVG / _enumResult 는 이 파일에서만 선언.
 */

// ── 상태 ─────────────────────────────────────────
// gap: 0.0 — 원칙(셀-셀 맞닿음, pitch = render_d), renderer.js DEFAULT_PARAMS와 동일
const state = {
  cell_type:       '21700',
  S:               3,
  P:               3,
  gap:             0.0,   // ★ 원칙: gap=0 (셀 맞닿음) — renderer.js 기본값과 동일
  arrangement:     'square',
  stag_dir:        'R',        // 엇배열 방향: 'R' = 홀수 행 오른쪽, 'L' = 짝수 행 오른쪽
  show_nickel:      true,
  show_terminal:    true,
  show_cell_coords: false,  // 커스텀 배열 셀 좌표 라벨(rNcM) 표시 여부
  face:            'all',
  max_plate_types: null,
  allow_mirror:    false,
  custom_align:    'center',  // 'left' | 'center' | 'right'
  custom_stagger:  false,     // 커스텀 배열 엇배열 여부
  custom_stagger_dir: 'R',   // 엇배열 방향: 'R' = 2번째 행이 1번째(하단) 대비 우측, 'L' = 좌측
  bms_edge:        'bottom',  // BMS 위치 엣지: 'top'|'bottom'|'left'|'right'
  bms_pos:         0.5,       // BMS 위치 비율 (0.0 ~ 1.0, 엣지 시작→끝)
  // 우측 패널
  icc1:              false,   // ICC① 행스팬 ≤ 2 (기본 비활성)
  icc2:              true,    // ICC② 종횡비 ≤ 2.0
  icc3:              false,   // ICC③ 볼록성 ≥ 0.75 (기본 비활성)
  nickel_w_mm:       4.0,     // 니켈 폭 mm (ICC 계산 기준)
  selected_ordering: 0,       // 선택된 배열 후보 인덱스
  // H1 — Level 1 물리 홀더 (null = S/P와 동일, 후방 호환)
  holder_rows:   null,        // null → P 사용
  holder_cols:   null,        // null → S 사용
  holder_empty:  [],          // [[row,col], ...] 빈 슬롯
  // H2 — Level 2 B+/B- 출력 방향
  b_plus_side:   'left',      // 'top'|'bottom'|'left'|'right'
  b_minus_side:  'right',
  // H3 보조 — G0 앵커 (1번 셀 위치 제약)
  g0_anchor:     null,        // null | 'TL' | 'TR' | 'BL' | 'BR' | {row, col}
  // Phase 4 — pentomino 도형 허용 토글
  allow_I:       true,        // 1자(I-pentomino) 허용 여부
  allow_U:       false,       // ㄷ자(U-pentomino) 허용 여부
  // Phase 5 — 니켈 플레이트 수 제한
  max_plates:    0,           // 0 = 제한 없음, N = 고유 형상(금형) 종류 수 ≤ N인 후보만 표시
  search_budget_ms: 600000,  // 탐색 시간 제한 (ms): null = 무제한, 기본 10분
  // UI
  zoom:          1.0,         // 중앙 SVG 표시 배율 (0.3 ~ 3.0)
};
let lastSVG = '';
let _enumResult = null;       // 마지막 enumerateGroupAssignments 결과
let _sortedCandidates = null; // 사이드바 표시용 정렬·필터 적용 배열 (인덱스 동기화용)

// ── 후보의 고유 형상(금형) 종류 수 계산 ──────────────
// 실제 니켈 플레이트 형상 기준: I형(단독 그룹) + U형(인접 두 그룹 합집합)
// calcNickelPattern (원칙 12/14) 패턴에 따라 top/bottom 모든 플레이트의
// canonical 4-회전 서명을 구해 고유 금형 종류를 카운트한다.
function _countDistinctShapes(cand) {
  const groups = cand.groups || [];
  const S = groups.length;
  if (S === 0) return 0;

  function _sig(cells) {
    if (!cells || cells.length === 0) return null;
    const pts = cells.map(c => [c.x != null ? c.x : c.cx, c.y != null ? c.y : c.cy]);
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const shifted = pts.map(([x, y]) => [x - cx, y - cy]);
    const variants = [0, 1, 2, 3].map(k => {
      const a = Math.PI / 2 * k, ca = Math.cos(a), sa = Math.sin(a);
      const rot = shifted.map(([x, y]) => [
        Math.round((x * ca - y * sa) * 10) / 10,
        Math.round((x * sa + y * ca) * 10) / 10,
      ]);
      rot.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return JSON.stringify(rot);
    });
    return variants.reduce((a, b) => a < b ? a : b);
  }

  const gc   = i => groups[i]?.cells || [];
  const pair = (i, j) => [...gc(i), ...gc(j)];
  const sigs = new Set();
  const add  = cells => { const s = _sig(cells); if (s) sigs.add(s); };

  // calcNickelPattern 동일 패턴 (원칙 12/14):
  // Top: I(G0=B+), U(G1,G2), U(G3,G4), ..., I(G_{S-1}=B-) if S 짝수
  add(gc(0));
  for (let g = 1; g < S - 1; g += 2) add(pair(g, g + 1));
  if (S % 2 === 0) add(gc(S - 1));

  // Bottom: U(G0,G1), U(G2,G3), ..., I(G_{S-1}=B-) if S 홀수
  for (let g = 0; g < S - 1; g += 2) add(pair(g, g + 1));
  if (S % 2 !== 0) add(gc(S - 1));

  return sigs.size;
}

// ── 비용 모델 (원칙 20) ──────────────────────────
const MOLD_COST_KRW  = 20_000_000;
const PLATE_COST_KRW = 300;

// ── 커스텀 배열 rows[] 파싱 (UI 입력 → 숫자 배열) ──
// 형식: "10,12:-2,13:-1,12:1,5:1" — 입력은 아래→위(1단부터), 내부는 위→아래로 역순 변환
function _parseCustomRowsRaw() {
  const raw = document.getElementById('customRows').value.trim();
  const counts = [], offsets = [];
  for (const entry of raw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)) {
    const m = entry.match(/^(\d+)(?::([+-]?\d+))?$/);
    if (m && parseInt(m[1], 10) > 0) {
      counts.push(parseInt(m[1], 10));
      offsets.push(m[2] ? parseInt(m[2], 10) : 0);
    }
  }
  counts.reverse();
  offsets.reverse();
  return { counts, offsets };
}
function parseCustomRows()    { return _parseCustomRowsRaw().counts; }
function parseRowOffsets()    { return _parseCustomRowsRaw().offsets; }

// ── 고정 그룹 파싱 (UI 입력 → {mode, groups|sparseGroups}) ──
// 연속 형식: 각 줄 = 한 그룹, 공백 구분 셀 좌표 "r{row}c{col}"
//   예: "r4c0 r3c0"
// 비연속(sparse) 형식: 줄 시작에 "그룹인덱스:" 접두사
//   예: "0: r4c0 r3c0"  "2: r4c3 r3c3"
function parsePinnedGroups() {
  const el = document.getElementById('pinnedGroupsInput');
  if (!el) return { mode: 'consecutive', groups: [] };
  // 줄바꿈으로 나누되, 한 줄 안에 "N:" 패턴이 여러 번 나오면 추가 분리
  // 예: "0: r3c0  11: r3c10  12: r3c11" → 세 토큰 그룹으로 분리
  const rawLines = el.value.split('\n').map(s => s.trim()).filter(Boolean);
  const lines = [];
  for (const raw of rawLines) {
    // lookahead으로 "숫자:" 앞에서 분리 (첫 번째 제외)
    const parts = raw.split(/(?=\s\d+\s*:)/).map(s => s.trim()).filter(Boolean);
    lines.push(...parts);
  }
  const isSparse = lines.some(l => /^\d+\s*:/.test(l));
  if (isSparse) {
    const sparseGroups = [];
    for (const line of lines) {
      const m = line.match(/^(\d+)\s*:(.*)/);
      if (!m) continue;
      const groupIdx = parseInt(m[1], 10);
      const cells = [];
      for (const tok of m[2].trim().split(/\s+/)) {
        const cm = tok.match(/^r(-?\d+)c(-?\d+)$/i);
        if (cm) cells.push({ row: parseInt(cm[1], 10), col: parseInt(cm[2], 10) });
      }
      if (cells.length > 0) sparseGroups.push({ groupIdx, cells });
    }
    return { mode: 'sparse', sparseGroups };
  }
  const groups = [];
  for (const line of lines) {
    const cells = [];
    for (const tok of line.split(/\s+/)) {
      const m = tok.match(/^r(-?\d+)c(-?\d+)$/i);
      if (m) cells.push({ row: parseInt(m[1], 10), col: parseInt(m[2], 10) });
    }
    if (cells.length > 0) groups.push(cells);
  }
  return { mode: 'consecutive', groups };
}

function clearPinnedGroups() {
  const el = document.getElementById('pinnedGroupsInput');
  if (el) { el.value = ''; }
}

// ── 커스텀 모드: S×P vs 행 합계 일치 경고 ──────────
function checkCustomConsistency() {
  if (state.arrangement !== 'custom') return;
  const el = document.getElementById('customConsistWarn');
  if (!el) return;
  const rows = parseCustomRows();
  const total = rows.reduce((a, b) => a + b, 0);
  const sp = state.S * state.P;
  if (rows.length === 0) {
    el.style.display = 'none';
  } else if (total !== sp) {
    el.textContent = `⚠ S×P = ${state.S}×${state.P} = ${sp}  ≠  행 합계 ${total}`;
    el.style.display = 'block';
  } else {
    el.textContent = `✓ S×P = ${sp} = 행 합계 ${total}`;
    el.style.color = 'var(--green)';
    el.style.display = 'block';
  }
}
