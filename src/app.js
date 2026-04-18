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
  S:               3,
  P:               3,
  gap:             0.0,   // ★ 원칙: gap=0 (셀 맞닿음) — renderer.js 기본값과 동일
  arrangement:     'square',
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
};
let lastSVG = '';

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
function parseCustomRows() {
  const raw = document.getElementById('customRows').value.trim();
  return raw.split(/[,\n\s]+/).map(s => parseInt(s, 10)).filter(n => Number.isFinite(n) && n > 0);
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
  document.getElementById('rectConfig').style.display      = 'block';
  document.getElementById('customGroup').style.display     = isCustom ? 'block' : 'none';
  document.getElementById('holderSizeGroup').style.display = isCustom ? 'none'  : 'block';
  if (isCustom) checkCustomConsistency();
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
  // 엇배열 ON일 때만 방향 선택 표시
  const dirGroup = document.getElementById('stagDirGroup');
  if (dirGroup) dirGroup.style.display = state.custom_stagger ? 'block' : 'none';
}

function setCustomStaggerDir(d) {
  state.custom_stagger_dir = d;
  document.getElementById('btnStagL')?.classList.toggle('active', d === 'L');
  document.getElementById('btnStagR')?.classList.toggle('active', d === 'R');
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
  // 범위 벗어난 경우 입력칸 값도 정규화
  const el = document.getElementById('val' + k);
  if (el && parseInt(el.value, 10) !== state[k]) el.value = state[k];
  checkCustomConsistency();
}

// ── H1 홀더 크기 제어 ─────────────────────────────
function getHolderRows() { return state.holder_rows != null ? state.holder_rows : state.P; }
function getHolderCols() { return state.holder_cols != null ? state.holder_cols : state.S; }

function adjHolder(dim, d) {
  if (dim === 'rows') {
    const cur = state.holder_rows != null ? state.holder_rows : state.P;
    const nxt = Math.max(1, cur + d);
    state.holder_rows = (nxt === state.P) ? null : nxt;
  } else {
    const cur = state.holder_cols != null ? state.holder_cols : state.S;
    const nxt = Math.max(1, cur + d);
    state.holder_cols = (nxt === state.S) ? null : nxt;
  }
  updateHolderUI();
  state.selected_ordering = 0;
  if (lastSVG) rerender();
  else populateCandidatePanel();
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
  if (lastSVG) rerender();
  else populateCandidatePanel();
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
  const p = {
    ...state,
    layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0, gap_section: 36,
    rows: (state.arrangement === 'custom') ? customRows : undefined,
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

// ── SVG를 viewBox 자연 크기로 고정 ─────────────────
function fixSVGSize() {
  const svgEl = document.querySelector('#svgOutput svg');
  if (!svgEl) return;
  const vb = svgEl.getAttribute('viewBox');
  if (!vb) return;
  const [, , w, h] = vb.split(' ').map(Number);
  svgEl.setAttribute('width',  Math.ceil(w) + 'px');
  svgEl.setAttribute('height', Math.ceil(h) + 'px');
  svgEl.style.cssText = 'max-width:100%;height:auto;display:block;';
}

// ── 통합 진입점: rerender() (M5 — doRender 제거, 유일 진입점) ────
//   모든 배열(square·staggered·custom)을 renderer.render() 한 곳에서 처리.
//   F14 덕분에 custom 배열도 renderer가 직접 렌더.
//   [M5 완료] doRender() 삭제. HTML onclick 및 초기 호출 모두 rerender()로 통일.
function rerender() {
  updateInfoBox();
  // ★ populate를 앞으로 이동 → _enumResult가 render() 호출 전에 준비됨
  populateCandidatePanel();

  const customRows = parseCustomRows();
  const p = {
    ...state,
    layout:       'auto',
    scale:        1.5,
    nickel_w_mm:  4.0,
    margin_mm:    8.0,
    gap_section:  36,
    // custom 배열일 때 rows 배열을 renderer.render()로 직접 전달 (F14)
    rows: (state.arrangement === 'custom') ? customRows : undefined,
    face: 'all',
  };

  // ★ 우측 패널 선택 후보를 렌더에 주입 (square/staggered only)
  if (state.arrangement !== 'custom' && _enumResult && _enumResult.candidates && _enumResult.candidates.length > 0) {
    const cand = _enumResult.candidates[state.selected_ordering];
    if (cand && cand.groups) {
      p.cell_groups = cand.groups.map(g => g.cells);
      p.grid_cols = getHolderCols();
      p.grid_rows = getHolderRows();
    }
  }

  try {
    lastSVG = render(p);
  } catch (err) {
    console.error('[rerender] render failed:', err);
    lastSVG = `<svg width="100%" viewBox="0 0 420 80"><rect width="100%" height="100%" fill="#181c27"/>`
      + `<text x="20" y="46" fill="#e74c3c" font-family="Arial" font-size="12">렌더 오류: ${err.message}</text></svg>`;
  }

  applyFaceFilter();
  fixSVGSize();
  addBmsMarkerToDOM();
  updateHolderUI();

  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('svgContainer').style.display = 'block';
}

// ── 우측 패널 제어 ────────────────────────────────

function toggleICC(key) {
  state[key] = !state[key];
  const ids = { icc1: 'togICC1', icc2: 'togICC2', icc3: 'togICC3' };
  const el  = document.getElementById(ids[key]);
  if (el) el.classList.toggle('on', state[key]);
  state.selected_ordering = 0;   // 새 제약 → 1번 카드로 리셋
  if (lastSVG) rerender();       // 이미 1회 이상 렌더했다면 메인 SVG 즉시 갱신
  else populateCandidatePanel(); // 첫 Generate 전이면 패널만
}

// ★ Phase 2: G0 앵커 (1번 셀 위치) 제약 핸들러
function setG0Anchor(mode) {
  state.g0_anchor = (mode === 'auto') ? null : mode;
  state.selected_ordering = 0;  // 새 제약으로 후보 재생성 → 첫 카드로 리셋
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
  rerender();
}

// ── 배열 후보 패널 (H3/H4) ──────────────────────────
// enumerateGroupAssignments(Generator)를 사용하여 실제 후보 열거

// 홀더 그리드 셀 반환 (holder_rows × holder_cols, 빈 슬롯 제외)
function _getHolderCells() {
  const hR = getHolderRows(), hC = getHolderCols();
  const params = { ...state, layout: 'auto', scale: 1.5, nickel_w_mm: state.nickel_w_mm, margin_mm: 8.0 };
  try {
    if (typeof Generator !== 'undefined' && typeof CELL_SPEC !== 'undefined') {
      return Generator.buildHolderGrid(hR, hC, state.arrangement, state.holder_empty, params, CELL_SPEC);
    }
    // fallback: calcCellCenters (P×S 기본 배열)
    const { cx, cy } = calcCellCenters(state.S, state.P, params);
    const cells = [];
    for (let p = 0; p < state.P; p++)
      for (let s = 0; s < state.S; s++)
        cells.push({ x: cx[s][p], y: cy[p] });
    return cells;
  } catch (_) { return null; }
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
  const trials = [];
  if (icc1) trials.push({ args: { ...baseArgs, icc1: false, icc2, icc3, g0_anchor: state.g0_anchor },
                          label: 'ICC① 해제', action: "toggleICC('icc1')" });
  if (icc2) trials.push({ args: { ...baseArgs, icc1, icc2: false, icc3, g0_anchor: state.g0_anchor },
                          label: 'ICC② 해제', action: "toggleICC('icc2')" });
  if (icc3) trials.push({ args: { ...baseArgs, icc1, icc2, icc3: false, g0_anchor: state.g0_anchor },
                          label: 'ICC③ 해제', action: "toggleICC('icc3')" });
  if (state.g0_anchor) trials.push({ args: { ...baseArgs, icc1, icc2, icc3, g0_anchor: null },
                                     label: '1번 셀 위치 자동', action: "setG0Anchor('auto')" });
  const out = [];
  for (const t of trials) {
    let n = 0;
    try {
      const r = Generator.enumerateGroupAssignments({ ...t.args });
      n = (r.candidates || []).length;
    } catch (_) { n = 0; }
    if (n > 0) out.push({ label: t.label, action: t.action, count: n });
  }
  out.sort((a, b) => b.count - a.count);
  return out.slice(0, 3);
}

function populateCandidatePanel() {
  const { S, P, arrangement, icc1, icc2, icc3, nickel_w_mm, b_plus_side, b_minus_side } = state;
  const listEl  = document.getElementById('candList');
  const countEl = document.getElementById('rpCandCount');
  if (!listEl) return;

  const hasGen = typeof Generator !== 'undefined';

  // 커스텀 배열: 단일 BFS 후보 (열거기 미지원)
  if (arrangement === 'custom') {
    listEl.innerHTML = '<div class="hint" style="color:var(--dt3);margin-top:4px">커스텀 배열<br>BFS 자동 순서 적용</div>';
    if (countEl) countEl.textContent = '1개';
    _enumResult = null;
    const detailEl = document.getElementById('candDetail');
    if (detailEl) detailEl.style.display = 'none';
    const divEl = document.getElementById('rpDetailDivider');
    if (divEl) divEl.style.display = 'none';
    _updateEnumStatus(null);
    return;
  }

  if (!hasGen) {
    listEl.innerHTML = '<div class="hint">Generator 미로드</div>';
    if (countEl) countEl.textContent = '—';
    return;
  }

  const cells = _getHolderCells();
  if (!cells || cells.length === 0) {
    listEl.innerHTML = '<div class="hint">셀 데이터 없음</div>';
    if (countEl) countEl.textContent = '—';
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
      max_candidates: 20,
      g0_anchor: state.g0_anchor,   // ★ Phase 2: 1번 셀 위치 제약
    });
  } catch (e) {
    listEl.innerHTML = `<div class="hint" style="color:var(--red)">열거 오류: ${e.message}</div>`;
    if (countEl) countEl.textContent = '오류';
    return;
  }

  _enumResult = result;
  _updateEnumStatus(result);

  const candidates = result.candidates || [];
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
        `${r.label} <span style="color:var(--amber)">→ 후보 ${r.count}개 복구</span></button>`
      ).join('');
      listEl.innerHTML = baseHint + btns;
    }
    _showCandDetail(-1);
    return;
  }

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

    const bTag = cand.b_plus_ok && cand.b_minus_ok ? '' :
      ` <span style="color:var(--amber);font-size:8px">B±?</span>`;
    const iccTag = (cand.icc_violations || 0) > 0 ?
      ` <span style="color:var(--amber);font-size:8px">ICC✗${cand.icc_violations}</span>` : '';
    const label  = cand.name || `후보 ${idx + 1}`;

    // ★ Phase 3b: 평균 rowSpan + T/Y 분기 하단 요약
    const rowSpans = groups.map(g => {
      const rows = (g.cells || []).map(c => c.row).filter(v => typeof v === 'number');
      return rows.length ? (Math.max(...rows) - Math.min(...rows) + 1) : 1;
    });
    const avgRS   = rowSpans.length ? (rowSpans.reduce((a, b) => a + b, 0) / rowSpans.length) : 1;
    const maxRS   = rowSpans.length ? Math.max(...rowSpans) : 1;
    const tyN     = groups.filter(g => g.has_TY).length;
    const totalQS = groups.reduce((s, g) => s + (g.quality_score || 0), 0);
    const statBits = [
      `Σ ${totalQS >= 0 ? '+' : ''}${totalQS}`,
      `행스팬 평균 ${avgRS.toFixed(1)}/최대 ${maxRS}`,
      ...(tyN > 0 ? [`<span style="color:var(--amber)">T/Y ${tyN}</span>`] : []),
    ];

    const card = document.createElement('div');
    card.className = 'cand-card' + (isSel ? ' selected' : '');
    card.onclick   = () => selectCandidate(idx);
    card.innerHTML =
      `<div class="cand-hdr">` +
        `<span class="cand-name">${label}${bTag}${iccTag}</span>` +
        `<span class="score-chip ${badgeClass}">${badgeText}</span>` +
      `</div>` +
      `<div class="cand-scores">${scoreStr}</div>` +
      `<div class="cand-desc">${cand.desc || ''}</div>` +
      `<div class="cand-stat" style="font-size:9px;color:var(--dt3);margin-top:3px;display:flex;gap:6px;flex-wrap:wrap">${statBits.join(' · ')}</div>`;
    listEl.appendChild(card);
  });

  // selected_ordering이 범위를 벗어나면 0번으로 리셋
  if (state.selected_ordering >= candidates.length) state.selected_ordering = 0;
  // 카드 하이라이트 + 상세 패널
  document.querySelectorAll('.cand-card').forEach((el, i) => {
    el.classList.toggle('selected', i === state.selected_ordering);
  });
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

// ── 초기 렌더 ─────────────────────────────────────
rerender();
