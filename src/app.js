/**
 * Battery Pack Renderer — UI Controller (app.js)
 *
 * 역할: UI 상태 관리 + 이벤트 핸들러만 담당. SVG 생성 로직 無.
 * 렌더 엔진: renderer.js (단일 기준) — 모든 SVG 생성은 render() 호출로 위임.
 * 형상 엔진: generator.js (LAYER 3) — 좌표·패턴·블록 타입 계산 전담.
 *
 * renderer.js가 전역으로 제공하는 함수 (browser <script> 로드 시):
 *   render, calcCellCenters, drawCell, drawFace, calcNickelPattern,
 *   getCellPolarity, resolveLayout, CELL_SPEC, RENDERER_VERSION
 *
 * M5 (2026-04-17): doRender() 제거, rerender() 유일 진입점.
 *   F14(renderer.renderCustomRows) 완성으로 app.js 내 renderCustomLayout/calcCustomCenters 삭제.
 */

// ── 상태 ─────────────────────────────────────────
// gap: 0.0 — 원칙(셀-셀 맞닿음, pitch = render_d), renderer.js DEFAULT_PARAMS와 동일
const state = {
  cell_type:       '21700',
  S:               13,
  P:               4,
  gap:             0.0,   // ★ 원칙: gap=0 (셀 맞닿음) — renderer.js 기본값과 동일
  arrangement:     'square',
  stag_dir:        'R',        // 엇배열 방향: 'R' = 홀수 행 오른쪽, 'L' = 짝수 행 오른쪽
  show_nickel:     true,
  show_terminal:   true,
  face:            'all',
  max_plate_types: null,
  allow_mirror:    false,
  custom_align:    'center',  // 'left' | 'center' | 'right'
  custom_stagger:  false,     // 커스텀 배열 엇배열 여부
  custom_stagger_dir: 'R',   // 엇배열 방향: 'R' = 2번째 행이 1번째(하단) 대비 우측, 'L' = 좌측
  bms_edge:        'bottom',  // BMS 위치 엣지: 'top'|'bottom'|'left'|'right'
  bms_pos:         0.5,       // BMS 위치 비율 (0.0 ~ 1.0, 엣지 시작→끝)
  // 우측 패널
  icc1:              true,    // ICC① 행스팬 ≤ 2
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
  // UI
  zoom:          1.0,         // 중앙 SVG 표시 배율 (0.3 ~ 3.0)
};
let lastSVG = '';

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

// ── m_min 컬럼 파티션 하한 (원칙 22) ─────────────
// ※ 이 함수는 renderer.js가 아직 export하지 않는 근사 계산.
//   정확한 SFMT 결과(원칙 18)와 다를 수 있으므로 UI에 "(est.)" 명시.
function estimateMmin(S, P, arr, mirror) {
  if (arr === 'square') return (S % 2 === 0) ? 1 : 2;
  let m = Math.ceil((S + 1) / 2) + 1;
  if (mirror) m = Math.max(1, m - 1);
  return Math.max(2, m);
}

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

// ── M5 제거됨 ────────────────────────────────────────
// calcCustomCenters → generator.calcCustomCenters (단일 출처, LAYER 3)
// convexHull2D      → 미사용 dead code 제거
// renderCustomLayout → renderer.renderCustomRows (F14, 단일 출처)
// 참조 위치 → src/generator.js, src/renderer.js

// ── UI 컨트롤 ─────────────────────────────────────
function setCellType(t) {
  state.cell_type = t;
  document.getElementById('btn18650').classList.toggle('active', t === '18650');
  document.getElementById('btn21700').classList.toggle('active', t === '21700');
}

function setArrangement(a) {
  state.arrangement = a;
  document.getElementById('btnSquare').classList.toggle('active', a === 'square');
  document.getElementById('btnStag').classList.toggle('active', a === 'staggered');
  document.getElementById('btnCustom').classList.toggle('active', a === 'custom');
  const isCustom = (a === 'custom');
  const isStag   = (a === 'staggered');
  document.getElementById('rectConfig').style.display      = 'block';
  document.getElementById('customGroup').style.display     = isCustom ? 'block' : 'none';
  document.getElementById('holderSizeGroup').style.display = isCustom ? 'none'  : 'block';
  document.getElementById('stagDirGroup').style.display    = isStag   ? 'block' : 'none';
  if (isCustom) { _enumResult = null; checkCustomConsistency(); }
  rerender();
}

function setStaggerDir(d) {
  state.stag_dir = d;
  document.getElementById('btnStagR').classList.toggle('active', d === 'R');
  document.getElementById('btnStagL').classList.toggle('active', d === 'L');
  if (lastSVG) _renderSVG();
}

function setCustomAlign(a) {
  state.custom_align = a;
  ['left', 'center', 'right'].forEach(v => {
    const el = document.getElementById('btnAlign' + v.charAt(0).toUpperCase() + v.slice(1));
    if (el) el.classList.toggle('active', a === v);
  });
}

function toggleCustomStagger() {
  state.custom_stagger = !state.custom_stagger;
  document.getElementById('togCustomStagger').classList.toggle('on', state.custom_stagger);
  rerender();
}

// ── BMS 위치 제어 (원칙 16 — 맨해튼 거리 최소화) ───────────
function setBmsEdge(e) {
  state.bms_edge = e;
  ['top','bottom','left','right'].forEach(v => {
    const el = document.getElementById('bmsEdge' + v.charAt(0).toUpperCase() + v.slice(1));
    if (el) el.classList.toggle('active', e === v);
  });
}

function adjBmsPos(d) {
  state.bms_pos = Math.max(0.0, Math.min(1.0, +(state.bms_pos + d).toFixed(1)));
  const el = document.getElementById('valBmsPos');
  if (el) el.textContent = Math.round(state.bms_pos * 100) + '%';
}

// B+/B− 단자에서 BMS 위치까지 맨해튼 거리 계산 (mm 단위)
// B+ = 그룹 0 중간 셀, B− = 그룹 S-1 중간 셀
function calcBmsDistances() {
  const { S, P, bms_edge, bms_pos, arrangement } = state;
  const p = { ...state, layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0 };
  try {
    let bpX, bpY, bmX, bmY, faceW, faceH;

    if (arrangement === 'custom') {
      // F21: 커스텀 배열 BMS 거리 계산 (인라인 — Generator/CELL_SPEC 의존 없음)
      const rows = parseCustomRows();
      if (!rows || rows.length === 0) return { distBp: null, distBm: null, ok: false };
      const _specs = { '18650': { render_d: 19.0 }, '21700': { render_d: 22.0 } };
      const _sp   = _specs[p.cell_type] || _specs['21700'];
      const _pit  = (_sp.render_d + (p.gap || 0)) * p.scale;
      const _R    = (_sp.render_d / 2) * p.scale;
      const _mg   = (p.margin_mm || 8) * p.scale;
      const _stag = !!p.custom_stagger;
      const _pitY = _stag ? _pit * Math.sqrt(3) / 2 : _pit;
      const _maxN = Math.max(...rows);
      const _aln  = p.custom_align || 'center';
      const _sd   = p.custom_stagger_dir === 'L' ? -1 : 1;
      const _lp   = (_stag && _sd === -1) ? _pit / 2 : 0;
      const pts = [];
      for (let r = 0; r < rows.length; r++) {
        const n = rows[r], fb = rows.length - 1 - r;
        const sOff = (_stag && fb % 2 === 1) ? _sd * _pit / 2 : 0;
        const aOff = _aln === 'left' ? 0 : _aln === 'right' ? (_maxN - n) * _pit : (_maxN - n) * _pit / 2;
        for (let i = 0; i < n; i++)
          pts.push({ x: _mg + _lp + aOff + sOff + i * _pit + _R, y: _mg + r * _pitY + _R, row: r });
      }
      const W = _mg * 2 + _maxN * _pit + (_stag ? _pit / 2 : 0);
      const H = _mg * 2 + (rows.length - 1) * _pitY + 2 * _R;
      // snake boustrophedon (renderCustomRows와 동일 순서)
      const N = pts.length;
      const cellsPerGroup = Math.ceil(N / S);
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
      const g0 = groupCells[0], gL = groupCells[S - 1];
      if (!g0?.length || !gL?.length) return { distBp: null, distBm: null, ok: false };
      bpX = g0[0].x;             bpY = g0[0].y;
      bmX = gL[gL.length - 1].x; bmY = gL[gL.length - 1].y;
      faceW = W; faceH = H;
    } else {
      const { cx, cy, R } = calcCellCenters(S, P, p);
      const nw     = p.nickel_w_mm * p.scale;
      const margin = p.margin_mm * p.scale;
      let maxCx = 0;
      for (let q = 0; q < P; q++) if (cx[S - 1][q] > maxCx) maxCx = cx[S - 1][q];
      faceW  = maxCx + R + margin + nw * 2;
      faceH  = cy[P - 1] + R + margin + 40;
      const midP = Math.floor(P / 2);
      bpX = cx[0][midP];      bpY = cy[midP];
      bmX = cx[S - 1][midP];  bmY = cy[midP];
    }

    let bmsX = 0, bmsY = 0;
    if (bms_edge === 'top')    { bmsX = bms_pos * faceW; bmsY = 0; }
    if (bms_edge === 'bottom') { bmsX = bms_pos * faceW; bmsY = faceH; }
    if (bms_edge === 'left')   { bmsX = 0;               bmsY = bms_pos * faceH; }
    if (bms_edge === 'right')  { bmsX = faceW;            bmsY = bms_pos * faceH; }
    const sc     = p.scale;
    const distBp = Math.round((Math.abs(bpX - bmsX) + Math.abs(bpY - bmsY)) / sc);
    const distBm = Math.round((Math.abs(bmX - bmsX) + Math.abs(bmY - bmsY)) / sc);
    return { distBp, distBm, bmsX, bmsY, faceW, faceH, ok: true };
  } catch (err) {
    console.error('[calcBmsDistances] error:', err);
    return { distBp: null, distBm: null, ok: false };
  }
}

// BMS 위치 마커를 SVG DOM에 직접 삽입
function addBmsMarkerToDOM() {
  const svgEl = document.querySelector('#svgOutput svg');
  if (!svgEl) return;
  const existing = svgEl.querySelector('#bmsMarker');
  if (existing) existing.remove();

  const edge = state.bms_edge;
  const pos  = state.bms_pos;
  let mX, mY;

  if (state.arrangement === 'custom') {
    // 커스텀: SVG viewBox 치수 기반으로 BMS 마커 위치 계산
    const [,, svgW, svgH] = svgEl.getAttribute('viewBox').split(' ').map(Number);
    const faceFilter = state.face;
    const yOff = (faceFilter === 'all') ? 24 : 20;
    const faceH = (faceFilter === 'all') ? (svgH - 50 - 36) / 2 : svgH - 44;
    if (edge === 'top')    { mX = pos * svgW;  mY = yOff; }
    if (edge === 'bottom') { mX = pos * svgW;  mY = yOff + faceH; }
    if (edge === 'left')   { mX = 0;           mY = yOff + pos * faceH; }
    if (edge === 'right')  { mX = svgW;        mY = yOff + pos * faceH; }
  } else {
    const { bmsX, bmsY, ok } = calcBmsDistances();
    if (!ok) return;
    mX = bmsX;
    mY = bmsY + ((state.face === 'all') ? 24 : 20);
  }

  const sz = 10;
  const ns = 'http://www.w3.org/2000/svg';
  const g  = document.createElementNS(ns, 'g');
  g.setAttribute('id', 'bmsMarker');
  const poly = document.createElementNS(ns, 'polygon');
  let pts;
  if (edge === 'top')    pts = `${mX-sz/2},${mY} ${mX+sz/2},${mY} ${mX},${mY+sz}`;
  if (edge === 'bottom') pts = `${mX-sz/2},${mY} ${mX+sz/2},${mY} ${mX},${mY-sz}`;
  if (edge === 'left')   pts = `${mX},${mY-sz/2} ${mX},${mY+sz/2} ${mX+sz},${mY}`;
  if (edge === 'right')  pts = `${mX},${mY-sz/2} ${mX},${mY+sz/2} ${mX-sz},${mY}`;
  poly.setAttribute('points', pts);
  poly.setAttribute('fill', '#059669');
  poly.setAttribute('opacity', '0.9');
  g.appendChild(poly);
  const txt = document.createElementNS(ns, 'text');
  txt.setAttribute('font-family', 'Arial');
  txt.setAttribute('font-size', '9');
  txt.setAttribute('fill', '#059669');
  txt.setAttribute('font-weight', 'bold');
  let tx = mX, ty = mY;
  if (edge === 'top')    { tx = mX;        ty = mY+sz+10; txt.setAttribute('text-anchor','middle'); }
  if (edge === 'bottom') { tx = mX;        ty = mY-sz-3;  txt.setAttribute('text-anchor','middle'); }
  if (edge === 'left')   { tx = mX+sz+3;   ty = mY+3;     txt.setAttribute('text-anchor','start');  }
  if (edge === 'right')  { tx = mX-sz-3;   ty = mY+3;     txt.setAttribute('text-anchor','end');    }
  txt.setAttribute('x', tx);
  txt.setAttribute('y', ty);
  txt.textContent = 'BMS';
  g.appendChild(txt);
  svgEl.appendChild(g);
}

function adj(k, d) {
  if (k === 'S') state.S = Math.max(2, Math.min(23, state.S + d));
  if (k === 'P') state.P = Math.max(1, Math.min(8,  state.P + d));
  const el = document.getElementById('val' + k);
  if (el) el.value = state[k];
  checkCustomConsistency();
}

// 직접 타이핑 입력 처리 (input[type=number] oninput 핸들러)
function setFromInput(k, v) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || v === '') return;
  if (k === 'S') state.S = Math.max(2, Math.min(23, n));
  if (k === 'P') state.P = Math.max(1, Math.min(8,  n));
  const el = document.getElementById('val' + k);
  if (el && parseInt(el.value, 10) !== state[k]) el.value = state[k];
  checkCustomConsistency();
}

// ── H1 홀더 크기 제어 ─────────────────────────────
function getHolderRows() { return state.holder_rows != null ? state.holder_rows : state.P; }
function getHolderCols() { return state.holder_cols != null ? state.holder_cols : state.S; }

function adjHolder(dim, d) {
  if (dim === 'rows') {
    if (state.holder_rows === null) {
      if (d > 0) state.holder_rows = 1;  // auto(0) + 1 = 1
    } else {
      const nxt = state.holder_rows + d;
      state.holder_rows = (nxt <= 0) ? null : nxt;  // 1 - 1 = auto
    }
  } else {
    if (state.holder_cols === null) {
      if (d > 0) state.holder_cols = 1;  // auto(0) + 1 = 1
    } else {
      const nxt = state.holder_cols + d;
      state.holder_cols = (nxt <= 0) ? null : nxt;  // 1 - 1 = auto
    }
  }
  updateHolderUI();
  state.selected_ordering = 0;
  rerender();
}

function updateHolderUI() {
  const hR = getHolderRows(), hC = getHolderCols();
  const rowEl = document.getElementById('valHolderRows');
  const colEl = document.getElementById('valHolderCols');
  if (rowEl) rowEl.textContent = state.holder_rows != null ? hR : 'auto';
  if (colEl) colEl.textContent = state.holder_cols != null ? hC : 'auto';

  const totalSlots = hR * hC;
  const N          = state.S * state.P;
  const emptyCount = totalSlots - N;
  const hint = document.getElementById('holderCapHint');
  if (!hint) return;
  if (emptyCount < 0) {
    hint.textContent = `⚠ 슬롯 부족: ${totalSlots} < ${N}셀`;
    hint.style.color = 'var(--red)';
  } else if (emptyCount === 0) {
    hint.textContent = `${hR}×${hC} = ${totalSlots}슬롯 · 빈 슬롯 없음`;
    hint.style.color = 'var(--dt3)';
  } else {
    hint.textContent = `${hR}×${hC} = ${totalSlots}슬롯 · 빈 ${emptyCount}개`;
    hint.style.color = 'var(--amber)';
  }
}

// ── H2 B+/B- 방향 제어 ───────────────────────────
function setBTermDir(key, side) {
  state[key] = side;
  const prefix = key === 'b_plus_side' ? 'bp' : 'bm';
  ['Top', 'Left', 'Right', 'Bottom'].forEach(s => {
    const el = document.getElementById(prefix + s);
    if (el) el.classList.toggle('active', side === s.toLowerCase());
  });
  state.selected_ordering = 0;
}

function adjGap(d) {
  state.gap = Math.max(0, Math.min(3, +(state.gap + d).toFixed(1)));
  document.getElementById('valGap').textContent = state.gap.toFixed(1);
}

function adjK(d) {
  const cur = state.max_plate_types;
  let nxt;
  if (cur === null) { nxt = (d > 0) ? 1 : null; }
  else { nxt = cur + d; if (nxt < 1) nxt = null; if (nxt > 10) nxt = null; }
  state.max_plate_types = nxt;
  document.getElementById('valK').textContent = (nxt === null) ? 'auto' : nxt;
}

function toggleOpt(k) {
  if (k === 'nickel') {
    state.show_nickel = !state.show_nickel;
    document.getElementById('togNickel').classList.toggle('on', state.show_nickel);
  }
  if (k === 'term') {
    state.show_terminal = !state.show_terminal;
    document.getElementById('togTerm').classList.toggle('on', state.show_terminal);
  }
  if (k === 'emboss') {
    state.allow_mirror = !state.allow_mirror;
    document.getElementById('togEmboss').classList.toggle('on', !state.allow_mirror);
  }
  if (lastSVG) rerender();
}

function setFace(f) {
  state.face = f;
  ['all', 'top', 'bottom'].forEach(id => {
    const el = document.getElementById('face' + id.charAt(0).toUpperCase() + id.slice(1));
    if (el) el.classList.toggle('active', f === id);
  });
  if (lastSVG) {
    applyFaceFilter();
    fixSVGSize();
    addBmsMarkerToDOM();
  }
}

function calcPackDimensions() {
  const spec = (typeof CELL_SPEC !== 'undefined') ? CELL_SPEC[state.cell_type] : null;
  if (!spec) return null;
  const pitch  = spec.render_d;   // gap=0
  const margin = 8.0;
  if (state.arrangement === 'custom') {
    if (typeof Generator === 'undefined') return null;
    const rows = parseCustomRows();
    if (!rows.length) return null;
    try {
      const cp = { ...state, layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0, rows };
      const { W, H } = Generator.calcCustomCenters(rows, cp, CELL_SPEC);
      const marginPx = 8.0 * 1.5;
      return { w: (W - 2 * marginPx) / 1.5, h: (H - 2 * marginPx) / 1.5 };
    } catch (_) { return null; }
  }
  const cols  = getHolderCols() || state.S;
  const rowsN = getHolderRows() || state.P;
  const isStag = state.arrangement === 'staggered';
  const pitchY = isStag ? pitch * Math.sqrt(3) / 2 : pitch;
  const R = pitch / 2;
  // 렌더링 여백(margin) 제외 — 순수 셀 배열 물리 크기
  return {
    w: cols * pitch + (isStag ? pitch / 2 : 0),
    h: (rowsN - 1) * pitchY + 2 * R,
  };
}

// ── info-box 업데이트 ──────────────────────────────
function updateInfoBox() {
  const { S, P, arrangement, allow_mirror, max_plate_types } = state;
  const pat    = calcNickelPattern(S);
  const topI   = pat.top.filter(n => n.type === 'I').length;
  const topU   = pat.top.filter(n => n.type === 'U').length;
  const botI   = pat.bot.filter(n => n.type === 'I').length;
  const botU   = pat.bot.filter(n => n.type === 'U').length;
  const layout = resolveLayout(S, P, 'auto');
  const bplus  = pat.top.find(n => n.terminal === 'B+') || pat.bot.find(n => n.terminal === 'B+');
  const bminus = pat.bot.find(n => n.terminal === 'B-') || pat.top.find(n => n.terminal === 'B-');

  document.getElementById('iCells').textContent  = `${S * P}개 (${S}×${P})`;
  document.getElementById('iNickel').textContent = `I자${topI + botI}  ㄷ자${topU + botU}`;
  document.getElementById('iLayout').textContent = layout === 'top_bottom' ? '상하 배치' : '좌우 배치';
  document.getElementById('iBplus').textContent  = bplus  ? `G${bplus.groups[0] + 1} ${bplus.type === 'I' ? 'I자' : 'ㄷ자'}` : '—';
  document.getElementById('iBminus').textContent = bminus ? `G${bminus.groups[bminus.groups.length - 1] + 1} ${bminus.type === 'I' ? 'I자' : 'ㄷ자'}` : '—';
  const dim = calcPackDimensions();
  const sizeEl = document.getElementById('iSize');
  if (sizeEl) sizeEl.textContent = dim ? `${dim.w.toFixed(0)} × ${dim.h.toFixed(0)} mm` : '—';

  const Nplates = topI + topU + botI + botU;
  const mMin   = estimateMmin(S, P, arrangement, allow_mirror);
  const K      = max_plate_types;
  const mUse   = (K === null) ? mMin : Math.max(mMin, K);
  const feas   = (K === null) || (K >= mMin);
  const mold   = mUse * MOLD_COST_KRW;
  const reuse  = (Nplates / mUse).toFixed(2);

  document.getElementById('iMmin').textContent  = `≈${mMin} (사용 ${mUse})`;
  document.getElementById('iMold').textContent  = `₩${(mold / 1e6).toFixed(0)}M`;
  document.getElementById('iReuse').textContent = `${reuse}× (${Nplates}/${mUse})`;
  document.getElementById('iFeas').innerHTML    = feas
    ? '<span style="color:#27ae60">✓ 가능</span>'
    : '<span style="color:#e74c3c">✗ 불가(K&lt;m_min)</span>';
  document.getElementById('toolInfo').textContent =
    `${state.cell_type} · ${S}S${P}P · ${S * P}셀 · ${layout === 'top_bottom' ? '상하' : '좌우'} · m=${mUse}`;

  // BMS 거리 정보 (원칙 16)
  document.getElementById('iBmsEdge').textContent =
    state.bms_edge.charAt(0).toUpperCase() + state.bms_edge.slice(1)
    + ' · ' + Math.round(state.bms_pos * 100) + '%';
  {
    const bms = calcBmsDistances();
    if (bms.ok) {
      document.getElementById('iDistBp').textContent  = bms.distBp + ' mm';
      document.getElementById('iDistBm').textContent  = bms.distBm + ' mm';
      const tot   = bms.distBp + bms.distBm;
      const totEl = document.getElementById('iDistTotal');
      totEl.textContent = tot + ' mm';
      totEl.className   = 'val ' + (tot < 60 ? 'green' : tot < 120 ? '' : 'amber');
    } else {
      ['iDistBp', 'iDistBm', 'iDistTotal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '—'; el.className = 'val'; }
      });
    }
  }
}

// ── 단면 필터 적용 ────────────────────────────────
function applyFaceFilter() {
  // face=all: rerender()에서 만든 양면 lastSVG를 그대로 표시
  // face=top|bottom: renderer.render()를 face 파라미터와 함께 재호출하여 단면 생성
  //   (square/staggered/custom 모두 renderer가 face 필터 지원 — F14 검증 완료)
  if (state.face === 'all') {
    document.getElementById('svgOutput').innerHTML = lastSVG;
    return;
  }
  const customRows = parseCustomRows();
  const customOffsets = parseRowOffsets();
  const p = {
    ...state,
    layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0, gap_section: 36,
    rows:        (state.arrangement === 'custom') ? customRows    : undefined,
    row_offsets: (state.arrangement === 'custom') ? customOffsets : undefined,
    face: state.face,   // 'top' | 'bottom'
  };
  let svg;
  try { svg = render(p); }
  catch (err) {
    console.error('[applyFaceFilter] render failed:', err);
    svg = `<svg width="100%" viewBox="0 0 420 80"><rect width="100%" height="100%" fill="#181c27"/>`
      + `<text x="20" y="46" fill="#e74c3c" font-family="Arial" font-size="12">단면 렌더 오류: ${err.message}</text></svg>`;
  }
  document.getElementById('svgOutput').innerHTML = svg;
}

// ── SVG를 viewBox 자연 크기 × zoom 배율로 고정 ─────
function fixSVGSize() {
  const svgEl = document.querySelector('#svgOutput svg');
  if (!svgEl) return;
  const vb = svgEl.getAttribute('viewBox');
  if (!vb) return;
  const [, , w, h] = vb.split(' ').map(Number);
  const z = state.zoom || 1.0;
  const pw = Math.ceil(w * z);
  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  // inline style이 CSS 규칙(width:100%)을 덮어써야 zoom이 반영됨
  svgEl.style.cssText = `width:${pw}px;max-width:100%;height:auto;display:block;`;
}

function adjZoom(d) {
  state.zoom = Math.round(Math.max(0.3, Math.min(3.0, state.zoom + d)) * 10) / 10;
  const el = document.getElementById('valZoom');
  if (el) el.textContent = Math.round(state.zoom * 100) + '%';
  fixSVGSize();
}

// ── SVG만 갱신 (재열거 없이 현재 _enumResult 기준으로 그림) ────────
function _renderSVG() {
  updateInfoBox();

  let effectiveCandidates = _enumResult ? (_enumResult.candidates || []) : [];
  if (state.max_plates > 0) {
    effectiveCandidates = effectiveCandidates.filter(
      c => _countDistinctShapes(c) <= state.max_plates
    );
  }

  const emptyEl = document.getElementById('emptyState');

  if (!_enumResult) {
    lastSVG = '';
    document.getElementById('svgOutput').innerHTML = '';
    document.getElementById('svgContainer').style.display = 'none';
    emptyEl.innerHTML = '<div class="empty-icon">⬡</div><div class="empty-text">Configure &amp; Generate</div>';
    emptyEl.style.display = 'flex';
    return;
  }

  if (effectiveCandidates.length === 0) {
    lastSVG = '';
    document.getElementById('svgOutput').innerHTML = '';
    document.getElementById('svgContainer').style.display = 'none';
    emptyEl.innerHTML =
      `<div class="empty-icon" style="opacity:.6">⊘</div>` +
      `<div class="empty-text" style="color:var(--amber)">` +
      (state.max_plates > 0
        ? `최대 플레이트 수 ${state.max_plates}개 제약으로<br>배열을 만들 수 없습니다`
        : `현재 제약 조건으로<br>배열을 만들 수 없습니다`) +
      `</div>`;
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.innerHTML = '<div class="empty-icon">⬡</div><div class="empty-text">Configure &amp; Generate</div>';

  const customRows = parseCustomRows();
  const customOffsets = parseRowOffsets();
  const p = {
    ...state,
    layout:      'auto',
    scale:       1.5,
    nickel_w_mm: 4.0,
    margin_mm:   8.0,
    gap_section: 36,
    rows:        (state.arrangement === 'custom') ? customRows    : undefined,
    row_offsets: (state.arrangement === 'custom') ? customOffsets : undefined,
    face: 'all',
  };

  if (effectiveCandidates.length > 0) {
    const idx  = Math.min(state.selected_ordering, effectiveCandidates.length - 1);
    const cand = effectiveCandidates[idx];
    if (cand && cand.groups) {
      p.cell_groups = cand.groups.map(g => g.cells);
      if (state.arrangement !== 'custom') {
        if (state.holder_cols != null || state.holder_rows != null) {
          const hC = getHolderCols(), hR = getHolderRows();
          const N = state.S * state.P;
          if (hC * hR >= N) {
            p.grid_cols = hC;
            p.grid_rows = hR;
          }
        }
      }
    }
  }

  try {
    lastSVG = render(p);
  } catch (err) {
    console.error('[_renderSVG] render failed:', err);
    lastSVG = `<svg width="100%" viewBox="0 0 420 80"><rect width="100%" height="100%" fill="#181c27"/>` +
      `<text x="20" y="46" fill="#e74c3c" font-family="Arial" font-size="12">렌더 오류: ${err.message}</text></svg>`;
  }

  applyFaceFilter();
  fixSVGSize();
  addBmsMarkerToDOM();
  updateHolderUI();

  emptyEl.style.display = 'none';
  document.getElementById('svgContainer').style.display = 'block';
}

// Generate Layout 버튼 전용: 현재 옵션 그대로 후보 재열거 + SVG 재렌더
async function generateLayout() {
  if (state.arrangement === 'custom') {
    await _runCustomSearch();
  } else {
    populateCandidatePanel();
  }
  _renderSVG();
}

// ── 통합 진입점: rerender() — 후보 재열거 + SVG 재렌더 ──────────
// 커스텀 배열은 _enumResult 캐시를 표시 (탐색 재실행 없음)
function rerender() {
  populateCandidatePanel();
  _renderSVG();
}

// ── 커스텀 배열 전용 10초 탐색 (Generate 버튼에서만 호출) ────────
async function _runCustomSearch() {
  const { S, P, icc1, icc2, icc3, nickel_w_mm, b_plus_side, b_minus_side } = state;
  const listEl  = document.getElementById('candList');
  const countEl = document.getElementById('rpCandCount');
  const titleEl = document.getElementById('rpCandTitle');
  const genBtn  = document.querySelector('.render-btn');

  const customRows    = parseCustomRows();
  const customOffsets = parseRowOffsets();
  if (!customRows.length || typeof Generator === 'undefined' || typeof CELL_SPEC === 'undefined') {
    _enumResult = null;
    _updateEnumStatus(null);
    if (listEl) listEl.innerHTML = '<div class="hint" style="color:var(--dt3);margin-top:4px">커스텀 배열 — 행 구성을 입력하세요</div>';
    if (countEl) countEl.textContent = '—';
    return;
  }
  const customParams = {
    ...state,
    layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0,
    rows: customRows, row_offsets: customOffsets,
  };
  let customPts, customPitch;
  try {
    const cc = Generator.calcCustomCenters(customRows, customParams, CELL_SPEC);
    customPts = cc.pts; customPitch = cc.pitch;
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div class="hint" style="color:var(--red)">커스텀 좌표 오류: ${e.message}</div>`;
    if (countEl) countEl.textContent = '오류';
    if (titleEl) titleEl.textContent = '셀 배열 후보';
    _enumResult = null; _updateEnumStatus(null);
    return;
  }

  // 탐색 시작 — 버튼 비활성화 + 로딩 표시
  if (genBtn) genBtn.disabled = true;
  if (titleEl) titleEl.textContent = '셀 배열 후보 탐색중…';
  if (countEl) countEl.textContent = '…';
  if (listEl) listEl.innerHTML = '<div class="hint" style="margin-top:6px;color:var(--dt3)">후보를 탐색하고 있습니다…</div>';

  // 두 프레임 대기 → 브라우저 실제 repaint 보장
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  let result;
  try {
    result = Generator.enumerateGroupAssignments({
      cells: customPts, S, P, arrangement: 'custom',
      b_plus_side, b_minus_side,
      icc1, icc2, icc3,
      nickel_w: nickel_w_mm * 1.5,
      max_candidates: 40,
      g0_anchor: state.g0_anchor,
      allow_I: state.allow_I,
      allow_U: state.allow_U,
      pitch: customPitch,
    });
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div class="hint" style="color:var(--red)">열거 오류: ${e.message}</div>`;
    if (countEl) countEl.textContent = '오류';
    _enumResult = null; _updateEnumStatus(null);
    if (titleEl) titleEl.textContent = '셀 배열 후보';
    if (genBtn) genBtn.disabled = false;
    return;
  }

  if (titleEl) titleEl.textContent = '셀 배열 후보';
  if (genBtn) genBtn.disabled = false;
  _enumResult = result;
  _updateEnumStatus(result);
  _renderCustomCandidates(result);
}

// 커스텀 배열 후보 목록 렌더링 (캐시 결과 사용)
function _renderCustomCandidates(result) {
  const listEl  = document.getElementById('candList');
  const countEl = document.getElementById('rpCandCount');
  const { S } = state;
  if (!listEl) return;
  if (!result) {
    listEl.innerHTML = '<div class="hint" style="color:var(--dt3);margin-top:8px">Generate Layout을 눌러 후보를 탐색하세요</div>';
    if (countEl) countEl.textContent = '—';
    _showCandDetail(-1);
    return;
  }
  let candidates = result.candidates || [];
  if (state.max_plates && state.max_plates > 0)
    candidates = candidates.filter(c => _countDistinctShapes(c) <= state.max_plates);
  candidates = candidates.slice().sort((a, b) => _countDistinctShapes(a) - _countDistinctShapes(b));
  if (countEl) countEl.textContent = candidates.length + '개';
  listEl.innerHTML = '';
  if (candidates.length === 0) {
    listEl.innerHTML = '<div class="hint" style="margin-top:4px;color:var(--amber)">현재 제약으로 유효 후보 없음<br>ICC/B± 조건을 완화해보세요</div>';
    _showCandDetail(-1);
    return;
  }
  if (state.selected_ordering >= candidates.length) state.selected_ordering = 0;
  _renderCandCards(candidates, listEl, S);
  _showCandDetail(state.selected_ordering);
}

// ── 우측 패널 제어 ────────────────────────────────

function toggleICC(key) {
  state[key] = !state[key];
  const ids = { icc1: 'togICC1', icc2: 'togICC2', icc3: 'togICC3' };
  const el  = document.getElementById(ids[key]);
  if (el) el.classList.toggle('on', state[key]);
  state.selected_ordering = 0;
}

// ★ Phase 2: G0 앵커 (1번 셀 위치) 제약 핸들러
function setG0Anchor(mode) {
  state.g0_anchor = (mode === 'auto') ? null : mode;
  state.selected_ordering = 0;
}

// ★ Phase 4: pentomino 도형 허용 토글
function toggleAllowShape(key) {
  state[key] = !state[key];
  const elId = key === 'allow_I' ? 'togAllowI' : 'togAllowU';
  const el = document.getElementById(elId);
  if (el) el.classList.toggle('on', state[key]);
  state.selected_ordering = 0;
}

function setMaxPlates(val) {
  const n = parseInt(val, 10);
  state.max_plates = (isNaN(n) || n <= 0) ? 0 : n;
  const el = document.getElementById('valMaxPlates');
  if (el) el.value = state.max_plates === 0 ? 0 : state.max_plates;
  state.selected_ordering = 0;
  rerender();
}

function adjNickelW(d) {
  state.nickel_w_mm = Math.max(1.0, Math.min(12.0, +(state.nickel_w_mm + d).toFixed(1)));
  const el = document.getElementById('valNickelW');
  if (el) el.textContent = state.nickel_w_mm.toFixed(1);
}

function selectCandidate(idx) {
  state.selected_ordering = idx;
  document.querySelectorAll('.cand-card').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });
  _showCandDetail(idx);
  _renderSVG();
}

// ── 배열 후보 패널 (H3/H4) ──────────────────────────
// enumerateGroupAssignments(Generator)를 사용하여 실제 후보 열거

// 홀더 그리드 셀 반환
// 홀더가 설정된 경우: buildHolderGrid → N개로 trim (여분 슬롯은 빈 칸)
// 홀더 auto: calcCellCenters(S,P) 기본 배열
function _getHolderCells() {
  const N = state.S * state.P;
  const params = { ...state, layout: 'auto', scale: 1.5, nickel_w_mm: state.nickel_w_mm, margin_mm: 8.0 };
  try {
    const hR = getHolderRows(), hC = getHolderCols();
    if (hR * hC < N) return null;
    // 홀더가 설정된 경우 홀더 격자(hC×hR) 기준 좌표·row/col 사용
    // → renderCustomGrid gridMap과 row/col이 일치하여 그룹 주입 성공
    const gridCols = (state.holder_cols != null || state.holder_rows != null) ? hC : state.S;
    const gridRows = (state.holder_cols != null || state.holder_rows != null) ? hR : state.P;
    const { cx, cy } = calcCellCenters(gridCols, gridRows, params);
    const cells = [];
    for (let i = 0; i < N; i++) {
      const r = Math.floor(i / gridCols);
      const c = i % gridCols;
      cells.push({ x: cx[c][r], y: cy[r], row: r, col: c });
    }
    return cells;
  } catch (e) { return null; }
}

let _enumResult = null;   // 마지막 enumerateGroupAssignments 결과

// ★ Phase 3a: 제약 1개씩 해제 재열거 → 복구 CTA 후보 생성
function _probeRelief(cfg) {
  if (typeof Generator === 'undefined') return [];
  const { cells, S, P, arrangement, b_plus_side, b_minus_side, icc1, icc2, icc3, nickel_w_mm } = cfg;
  const baseArgs = {
    cells, S, P, arrangement,
    b_plus_side, b_minus_side,
    nickel_w: nickel_w_mm * 1.5,
    max_candidates: 10,
  };
  const out = [];

  // max_plates 제약이 원인인 경우 최우선 안내 (재열거 없이 즉시 확인 가능)
  if (state.max_plates > 0) {
    const mMin = estimateMmin(S, P, arrangement, state.allow_mirror);
    if (mMin > state.max_plates) {
      out.push({
        label: `최대 형상 종류 해제 (최소 ${mMin}종 필요)`,
        action: 'setMaxPlates(0)',
        count: -1,   // 특별값: 재열거 없이 삽입
      });
    }
  }

  const trials = [];
  if (icc1) trials.push({ args: { ...baseArgs, icc1: false, icc2, icc3, g0_anchor: state.g0_anchor },
                          label: 'ICC① 해제', action: "toggleICC('icc1')" });
  if (icc2) trials.push({ args: { ...baseArgs, icc1, icc2: false, icc3, g0_anchor: state.g0_anchor },
                          label: 'ICC② 해제', action: "toggleICC('icc2')" });
  if (icc3) trials.push({ args: { ...baseArgs, icc1, icc2, icc3: false, g0_anchor: state.g0_anchor },
                          label: 'ICC③ 해제', action: "toggleICC('icc3')" });
  if (state.g0_anchor) trials.push({ args: { ...baseArgs, icc1, icc2, icc3, g0_anchor: null },
                                     label: '1번 셀 위치 자동', action: "setG0Anchor('auto')" });
  for (const t of trials) {
    let n = 0;
    try {
      const r = Generator.enumerateGroupAssignments({ ...t.args });
      n = (r.candidates || []).length;
    } catch (_) { n = 0; }
    if (n > 0) out.push({ label: t.label, action: t.action, count: n });
  }
  // max_plates 항목은 이미 맨앞에 삽입됨 — count=-1은 표시 시 후보 수 미표시 처리
  const maxPlatesEntry = out.find(x => x.count === -1);
  const rest = out.filter(x => x.count !== -1).sort((a, b) => b.count - a.count).slice(0, 3);
  return maxPlatesEntry ? [maxPlatesEntry, ...rest].slice(0, 3) : rest.slice(0, 3);
}

function _renderCandCards(candidates, listEl, S) {
  listEl.innerHTML = '';
  candidates.forEach((cand, idx) => {
    const groups  = cand.groups || [];
    const posN    = groups.filter(g => g.quality_score > 0).length;
    const negN    = groups.filter(g => g.quality_score < 0).length;
    const isSel   = idx === state.selected_ordering;

    const scoreStr = groups.slice(0, 6)
      .map(g => g.quality_score > 0 ? '+10' : g.quality_score < 0 ? '−10' : ' 0 ')
      .join(' ') + (S > 6 ? ' …' : '');

    const badgeClass = posN > 0 && negN === 0 ? 'pos' : negN > 0 ? 'neg' : 'zero';
    const badgeText  = posN > 0 && negN === 0 ? `${posN}×+10`
                     : negN > 0               ? `${negN}×−10`
                     : 'neutral';

    const bTag   = cand.b_plus_ok && cand.b_minus_ok ? '' :
      ` <span style="color:var(--amber);font-size:8px">B±?</span>`;
    const iccTag = (cand.icc_violations || 0) > 0 ?
      ` <span style="color:var(--amber);font-size:8px">ICC✗${cand.icc_violations}</span>` : '';
    const label  = cand.name || `후보 ${idx + 1}`;

    let shapeTag = '';
    if (cand.is_pentomino) {
      shapeTag = ` <span style="background:#2A3E66;color:rgba(255,255,255,.65);font-size:8px;padding:1px 4px;border-radius:3px">${cand.name}</span>`;
    } else if (cand.is_standard) {
      shapeTag = ` <span style="background:var(--bg2);color:var(--dt3);font-size:8px;padding:1px 4px;border-radius:3px">snake</span>`;
    }

    const rowSpans = groups.map(g => {
      const rs = (g.cells || []).map(c => c.row).filter(v => typeof v === 'number');
      return rs.length ? (Math.max(...rs) - Math.min(...rs) + 1) : 1;
    });
    const avgRS    = rowSpans.length ? (rowSpans.reduce((a, b) => a + b, 0) / rowSpans.length) : 1;
    const maxRS    = rowSpans.length ? Math.max(...rowSpans) : 1;
    const tyN      = groups.filter(g => g.has_TY).length;
    const totalQS  = groups.reduce((s, g) => s + (g.quality_score || 0), 0);
    const sigmaStyle = cand.is_pentomino
      ? 'font-weight:700;color:#86efac;font-size:11px'
      : 'color:#4ADE80';
    const platesVal = _countDistinctShapes(cand);
    const statBits = [
      `<span style="${sigmaStyle}">Σ ${totalQS >= 0 ? '+' : ''}${totalQS}</span>`,
      `<span style="color:#ffffff">플레이트 ${platesVal}개</span>`,
      `행스팬 평균 ${avgRS.toFixed(1)}/최대 ${maxRS}`,
      ...(tyN > 0 ? [`<span style="color:var(--amber)">T/Y ${tyN}</span>`] : []),
    ];

    const card = document.createElement('div');
    card.className = 'cand-card' + (isSel ? ' selected' : '');
    card.onclick   = () => selectCandidate(idx);
    card.innerHTML =
      `<div class="cand-hdr">` +
        `<span class="cand-name">${label}${shapeTag}${bTag}${iccTag}</span>` +
        `<span class="score-chip ${badgeClass}">${badgeText}</span>` +
      `</div>` +
      `<div class="cand-scores">${scoreStr}</div>` +
      `<div class="cand-stat" style="font-size:9px;color:var(--dt3);margin-top:3px;display:flex;gap:6px;flex-wrap:wrap">${statBits.join(' · ')}</div>`;
    listEl.appendChild(card);
  });
}

function populateCandidatePanel() {
  const { S, P, arrangement, icc1, icc2, icc3, nickel_w_mm, b_plus_side, b_minus_side } = state;
  const listEl  = document.getElementById('candList');
  const countEl = document.getElementById('rpCandCount');
  if (!listEl) return;

  // hintTotalPlates: 이 S 기준 총 플레이트 수 힌트 업데이트
  const hintTP = document.getElementById('hintTotalPlates');
  if (hintTP) hintTP.textContent = S + 1;

  const hasGen = typeof Generator !== 'undefined';

  // 커스텀 배열: _enumResult 캐시 표시 (탐색은 generateLayout/_runCustomSearch에서만)
  if (arrangement === 'custom') {
    const customRows = parseCustomRows();
    if (!customRows.length || !hasGen || typeof CELL_SPEC === 'undefined') {
      listEl.innerHTML = '<div class="hint" style="color:var(--dt3);margin-top:4px">커스텀 배열 — 행 구성을 입력하세요</div>';
      if (countEl) countEl.textContent = '—';
      _enumResult = null;
      _updateEnumStatus(null);
      return;
    }
    _renderCustomCandidates(_enumResult);
    return;
  }

  if (!hasGen) {
    listEl.innerHTML = '<div class="hint">Generator 미로드</div>';
    if (countEl) countEl.textContent = '—';
    return;
  }

  const cells = _getHolderCells();
  if (!cells || cells.length === 0) {
    const hR = getHolderRows(), hC = getHolderCols();
    const N = state.S * state.P;
    const slots = hR * hC;
    listEl.innerHTML = slots < N
      ? `<div class="hint" style="color:var(--red)">⚠ 홀더 슬롯 부족: ${hR}×${hC}=${slots} < ${N}셀<br>행×열이 ${N} 이상이어야 합니다</div>`
      : '<div class="hint">셀 데이터 없음</div>';
    if (countEl) countEl.textContent = '—';
    _enumResult = null;
    _updateEnumStatus(null);
    _showCandDetail(-1);
    return;
  }

  // 열거기 실행
  let result;
  try {
    result = Generator.enumerateGroupAssignments({
      cells, S, P, arrangement,
      b_plus_side, b_minus_side,
      icc1, icc2, icc3,
      nickel_w: nickel_w_mm * 1.5,  // scale 반영 근사
      max_candidates: 40,
      g0_anchor: state.g0_anchor,   // ★ Phase 2: 1번 셀 위치 제약
      allow_I: state.allow_I,       // ★ Phase 4: I-pentomino 허용
      allow_U: state.allow_U,       // ★ Phase 4: U-pentomino 허용
    });
  } catch (e) {
    listEl.innerHTML = `<div class="hint" style="color:var(--red)">열거 오류: ${e.message}</div>`;
    if (countEl) countEl.textContent = '오류';
    return;
  }

  _enumResult = result;
  _updateEnumStatus(result);

  let candidates = result.candidates || [];
  // ★ max_plates 필터: 고유 형상(금형) 종류 수 ≤ state.max_plates
  if (state.max_plates && state.max_plates > 0) {
    candidates = candidates.filter(c => _countDistinctShapes(c) <= state.max_plates);
  }
  candidates = candidates.slice().sort((a, b) => _countDistinctShapes(a) - _countDistinctShapes(b));
  if (countEl) countEl.textContent = candidates.length + '개';

  listEl.innerHTML = '';
  if (candidates.length === 0) {
    // ★ Phase 3a: 각 제약을 1개씩 해제 재열거 → 가장 많이 복구되는 것을 CTA로 제시
    const reliefs = _probeRelief({ cells, S, P, arrangement, b_plus_side, b_minus_side, icc1, icc2, icc3, nickel_w_mm });
    const baseHint = '<div class="hint" style="margin-top:4px;color:var(--amber)">현재 제약으로 유효 후보 없음</div>';
    if (reliefs.length === 0) {
      listEl.innerHTML = baseHint + '<div class="hint" style="margin-top:4px">ICC/앵커/B± 중 하나를 해제하세요</div>';
    } else {
      const btns = reliefs.map(r =>
        `<button onclick="${r.action}" style="display:block;width:100%;margin-top:4px;padding:5px 6px;background:var(--bg2);color:var(--dt1);border:1px solid var(--amber);border-radius:3px;font-size:10px;text-align:left;cursor:pointer">` +
        `${r.label}` +
        (r.count > 0 ? ` <span style="color:var(--amber)">→ 후보 ${r.count}개 복구</span>` : '') +
        `</button>`
      ).join('');
      listEl.innerHTML = baseHint + btns;
    }
    _showCandDetail(-1);
    return;
  }

  if (state.selected_ordering >= candidates.length) state.selected_ordering = 0;
  _renderCandCards(candidates, listEl, S);
  _showCandDetail(state.selected_ordering);
}

// 열거 상태 표시 (strategy / iterations)
function _updateEnumStatus(result) {
  const el = document.getElementById('rpEnumStatus');
  if (!el) return;
  if (!result) { el.textContent = ''; return; }
  const stratLabel = { backtracking: 'BT', beam: 'Beam', heuristic: 'Heuristic', none: '—' };
  const s = result.strategy || 'none';
  const iter = result.iterations_used ? `${(result.iterations_used / 1000).toFixed(1)}k` : '';
  el.textContent = `${stratLabel[s] || s}  ${iter}${result.max_iter_hit ? ' !' : ''}`;
}

function _showCandDetail(idx) {
  const detailEl = document.getElementById('candDetail');
  const divEl    = document.getElementById('rpDetailDivider');
  const boxEl    = document.getElementById('candDetailBox');
  if (!detailEl || !boxEl) return;

  const cand = _enumResult && _enumResult.candidates && _enumResult.candidates[idx];
  if (!cand) {
    detailEl.style.display = 'none';
    if (divEl) divEl.style.display = 'none';
    return;
  }

  const groups  = cand.groups || [];
  const posN    = groups.filter(g => g.quality_score > 0).length;
  const negN    = groups.filter(g => g.quality_score < 0).length;
  const neutral = groups.length - posN - negN;

  detailEl.style.display = 'block';
  if (divEl) divEl.style.display = 'block';

  const r = _enumResult;
  boxEl.innerHTML =
    `<div class="info-title">${cand.name || '후보 ' + (idx + 1)}</div>` +
    `<div class="row"><span class="key">총 그룹</span><span class="val">${groups.length}개</span></div>` +
    `<div class="row"><span class="key">총합 점수</span><span class="val ${cand.total_score > 0 ? 'green' : ''}">${cand.total_score >= 0 ? '+' : ''}${cand.total_score}</span></div>` +
    `<div class="row"><span class="key">+10 컴팩트</span><span class="val green">${posN}개</span></div>` +
    `<div class="row"><span class="key">−10 T/Y형</span><span class="val" style="color:#F87171">${negN}개</span></div>` +
    `<div class="row"><span class="key">0 체인형</span><span class="val">${neutral}개</span></div>` +
    `<div class="divider"></div>` +
    `<div class="info-title">열거 정보</div>` +
    `<div class="row"><span class="key">전략</span><span class="val">${r.strategy || '—'}</span></div>` +
    `<div class="row"><span class="key">반복수</span><span class="val">${r.iterations_used || 0}</span></div>` +
    `<div class="row"><span class="key">B+ 충족</span><span class="val ${cand.b_plus_ok ? 'green' : ''}">${cand.b_plus_ok ? '✓' : '✗'} (${r.boundary_plus_count || 0}셀)</span></div>` +
    `<div class="row"><span class="key">B− 충족</span><span class="val ${cand.b_minus_ok ? 'green' : ''}">${cand.b_minus_ok ? '✓' : '✗'} (${r.boundary_minus_count || 0}셀)</span></div>` +
    `<div class="divider"></div>` +
    `<div class="info-title">ICC 제약</div>` +
    `<div class="row"><span class="key">ICC①</span><span class="val">${state.icc1 ? '행스팬≤2' : '비활성'}</span></div>` +
    `<div class="row"><span class="key">ICC②</span><span class="val">${state.icc2 ? '종횡비≤2.0' : '비활성'}</span></div>` +
    `<div class="row"><span class="key">ICC③</span><span class="val">${state.icc3 ? '볼록≥0.75' : '비활성'}</span></div>`;
}

// ── SVG 다운로드 ──────────────────────────────────
function downloadSVG() {
  if (!lastSVG) return;
  const blob = new Blob([lastSVG], { type: 'image/svg+xml' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `${state.S}s${state.P}p_${state.cell_type}_${state.arrangement}.svg`;
  a.click();
}

// F24: PNG 내보내기 — SVG → Canvas(2×) → PNG
function downloadPNG() {
  if (!lastSVG) return;
  const svgEl = document.querySelector('#svgOutput svg');
  const vb    = svgEl ? svgEl.getAttribute('viewBox') : null;
  let vbW = 800, vbH = 600;
  if (vb) { const p = vb.split(' ').map(Number); vbW = p[2] || 800; vbH = p[3] || 600; }
  const scale  = 2;
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(vbW * scale);
  canvas.height = Math.round(vbH * scale);
  const ctx    = canvas.getContext('2d');
  const blob   = new Blob([lastSVG], { type: 'image/svg+xml;charset=utf-8' });
  const url    = URL.createObjectURL(blob);
  const img    = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const a    = document.createElement('a');
    a.download = `${state.S}s${state.P}p_${state.cell_type}_${state.arrangement}.png`;
    a.href     = canvas.toDataURL('image/png');
    a.click();
  };
  img.src = url;
}

// ── 후보 카드 키보드 내비게이션 (↑↓) ────────────────
document.addEventListener('keydown', function(e) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const cards = document.querySelectorAll('.cand-card');
  if (!cards.length) return;
  e.preventDefault();
  const total = cards.length;
  let next = state.selected_ordering + (e.key === 'ArrowDown' ? 1 : -1);
  next = Math.max(0, Math.min(total - 1, next));
  if (next === state.selected_ordering) return;
  selectCandidate(next);
  cards[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

// ── 초기 렌더 ─────────────────────────────────────
rerender();
