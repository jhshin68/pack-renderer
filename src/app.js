/**
 * Battery Pack Renderer — UI Controller (app.js)
 *
 * 역할: UI 상태 관리 + 이벤트 핸들러만 담당.
 * 렌더 엔진: renderer.js (단일 기준) — 모든 SVG 생성은 renderer.js의 render() 호출.
 *
 * renderer.js가 전역으로 제공하는 함수 (browser <script> 로드 시):
 *   render, calcCellCenters, drawCell, drawFace, calcNickelPattern,
 *   getCellPolarity, resolveLayout, CELL_SPEC, RENDERER_VERSION
 *
 * ★ 커스텀 배열(arrangement='custom')은 현재 app.js 내 renderCustomLayout()으로 처리.
 *   renderer.js v0.2.18은 rows=[...] 직접 수신 미지원 (grid_cols/grid_rows 직사각 오버라이드만 지원).
 *   → 차기 renderer.js 버전에서 rows 배열 파라미터를 지원하면 render() 단일 호출로 통합 예정.
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

// ── 커스텀 배열 좌표 계산 (행별 셀 수) ──────────────
function calcCustomCenters(rows, p) {
  const spec    = CELL_SPEC[p.cell_type];
  const pitch   = (spec.render_d + p.gap) * p.scale;
  const R       = (spec.render_d / 2) * p.scale;
  const margin  = p.margin_mm * p.scale;
  const stagger = !!p.custom_stagger;
  // 엇배열: 행 간격 = pitch × (√3/2) ≈ 0.866 (헥사 밀집), 정배열: pitch
  const pitchY  = stagger ? pitch * Math.sqrt(3) / 2 : pitch;
  const maxN    = Math.max(...rows);
  const align   = p.custom_align || 'center';

  // ── 엇배열 방향 (하단 기준) ──────────────────────────
  // 'R': 2번째 행(하단 기준)이 1번째 행 대비 오른쪽 (+pitch/2)
  // 'L': 2번째 행이 왼쪽 (-pitch/2) → leftPad=pitch/2로 좌측 오버플로 방지
  const stagDir = (p.custom_stagger_dir === 'L') ? -1 : 1;
  const leftPad = (stagger && stagDir === -1) ? pitch / 2 : 0;

  const pts = [];
  for (let r = 0; r < rows.length; r++) {
    const n          = rows[r];
    const fromBottom = rows.length - 1 - r;   // 0 = 맨 하단 행
    // 하단 기준 홀수 행(2번째, 4번째...)에 엇배열 오프셋 적용
    const stagOffX   = (stagger && fromBottom % 2 === 1) ? stagDir * pitch / 2 : 0;
    let alignOffX;
    if      (align === 'left')  alignOffX = 0;
    else if (align === 'right') alignOffX = (maxN - n) * pitch;
    else                        alignOffX = (maxN - n) * pitch / 2;  // center
    for (let i = 0; i < n; i++) {
      pts.push({
        x: margin + leftPad + alignOffX + stagOffX + i * pitch + R,
        y: margin + r * pitchY + R,
        row: r, col: i,
      });
    }
  }

  // extraW: 엇배열 시 한 쪽으로 pitch/2 넓어짐 (L·R 모두 동일)
  const extraW = stagger ? pitch / 2 : 0;
  return {
    pts, R, pitch,
    W: margin * 2 + maxN * pitch + extraW,
    H: margin * 2 + (rows.length - 1) * pitchY + 2 * R,
  };
}

function parseCustomRows() {
  const raw = document.getElementById('customRows').value.trim();
  return raw.split(/[,\n\s]+/).map(s => parseInt(s, 10)).filter(n => Number.isFinite(n) && n > 0);
}

// ── 2D Convex Hull (Andrew's Monotone Chain) ─────────────────────────
// 입력: [[x,y], ...]  출력: [[x,y], ...] (CCW winding)
// 원리: 임의의 점 집합에서 최소 볼록 껍질 계산 — O(n log n)
// 이것으로 어떤 셀 배열(수천 가지)도 lookup table 없이 플레이트 형상 자동 결정
function convexHull2D(points) {
  if (points.length <= 2) return points.slice();
  const pts = points.slice().sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
  const cross = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const lower = [];
  for (const pt of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0)
      lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const pt = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0)
      upper.pop();
    upper.push(pt);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

// ── 커스텀 배열 렌더 (renderer.js의 drawCell/getCellPolarity 사용) ──
function renderCustomLayout(p) {
  const rows = parseCustomRows();
  if (rows.length === 0) {
    return '<svg width="100%" viewBox="0 0 420 80"><rect width="100%" height="100%" fill="#181c27"/>'
      + '<text x="20" y="46" fill="#e74c3c" font-family="Arial" font-size="13">커스텀 행 입력 필요 (예: 8,8,10,13,13,13)</text></svg>';
  }

  const { pts, R, W, H } = calcCustomCenters(rows, p);
  const S  = p.S;
  const N  = pts.length;
  const nw = p.nickel_w_mm * p.scale;
  const hw = nw / 2;
  const cellsPerGroup = Math.ceil(N / S);

  // 행-단위 보스트로페돈(snake) 그룹 배정
  const byRow = [];
  for (let r = 0; r < rows.length; r++) byRow.push([]);
  pts.forEach(pt => byRow[pt.row].push(pt));
  const snake = [];
  for (let r = 0; r < byRow.length; r++) {
    const row = [...byRow[r]];
    if (r % 2 === 1) row.reverse();
    snake.push(...row);
  }

  // 그룹별 셀 분류
  const groupCells = Array.from({ length: S }, () => []);
  snake.forEach((pt, i) => {
    const g = Math.min(S - 1, Math.floor(i / cellsPerGroup));
    groupCells[g].push(pt);
  });

  // ── 인접 판정 (grid row/col 기준 — renderer.js renderCustomGrid와 동일) ──
  const isAdj = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

  // ── 니켈 플레이트 — 원칙 27: buildNickel → cells → buildTerminals ────────
  // 형상: 플레이트 내 isAdj 인접 셀 쌍 연결선(stroke=2R) + 각 셀 원형(r=R)
  // 색상: 회색(#888888) 단일
  function buildNickel(face) {
    if (!p.show_nickel) return '';
    const parts = [];
    const sw = nw.toFixed(1);
    const fc = '#888888';

    // 플레이트 구성: 그룹 병합
    // 상면: [G0], [G1∪G2], ...  / 하면: [G0∪G1], [G2∪G3], ...
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
      // ① 인접 셀 쌍 연결선 (얇은 니켈 스트립)
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

  // ── 단자 탭 (B+ / B−) — renderer.js buildFace와 동일 ────────────────
  function buildTerminals(face) {
    if (!p.show_terminal) return '';
    const parts = [];
    // B+: 항상 top face G0 첫 셀
    if (face === 'top') {
      const c0 = groupCells[0]?.[0];
      if (c0) {
        parts.push(`<circle cx="${c0.x.toFixed(1)}" cy="${c0.y.toFixed(1)}" r="${(nw*0.7).toFixed(1)}" fill="#C0392B" stroke="#7B241C" stroke-width="1"/>`);
        parts.push(`<text font-family="Arial" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" x="${c0.x.toFixed(1)}" y="${(c0.y+4).toFixed(1)}">B+</text>`);
      }
    }
    // B−: S 짝수→top G_last, S 홀수→bottom G_last
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

  // 상면/하면 셀 렌더
  const topCells = snake.map((pt, i) => {
    const g = Math.min(S - 1, Math.floor(i / cellsPerGroup));
    return drawCell(pt.x, pt.y, R, getCellPolarity(g, 'top'), p.scale);
  });
  const botCells = snake.map((pt, i) => {
    const g = Math.min(S - 1, Math.floor(i / cellsPerGroup));
    return drawCell(pt.x, pt.y, R, getCellPolarity(g, 'bottom'), p.scale);
  });

  const faceFilter = p.face || 'all';
  const showTop    = faceFilter !== 'bottom';
  const showBot    = faceFilter !== 'top';
  const gap        = p.gap_section;
  const svgH       = (showTop && showBot) ? H * 2 + gap + 50 : H + 44;
  const ln         = [];
  ln.push(`<svg width="100%" viewBox="0 0 ${Math.ceil(W)} ${Math.ceil(svgH)}" xmlns="http://www.w3.org/2000/svg">`);

  // 원칙 27: 레이어 순서 = 니켈(최하단) → 셀 → 단자탭(최상단)
  // 채워진 폴리곤 니켈은 셀 아래에 그려져야 셀 위치가 항상 보인다.
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
  // 커스텀 배열: renderCustomLayout이 p.face를 직접 처리
  if (state.arrangement === 'custom') {
    const p = { ...state, layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0, gap_section: 36 };
    document.getElementById('svgOutput').innerHTML = renderCustomLayout(p);
    return;
  }
  let svg = lastSVG;
  if (state.face === 'top' || state.face === 'bottom') {
    const p = { ...state, layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0, gap_section: 36 };
    const { S, P } = p;
    const { cx, cy, R } = calcCellCenters(S, P, p);
    const nw = p.nickel_w_mm * p.scale;
    const margin = p.margin_mm * p.scale;
    let maxCx = 0;
    for (let q = 0; q < P; q++) if (cx[S - 1][q] > maxCx) maxCx = cx[S - 1][q];
    const faceW = maxCx + R + margin + nw * 2;
    const faceH = cy[P - 1] + R + margin + 40;
    const face  = state.face;
    svg = `<svg width="100%" viewBox="0 0 ${Math.ceil(faceW)} ${Math.ceil(faceH)}" xmlns="http://www.w3.org/2000/svg">`
      + `<text font-family="Arial" font-size="11" fill="#4a5568" text-anchor="middle" x="${faceW / 2}" y="16">${face === 'top' ? 'top face' : 'bottom face'}</text>`
      + `<g transform="translate(0,20)">${drawFace(S, P, face, cx, cy, R, p)}</g>`
      + `<text font-family="Arial" font-size="8" fill="#27AE60" text-anchor="middle" x="${faceW / 2}" y="${faceH - 6}">${RENDERER_VERSION} · ${S}S${P}P · ${p.cell_type} · ${face}</text>`
      + `</svg>`;
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

// ── 메인 렌더 ─────────────────────────────────────
function doRender() {
  updateInfoBox();

  const p = {
    ...state,
    layout:       'auto',
    scale:        1.5,
    nickel_w_mm:  4.0,
    margin_mm:    8.0,
    gap_section:  36,
  };

  if (state.arrangement === 'custom') {
    // lastSVG = 항상 양면 (export용). 화면 표시는 applyFaceFilter가 face 필터 적용
    lastSVG = renderCustomLayout({ ...p, face: 'all' });
    applyFaceFilter();
    fixSVGSize();
    addBmsMarkerToDOM();
  } else {
    lastSVG = render(p);
    applyFaceFilter();
    fixSVGSize();
    addBmsMarkerToDOM();
  }

  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('svgContainer').style.display = 'block';
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
doRender();
