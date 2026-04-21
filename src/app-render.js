/**
 * app-render.js — 렌더 파이프라인
 * (browser-only, window 공유 스코프 — no exports)
 *
 * 의존: app-state.js (state, lastSVG, _enumResult, _countDistinctShapes,
 *                     parseCustomRows, parseRowOffsets, MOLD_COST_KRW)
 *       app-ui.js (getHolderRows, getHolderCols, addBmsMarkerToDOM,
 *                  updateHolderUI, calcBmsDistances)
 *       app-panel.js (populateCandidatePanel, _renderCustomCandidates,
 *                     _updateEnumStatus)
 *       renderer.js (render, calcCellCenters, calcNickelPattern, resolveLayout, CELL_SPEC)
 *       generator.js (Generator — estimateMmin, calcCustomCenters, enumerateGroupAssignments)
 */

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
  const mMin   = Generator.estimateMmin(S, P, arrangement, allow_mirror);
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
      c => (c.m_distinct || 0) <= state.max_plates
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
  const budgetMs = (state.search_budget_ms !== undefined) ? state.search_budget_ms : 600000;
  const budgetLabel = budgetMs === null ? '무제한'
    : budgetMs >= 60000 ? `${budgetMs / 60000}분`
    : `${budgetMs / 1000}초`;
  if (genBtn) genBtn.disabled = true;
  if (titleEl) titleEl.textContent = `셀 배열 후보 탐색중… (${budgetLabel})`;
  if (countEl) countEl.textContent = '…';
  if (listEl) listEl.innerHTML = '<div class="hint" style="margin-top:6px;color:var(--dt3)">후보를 탐색하고 있습니다…</div>';
  _syncFilterOptions(null);  // 탐색 시작 시 필터 초기화

  // 두 프레임 대기 → 브라우저 실제 repaint 보장
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const t0 = Date.now();

  let result;
  try {
    result = Generator.enumerateGroupAssignments({
      cells: customPts, S, P, arrangement: 'custom',
      b_plus_side, b_minus_side,
      icc1, icc2, icc3,
      nickel_w: nickel_w_mm * 1.5,
      max_candidates: 999999,
      budget_ms: budgetMs,
      g0_anchor: state.g0_anchor,
      allow_I: state.allow_I,
      allow_U: state.allow_U,
      pitch: customPitch,
      custom_stagger: !!state.custom_stagger,
    });
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div class="hint" style="color:var(--red)">열거 오류: ${e.message}</div>`;
    if (countEl) countEl.textContent = '오류';
    _enumResult = null; _updateEnumStatus(null);
    if (titleEl) titleEl.textContent = '셀 배열 후보';
    if (genBtn) genBtn.disabled = false;
    return;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (titleEl) titleEl.textContent = '셀 배열 후보';
  if (genBtn) genBtn.disabled = false;
  _enumResult = result;
  _updateEnumStatus(result);
  // 필터 먼저 채운 후 후보 렌더 (순서 중요: populate → render)
  _syncFilterOptions(result);
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
    _syncFilterOptions(null);
    _showCandDetail(-1);
    return;
  }

  let candidates = result.candidates || [];
  const total = candidates.length;

  if (state.max_plates && state.max_plates > 0)
    candidates = candidates.filter(c => (c.m_distinct || 0) <= state.max_plates);
  candidates = candidates.slice().sort((a, b) => (a.m_distinct || 0) - (b.m_distinct || 0));

  // m_distinct 필터 적용
  const mdSel = document.getElementById('mdistinctSel');
  const mdFilter = mdSel ? mdSel.value : '';
  if (mdFilter !== '') {
    const mdVal = parseInt(mdFilter, 10);
    candidates = candidates.filter(c => (c.m_distinct || 0) === mdVal);
  }

  // 품질점수 필터 적용
  const qSel = document.getElementById('qualitySel');
  const qFilter = qSel ? qSel.value : '';
  if (qFilter !== '') {
    const qVal = parseInt(qFilter, 10);
    candidates = candidates.filter(c => (c.total_score ?? 0) === qVal);
  }

  const filtered = candidates.length;
  // 표시 상한: 필터링 후에도 너무 많으면 상위 200개만 렌더링
  const DISPLAY_CAP = 200;
  const display = candidates.slice(0, DISPLAY_CAP);

  if (countEl) {
    if (filtered === 0) {
      countEl.textContent = '0개';
    } else if (filtered > DISPLAY_CAP) {
      countEl.textContent = `${DISPLAY_CAP} / ${total}개 표시`;
    } else if (filtered < total) {
      countEl.textContent = `${filtered} / ${total}개`;
    } else {
      countEl.textContent = `${total}개`;
    }
  }
  listEl.innerHTML = '';
  if (display.length === 0) {
    listEl.innerHTML = '<div class="hint" style="margin-top:4px;color:var(--amber)">현재 제약으로 유효 후보 없음<br>ICC/B± 조건을 완화해보세요</div>';
    _showCandDetail(-1);
    return;
  }
  if (state.selected_ordering >= display.length) state.selected_ordering = 0;
  _renderCandCards(display, listEl, S);
  _showCandDetail(state.selected_ordering);
}
