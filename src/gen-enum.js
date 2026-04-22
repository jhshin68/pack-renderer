/**
 * gen-enum.js — 홀더 그리드 & 경계 & Hamiltonian 그룹 배정 열거기 (LAYER 3)
 *
 * 추출 출처: generator.js §2.5 H1/H2/H3 + §1.5 _shapeSigOf
 * 의존 관계:
 *   gen-math.js   → _pt, estimatePitch, buildAdjacency, compactShapeScore,
 *                   checkPlanarNoCrossing, groupQualityScore
 *   gen-layout.js → canonicalSig
 *   pentomino_tiling.js → _PT (Phase 4 DLX 타일링)
 * 공개 API:
 *   _shapeSigOf, calcBoundarySet, calcCustomBoundarySet,
 *   buildHolderGrid, enumerateGroupAssignments
 *
 * 이중 런타임:
 *   Node.js  → module.exports = { ... }
 *   Browser  → window._GenEnum = { ... }  (gen-math·gen-layout 로드 후, generator.js 전에 로드)
 */
(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════
  // 서브모듈 의존성 로드
  // ═══════════════════════════════════════════════
  const _isNode = typeof require !== 'undefined' && typeof module !== 'undefined';

  const _math = _isNode ? require('./gen-math') : (global._GenMath || {});
  const _layout = _isNode ? require('./gen-layout') : (global._GenLayout || {});

  const { _pt, estimatePitch, buildAdjacency, compactShapeScore,
          checkPlanarNoCrossing, groupQualityScore } = _math;
  const { canonicalSig, calcNickelPattern } = _layout;

  // ═══════════════════════════════════════════════
  // Phase 4: pentomino_tiling.js 로드 (Node: require / Browser: global)
  // ═══════════════════════════════════════════════
  const _PT = _isNode
    ? require('./pentomino_tiling.js')
    : (typeof PentominoTiling !== 'undefined' ? PentominoTiling : null); // eslint-disable-line no-undef

  // ═══════════════════════════════════════════════
  // _shapeSigOf — 그룹 형상 캐노니컬 서명 (원칙 12, rotSteps 회전만)
  // ═══════════════════════════════════════════════

  /**
   * 그룹 형상 캐노니컬 서명 — centroid 원점 이동 후 회전만 고려(원칙 12)
   *   rotSteps: 4 (square) | 6 (hex/staggered)
   */
  function _shapeSigOf(group, rotSteps) {
    const cells = (group && group.cells) || [];
    if (cells.length === 0) return '[]';
    const pts = cells.map(c => {
      const p = _pt(c);
      return [p.x, p.y];
    });
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const shifted = pts.map(([x, y]) => [x - cx, y - cy]);
    return canonicalSig(shifted, rotSteps);
  }

  // ═══════════════════════════════════════════════
  // _plateMdistinct — 원칙 14 합판 단위 distinct 형상 수
  // ═══════════════════════════════════════════════

  /**
   * 원칙 14 상/하면 합판(플레이트) 기준 distinct 형상 수.
   *   I형 플레이트(B+/B- 단독 그룹)와 U형 플레이트(인접 2그룹 합산)를 각각 서명 계산.
   *   rotSteps=4: 0°/90°/180°/270° 회전 동일, 미러는 별도 형상.
   */
  function _plateMdistinct(groups, S) {
    const { top, bot } = calcNickelPattern(S);
    const sigs = new Set();
    for (const plate of [...top, ...bot]) {
      const cells = plate.groups.flatMap(gi => (groups[gi] ? groups[gi].cells : []));
      if (cells.length > 0) sigs.add(_shapeSigOf({ cells }, 4));
    }
    return sigs.size;
  }

  // ═══════════════════════════════════════════════
  // H2: 경계 셀 집합
  // ═══════════════════════════════════════════════

  /**
   * 경계 셀 집합 계산 (H2 — Level 2 입력)
   * cells: [{x,y}]  side: 'top'|'bottom'|'left'|'right'
   * 반환: Set<number> — cells[] 인덱스
   */
  function calcBoundarySet(cells, side) {
    if (!cells || cells.length === 0) return new Set();
    const p = estimatePitch(cells);
    const tol = p * 0.5;
    const xs = cells.map(c => c.x), ys = cells.map(c => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const set = new Set();
    for (let i = 0; i < cells.length; i++) {
      const { x, y } = cells[i];
      switch (side) {
        case 'left':   if (x <= minX + tol) set.add(i); break;
        case 'right':  if (x >= maxX - tol) set.add(i); break;
        case 'top':    if (y <= minY + tol) set.add(i); break;
        case 'bottom': if (y >= maxY - tol) set.add(i); break;
      }
    }
    return set;
  }

  /**
   * 커스텀 배열 전용 경계 셀 집합 (Bug2 — 행별 오프셋 보정)
   * 'left'/'right': 각 행에서 x가 최소/최대인 셀 (전역 min/max 아님)
   * 'top'/'bottom': 기존 y 기반 로직 동일
   */
  function calcCustomBoundarySet(cells, side) {
    if (!cells || cells.length === 0) return new Set();
    const rowMap = new Map();
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].row;
      if (!rowMap.has(r)) rowMap.set(r, []);
      rowMap.get(r).push(i);
    }
    const set = new Set();
    if (side === 'left') {
      for (const idxs of rowMap.values()) {
        let minX = Infinity, minI = -1;
        for (const i of idxs) { if (cells[i].x < minX) { minX = cells[i].x; minI = i; } }
        if (minI >= 0) set.add(minI);
      }
    } else if (side === 'right') {
      for (const idxs of rowMap.values()) {
        let maxX = -Infinity, maxI = -1;
        for (const i of idxs) { if (cells[i].x > maxX) { maxX = cells[i].x; maxI = i; } }
        if (maxI >= 0) set.add(maxI);
      }
    } else {
      const ys = cells.map(c => c.y);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const tol = estimatePitch(cells) * 0.5;
      for (let i = 0; i < cells.length; i++) {
        if (side === 'top'    && cells[i].y <= minY + tol) set.add(i);
        if (side === 'bottom' && cells[i].y >= maxY - tol) set.add(i);
      }
    }
    return set;
  }

  // ═══════════════════════════════════════════════
  // H1: 홀더 그리드
  // ═══════════════════════════════════════════════

  /**
   * 홀더 그리드 셀 좌표 생성 (H1 — Level 1 물리 홀더)
   * hRows: 홀더 행 수  hCols: 홀더 열 수
   * pattern: 'square'|'staggered'
   * emptyCells: [[row,col], ...] 빈 슬롯 좌표
   * params: { cell_type, gap, scale, margin_mm }  cellSpec: CELL_SPEC
   * 반환: [{x, y, row, col}]  (빈 슬롯 제외)
   */
  function buildHolderGrid(hRows, hCols, pattern, emptyCells, params, cellSpec) {
    if (!cellSpec) throw new Error('[generator.buildHolderGrid] cellSpec 미제공');
    const spec = cellSpec[params.cell_type];
    if (!spec) throw new Error(`[generator.buildHolderGrid] 알 수 없는 cell_type: ${params.cell_type}`);

    const pitch  = (spec.render_d + (params.gap || 0)) * params.scale;
    const pitchY = pattern === 'staggered' ? pitch * Math.sqrt(3) / 2 : pitch;
    const R      = (spec.render_d / 2) * params.scale;
    const margin = params.margin_mm * params.scale;

    const emptySet = new Set((emptyCells || []).map(([r, c]) => `${r},${c}`));
    const cells = [];

    for (let r = 0; r < hRows; r++) {
      const stagOffX = (pattern === 'staggered' && r % 2 === 1) ? pitch / 2 : 0;
      for (let c = 0; c < hCols; c++) {
        if (emptySet.has(`${r},${c}`)) continue;
        cells.push({
          x: margin + stagOffX + c * pitch + R,
          y: margin + r * pitchY + R,
          row: r, col: c,
        });
      }
    }
    return cells;
  }

  // ═══════════════════════════════════════════════
  // H3: Hamiltonian 그룹 배정 열거기
  // ═══════════════════════════════════════════════

  /**
   * Hamiltonian 그룹 배정 열거기 — 하이브리드 전략 (H3)
   * docs/holder_array_constraint_design.md §5 알고리즘 파이프라인 구현
   *
   * 전략:
   *   Phase 1 — 표준 배열 4종 (square·staggered 항상 생성, 즉시 O(N))
   *     · 보스트로페돈 L→R / R→L (행 우선 지그재그)
   *     · 열 우선 L→R / R→L (컬럼 단위)
   *   Phase 2 — 백트래킹 (N ≤ 18 추가 비표준 해 탐색)
   *     · ICC①(행스팬≤2), ICC②(종횡비, I형 제외), T/Y 분기 가지치기
   *     · B+/B− 경계 강제
   *
   * ctx: {
   *   cells,          // [{x,y}] — buildHolderGrid / calcCellCenters 결과
   *   S, P, arrangement, b_plus_side, b_minus_side,
   *   icc1, icc2, icc3,  max_candidates (default 20)
   * }
   * 반환: { candidates, count, strategy, boundary_plus_count, boundary_minus_count }
   */
  function enumerateGroupAssignments(ctx) {
    const {
      cells, S, P, arrangement = 'square',
      b_plus_side  = 'left',
      b_minus_side = 'right',
      icc1 = true, icc2 = true, icc3 = false,
      max_candidates = 20,
      g0_anchor = null,  // ★ Phase 2: 1번 셀 위치 제약 (null | 'TL'|'TR'|'BL'|'BR'|'L'|'R' | {row, col})
      allow_I = false,   // ★ Phase 4: I-pentomino 허용 여부
      allow_U = false,   // ★ Phase 4: U-pentomino 허용 여부
      pitch: pitchArg = null, // ★ Bug1: 커스텀 배열에서 calcCustomCenters가 반환한 실제 pitch 명시 전달
      use_beam_search = true, // ★ Phase 2: Beam Search 활성화 (false = 기존 MRV 동작)
      custom_stagger = false, // ★ P28③: 렌더러 임계값 정합성 (stagger→1.2P, non-stagger→1.05P)
      exhaustive = false,     // ★ 완전 탐색 모드: true → 타임아웃·반복 제한·adjStarts 캡 해제
      budget_ms = null,       // ★ 완전 탐색 시간 예산 (ms). null → exhaustive:false=10s, true=Infinity
      fixed_g0 = null,        // ★ 병렬탐색: G0 셀 인덱스 배열 고정 → G1..G(S-1)만 백트래킹
      enumerate_g0_only = false, // ★ 병렬탐색: true → G0 후보 목록만 반환 (backtracking 생략)
    } = ctx || {};

    if (!cells || cells.length === 0 || S < 1 || P < 1) {
      return { candidates: [], count: 0, strategy: 'none', error: 'invalid ctx' };
    }
    const N = cells.length;
    if (N < S * P) {
      return { candidates: [], count: 0, strategy: 'none', error: `셀 부족: ${N} < ${S}×${P}` };
    }

    const pitch = (pitchArg != null) ? pitchArg : estimatePitch(cells);
    const thr   = arrangement === 'custom' ? pitch * 1.5 : pitch * 1.05;
    // renderThr: renderer.js isAdj와 동일한 임계값 — P28③ U판 연결성 검증에 사용
    const renderThr = custom_stagger ? pitch * 1.2 : pitch * 1.05;
    const bPlus  = arrangement === 'custom' ? calcCustomBoundarySet(cells, b_plus_side)  : calcBoundarySet(cells, b_plus_side);
    const bMinus = arrangement === 'custom' ? calcCustomBoundarySet(cells, b_minus_side) : calcBoundarySet(cells, b_minus_side);

    // ★ Phase 2: G0 앵커 매칭 헬퍼
    //   TL/TR/BL/BR: row 최소/최대 × col 최소/최대 교차
    //   {row, col}:  셀의 row/col 필드와 정확 일치
    let anchorCells = null;  // 앵커에 부합하는 셀 배열 (null → 제약 없음)
    let anchorWarning = null;
    if (g0_anchor) {
      const rows = cells.map(c => c.row).filter(v => typeof v === 'number');
      const cols = cells.map(c => c.col).filter(v => typeof v === 'number');
      if (rows.length === 0 || cols.length === 0) {
        anchorWarning = 'g0_anchor_no_row_col_fields';
      } else {
        const rMin = Math.min(...rows), rMax = Math.max(...rows);
        const cMin = Math.min(...cols), cMax = Math.max(...cols);
        // 'L'/'R' 앵커: 각 행의 맨 왼쪽/오른쪽 셀 전체 (행별 경계)
        const rowMinCol = new Map(), rowMaxCol = new Map();
        for (const c of cells) {
          if (typeof c.row === 'number' && typeof c.col === 'number') {
            const rm = rowMinCol.get(c.row);
            if (rm === undefined || c.col < rm) rowMinCol.set(c.row, c.col);
            const rx = rowMaxCol.get(c.row);
            if (rx === undefined || c.col > rx) rowMaxCol.set(c.row, c.col);
          }
        }
        const pred = (typeof g0_anchor === 'object')
          ? (c => c.row === g0_anchor.row && c.col === g0_anchor.col)
          : ({
              'TL': c => c.row === rMin && c.col === cMin,
              'TR': c => c.row === rMin && c.col === cMax,
              'BL': c => c.row === rMax && c.col === cMin,
              'BR': c => c.row === rMax && c.col === cMax,
              'L':  c => typeof c.col === 'number' && c.col === rowMinCol.get(c.row),
              'R':  c => typeof c.col === 'number' && c.col === rowMaxCol.get(c.row),
            }[g0_anchor] || (() => true));
        anchorCells = cells.filter(pred);
        if (anchorCells.length === 0) {
          anchorWarning = 'g0_anchor_no_match';
        } else {
          // B+ 경계와 교집합 체크
          const anchorIdxs = anchorCells.map(c => cellIdxMapLocal(c));
          const inBPlus = anchorIdxs.some(i => i != null && bPlus.has(i));
          if (!inBPlus) anchorWarning = 'g0_anchor_outside_boundary';
        }
      }
    }

    // cellIdxMap을 앵커 체크에서 먼저 쓰기 위한 로컬 헬퍼 (하단 cellIdxMap 정의와 동일 로직)
    function cellIdxMapLocal(c) {
      const key = `${Math.round(c.x * 10)},${Math.round(c.y * 10)}`;
      for (let i = 0; i < cells.length; i++) {
        if (`${Math.round(cells[i].x * 10)},${Math.round(cells[i].y * 10)}` === key) return i;
      }
      return null;
    }

    const anchorMatches = (cell) => {
      if (!anchorCells) return true;
      return anchorCells.some(ac => ac.row === cell.row && ac.col === cell.col);
    };

    // I형(1자) 판별: 4개 이상 셀이 직선 또는 지그재그 단순 경로 형성
    const _isLinearGroup = (gc) => {
      if (gc.length < 4) return false;
      const pts = gc.map(c => _pt(c));

      // 순수 직선: 모든 x 동일 또는 모든 y 동일
      const xs = pts.map(p => Math.round(p.x * 10));
      const ys = pts.map(p => Math.round(p.y * 10));
      if (new Set(xs).size === 1 || new Set(ys).size === 1) return true;

      // 지그재그 경로: 인접 그래프가 단순 경로(분기 없음, 끝점 2개)
      let minDist = Infinity;
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < minDist) minDist = d;
        }
      const thr = minDist * 1.6;
      const deg = new Array(pts.length).fill(0);
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++)
          if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) <= thr) {
            deg[i]++; deg[j]++;
          }
      // 단순 경로: 분기(degree > 2) 없고 끝점(degree === 1) 정확히 2개
      return !deg.some(d => d > 2) && deg.filter(d => d === 1).length === 2;
    };

    // ── ICC 정보 계산 (per group cell array) ────────────────────────
    function groupICC(gc) {
      // T/Y 분기
      const edges = buildAdjacency(gc, arrangement, pitch);
      const deg = new Array(gc.length).fill(0);
      for (const { i, j } of edges) { deg[i]++; deg[j]++; }
      const hasT = deg.some(d => d >= 3);

      const gxs = gc.map(c => c.x), gys = gc.map(c => c.y);
      const spanX = Math.max(...gxs) - Math.min(...gxs);
      const spanY = Math.max(...gys) - Math.min(...gys);
      const is1D  = spanX < thr * 0.1 || spanY < thr * 0.1;
      const rowSpan = Math.round(spanY / (pitch || 1)) + 1;
      const colSpan = Math.round(spanX / (pitch || 1)) + 1;
      const ratio   = is1D ? 1 : Math.max(spanX, spanY) / (Math.min(spanX, spanY) || 1);

      return {
        edges, hasT, is1D, rowSpan, colSpan, ratio,
        icc1_ok: Math.min(rowSpan, colSpan) <= 2,
        icc2_ok: is1D || ratio <= 2.0,
        qs: groupQualityScore(gc, edges),
      };
    }

    // 그룹 내 셀 연결성 검사 (원칙 1: P개 셀이 인접 그래프 상 연결되어야 함)
    function isGroupConnected(gc, thrOverride) {
      const t = (thrOverride != null ? thrOverride : thr) + 0.5;
      if (gc.length <= 1) return true;
      const adj = Array.from({ length: gc.length }, () => []);
      for (let i = 0; i < gc.length; i++)
        for (let j = i + 1; j < gc.length; j++)
          if (Math.hypot(gc[i].x - gc[j].x, gc[i].y - gc[j].y) <= t) {
            adj[i].push(j); adj[j].push(i);
          }
      const vis = new Set([0]);
      const q = [0];
      while (q.length) {
        const n = q.shift();
        for (const nb of adj[n]) if (!vis.has(nb)) { vis.add(nb); q.push(nb); }
      }
      return vis.size === gc.length;
    }

    // 후보 유효성 검사: 원칙 8(셀수), 21A(그룹 내 연결), 21B+28③(인접 그룹 쌍 연결)
    function validateCandidate(groups) {
      // P28②: 각 그룹 정확히 P셀
      for (let g = 0; g < groups.length; g++) {
        if (groups[g].cells.length !== P) return false;
      }
      // P21A: 그룹 내 연결성
      for (let g = 0; g < groups.length; g++) {
        if (!isGroupConnected(groups[g].cells)) return false;
      }
      // P21B: 인접 그룹 쌍 연결
      for (let g = 0; g + 1 < groups.length; g++) {
        const ga = groups[g].cells, gb = groups[g + 1].cells;
        const ok = ga.some(a => gb.some(b =>
          Math.hypot(a.x - b.x, a.y - b.y) <= thr + 0.5));
        if (!ok) return false;
      }
      // P28③: 2P 병합 플레이트 연결성 — renderThr 사용(renderer.js isAdj와 임계값 일치)
      for (let pStart = 0; pStart <= 1; pStart++) {
        for (let g = pStart; g + 1 < groups.length; g += 2) {
          const merged = [...groups[g].cells, ...groups[g + 1].cells];
          if (!isGroupConnected(merged, renderThr)) return false;
        }
      }
      // ★ 원칙 30: 동일 면 이종 플레이트 비교차 (쇼트 절대 금지)
      if (!checkPlanarNoCrossing(groups, thr)) return false;
      return true;
    }

    // ── Phase 1: 표준 배열 4종 생성 ─────────────────────────────────
    function makeBoustrophedon(startLTR) {
      const rowMap = new Map();
      for (const c of cells) {
        const ry = Math.round(c.y / (pitch || 1));
        if (!rowMap.has(ry)) rowMap.set(ry, []);
        rowMap.get(ry).push(c);
      }
      const flat = [];
      [...rowMap.keys()].sort((a, b) => a - b).forEach((ry, ri) => {
        const row = [...rowMap.get(ry)].sort((a, b) => a.x - b.x);
        const ltr = startLTR ? ri % 2 === 0 : ri % 2 !== 0;
        flat.push(...(ltr ? row : [...row].reverse()));
      });
      return flat;
    }

    function makeColumnFirst(rtl) {
      const colMap = new Map();
      for (const c of cells) {
        const cx = Math.round(c.x / (pitch || 1));
        if (!colMap.has(cx)) colMap.set(cx, []);
        colMap.get(cx).push(c);
      }
      const flat = [];
      [...colMap.keys()].sort((a, b) => rtl ? b - a : a - b).forEach(cx => {
        flat.push(...[...colMap.get(cx)].sort((a, b) => a.y - b.y));
      });
      return flat;
    }

    // xy → cell index 매핑 (경계 포함 여부 빠른 판정)
    const xyKey = c => `${Math.round(c.x * 10)},${Math.round(c.y * 10)}`;
    const cellIdxMap = new Map(cells.map((c, i) => [xyKey(c), i]));

    function cellInBoundary(c, bndSet) {
      const idx = cellIdxMap.get(xyKey(c));
      return idx !== undefined && bndSet.has(idx);
    }

    function flatToCandidate(flat, name, desc) {
      if (flat.length < S * P) return null;
      const groups = [];
      let iccViolations = 0;
      for (let g = 0; g < S; g++) {
        const gc = flat.slice(g * P, (g + 1) * P);
        if (!isGroupConnected(gc)) return null;
        const icc = groupICC(gc);
        if (icc.hasT) iccViolations++;
        if (icc1 && !icc.icc1_ok) iccViolations++;
        if (icc2 && !icc.icc2_ok) iccViolations++;
        groups.push({
          index: g, cells: gc,
          quality_score: icc.qs,
          is_b_plus:  g === 0,
          is_b_minus: g === S - 1,
          icc1_ok: icc.icc1_ok, icc2_ok: icc.icc2_ok, has_TY: icc.hasT,
        });
      }
      if (!validateCandidate(groups)) return null;
      const bpOk = groups[0]?.cells.some(c => cellInBoundary(c, bPlus)) ?? false;
      const bmOk = groups[S - 1]?.cells.some(c => cellInBoundary(c, bMinus)) ?? false;
      const totalScore = groups.reduce((s, g) => s + g.quality_score, 0);
      return {
        groups, total_score: totalScore,
        name, desc, is_standard: true,
        b_plus_ok: bpOk, b_minus_ok: bmOk,
        icc_violations: iccViolations,
        total_plates: S + 1,
      };
    }

    const results = [];
    let btIterations = 0;
    let strategy = 'standard';

    {
      const STANDARD = [
        { name: '보스트로페돈 L→R', desc: '행 우선 · 짝수행 L→R', fn: () => makeBoustrophedon(true)  },
        { name: '보스트로페돈 R→L', desc: '행 우선 · 짝수행 R→L', fn: () => makeBoustrophedon(false) },
        { name: '열 우선 L→R',      desc: '열 우선 · 좌열→우열',  fn: () => makeColumnFirst(false)   },
        { name: '열 우선 R→L',      desc: '열 우선 · 우열→좌열',  fn: () => makeColumnFirst(true)    },
      ];
      for (const ord of STANDARD) {
        let flat = ord.fn();
        // ★ G0 앵커: 첫 셀이 앵커와 불일치면 reverse 시도, 여전히 불일치면 drop
        if (anchorCells) {
          if (flat.length > 0 && !anchorMatches(flat[0])) {
            const reversed = [...flat].reverse();
            if (reversed.length > 0 && anchorMatches(reversed[0])) flat = reversed;
            else continue;
          }
        }
        const cand = flatToCandidate(flat, ord.name, ord.desc);
        if (cand) {
          if (!allow_I && cand.groups.some(g => _isLinearGroup(g.cells))) continue;
          results.push(cand);
        }
      }
    }

    // ── Phase 4: 폴리오미노 DLX (P>=2, 커스텀 포함; G0 열거 단계 제외) ──────────────────
    if (_PT && P >= 2 && S >= 2 && !enumerate_g0_only) {
      const pentResults = _PT.enumeratePentominoTilings(cells, S, P, {
        b_plus_side, b_minus_side,
        g0_anchor,
        allow_I, allow_U,
        arrangement,
        adj_thr: thr,  // 커스텀=1.5p, 표준=1.05p
        max_candidates: Math.max(20, max_candidates),
        time_budget_ms: 1500,
      });
      if (pentResults.length > 0) {
        results.push(...pentResults);
        strategy = 'standard+pentomino';
      }
    }

    // ── Phase 2: 백트래킹 (N ≤ 18 소형 또는 custom 배열, 비표준 해 탐색) ──────────
    if (arrangement === 'custom' || N <= 18 || fixed_g0 != null || enumerate_g0_only) {
      strategy = 'standard+backtracking';
      const btBudgetMs = budget_ms != null ? budget_ms
                       : exhaustive ? Infinity
                       : (arrangement === 'custom' ? 10000 : Infinity);
      const btStart    = Date.now();

      const adjL = Array.from({ length: N }, () => []);
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          if (Math.hypot(cells[i].x - cells[j].x, cells[i].y - cells[j].y) <= thr) {
            adjL[i].push(j); adjL[j].push(i);
          }
        }
      }

      function passICC_bt(idxArr) {
        if (idxArr.length < 2) return true;
        const gc = idxArr.map(i => cells[i]);
        const icc = groupICC(gc);
        if (icc3 && icc.hasT) return false;
        if (icc1 && !icc.icc1_ok) return false;
        if (icc2) {
          const maxRatio = arrangement === 'custom' ? 4.0 : 2.0;
          if (!icc.is1D && icc.ratio > maxRatio) return false;
        }
        return true;
      }

      // 표준 배열과 동일한 그룹 구성인지 시그니처로 중복 검사
      const seenSigs = new Set(results.map(r =>
        r.groups.map(g => g.cells.map(c => xyKey(c)).sort().join(';')).join('|')
      ));
      const used = new Uint8Array(N);
      const MAX_ITER_BT = Infinity; // 시간 예산(budget_ms)으로만 제어

      // ── 후보 정렬 비교기 (오름차순: a가 b보다 좋으면 음수) ────────────
      // B+/B- 충족 → m_distinct 오름차순 → ICC 위반 오름차순 → total_score 내림차순
      function candCmp(a, b) {
        const aOk = (a.b_plus_ok && a.b_minus_ok) ? 0 : 1;
        const bOk = (b.b_plus_ok && b.b_minus_ok) ? 0 : 1;
        if (aOk !== bOk) return aOk - bOk;
        if (a.m_distinct !== b.m_distinct) return a.m_distinct - b.m_distinct;
        if (a.icc_violations !== b.icc_violations) return a.icc_violations - b.icc_violations;
        if (a.total_score !== b.total_score) return b.total_score - a.total_score;
        return 0;
      }

      // ── 공통 후보 기록 헬퍼 (우선순위 축출 포함) ──────────────────────
      // max_candidates 초과 시: 결과 집합에서 worst를 찾아 새 후보와 비교,
      // 새 후보가 더 좋으면 worst를 축출한다 → 전체 탐색 후 최적 K개 보장.
      function commitCandidate(allSnaps) {
        const groups = allSnaps.map((g, gi) => {
          const gc = g.map(i => cells[i]);
          const icc = groupICC(gc);
          return {
            index: gi, cells: gc,
            quality_score: icc.qs,
            is_b_plus: gi === 0, is_b_minus: gi === S - 1,
            icc1_ok: icc.icc1_ok, icc2_ok: icc.icc2_ok, has_TY: icc.hasT,
          };
        });
        if (!allow_I && groups.some(g => _isLinearGroup(g.cells))) return;
        if (!validateCandidate(groups)) return;
        const sig = groups.map(g => g.cells.map(c => xyKey(c)).sort().join(';')).join('|');
        if (!seenSigs.has(sig)) {
          seenSigs.add(sig);
          const totalScore = groups.reduce((s, g) => s + g.quality_score, 0);
          const mD = _plateMdistinct(groups, S);
          const newCand = {
            groups, total_score: totalScore,
            name: `비표준 ${seenSigs.size}`, desc: 'backtracking',
            is_standard: false, b_plus_ok: true, b_minus_ok: true,
            icc_violations: 0, total_plates: S + 1,
            m_distinct: mD,
          };
          if (results.length < max_candidates) {
            results.push(newCand);
          } else {
            // 결과 집합에서 worst(candCmp 기준 최대값) 탐색 후 축출 여부 결정
            let worstIdx = 0;
            for (let i = 1; i < results.length; i++) {
              if (candCmp(results[i], results[worstIdx]) > 0) worstIdx = i;
            }
            if (candCmp(newCand, results[worstIdx]) < 0) {
              results[worstIdx] = newCand;
            }
          }
        }
      }

      if (arrangement === 'custom') {
        // ── BFS Greedy (MRV 휴리스틱) ─────────────────────────────────────
        // DFS가 불규칙 행 배치에서 탐색 공간 폭발로 0개를 반환하는 문제 해결.
        // x 오름차순 스캔, 각 그룹은 BFS 확장 + MRV(최소 남은 이웃) 선택.
        // 결정론적(1후보)이므로 먼저 실행하고 DFS로 추가 후보를 시도한다.
        // fixed_g0 모드(worker) 또는 G0 열거 전용 모드에서는 BFS Greedy 생략
        if (!fixed_g0 && !enumerate_g0_only) {
          const scanByX = [...Array(N).keys()]
            .sort((a, b) => cells[a].x - cells[b].x || cells[a].y - cells[b].y);

          // MRV + 2번째 픽 수평 우선(같은 행) + I형 회피
          // • step 2 (group.length=1): 같은 행 후보 있으면 해당 후보로 제한
          // • step 4 (group.length=P-1): I형 체인 되는 후보 제거
          // • 나머지: MRV(최소 남은 이웃) 기본
          function pickCompactHoriz(candidates, group) {
            const groupCells = group.map(i => cells[i]);
            let pool = candidates;

            // step 2: 수평 우선
            if (group.length === 1) {
              const lastCell = cells[group[0]];
              const sameRow = pool.filter(c => cells[c].row === lastCell.row);
              if (sameRow.length > 0) pool = sameRow;
            }

            // step P-1: I형 완성 방지
            if (!allow_I && group.length === P - 1) {
              const nonI = pool.filter(c => !_isLinearGroup([...groupCells, cells[c]]));
              if (nonI.length > 0) pool = nonI;
            }

            // MRV: 남은 이웃이 가장 적은 셀 선택
            let best = -1, bestMRV = Infinity;
            for (const c of pool) {
              const remaining = adjL[c].filter(j => !used[j]).length;
              if (remaining < bestMRV) { bestMRV = remaining; best = c; }
            }
            return best;
          }

          const bPlusInOrderX = scanByX.filter(i => bPlus.has(i));
          const bPlusStartCells = anchorCells
            ? bPlusInOrderX.filter(i => anchorMatches(cells[i]))
            : bPlusInOrderX;

          for (const g0start of bPlusStartCells) {
            used.fill(0);
            const allSnaps = [];
            let ok = true;
            let prevGroup = null;

            for (let g = 0; g < S; g++) {
              let start = -1;
              if (g === 0) {
                start = g0start;
              } else {
                for (const i of scanByX) {
                  if (!used[i] && prevGroup.some(pi => adjL[pi].includes(i))) { start = i; break; }
                }
                if (start < 0) for (const i of scanByX) if (!used[i]) { start = i; break; }
              }
              if (start < 0) { ok = false; break; }

              const group = [start]; used[start] = 1;
              const frontier = new Set(adjL[start].filter(j => !used[j]));
              while (group.length < P && frontier.size > 0) {
                const next = pickCompactHoriz([...frontier], group);
                if (next < 0) break;
                group.push(next); used[next] = 1; frontier.delete(next);
                for (const nb of adjL[next]) if (!used[nb]) frontier.add(nb);
              }
              if (group.length < P) { ok = false; break; }
              if (g === S - 1 && !group.some(i => bMinus.has(i))) { ok = false; break; }

              allSnaps.push(group);
              prevGroup = group;
            }

            if (ok && allSnaps.length === S) {
              used.fill(0); // commitCandidate reads cells[], not used
              commitCandidate(allSnaps);
            }
            used.fill(0);
          }
        } // end if (!fixed_g0) BFS Greedy

        // ── Phase 2: Beam Search (pickCompact × 4 프리셋 × beam_width=5) ────────────
        if (!fixed_g0 && !enumerate_g0_only && use_beam_search && Date.now() - btStart < btBudgetMs) {
          const BEAM_W = 5;
          const PC_PRESETS = [
            {wh:1.0, wv:0.5, wd:0.3, wc:1.0, ws:0.8, piso:0.8, picc:2.0}, // HORIZ_FIRST
            {wh:0.5, wv:1.0, wd:0.3, wc:1.0, ws:0.8, piso:0.8, picc:2.0}, // VERT_FIRST
            {wh:0.8, wv:0.8, wd:0.4, wc:2.0, ws:1.0, piso:1.0, picc:2.0}, // COMPACT
            {wh:0.7, wv:0.7, wd:0.3, wc:1.2, ws:2.0, piso:0.8, picc:2.0}, // SHAPE_MATCH
          ];

          function computeBbox(idxArr) {
            const cs = idxArr.map(i => cells[i]);
            const minX = Math.min(...cs.map(c => c.x));
            const maxX = Math.max(...cs.map(c => c.x));
            const minY = Math.min(...cs.map(c => c.y));
            const maxY = Math.max(...cs.map(c => c.y));
            const w = (maxX - minX) / pitch + 1;
            const h = (maxY - minY) / pitch + 1;
            return { cx: (minX+maxX)/2, cy: (minY+maxY)/2, w, h, aspect: h > 0.01 ? w/h : w };
          }

          function scoreCellBeam(c, lastIdx, groupIdxs, prevBbox, usedArr, preset) {
            const cell = cells[c];
            const lc = lastIdx >= 0 ? cells[lastIdx] : null;
            const H = lc && cell.row === lc.row ? 1 : 0;
            const V = lc && Math.abs(cell.x - lc.x) < pitch * 0.1 ? 1 : 0;
            const dx = lc ? Math.abs(cell.x - lc.x) : 0;
            const dy = lc ? Math.abs(cell.y - lc.y) : 0;
            const D = (lc && dx > pitch*0.3 && dy > pitch*0.3) ? 1 : 0;
            const gco = groupIdxs.map(i => cells[i]);
            const gx = gco.length > 0 ? gco.reduce((s,c) => s+c.x, 0)/gco.length : cell.x;
            const gy = gco.length > 0 ? gco.reduce((s,c) => s+c.y, 0)/gco.length : cell.y;
            const C = Math.max(0, 1 - Math.hypot(cell.x-gx, cell.y-gy)/pitch);
            let M = 0;
            if (prevBbox && gco.length > 0) {
              const cb = computeBbox([...groupIdxs, c]);
              M = Math.exp(-Math.abs(cb.aspect - prevBbox.aspect));
            }
            const I = adjL[c].filter(j => !usedArr[j]).length === 0 ? 1 : 0;
            const X = _isLinearGroup([...gco, cell]) ? 1 : 0;
            return preset.wh*H + preset.wv*V + preset.wd*D + preset.wc*C + preset.ws*M
                   - preset.piso*I - preset.picc*X;
          }

          function buildGroupBeam(seedIdx, prevBbox, inputUsed, preset) {
            const lu = inputUsed.slice();
            lu[seedIdx] = 1;
            const grp = [seedIdx];
            const fr = new Set(adjL[seedIdx].filter(j => !lu[j]));
            while (grp.length < P && fr.size > 0) {
              let pool = [...fr];
              if (grp.length === P - 1 && !allow_I) {
                const nonI = pool.filter(c => !_isLinearGroup([...grp.map(i => cells[i]), cells[c]]));
                if (nonI.length > 0) pool = nonI;
              }
              if (pool.length === 0) return null;
              let best = -1, bestSc = -Infinity;
              const li = grp[grp.length - 1];
              for (const c of pool) {
                const sc = scoreCellBeam(c, li, grp, prevBbox, lu, preset);
                if (sc > bestSc) { bestSc = sc; best = c; }
              }
              if (best < 0) return null;
              grp.push(best); lu[best] = 1; fr.delete(best);
              for (const nb of adjL[best]) if (!lu[nb]) fr.add(nb);
            }
            return grp.length === P ? { group: grp, usedArr: lu } : null;
          }

          const bPlusBeam = anchorCells
            ? [...bPlus].filter(i => anchorMatches(cells[i]))
            : [...bPlus];

          for (const seed of bPlusBeam) {
            if (Date.now() - btStart > btBudgetMs) break;

            for (const preset of PC_PRESETS) {
              if (Date.now() - btStart > btBudgetMs) break;

              const g0 = buildGroupBeam(seed, null, new Uint8Array(N), preset);
              if (!g0 || !passICC_bt(g0.group)) continue;
              if (S === 1 && !g0.group.some(i => bMinus.has(i))) continue;

              let beam = [{ groups: [g0.group], usedArr: g0.usedArr, prevBbox: computeBbox(g0.group) }];

              for (let g = 1; g < S; g++) {
                if (Date.now() - btStart > btBudgetMs) break;
                const newBeam = [];
                for (const st of beam) {
                  const lastGrp = st.groups[st.groups.length - 1];
                  const adjSet = new Set();
                  for (const ci of lastGrp) {
                    for (const nb of adjL[ci]) { if (!st.usedArr[nb]) adjSet.add(nb); }
                  }
                  const adjArr = [...adjSet].sort((a, b) =>
                    Math.hypot(cells[a].x-st.prevBbox.cx, cells[a].y-st.prevBbox.cy) -
                    Math.hypot(cells[b].x-st.prevBbox.cx, cells[b].y-st.prevBbox.cy));
                  const nextSeeds = adjArr.slice(0, 3);
                  if (nextSeeds.length === 0) {
                    for (let i = 0; i < N; i++) { if (!st.usedArr[i]) { nextSeeds.push(i); break; } }
                  }
                  for (const ns of nextSeeds) {
                    const r = buildGroupBeam(ns, st.prevBbox, st.usedArr, preset);
                    if (!r || !passICC_bt(r.group)) continue;
                    if (g === S - 1 && !r.group.some(i => bMinus.has(i))) continue;
                    newBeam.push({ groups: [...st.groups, r.group], usedArr: r.usedArr, prevBbox: computeBbox(r.group) });
                  }
                }
                beam = newBeam.slice(0, BEAM_W);
              }

              for (const st of beam) {
                if (st.groups.length === S) {
                  commitCandidate(st.groups);
                }
              }
            }
          }
        }
        // ── end Phase 2 Beam Search ─────────────────────────────────────────────

        // 4종 scan order를 순서대로 시도: 열 우선 2종 → boustrophedon 2종
        // 불규칙 행 너비에서 boustrophedon U턴 패턴의 P21B 비인접 문제 해결
        const scanOrderGenerators = [
          () => makeColumnFirst(false),
          () => makeColumnFirst(true),
          () => makeBoustrophedon(true),
          () => makeBoustrophedon(false),
        ];

        for (const genScanOrder of scanOrderGenerators) {
          if (Date.now() - btStart > btBudgetMs) break;
          btIterations = 0;

          const scanOrder = genScanOrder()
            .map(c => cellIdxMap.get(xyKey(c)))
            .filter(i => i !== undefined);

          const dfsCustom = (gIdx, snapGroups, curIdxs, frontier) => {
            if (++btIterations > MAX_ITER_BT) return;
            if (Date.now() - btStart > btBudgetMs) return;

            if (curIdxs.length === P) {
              if (!passICC_bt(curIdxs)) return;
              const snap = [...curIdxs];
              const allSnaps = snapGroups.concat([snap]);

              if (gIdx === S - 1) {
                if (!snap.some(i => bMinus.has(i))) return;
                commitCandidate(allSnaps);
                return;
              }

              // 인접 우선: 현재 그룹에 인접한 미사용 셀 최대 5개 시도
              // 인접 셀 없으면 scan order 첫 미사용 셀 1개 (비인접 fallback)
              const adjToSnap = new Set();
              for (const ci of snap) {
                for (const nb of adjL[ci]) { if (!used[nb]) adjToSnap.add(nb); }
              }
              const adjStarts = [];
              for (const ci of scanOrder) {
                if (!used[ci] && adjToSnap.has(ci)) adjStarts.push(ci);
              }
              const starts = adjStarts.length > 0
                ? adjStarts
                : (() => { for (const ci of scanOrder) { if (!used[ci]) return [ci]; } return []; })();
              for (const nextStart of starts) {
                if (Date.now() - btStart > btBudgetMs) break;
                used[nextStart] = 1;
                dfsCustom(gIdx + 1, allSnaps, [nextStart],
                  new Set(adjL[nextStart].filter(nb => !used[nb])));
                used[nextStart] = 0;
              }
              return;
            }

            for (const cand of frontier) {
              // Phase 2 조기 가지치기: 마지막 셀 선택 시 I형 완성 시도 차단
              if (curIdxs.length === P - 1 && !allow_I) {
                if (_isLinearGroup([...curIdxs.map(i => cells[i]), cells[cand]])) continue;
              }
              used[cand] = 1;
              curIdxs.push(cand);
              const nf = new Set(frontier);
              nf.delete(cand);
              for (const nb of adjL[cand]) { if (!used[nb]) nf.add(nb); }
              dfsCustom(gIdx, snapGroups, curIdxs, nf);
              curIdxs.pop();
              used[cand] = 0;
            }
          };

          const bPlusInOrder = scanOrder.filter(i => bPlus.has(i));
          const bPlusFiltered = anchorCells
            ? bPlusInOrder.filter(i => anchorMatches(cells[i]))
            : bPlusInOrder;

          if (fixed_g0) {
            // G0 고정 모드: fixed_g0 인덱스로 G0 지정, G1..G(S-1)만 탐색
            if (passICC_bt(fixed_g0) && fixed_g0.some(i => bPlus.has(i))) {
              for (const ci of fixed_g0) used[ci] = 1;
              const adjToG0 = new Set();
              for (const ci of fixed_g0) {
                for (const nb of adjL[ci]) { if (!used[nb]) adjToG0.add(nb); }
              }
              const adjStarts = [];
              for (const ci of scanOrder) {
                if (!used[ci] && adjToG0.has(ci)) adjStarts.push(ci);
              }
              const starts = adjStarts.length > 0
                ? adjStarts
                : (() => { for (const ci of scanOrder) { if (!used[ci]) return [ci]; } return []; })();
              for (const nextStart of starts) {
                if (Date.now() - btStart > btBudgetMs) break;
                used[nextStart] = 1;
                dfsCustom(1, [fixed_g0], [nextStart],
                  new Set(adjL[nextStart].filter(nb => !used[nb])));
                used[nextStart] = 0;
              }
              for (const ci of fixed_g0) used[ci] = 0;
            }
          } else if (enumerate_g0_only) {
            // G0 열거 전용 모드: 유효한 G0 후보 목록만 수집
            const g0Configs = [];
            const seenG0 = new Set();
            function dfsG0(curIdxs, frontier) {
              if (curIdxs.length === P) {
                if (!passICC_bt(curIdxs)) return;
                if (!allow_I && _isLinearGroup(curIdxs.map(i => cells[i]))) return;
                if (!curIdxs.some(i => bPlus.has(i))) return;
                const key = [...curIdxs].sort((a, b) => a - b).join(',');
                if (!seenG0.has(key)) { seenG0.add(key); g0Configs.push([...curIdxs]); }
                return;
              }
              for (const cand of frontier) {
                if (curIdxs.length === P - 1 && !allow_I) {
                  if (_isLinearGroup([...curIdxs.map(i => cells[i]), cells[cand]])) continue;
                }
                used[cand] = 1;
                curIdxs.push(cand);
                const nf = new Set(frontier);
                nf.delete(cand);
                for (const nb of adjL[cand]) { if (!used[nb]) nf.add(nb); }
                dfsG0(curIdxs, nf);
                curIdxs.pop();
                used[cand] = 0;
              }
            }
            for (const startCell of bPlusFiltered) {
              used[startCell] = 1;
              dfsG0([startCell], new Set(adjL[startCell].filter(nb => !used[nb])));
              used[startCell] = 0;
            }
            // enumerate_g0_only 모드는 g0Configs만 반환 (backtracking 결과 무시)
            return { g0_configs: g0Configs, count: g0Configs.length };
          } else {
            for (const startCell of bPlusFiltered) {
              if (Date.now() - btStart > btBudgetMs) break;
              used[startCell] = 1;
              dfsCustom(0, [], [startCell], new Set(adjL[startCell].filter(nb => !used[nb])));
              used[startCell] = 0;
            }
          }
        }

      } else {
        // N ≤ 18: 기존 그룹 체이닝 DFS
        function dfs(gIdx, snapGroups, curIdxs, frontier) {
          if (++btIterations > MAX_ITER_BT) return;

          if (curIdxs.length === P) {
            if (!passICC_bt(curIdxs)) return;
            const snap = [...curIdxs];
            const allSnaps = snapGroups.concat([snap]);

            if (gIdx === S - 1) {
              if (!snap.some(i => bMinus.has(i))) return;
              commitCandidate(allSnaps);
              return;
            }

            for (const nextStart of frontier) {
              used[nextStart] = 1;
              const nextFront = new Set(adjL[nextStart].filter(nb => !used[nb]));
              dfs(gIdx + 1, allSnaps, [nextStart], nextFront);
              used[nextStart] = 0;
            }
            return;
          }

          for (const cand of frontier) {
            used[cand] = 1;
            curIdxs.push(cand);
            const nf = new Set(frontier);
            nf.delete(cand);
            for (const nb of adjL[cand]) { if (!used[nb]) nf.add(nb); }
            dfs(gIdx, snapGroups, curIdxs, nf);
            curIdxs.pop();
            used[cand] = 0;
          }
        }

        // ★ G0 앵커: 시작 셀을 앵커 일치 셀로 제한
        const bPlusFiltered = anchorCells
          ? [...bPlus].filter(i => anchorMatches(cells[i]))
          : [...bPlus];
        for (const startCell of bPlusFiltered) {
          if (btIterations > MAX_ITER_BT) break;
          used[startCell] = 1;
          dfs(0, [], [startCell], new Set(adjL[startCell].filter(nb => !used[nb])));
          used[startCell] = 0;
        }
      }
    }

    // 정렬: B+/B- 충족 우선 → 금형 종류 수 적은 순 → ICC 위반 적은 순 → 점수 높은 순 → compact 높은 순
    const _sumCompact = (c) => (c.groups || []).reduce(
      (s, g) => s + compactShapeScore(g.cells, pitch, arrangement), 0);
    // m_distinct 미리 계산 후 candidate에 주석 (UI·테스트에서도 사용)
    for (const c of results) {
      if (c.m_distinct == null)
        c.m_distinct = _plateMdistinct(c.groups || [], S);
    }
    results.sort((a, b) => {
      const aOk = (a.b_plus_ok && a.b_minus_ok) ? 0 : 1;
      const bOk = (b.b_plus_ok && b.b_minus_ok) ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;
      if (a.m_distinct !== b.m_distinct) return a.m_distinct - b.m_distinct;
      if (a.icc_violations !== b.icc_violations) return a.icc_violations - b.icc_violations;
      if (a.total_score !== b.total_score) return b.total_score - a.total_score;
      const csDiff = _sumCompact(b) - _sumCompact(a);
      if (Math.abs(csDiff) > 0.01) return csDiff;
      return 0;
    });

    return {
      candidates:           results,
      count:                results.length,
      strategy,
      boundary_plus_count:  bPlus.size,
      boundary_minus_count: bMinus.size,
      iterations_used:      btIterations,
      max_iter_hit:         false,
      warning:              anchorWarning,  // ★ Phase 2
    };
  }

  // ═══════════════════════════════════════════════
  // export (Node + Browser 양쪽 지원)
  // ═══════════════════════════════════════════════
  const _exports = {
    _shapeSigOf,
    _plateMdistinct,
    calcBoundarySet,
    calcCustomBoundarySet,
    buildHolderGrid,
    enumerateGroupAssignments,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = _exports;
  } else {
    global._GenEnum = _exports;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
