/**
 * app-panel.js — 배열 후보 패널 제어
 * (browser-only, window 공유 스코프 — no exports)
 *
 * 의존: app-state.js (state, _enumResult, _countDistinctShapes)
 *       app-ui.js (getHolderRows, getHolderCols)
 *       app-render.js (_renderSVG, rerender)
 *       renderer.js (calcCellCenters, CELL_SPEC)
 *       generator.js (Generator — enumerateGroupAssignments, estimateMmin)
 */

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

// ★ Phase 3a: 제약 1개씩 해제 재열거 → 복구 CTA 후보 생성
function _probeRelief(cfg) {
  if (typeof Generator === 'undefined') return [];
  const { cells, S, P, arrangement, b_plus_side, b_minus_side, icc1, icc2, icc3, nickel_w_mm } = cfg;
  const baseArgs = {
    cells, S, P, arrangement,
    b_plus_side, b_minus_side,
    nickel_w: nickel_w_mm * 1.5,
    max_candidates: 10,
    allow_I: state.allow_I,
    allow_U: state.allow_U,
    g0_anchor: state.g0_anchor,
  };
  const out = [];

  // max_plates 제약이 원인인 경우 최우선 안내 (재열거 없이 즉시 확인 가능)
  if (state.max_plates > 0) {
    const mMin = Generator.estimateMmin(S, P, arrangement, state.allow_mirror);
    if (mMin > state.max_plates) {
      out.push({ label: `최대 형상 종류 해제 (최소 ${mMin}종 필요)`, action: 'setMaxPlates(0)', count: -1 });
    }
  }

  const trials = [];
  if (!state.allow_I) trials.push({ args: { ...baseArgs, allow_I: true },
                                    label: '1자(I)형 허용', action: "toggleAllowShape('allow_I')" });
  if (!state.allow_U) trials.push({ args: { ...baseArgs, allow_U: true },
                                    label: 'ㄷ자(U)형 허용', action: "toggleAllowShape('allow_U')" });
  if (icc1) trials.push({ args: { ...baseArgs, icc1: false },
                          label: 'ICC① 해제', action: "toggleICC('icc1')" });
  if (icc2) trials.push({ args: { ...baseArgs, icc2: false },
                          label: 'ICC② 해제', action: "toggleICC('icc2')" });
  if (icc3) trials.push({ args: { ...baseArgs, icc3: false },
                          label: 'ICC③ 해제', action: "toggleICC('icc3')" });
  if (state.g0_anchor) trials.push({ args: { ...baseArgs, g0_anchor: null },
                                     label: '1번 셀 위치 자동', action: "setG0Anchor('auto')" });
  for (const t of trials) {
    let n = 0;
    try {
      const r = Generator.enumerateGroupAssignments({ ...t.args });
      n = (r.candidates || []).length;
    } catch (_) { n = 0; }
    if (n > 0) out.push({ label: t.label, action: t.action, count: n });
  }
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
    const platesVal = cand.m_distinct || 0;
    const statBits = [
      `<span style="${sigmaStyle}">Σ ${totalQS >= 0 ? '+' : ''}${totalQS}</span>`,
      `<span style="color:#ffffff">플레이트 ${platesVal}종</span>`,
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
    _renderCustomCandidates(_enumResult, false);  // rerender: 사용자 선택 유지
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
      nickel_w: nickel_w_mm * 1.5,
      max_candidates: 999999,
      g0_anchor: state.g0_anchor,
      allow_I: state.allow_I,
      allow_U: state.allow_U,
    });
  } catch (e) {
    listEl.innerHTML = `<div class="hint" style="color:var(--red)">열거 오류: ${e.message}</div>`;
    if (countEl) countEl.textContent = '오류';
    return;
  }

  _enumResult = result;
  _updateEnumStatus(result);

  // ① 후보 확정 (max_plates 필터 + 정렬)
  let candidates = result.candidates || [];
  if (state.max_plates && state.max_plates > 0) {
    candidates = candidates.filter(c => (c.m_distinct || 0) <= state.max_plates);
  }
  candidates = candidates.slice().sort((a, b) => (a.m_distinct || 0) - (b.m_distinct || 0));

  listEl.innerHTML = '';
  if (candidates.length === 0) {
    _syncFilterOptions({ candidates }, true);
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

  // ② 필터 갱신 (새 탐색: 최솟값·최댓값 자동 선택)
  _syncFilterOptions({ candidates }, true);

  // ③ 필터 읽기
  const mdSelF = document.getElementById('mdistinctSel');
  const mdFilterF = mdSelF ? mdSelF.value : '';
  if (mdFilterF !== '') candidates = candidates.filter(c => (c.m_distinct || 0) === parseInt(mdFilterF, 10));
  const qSelF = document.getElementById('qualitySel');
  const qFilterF = qSelF ? qSelF.value : '';
  if (qFilterF !== '') candidates = candidates.filter(c => (c.total_score ?? 0) === parseInt(qFilterF, 10));

  if (countEl) countEl.textContent = candidates.length + '개';

  if (state.selected_ordering >= candidates.length) state.selected_ordering = 0;
  // ④ 카드 렌더링
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

// 필터 콤보박스 동기화
// autoSelect=true (새 탐색): 형상종류 최솟값 · 품질 최댓값 강제 선택
// autoSelect=false (필터 변경): 사용자 선택 유지
function _syncFilterOptions(result, autoSelect) {
  const candidates = (result && result.candidates) || [];

  const mdSel = document.getElementById('mdistinctSel');
  if (mdSel) {
    const prev = mdSel.value;
    if (candidates.length === 0) {
      mdSel.innerHTML = '<option value="">전체</option>';
      mdSel.value = '';
    } else {
      const vals = [...new Set(candidates.map(c => c.m_distinct || 0))].sort((a, b) => a - b);
      mdSel.innerHTML = '<option value="">전체</option>' +
        vals.map(v => `<option value="${v}">${v}종</option>`).join('');
      if (autoSelect) {
        mdSel.value = String(vals[0]);            // 새 탐색: 최솟값 강제 선택
      } else if (vals.includes(parseInt(prev, 10))) {
        mdSel.value = prev;                       // 필터 변경: 사용자 선택 유지
      } else {
        mdSel.value = '';
      }
    }
  }

  const qSel = document.getElementById('qualitySel');
  if (qSel) {
    const prev = qSel.value;
    if (candidates.length === 0) {
      qSel.innerHTML = '<option value="">전체</option>';
      qSel.value = '';
    } else {
      const vals = [...new Set(candidates.map(c => c.total_score ?? 0))].sort((a, b) => b - a);
      qSel.innerHTML = '<option value="">전체</option>' +
        vals.map(v => `<option value="${v}">Σ ${v >= 0 ? '+' : ''}${v}</option>`).join('');
      if (autoSelect) {
        qSel.value = String(vals[0]);             // 새 탐색: 최댓값 강제 선택
      } else if (vals.includes(parseInt(prev, 10))) {
        qSel.value = prev;                        // 필터 변경: 사용자 선택 유지
      } else {
        qSel.value = '';
      }
    }
  }
}

// 필터 변경 핸들러 — custom/square/staggered 모두 _enumResult 캐시 기준 재렌더
function filterByMdistinct() { _renderFromCache(); }
function filterByQuality()   { _renderFromCache(); }

function _renderFromCache() {
  if (state.arrangement === 'custom') {
    _renderCustomCandidates(_enumResult, false);  // 필터 변경: 사용자 선택 유지
  } else {
    // square/staggered: _enumResult 캐시 기준으로 ①②③④ 재수행 (재열거 없음)
    if (!_enumResult) return;
    const listEl  = document.getElementById('candList');
    const countEl = document.getElementById('rpCandCount');
    const { S }   = state;
    if (!listEl) return;

    let candidates = (_enumResult.candidates || []).slice()
      .sort((a, b) => (a.m_distinct || 0) - (b.m_distinct || 0));
    if (state.max_plates > 0)
      candidates = candidates.filter(c => (c.m_distinct || 0) <= state.max_plates);

    _syncFilterOptions({ candidates }, false);  // 필터 변경: 사용자 선택 유지

    const mdSel = document.getElementById('mdistinctSel');
    const mdV = mdSel ? mdSel.value : '';
    if (mdV !== '') candidates = candidates.filter(c => (c.m_distinct || 0) === parseInt(mdV, 10));
    const qSel = document.getElementById('qualitySel');
    const qV = qSel ? qSel.value : '';
    if (qV !== '') candidates = candidates.filter(c => (c.total_score ?? 0) === parseInt(qV, 10));

    if (countEl) countEl.textContent = candidates.length + '개';
    listEl.innerHTML = '';
    if (candidates.length === 0) {
      listEl.innerHTML = '<div class="hint" style="margin-top:4px;color:var(--amber)">현재 필터 조건으로 후보 없음</div>';
      _showCandDetail(-1);
      return;
    }
    if (state.selected_ordering >= candidates.length) state.selected_ordering = 0;
    _renderCandCards(candidates, listEl, S);
    _showCandDetail(state.selected_ordering);
  }
}
