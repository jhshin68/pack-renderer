/**
 * app-ui.js — UI 컨트롤 핸들러
 * (browser-only, window 공유 스코프 — no exports)
 *
 * 의존: app-state.js (state, lastSVG, parseCustomRows, parseRowOffsets,
 *                     checkCustomConsistency, _enumResult)
 *       renderer.js (calcCellCenters — BMS 거리 계산)
 */

// ── UI 컨트롤 ─────────────────────────────────────────
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
