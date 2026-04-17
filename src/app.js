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
  document.getElementById('customGroup').style.display = (a === 'custom') ? 'block' : 'none';
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
  const { S, P, bms_edge, bms_pos } = state;
  const p = { ...state, layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0 };
  try {
    const { cx, cy, R } = calcCellCenters(S, P, p);
    const nw     = p.nickel_w_mm * p.scale;
    const margin = p.margin_mm * p.scale;
    let maxCx = 0;
    for (let q = 0; q < P; q++) if (cx[S - 1][q] > maxCx) maxCx = cx[S - 1][q];
    const faceW  = maxCx + R + margin + nw * 2;
    const faceH  = cy[P - 1] + R + margin + 40;
    const midP   = Math.floor(P / 2);
    // 각 그룹 중간 셀 좌표
    const bpX    = cx[0][midP];
    const bpY    = cy[midP];
    const bmX    = cx[S - 1][midP];
    const bmY    = cy[midP];
    // BMS 위치 (팩 경계 위의 한 점)
    let bmsX = 0, bmsY = 0;
    if (bms_edge === 'top')    { bmsX = bms_pos * faceW; bmsY = 0; }
    if (bms_edge === 'bottom') { bmsX = bms_pos * faceW; bmsY = faceH; }
    if (bms_edge === 'left')   { bmsX = 0;               bmsY = bms_pos * faceH; }
    if (bms_edge === 'right')  { bmsX = faceW;            bmsY = bms_pos * faceH; }
    const sc     = p.scale;
    const distBp = Math.round((Math.abs(bpX - bmsX) + Math.abs(bpY - bmsY)) / sc);
    const distBm = Math.round((Math.abs(bmX - bmsX) + Math.abs(bmY - bmsY)) / sc);
    return { distBp, distBm, bmsX, bmsY, faceW, faceH, ok: true };
  } catch (_) {
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
  document.getElementById('val' + k).textContent = state[k];
  const sc = document.getElementById('valScustom');
  if (sc && k === 'S') sc.textContent = state.S;
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
  if (state.arrangement !== 'custom') {
    const bms = calcBmsDistances();
    if (bms.ok) {
      document.getElementById('iDistBp').textContent  = bms.distBp + ' mm';
      document.getElementById('iDistBm').textContent  = bms.distBm + ' mm';
      const tot   = bms.distBp + bms.distBm;
      const totEl = document.getElementById('iDistTotal');
      totEl.textContent = tot + ' mm';
      totEl.className   = 'val ' + (tot < 60 ? 'green' : tot < 120 ? '' : 'amber');
    }
  } else {
    ['iDistBp', 'iDistBm', 'iDistTotal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = '—'; el.className = 'val'; }
    });
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
  populateCandidatePanel();

  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('svgContainer').style.display = 'block';
}

// ── 우측 패널 제어 ────────────────────────────────

function toggleICC(key) {
  state[key] = !state[key];
  const ids = { icc1: 'togICC1', icc2: 'togICC2', icc3: 'togICC3' };
  const el  = document.getElementById(ids[key]);
  if (el) el.classList.toggle('on', state[key]);
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
}

// ── 배열 후보 패널 ─────────────────────────────────

// 행-우선(p=0..P-1, s=0..S-1) 플랫 셀 배열 반환
function _flatCells() {
  const { S, P, nickel_w_mm } = state;
  const params = { ...state, layout: 'auto', scale: 1.5, nickel_w_mm, margin_mm: 8.0 };
  try {
    const { cx, cy } = calcCellCenters(S, P, params);
    const cells = [];
    for (let p = 0; p < P; p++)
      for (let s = 0; s < S; s++)
        cells.push({ x: cx[s][p], y: cy[p] });
    return cells;
  } catch (_) { return null; }
}

// 보스트로페돈: startLTR=true → 0번 행 L→R, 1번 행 R→L, …
function _boustrophedonOrder(cells, S, P, startLTR) {
  const result = [];
  for (let p = 0; p < P; p++) {
    const row = cells.slice(p * S, (p + 1) * S);
    const ltr = startLTR ? (p % 2 === 0) : (p % 2 !== 0);
    result.push(...(ltr ? row : [...row].reverse()));
  }
  return result;
}

// 열 우선: s=0..S-1 (또는 역방향), 각 열 p=0..P-1
function _columnFirstOrder(cells, S, P, rtl) {
  const result = [];
  for (let si = 0; si < S; si++) {
    const s = rtl ? (S - 1 - si) : si;
    for (let p = 0; p < P; p++)
      result.push(cells[p * S + s]);
  }
  return result;
}

const _ORDERING_DEFS = [
  { name: '보스트로페돈 L→R', desc: '행 우선 · 짝수행 L→R' },
  { name: '보스트로페돈 R→L', desc: '행 우선 · 짝수행 R→L' },
  { name: '열 우선 L→R',      desc: '열 우선 · 좌열→우열' },
  { name: '열 우선 R→L',      desc: '열 우선 · 우열→좌열' },
];

let _candGroups = [];  // 마지막 계산된 후보별 그룹 품질 데이터

function populateCandidatePanel() {
  const { S, P, arrangement } = state;
  const listEl  = document.getElementById('candList');
  const countEl = document.getElementById('rpCandCount');
  if (!listEl) return;

  // 커스텀 배열: BFS 단일 후보만 지원
  if (arrangement === 'custom') {
    listEl.innerHTML =
      '<div class="hint" style="color:var(--dt3);margin-top:4px">커스텀 배열<br>BFS 자동 순서 적용</div>';
    if (countEl) countEl.textContent = '1개';
    _candGroups = [];
    const detailEl = document.getElementById('candDetail');
    if (detailEl) detailEl.style.display = 'none';
    const divEl = document.getElementById('rpDetailDivider');
    if (divEl) divEl.style.display = 'none';
    return;
  }

  const flatCells = _flatCells();
  if (!flatCells) {
    listEl.innerHTML = '<div class="hint">셀 데이터 없음</div>';
    if (countEl) countEl.textContent = '—';
    return;
  }

  const orderings = [
    _boustrophedonOrder(flatCells, S, P, true),
    _boustrophedonOrder(flatCells, S, P, false),
    _columnFirstOrder(flatCells, S, P, false),
    _columnFirstOrder(flatCells, S, P, true),
  ];

  if (countEl) countEl.textContent = orderings.length + '개';
  listEl.innerHTML = '';
  _candGroups = [];

  orderings.forEach((ordered, idx) => {
    // 각 그룹(P개 셀)의 품질 점수 계산
    const groups = [];
    const hasGen = typeof Generator !== 'undefined';
    for (let g = 0; g < S; g++) {
      const gc = ordered.slice(g * P, (g + 1) * P);
      let score = 0;
      if (hasGen && gc.length > 0) {
        try {
          const edges = Generator.buildAdjacency(gc, arrangement, null);
          score = Generator.groupQualityScore(gc, edges);
        } catch (_) {}
      }
      groups.push({ index: g, cells: gc, score });
    }
    _candGroups.push(groups);

    const posN  = groups.filter(g => g.score > 0).length;
    const negN  = groups.filter(g => g.score < 0).length;
    const def   = _ORDERING_DEFS[idx];
    const isSel = idx === state.selected_ordering;

    // 점수 한 줄 요약 (최대 6그룹 표시)
    const scoreStr = groups.slice(0, 6)
      .map(g => g.score > 0 ? '+10' : g.score < 0 ? '−10' : ' 0 ')
      .join(' ') + (S > 6 ? ' …' : '');

    const badgeClass = posN > 0 && negN === 0 ? 'pos'
                     : negN > 0               ? 'neg'
                     : 'zero';
    const badgeText  = posN > 0 && negN === 0 ? posN + '×+10'
                     : negN > 0               ? negN + '×−10'
                     : 'neutral';

    const card = document.createElement('div');
    card.className = 'cand-card' + (isSel ? ' selected' : '');
    card.onclick   = () => selectCandidate(idx);
    card.innerHTML =
      `<div class="cand-hdr">` +
        `<span class="cand-name">${def.name}</span>` +
        `<span class="score-chip ${badgeClass}">${badgeText}</span>` +
      `</div>` +
      `<div class="cand-scores">${scoreStr}</div>` +
      `<div class="cand-desc">${def.desc}</div>`;
    listEl.appendChild(card);
  });

  _showCandDetail(state.selected_ordering);
}

function _showCandDetail(idx) {
  const detailEl = document.getElementById('candDetail');
  const divEl    = document.getElementById('rpDetailDivider');
  const boxEl    = document.getElementById('candDetailBox');
  if (!detailEl || !boxEl) return;
  if (!_candGroups[idx]) { detailEl.style.display = 'none'; if (divEl) divEl.style.display = 'none'; return; }

  const groups  = _candGroups[idx];
  const posN    = groups.filter(g => g.score > 0).length;
  const negN    = groups.filter(g => g.score < 0).length;
  const neutral = groups.length - posN - negN;

  detailEl.style.display = 'block';
  if (divEl) divEl.style.display = 'block';
  boxEl.innerHTML =
    `<div class="info-title">${_ORDERING_DEFS[idx].name}</div>` +
    `<div class="row"><span class="key">총 그룹</span><span class="val">${groups.length}개</span></div>` +
    `<div class="row"><span class="key">+10 컴팩트</span><span class="val green">${posN}개</span></div>` +
    `<div class="row"><span class="key">−10 T/Y형</span><span class="val" style="color:#F87171">${negN}개</span></div>` +
    `<div class="row"><span class="key">0 체인형</span><span class="val">${neutral}개</span></div>` +
    `<div class="divider"></div>` +
    `<div class="info-title">ICC 적용 (선택)</div>` +
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

// ── 초기 렌더 ─────────────────────────────────────
rerender();
