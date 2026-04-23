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

  // ★ 사이드바와 동일한 정렬·필터 배열 사용 (인덱스 불일치 버그 방지)
  let effectiveCandidates = _sortedCandidates ||
    (_enumResult ? (_enumResult.candidates || []) : []);
  if (!_sortedCandidates && state.max_plates > 0) {
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
    const { S, P, arrangement, icc1, icc2, icc3, nickel_w_mm, b_plus_side, b_minus_side } = state;
    const cells   = _getHolderCells();
    const listEl  = document.getElementById('candList');
    const countEl = document.getElementById('rpCandCount');
    const titleEl = document.getElementById('rpCandTitle');
    const genBtn  = document.querySelector('.render-btn');

    // 로딩 표시 → 브라우저 repaint 보장 후 탐색
    if (genBtn) genBtn.disabled = true;
    if (titleEl) titleEl.textContent = '셀 배열 후보 탐색중…';
    if (countEl) countEl.textContent = '…';
    if (listEl) listEl.innerHTML = '<div class="hint" style="margin-top:6px;color:var(--dt3)">후보를 탐색하고 있습니다…</div>';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    if (cells && cells.length && typeof Generator !== 'undefined') {
      try {
        _enumResult = Generator.enumerateGroupAssignments({
          cells, S, P, arrangement,
          b_plus_side, b_minus_side, icc1, icc2, icc3,
          nickel_w: nickel_w_mm * 1.5,
          max_candidates: 999999,
          g0_anchor: state.g0_anchor,
          allow_I: state.allow_I,
          allow_U: state.allow_U,
        });
      } catch (e) {
        if (listEl) listEl.innerHTML = `<div class="hint" style="color:var(--red)">열거 오류: ${e.message}</div>`;
        if (countEl) countEl.textContent = '오류';
        if (genBtn) genBtn.disabled = false;
        _renderSVG();
        return;
      }
    }
    if (genBtn) genBtn.disabled = false;
    if (titleEl) titleEl.textContent = '셀 배열 후보';
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
// 고정 그룹 탐색 전용 진입점 (UI 버튼에서만 호출)
async function runPinnedGroupsSearch() {
  await _runCustomSearch(true);
}

async function _runCustomSearch(usePinned = false) {
  const { S, P, icc1, icc2, icc3, nickel_w_mm, b_plus_side, b_minus_side } = state;
  const listEl  = document.getElementById('candList');
  const countEl = document.getElementById('rpCandCount');
  const titleEl = document.getElementById('rpCandTitle');
  const genBtn  = document.querySelector('.render-btn');

  const customRows    = parseCustomRows();
  const customOffsets = parseRowOffsets();
  if (!customRows.length || typeof Generator === 'undefined' || typeof CELL_SPEC === 'undefined') {
    _enumResult = null; _sortedCandidates = null;
    _updateEnumStatus(null);
    if (listEl) listEl.innerHTML = '<div class="hint" style="color:var(--dt3);margin-top:4px">커스텀 배열 — 행 구성을 입력하세요</div>';
    if (countEl) countEl.textContent = '—';
    return;
  }
  // 열거용 좌표: state.custom_stagger 그대로 전달 — 표시 좌표와 탐색 좌표를 일치시킴
  const customParams = {
    ...state,
    layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0,
    rows: customRows, row_offsets: customOffsets,
    custom_stagger: !!state.custom_stagger,
  };
  let customPts, customPitch;
  try {
    const cc = Generator.calcCustomCenters(customRows, customParams, CELL_SPEC);
    customPts = cc.pts; customPitch = cc.pitch;
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div class="hint" style="color:var(--red)">커스텀 좌표 오류: ${e.message}</div>`;
    if (countEl) countEl.textContent = '오류';
    if (titleEl) titleEl.textContent = '셀 배열 후보';
    _enumResult = null; _sortedCandidates = null; _updateEnumStatus(null);
    return;
  }

  // ─── 부분 고정 탐색: 전용 버튼 호출 시에만 실행 (일반 탐색과 분리) ──
  const pinnedGroups = usePinned ? parsePinnedGroups() : [];
  if (pinnedGroups.length > 0) {
    const budgetMsPinned = (state.search_budget_ms !== undefined) ? state.search_budget_ms : 600000;
    const budgetLabelPinned = budgetMsPinned >= 60000 ? `${budgetMsPinned / 60000}분` : `${budgetMsPinned / 1000}초`;
    if (genBtn) genBtn.disabled = true;
    if (countEl) countEl.textContent = '…';
    if (listEl) listEl.innerHTML = '<div class="hint" style="margin-top:6px;color:var(--dt3)">고정 그룹 탐색 중…</div>';
    _syncFilterOptions(null);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const t0p = Date.now();

    const enumBasePinned = {
      cells: customPts, S, P, arrangement: 'custom',
      b_plus_side, b_minus_side, icc1, icc2, icc3,
      nickel_w: nickel_w_mm * 1.5,
      allow_I: state.allow_I, allow_U: state.allow_U,
      pitch: customPitch, custom_stagger: !!state.custom_stagger,
      pinned_groups: pinnedGroups,
    };

    // G(k) 후보 열거 — 병렬 분할 기준
    let gkConfigs = [];
    try {
      const gkr = Generator.enumerateGroupAssignments({ ...enumBasePinned, enumerate_g0_only: true });
      gkConfigs = gkr.g0_configs || [];
      console.log('[pinned-parallel] pinnedGroups:', pinnedGroups.length, '개 고정, gkConfigs:', gkConfigs.length, '개');
    } catch (e) {
      console.error('[pinned-parallel] gkConfigs 열거 오류:', e);
    }

    // cell idx 변환 (워커 전달용)
    const rcIdxMap = new Map(customPts.map((pt, i) => [`${pt.row},${pt.col}`, i]));
    const pinnedCellIdxGroups = pinnedGroups.map(grp =>
      grp.map(({row, col}) => rcIdxMap.get(`${row},${col}`)).filter(i => i !== undefined)
    ).filter(grp => grp.length > 0);
    console.log('[pinned-parallel] pinnedCellIdxGroups 매칭:', pinnedCellIdxGroups.map(g => g.length), '셀');

    const wParams = {
      S, P, b_plus_side, b_minus_side, icc1, icc2, icc3,
      nickel_w: nickel_w_mm * 1.5,
      allow_I: state.allow_I, allow_U: state.allow_U,
      custom_stagger: !!state.custom_stagger,
    };

    let allCandidates = [];

    if (typeof Worker !== 'undefined') {
      if (gkConfigs.length >= 1) {
        // ── 병렬 탐색: gkConfigs를 워커에 분배 ──────────────────────
        const numW = Math.min(Math.max(1, (navigator.hardwareConcurrency || 4) - 2), gkConfigs.length);
        const chunks = Array.from({ length: numW }, () => []);
        gkConfigs.forEach((gk, i) => chunks[i % numW].push(gk));
        if (titleEl) titleEl.textContent = `고정 탐색 병렬중… (${pinnedGroups.length}개 고정, ${gkConfigs.length}분할, ${budgetLabelPinned})`;
        try {
          const batches = await Promise.all(chunks.map(chunk => {
            const budgetPerGk = Math.floor(budgetMsPinned / Math.max(1, chunk.length));
            return new Promise((resolve, reject) => {
              const w = new Worker('src/enum-worker-bundle.js');
              const killer = setTimeout(() => { w.terminate(); resolve([]); }, budgetMsPinned + 3000);
              w.onmessage = ev => { clearTimeout(killer); w.terminate(); resolve(ev.data.candidates || []); };
              w.onerror   = err => { clearTimeout(killer); w.terminate(); reject(err); };
              w.postMessage({ params: wParams, g0Configs: chunk, budgetMs: budgetMsPinned, budgetPerG0: budgetPerGk,
                              cells: customPts, pitch: customPitch, pinnedCellIdxGroups });
            });
          }));
          const seen = new Set();
          for (const batch of batches) {
            for (const cand of batch) {
              const key = (cand.groups || []).map(g =>
                (g.cells || []).map(c => `${c.row},${c.col}`).sort().join('|')
              ).join('§');
              if (!seen.has(key)) { seen.add(key); allCandidates.push(cand); }
            }
          }
        } catch (e) {
          console.error('[pinned-parallel] 워커 오류:', e);
        }
      } else {
        // ── gkConfigs=0: 단일 워커로 전체 pinned 탐색 (UI 비블로킹) ──
        if (titleEl) titleEl.textContent = `고정 탐색 중… (${pinnedGroups.length}개 고정, 단일 워커, ${budgetLabelPinned})`;
        console.log('[pinned-parallel] gkConfigs=0 → 단일 워커 fallback');
        try {
          allCandidates = await new Promise((resolve, reject) => {
            const w = new Worker('src/enum-worker-bundle.js');
            const killer = setTimeout(() => { w.terminate(); resolve([]); }, budgetMsPinned + 3000);
            w.onmessage = ev => { clearTimeout(killer); w.terminate(); resolve(ev.data.candidates || []); };
            w.onerror   = err => { clearTimeout(killer); w.terminate(); reject(err); };
            // g0Configs=[] + pinnedCellIdxGroups → 워커 내부에서 전체 pinned 탐색
            w.postMessage({ params: wParams, g0Configs: [], budgetMs: budgetMsPinned, budgetPerG0: budgetMsPinned,
                            cells: customPts, pitch: customPitch, pinnedCellIdxGroups });
          });
        } catch (e) {
          console.error('[pinned-parallel] 단일 워커 오류:', e);
        }
      }
    } else {
      // ── Workers 미지원: 동기 실행 폴백 ──────────────────────────────
      if (titleEl) titleEl.textContent = `고정 탐색 중… (${pinnedGroups.length}개 고정, ${budgetLabelPinned})`;
      try {
        const presult = Generator.enumerateGroupAssignments({
          ...enumBasePinned, exhaustive: true, budget_ms: budgetMsPinned, max_candidates: 999999,
        });
        allCandidates = presult.candidates || [];
      } catch (_) {}
    }

    const candidates = allCandidates.map(c => ({ ...c, pinned: true }));
    _enumResult = { candidates };
    _sortedCandidates = null;
    const elapsed = ((Date.now() - t0p) / 1000).toFixed(1);
    const warnEl = document.getElementById('pinnedGroupsWarn');
    if (warnEl) {
      warnEl.textContent = candidates.length === 0
        ? '⚠ 고정 그룹 탐색: 후보 없음 — B+ 셀 포함 여부와 인접성을 확인하세요'
        : '';
      warnEl.style.display = candidates.length === 0 ? 'block' : 'none';
    }
    _updateEnumStatus({ candidates });
    populateCandidatePanel();
    if (genBtn) genBtn.disabled = false;
    if (titleEl) titleEl.textContent = `셀 배열 후보 (고정 탐색 ${elapsed}s)`;
    if (countEl) countEl.textContent = candidates.length;
    return;
  }

  // 탐색 시작 — 버튼 비활성화 + 로딩 표시
  const budgetMs = (state.search_budget_ms !== undefined) ? state.search_budget_ms : 600000;
  const budgetLabel = budgetMs === null ? '무제한'
    : budgetMs >= 60000 ? `${budgetMs / 60000}분`
    : `${budgetMs / 1000}초`;
  if (genBtn) genBtn.disabled = true;
  if (titleEl) titleEl.textContent = `셀 배열 후보 병렬 탐색중… (${budgetLabel})`;
  if (countEl) countEl.textContent = '…';
  if (listEl) listEl.innerHTML = '<div class="hint" style="margin-top:6px;color:var(--dt3)">후보를 탐색하고 있습니다…</div>';
  _syncFilterOptions(null);  // 탐색 시작 시 필터 초기화

  // 두 프레임 대기 → 브라우저 실제 repaint 보장
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const t0 = Date.now();

  // ─── Step 1: G0 후보 열거 (분할 계획) ────────────────────────────
  const enumBase = {
    cells: customPts, S, P, arrangement: 'custom',
    b_plus_side, b_minus_side, icc1, icc2, icc3,
    nickel_w: nickel_w_mm * 1.5,
    g0_anchor: state.g0_anchor,
    allow_I: state.allow_I, allow_U: state.allow_U,
    pitch: customPitch, custom_stagger: !!state.custom_stagger,
  };
  if (titleEl) titleEl.textContent = `G0 분할 계획 중…`;
  await new Promise(r => requestAnimationFrame(r));

  // G0 열거 — Worker에서 실행(메인 스레드 블로킹 방지), 7초 킬러 내장
  const g0EnumStart = Date.now();
  let g0Configs = [];
  try {
    if (typeof Worker !== 'undefined') {
      const g0r = await new Promise((resolve) => {
        const g0Url = new URL('src/enum-worker-bundle.js', location.href).href;
        const w = new Worker(g0Url);
        const killer = setTimeout(() => { w.terminate(); resolve({ g0_configs: [] }); }, 7000);
        w.onmessage = ev => { clearTimeout(killer); w.terminate(); resolve(ev.data); };
        w.onerror   = ev => { console.error('[G0 Worker] 실패:', ev && ev.message, ev); clearTimeout(killer); w.terminate(); resolve({ g0_configs: [] }); };
        w.postMessage({
          g0_enum_only: true,
          cells: customPts,
          pitch: customPitch,
          params: {
            S, P, b_plus_side, b_minus_side, icc1, icc2, icc3,
            nickel_w: nickel_w_mm * 1.5,
            allow_I: state.allow_I, allow_U: state.allow_U,
            custom_stagger: !!state.custom_stagger,
            g0_anchor: state.g0_anchor,
          },
        });
      });
      g0Configs = g0r.g0_configs || [];
    } else {
      const g0r = Generator.enumerateGroupAssignments({ ...enumBase, enumerate_g0_only: true, budget_ms: 5000 });
      g0Configs = g0r.g0_configs || [];
    }
  } catch (e) { console.error('[parallel] G0 열거 실패:', e); }
  const g0ElapsedS = ((Date.now() - g0EnumStart) / 1000).toFixed(1);

  const numWorkers = Math.min(
    Math.max(1, (navigator.hardwareConcurrency || 4) - 2),
    g0Configs.length
  );

  // G0 결과를 패널 본문에 표시 (소요 시간 포함) — 타이틀보다 눈에 잘 띔
  const g0StatusColor = g0Configs.length >= 2 ? 'var(--slp-blue-500,#2563eb)' : 'var(--dt3)';
  const g0StatusMsg = g0Configs.length >= 2
    ? `▶ G0 ${g0Configs.length}개 (${g0ElapsedS}s) → ${numWorkers} 워커 병렬 탐색 시작`
    : g0Configs.length === 1
      ? `▶ G0 1개 (${g0ElapsedS}s) → 단일 워커 탐색 시작`
      : `▶ G0 0개 (${g0ElapsedS}s) → 단일 워커 전체 탐색`;
  if (listEl) listEl.innerHTML = `<div class="hint" style="margin-top:6px;color:${g0StatusColor};font-weight:600">${g0StatusMsg}</div>`;
  await new Promise(r => requestAnimationFrame(r));

  let result;

  const wParams = {
    S, P, b_plus_side, b_minus_side, icc1, icc2, icc3,
    nickel_w: nickel_w_mm * 1.5,
    allow_I: state.allow_I, allow_U: state.allow_U,
    custom_stagger: !!state.custom_stagger,
    exhaustive: true,
  };
  const workerUrl = new URL('src/enum-worker-bundle.js', location.href).href;

  if (typeof Worker !== 'undefined') {
    if (g0Configs.length >= 1) {
      // ─── Step 2: Web Workers 병렬 탐색 ────────────────────────────
      if (titleEl) titleEl.textContent = `병렬 탐색중… (G0 ${g0Configs.length}개 → ${numWorkers} 워커, ${budgetLabel})`;
      const chunks = Array.from({ length: numWorkers }, () => []);
      g0Configs.forEach((g0, i) => chunks[i % numWorkers].push(g0));

      try {
        const allBatches = await Promise.all(
          chunks.map(chunk => {
            // G0 config별 균등 예산: 모든 G0 config가 탐색되도록 보장
            const budgetPerG0 = Math.floor(budgetMs / Math.max(1, chunk.length));
            return new Promise((resolve, reject) => {
              const w = new Worker(workerUrl);
              const killer = setTimeout(() => { w.terminate(); resolve([]); }, budgetMs + 3000);
              w.onmessage = ev => { clearTimeout(killer); w.terminate(); resolve(ev.data.candidates || []); };
              w.onerror   = err => { console.error('[병렬 Worker] 실패:', err && err.message, err); clearTimeout(killer); w.terminate(); reject(err); };
              w.postMessage({ params: wParams, g0Configs: chunk, budgetMs, budgetPerG0, cells: customPts, pitch: customPitch });
            });
          })
        );

        // 중복 제거 병합
        const seen   = new Set();
        const merged = [];
        for (const batch of allBatches) {
          for (const cand of batch) {
            const key = (cand.groups || []).map(g =>
              (g.cells || []).map(c => `${c.row},${c.col}`).sort().join('|')
            ).join('§');
            if (!seen.has(key)) { seen.add(key); merged.push(cand); }
          }
        }
        result = { candidates: merged, count: merged.length };
      } catch (e) {
        // Worker 실패 → 단일 스레드 폴백
        console.warn('[병렬 Workers] 실패, 단일 스레드 폴백:', e);
        if (titleEl) titleEl.textContent = `셀 배열 후보 탐색중… (단일 스레드 폴백, ${budgetLabel})`;
        if (listEl) listEl.innerHTML = '<div class="hint" style="margin-top:6px;color:var(--dt3)">⚠ Worker 불가 — 단일 스레드로 탐색합니다 (UI 일시 정지)</div>';
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        try {
          result = Generator.enumerateGroupAssignments({ ...enumBase, max_candidates: 999999, exhaustive: true, budget_ms: budgetMs });
        } catch (e2) {
          if (listEl) listEl.innerHTML = `<div class="hint" style="color:var(--red)">열거 오류: ${e2.message}</div>`;
          if (countEl) countEl.textContent = '오류';
          _enumResult = null; _sortedCandidates = null; _updateEnumStatus(null);
          if (titleEl) titleEl.textContent = '셀 배열 후보';
          if (genBtn) genBtn.disabled = false;
          return;
        }
      }
    } else {
      // ─── g0Configs=0: 단일 워커 fallback (UI 비블로킹) ─────────────
      console.log('[custom-parallel] g0Configs=0 → 단일 워커 fallback');
      if (titleEl) titleEl.textContent = `셀 배열 후보 탐색중… (단일 워커, ${budgetLabel})`;
      try {
        const cands = await new Promise((resolve, reject) => {
          const w = new Worker(workerUrl);
          const killer = setTimeout(() => { w.terminate(); resolve([]); }, budgetMs + 3000);
          w.onmessage = ev => { clearTimeout(killer); w.terminate(); resolve(ev.data.candidates || []); };
          w.onerror   = err => { clearTimeout(killer); w.terminate(); reject(err); };
          w.postMessage({ params: wParams, g0Configs: [], budgetMs, budgetPerG0: budgetMs, cells: customPts, pitch: customPitch });
        });
        result = { candidates: cands, count: cands.length };
      } catch (e) {
        // Worker 실패 → 단일 스레드 폴백
        console.warn('[custom-single-worker] Worker 실패, 단일 스레드 폴백:', e);
        if (titleEl) titleEl.textContent = `셀 배열 후보 탐색중… (단일 스레드 폴백, ${budgetLabel})`;
        if (listEl) listEl.innerHTML = '<div class="hint" style="margin-top:6px;color:var(--dt3)">⚠ Worker 불가 — 단일 스레드로 탐색합니다 (UI 일시 정지)</div>';
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        try {
          result = Generator.enumerateGroupAssignments({ ...enumBase, max_candidates: 999999, exhaustive: true, budget_ms: budgetMs });
        } catch (e2) {
          if (listEl) listEl.innerHTML = `<div class="hint" style="color:var(--red)">열거 오류: ${e2.message}</div>`;
          if (countEl) countEl.textContent = '오류';
          _enumResult = null; _sortedCandidates = null; _updateEnumStatus(null);
          if (titleEl) titleEl.textContent = '셀 배열 후보';
          if (genBtn) genBtn.disabled = false;
          return;
        }
      }
    }
  } else {
    // ─── Workers 미지원: 단일 스레드 폴백 ─────────────────────────
    try {
      result = Generator.enumerateGroupAssignments({ ...enumBase, max_candidates: 999999, exhaustive: true, budget_ms: budgetMs });
    } catch (e) {
      if (listEl) listEl.innerHTML = `<div class="hint" style="color:var(--red)">열거 오류: ${e.message}</div>`;
      if (countEl) countEl.textContent = '오류';
      _enumResult = null; _sortedCandidates = null; _updateEnumStatus(null);
      if (titleEl) titleEl.textContent = '셀 배열 후보';
      if (genBtn) genBtn.disabled = false;
      return;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const foundCount = (result && result.candidates) ? result.candidates.length : 0;
  if (titleEl) titleEl.textContent = `셀 배열 후보 (${elapsed}s, ${foundCount}개 발견)`;
  if (genBtn) genBtn.disabled = false;
  _enumResult = result;
  _updateEnumStatus(result);
  _renderCustomCandidates(result, true);  // 새 탐색: 최솟값·최댓값 자동 선택
}

// 커스텀 배열 후보 목록 렌더링 (캐시 결과 사용)
// 순서 불변: ① 후보 확정 → ② 필터 갱신 → ③ 필터 읽기 → ④ 카드 렌더링
// autoSelect=true(새 탐색): 최솟값·최댓값 강제 / false(필터 변경): 사용자 선택 유지
function _renderCustomCandidates(result, autoSelect) {
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

  // ① 후보 확정 (max_plates 필터 + 정렬)
  let candidates = result.candidates || [];
  const total = candidates.length;
  if (state.max_plates && state.max_plates > 0)
    candidates = candidates.filter(c => (c.m_distinct || 0) <= state.max_plates);
  candidates = candidates.slice().sort((a, b) => (a.m_distinct || 0) - (b.m_distinct || 0));

  // ② 필터 갱신
  _syncFilterOptions({ candidates }, autoSelect);

  // ③ 필터 읽기 (갱신된 값 기준)
  const mdSel = document.getElementById('mdistinctSel');
  const mdFilter = mdSel ? mdSel.value : '';
  if (mdFilter !== '') {
    const mdVal = parseInt(mdFilter, 10);
    candidates = candidates.filter(c => (c.m_distinct || 0) === mdVal);
  }

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
