/**
 * pentomino_tiling.js  —  범용 폴리오미노 DLX 타일링 열거기
 *
 * 공개 API: enumeratePentominoTilings(cells, S, P, opts)
 * - cells: [{x,y,row,col}] 전체 셀 배열 (N = S×P 개)
 * - S: 그룹(직렬) 수
 * - P: 그룹당 셀 수 (P=1~8, 모든 값 지원)
 * - opts.allow_I/allow_U: Tier B 체인 도형 허용 여부 (기본 false)
 * - opts.g0_anchor: 'TL'|'TR'|'BL'|'BR'|{row,col} — G0 시작 위치 제약
 * - opts.b_plus_side, b_minus_side: 경계 방향 (기본 'left','right')
 * - opts.max_candidates: 최대 반환 후보 수 (기본 20)
 * - opts.time_budget_ms: DLX 시간 제한 ms (기본 1500)
 *
 * 반환: 기존 enumerateGroupAssignments 후보 포맷 호환 배열
 */
'use strict';

(function (factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    /* global global */
    (typeof globalThis !== 'undefined' ? globalThis : global).PentominoTiling = factory();
  }
})(function () {

// ─────────────────────────────────────────────────────────────────────────
// 인라인 유틸리티 (generator.js와 동일 로직)
// ─────────────────────────────────────────────────────────────────────────

function _pt(c) { return { x: c.x != null ? c.x : c.cx, y: c.y != null ? c.y : c.cy }; }

function estimatePitch(cells) {
  if (!cells || cells.length < 2) return 1;
  let minDist = Infinity;
  for (let i = 0; i < cells.length; i++) {
    const a = _pt(cells[i]);
    for (let j = i + 1; j < cells.length; j++) {
      const b = _pt(cells[j]);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0 && d < minDist) minDist = d;
    }
  }
  return minDist === Infinity ? 1 : minDist;
}

function buildAdj(cells, pitch, adj_thr) {
  const p = pitch || estimatePitch(cells);
  const thr = adj_thr != null ? adj_thr : p * 1.05;
  const edges = [];
  for (let i = 0; i < cells.length; i++) {
    const a = _pt(cells[i]);
    for (let j = i + 1; j < cells.length; j++) {
      const b = _pt(cells[j]);
      if (Math.hypot(a.x - b.x, a.y - b.y) <= thr) edges.push({ i, j });
    }
  }
  return edges;
}

function groupQS(cells, edges) {
  if (!cells || cells.length <= 1) return 0;
  const xs = cells.map(c => Math.round(_pt(c).x * 10) / 10);
  const ys = cells.map(c => Math.round(_pt(c).y * 10) / 10);
  if (new Set(xs).size === 1 || new Set(ys).size === 1) return 0;
  const hasCycle = edges.length >= cells.length;
  if (hasCycle) {
    const p = estimatePitch(cells);
    const bboxC = Math.round((Math.max(...xs) - Math.min(...xs)) / p) + 1;
    const bboxR = Math.round((Math.max(...ys) - Math.min(...ys)) / p) + 1;
    if (cells.length / (bboxC * bboxR) >= 0.75) return +10;
    return 0;
  }
  const deg = new Array(cells.length).fill(0);
  for (const { i, j } of edges) { deg[i]++; deg[j]++; }
  if (deg.some(d => d >= 3)) return -10;
  return 0;
}

function calcBoundarySet(cells, side) {
  if (!cells || cells.length === 0) return new Set();
  const p = estimatePitch(cells);
  const tol = p * 0.5;
  const xs = cells.map(c => _pt(c).x);
  const ys = cells.map(c => _pt(c).y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const set = new Set();
  for (let i = 0; i < cells.length; i++) {
    const { x, y } = _pt(cells[i]);
    if (side === 'left'   && x <= minX + tol) set.add(i);
    if (side === 'right'  && x >= maxX - tol) set.add(i);
    if (side === 'top'    && y <= minY + tol) set.add(i);
    if (side === 'bottom' && y >= maxY - tol) set.add(i);
  }
  return set;
}

// 커스텀 배열 전용 경계 셀 집합: 각 행의 leftmost/rightmost (전역 min/max 아님)
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
      for (const i of idxs) { if (_pt(cells[i]).x < minX) { minX = _pt(cells[i]).x; minI = i; } }
      if (minI >= 0) set.add(minI);
    }
  } else if (side === 'right') {
    for (const idxs of rowMap.values()) {
      let maxX = -Infinity, maxI = -1;
      for (const i of idxs) { if (_pt(cells[i]).x > maxX) { maxX = _pt(cells[i]).x; maxI = i; } }
      if (maxI >= 0) set.add(maxI);
    }
  } else {
    const ys = cells.map(c => _pt(c).y);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const tol = estimatePitch(cells) * 0.5;
    for (let i = 0; i < cells.length; i++) {
      const y = _pt(cells[i]).y;
      if (side === 'top'    && y <= minY + tol) set.add(i);
      if (side === 'bottom' && y >= maxY - tol) set.add(i);
    }
  }
  return set;
}

// ─────────────────────────────────────────────────────────────────────────
// Fixed polyomino enumeration — Redelmeier algorithm
// ─────────────────────────────────────────────────────────────────────────

const _polyCache = new Map();

function _genAllFixedPolyominoes(P) {
  if (_polyCache.has(P)) return _polyCache.get(P);
  if (P <= 0 || P > 8) { _polyCache.set(P, []); return []; }
  const results = [];
  const seen = new Set();
  const DIRS = [[-1,0],[0,-1],[0,1],[1,0]];

  function extend(poly, inPoly, N_arr) {
    if (poly.length === P) {
      const minR = Math.min(...poly.map(c => c[0]));
      const minC = Math.min(...poly.map(c => c[1]));
      const norm = poly.map(([r,c]) => [r-minR, c-minC]);
      norm.sort((a,b) => a[0]!==b[0] ? a[0]-b[0] : a[1]-b[1]);
      const k = norm.map(([r,c]) => `${r},${c}`).join('|');
      if (!seen.has(k)) { seen.add(k); results.push(norm); }
      return;
    }
    for (let i = 0; i < N_arr.length; i++) {
      const [r, c] = N_arr[i];
      const ck = `${r},${c}`;
      inPoly.add(ck);
      poly.push([r, c]);
      const childN = new Map();
      for (let j = i + 1; j < N_arr.length; j++) {
        childN.set(`${N_arr[j][0]},${N_arr[j][1]}`, N_arr[j]);
      }
      for (const [dr,dc] of DIRS) {
        const nr = r+dr, nc = c+dc;
        const nk = `${nr},${nc}`;
        if (!inPoly.has(nk) && !childN.has(nk)) childN.set(nk, [nr, nc]);
      }
      const childNArr = [...childN.values()].sort((a,b) => a[0]!==b[0] ? a[0]-b[0] : a[1]-b[1]);
      extend(poly, inPoly, childNArr);
      poly.pop();
      inPoly.delete(ck);
    }
  }

  extend([[0,0]], new Set(['0,0']), [[-1,0],[0,-1],[0,1],[1,0]]);
  _polyCache.set(P, results);
  return results;
}

function _scoreOffsets(offsets) {
  const cells = offsets.map(([r,c]) => ({ x: c, y: r, row: r, col: c }));
  return groupQS(cells, buildAdj(cells, 1));
}

// ─────────────────────────────────────────────────────────────────────────
// Shape Library  —  Tier A (compact cycle +10), Tier B-I (1자, 옵션), Tier B-O (기타 chain), Tier C (없음)
// ─────────────────────────────────────────────────────────────────────────

function _isLinear(offsets) {
  const rs = new Set(offsets.map(([r]) => r));
  const cs = new Set(offsets.map(([,c]) => c));
  return rs.size === 1 || cs.size === 1;
}

// allowI: 1자(직선) 도형 허용 여부 — false이면 어떤 상황에서도 직선 형상 제외
// allowChain: 비직선 Tier B(chain) 도형 허용 여부 — Tier A 없으면 자동 true
function buildShapeLibrary(P, allowI, allowChain) {
  const tierA = [], tierBLinear = [], tierBOther = [];
  for (const offsets of _genAllFixedPolyominoes(P)) {
    const score = _scoreOffsets(offsets);
    if (score === 10) tierA.push({ name: 'A', offsets });
    else if (score === 0) {
      if (_isLinear(offsets)) tierBLinear.push({ name: 'I', offsets });
      else                    tierBOther.push({ name: 'B', offsets });
    }
  }
  // Tier A가 없으면 비직선 Tier B 자동 포함 (allow_I 제약 유지)
  const addOther = allowChain || tierA.length === 0;
  const lib = [...tierA];
  if (addOther) lib.push(...tierBOther);
  if (allowI)   lib.push(...tierBLinear);
  return lib;
}

// ─────────────────────────────────────────────────────────────────────────
// Placement 생성
// ─────────────────────────────────────────────────────────────────────────

function _isPhysConnected(gcells, thr) {
  if (gcells.length <= 1) return true;
  const visited = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const ci = queue.shift();
    const a = _pt(gcells[ci]);
    for (let j = 0; j < gcells.length; j++) {
      if (!visited.has(j)) {
        const b = _pt(gcells[j]);
        if (Math.hypot(a.x - b.x, a.y - b.y) <= thr) { visited.add(j); queue.push(j); }
      }
    }
  }
  return visited.size === gcells.length;
}

function generatePlacements(cells, shapes, pitch, adj_thr) {
  const rcMap = new Map();
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const r = c.row != null ? c.row : Math.round(_pt(c).y / pitch);
    const cc = c.col != null ? c.col : Math.round(_pt(c).x / pitch);
    rcMap.set(`${r},${cc}`, i);
  }

  const placements = [];

  for (const shape of shapes) {
    for (let ai = 0; ai < cells.length; ai++) {
      const ac = cells[ai];
      const ar = ac.row != null ? ac.row : Math.round(_pt(ac).y / pitch);
      const acc = ac.col != null ? ac.col : Math.round(_pt(ac).x / pitch);

      const idxs = [];
      let ok = true;
      for (const [dr, dc] of shape.offsets) {
        const idx = rcMap.get(`${ar + dr},${acc + dc}`);
        if (idx === undefined) { ok = false; break; }
        idxs.push(idx);
      }
      if (!ok) continue;
      if (new Set(idxs).size !== idxs.length) continue;

      // 커스텀 배열: 논리적 인접이 물리적 인접을 보장하지 않으므로 연결성 재검증
      if (adj_thr != null && !_isPhysConnected(idxs.map(i => cells[i]), adj_thr)) continue;

      placements.push({ name: shape.name, cellIdxs: idxs });
    }
  }

  return placements;
}

// ─────────────────────────────────────────────────────────────────────────
// DLX — Algorithm X with Dancing Links (Knuth 2000)
// ─────────────────────────────────────────────────────────────────────────

function solveDLX(N, placements, maxSolutions, timeBudgetMs) {
  const P_PER = placements.length > 0 ? placements[0].cellIdxs.length : 0;
  const NODES = 1 + N + placements.length * P_PER + 8;

  const L = new Int32Array(NODES);
  const R = new Int32Array(NODES);
  const U = new Int32Array(NODES);
  const D = new Int32Array(NODES);
  const Col = new Int32Array(NODES);  // column index (0..N-1)
  const RowOf = new Int32Array(NODES);  // placement index
  const colSize = new Int32Array(N);
  const colHead = new Int32Array(N);

  let nc = 0;

  // Root (node 0)
  const root = nc++;
  R[root] = root; L[root] = root; U[root] = root; D[root] = root;

  // Column headers (nodes 1..N)
  for (let col = 0; col < N; col++) {
    const h = nc++;
    colHead[col] = h;
    Col[h] = col;
    colSize[col] = 0;
    U[h] = h; D[h] = h;
    // Insert after last header
    L[h] = L[root]; R[L[root]] = h; R[h] = root; L[root] = h;
  }

  // Data rows
  for (let p = 0; p < placements.length; p++) {
    const cidxs = placements[p].cellIdxs;
    let rowFirst = -1, rowPrev = -1;
    for (const col of cidxs) {
      const n = nc++;
      Col[n] = col; RowOf[n] = p;
      // Insert at bottom of column
      const h = colHead[col];
      U[n] = U[h]; D[U[h]] = n; D[n] = h; U[h] = n;
      colSize[col]++;
      // Horizontal circular link
      if (rowFirst < 0) {
        rowFirst = n; rowPrev = n; L[n] = n; R[n] = n;
      } else {
        L[n] = rowPrev; R[rowPrev] = n; R[n] = rowFirst; L[rowFirst] = n;
        rowPrev = n;
      }
    }
  }

  const solutions = [];
  const chosen = [];
  const t0 = Date.now();

  function chooseCol() {
    let best = root, bestSz = Infinity;
    for (let j = R[root]; j !== root; j = R[j]) {
      if (colSize[Col[j]] < bestSz) {
        bestSz = colSize[Col[j]]; best = j;
      }
    }
    return best;
  }

  function cover(col) {
    const h = colHead[col];
    L[R[h]] = L[h]; R[L[h]] = R[h];
    for (let i = D[h]; i !== h; i = D[i]) {
      for (let j = R[i]; j !== i; j = R[j]) {
        U[D[j]] = U[j]; D[U[j]] = D[j];
        colSize[Col[j]]--;
      }
    }
  }

  function uncover(col) {
    const h = colHead[col];
    for (let i = U[h]; i !== h; i = U[i]) {
      for (let j = L[i]; j !== i; j = L[j]) {
        colSize[Col[j]]++;
        U[D[j]] = j; D[U[j]] = j;
      }
    }
    L[R[h]] = h; R[L[h]] = h;
  }

  function search() {
    if (Date.now() - t0 > timeBudgetMs) return;
    if (solutions.length >= maxSolutions) return;
    if (R[root] === root) {
      solutions.push([...chosen]);
      return;
    }
    const ch = chooseCol();
    if (ch === root) return;
    const col = Col[ch];
    cover(col);
    for (let r = D[ch]; r !== ch; r = D[r]) {
      chosen.push(RowOf[r]);
      for (let j = R[r]; j !== r; j = R[j]) cover(Col[j]);
      search();
      for (let j = L[r]; j !== r; j = L[j]) uncover(Col[j]);
      chosen.pop();
      if (solutions.length >= maxSolutions || Date.now() - t0 > timeBudgetMs) break;
    }
    uncover(col);
  }

  search();
  return solutions;
}

// ─────────────────────────────────────────────────────────────────────────
// Hamiltonian 경로 탐색 (그룹 인접 그래프 위)
// ─────────────────────────────────────────────────────────────────────────

function buildGroupAdj(groupCellIdxArrays, cells, pitch, adj_thr) {
  const S = groupCellIdxArrays.length;
  const adj = Array.from({ length: S }, () => []);
  const thr = adj_thr != null ? adj_thr : pitch * 1.05;

  for (let i = 0; i < S; i++) {
    for (let j = i + 1; j < S; j++) {
      let found = false;
      outer: for (const ci of groupCellIdxArrays[i]) {
        const ai = _pt(cells[ci]);
        for (const cj of groupCellIdxArrays[j]) {
          const aj = _pt(cells[cj]);
          if (Math.hypot(ai.x - aj.x, ai.y - aj.y) <= thr) {
            found = true; break outer;
          }
        }
      }
      if (found) { adj[i].push(j); adj[j].push(i); }
    }
  }
  return adj;
}

function findAllHamPaths(adj, S, startSet, endSet, maxPaths, t0, timeBudgetMs) {
  const visited = new Uint8Array(S);
  const results = [];
  const deadline = t0 + timeBudgetMs;

  function dfs(path) {
    if (results.length >= maxPaths || Date.now() > deadline) return;
    if (path.length === S) {
      const last = path[S - 1];
      if (!endSet || endSet.size === 0 || endSet.has(last)) results.push([...path]);
      return;
    }
    const cur = path[path.length - 1];
    for (const nb of adj[cur]) {
      if (!visited[nb]) {
        visited[nb] = 1;
        path.push(nb);
        dfs(path);
        path.pop();
        visited[nb] = 0;
        if (results.length >= maxPaths || Date.now() > deadline) return;
      }
    }
  }

  for (const start of startSet) {
    if (results.length >= maxPaths || Date.now() > deadline) break;
    visited.fill(0);
    visited[start] = 1;
    dfs([start]);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────
// Main API
// ─────────────────────────────────────────────────────────────────────────

function enumeratePentominoTilings(cells, S, P, opts) {
  opts = opts || {};
  const {
    b_plus_side    = 'left',
    b_minus_side   = 'right',
    g0_anchor      = null,
    allow_I        = false,
    allow_U        = false,
    max_candidates = 20,
    time_budget_ms = 1500,
    arrangement    = 'square',  // 'custom' → 완화된 인접 임계값 + 행별 경계 계산
    adj_thr        = null,      // null → arrangement에 따라 자동 선택
  } = opts;

  if (!cells || cells.length === 0 || P < 1) return [];
  const N = cells.length;
  if (N !== S * P) return [];

  const t0 = Date.now();
  const pitch = estimatePitch(cells);
  const isCustom = arrangement === 'custom';
  // 커스텀 배열: 대각 인접(√2·p≈1.41p)까지 허용하도록 임계값 완화
  const adjThr = adj_thr != null ? adj_thr : (isCustom ? pitch * 1.5 : pitch * 1.05);
  const bPlus  = isCustom ? calcCustomBoundarySet(cells, b_plus_side)  : calcBoundarySet(cells, b_plus_side);
  const bMinus = isCustom ? calcCustomBoundarySet(cells, b_minus_side) : calcBoundarySet(cells, b_minus_side);

  // ── Anchor 해석 ──────────────────────────────────────
  let anchorIdxSet = null;
  if (g0_anchor) {
    const rows = cells.map(c => c.row).filter(v => typeof v === 'number');
    const cols = cells.map(c => c.col).filter(v => typeof v === 'number');
    if (rows.length > 0 && cols.length > 0) {
      const rMin = Math.min(...rows), rMax = Math.max(...rows);
      const cMin = Math.min(...cols), cMax = Math.max(...cols);
      const pred = typeof g0_anchor === 'object'
        ? (i => cells[i].row === g0_anchor.row && cells[i].col === g0_anchor.col)
        : ({
            TL: i => cells[i].row === rMin && cells[i].col === cMin,
            TR: i => cells[i].row === rMin && cells[i].col === cMax,
            BL: i => cells[i].row === rMax && cells[i].col === cMin,
            BR: i => cells[i].row === rMax && cells[i].col === cMax,
          }[g0_anchor] || (() => false));
      const idxs = cells.map((_, i) => i).filter(pred);
      if (idxs.length > 0) anchorIdxSet = new Set(idxs);
    }
  }

  // ── Shape 라이브러리 & Placement 생성 ────────────────
  // allow_I: 1자 도형 허용 여부 (false이면 어떤 fallback에서도 직선 제외)
  // allow_U: 비직선 Tier B 명시 허용 (Tier A 없으면 자동 활성)
  let shapes = buildShapeLibrary(P, allow_I, allow_U);
  if (shapes.length === 0) return [];
  let placements = generatePlacements(cells, shapes, pitch, isCustom ? adjThr : null);
  if (placements.length === 0) return [];

  // ── 해 후처리 공통 함수 (클로저) ──────────────────────
  const results = [];
  const seenSigs = new Set();

  function processBatch(rawSols, plcmts) {
    for (const sol of rawSols) {
      if (Date.now() - t0 > time_budget_ms) break;
      if (results.length >= max_candidates) break;

      const groupCellIdxs = sol.map(pIdx => plcmts[pIdx].cellIdxs);

      const adj = buildGroupAdj(groupCellIdxs, cells, pitch, isCustom ? adjThr : null);

      const g0Set = new Set();
      const gLastSet = new Set();
      for (let gi = 0; gi < S; gi++) {
        const cidxs = groupCellIdxs[gi];
        if (cidxs.some(ci => bPlus.has(ci)))  g0Set.add(gi);
        if (cidxs.some(ci => bMinus.has(ci))) gLastSet.add(gi);
      }

      if (anchorIdxSet && anchorIdxSet.size > 0) {
        const anchorGroups = new Set(
          sol.map((pIdx, gi) =>
            plcmts[pIdx].cellIdxs.some(ci => anchorIdxSet.has(ci)) ? gi : -1
          ).filter(gi => gi >= 0)
        );
        if (anchorGroups.size === 0) continue;
        for (const gi of [...g0Set]) {
          if (!anchorGroups.has(gi)) g0Set.delete(gi);
        }
        if (g0Set.size === 0) continue;
      }

      const startSet = g0Set.size > 0 ? g0Set : new Set(Array.from({ length: S }, (_, i) => i));
      const hamTime  = Math.max(50, time_budget_ms - (Date.now() - t0));
      const paths = findAllHamPaths(adj, S, startSet, gLastSet.size > 0 ? gLastSet : null,
        10, t0, hamTime);
      if (paths.length === 0) continue;

      for (const path of paths) {
        if (results.length >= max_candidates) break;

        const sig = path.map(gi => {
          const cidxsSorted = [...plcmts[sol[gi]].cellIdxs].sort((a, b) => a - b).join(',');
          return `${plcmts[sol[gi]].name}:${cidxsSorted}`;
        }).join('|');
        if (seenSigs.has(sig)) continue;
        seenSigs.add(sig);

        const groups = path.map((gi, idx) => {
          const pIdx = sol[gi];
          const gcells = plcmts[pIdx].cellIdxs.map(ci => cells[ci]);
          const edges  = buildAdj(gcells, pitch);
          const qs     = groupQS(gcells, edges);
          const rowSpans = gcells.map(c => c.row != null ? c.row : Math.round(_pt(c).y / pitch));
          const colSpans = gcells.map(c => c.col != null ? c.col : Math.round(_pt(c).x / pitch));
          const rowSpan = Math.max(...rowSpans) - Math.min(...rowSpans) + 1;
          const colSpan = Math.max(...colSpans) - Math.min(...colSpans) + 1;
          return {
            index: idx,
            cells: gcells,
            quality_score: qs,
            is_b_plus:  idx === 0,
            is_b_minus: idx === S - 1,
            icc1_ok: Math.min(rowSpan, colSpan) <= 2,
            icc2_ok: true,
            has_TY: false,
            _pIdx: pIdx,
          };
        });

        const totalScore = groups.reduce((s, g) => s + g.quality_score, 0);
        const bPlusOk  = plcmts[sol[path[0]]].cellIdxs.some(ci => bPlus.has(ci));
        const bMinusOk = plcmts[sol[path[S - 1]]].cellIdxs.some(ci => bMinus.has(ci));
        const usedNames = new Set(path.map(gi => plcmts[sol[gi]].name));
        const shapeSig = [...usedNames].sort().join('+') || 'A';
        const POLY_NAMES = {1:'monomino',2:'domino',3:'triomino',4:'tetromino',5:'pentomino',6:'hexomino',7:'heptomino',8:'octomino'};
        const pname = POLY_NAMES[P] || `P${P}-omino`;

        results.push({
          groups: groups.map(({ _pIdx, ...rest }) => rest),
          total_score: totalScore,
          name: `${pname} ×${S}`,
          desc: `DLX · ${shapeSig}`,
          is_standard: false,
          is_pentomino: true,
          shape_signature: shapeSig,
          b_plus_ok: bPlusOk,
          b_minus_ok: bMinusOk,
          icc_violations: groups.filter(g => !g.icc1_ok || g.quality_score < 0).length,
          total_plates: S + 1,
        });
      }
    }
  }

  // ── 1차 DLX ──────────────────────────────────────────
  let remaining = time_budget_ms - (Date.now() - t0);
  if (remaining <= 10) return [];
  const rawSolutions = solveDLX(N, placements, 5000, remaining);
  processBatch(rawSolutions, placements);

  // ── Auto-expand: 후보 부족(< 5)이면 비직선 Tier B 추가 ──
  // allow_I=false 제약은 여기서도 유지 — 1자 배열 금지는 항상 존중
  if (results.length < 5 && !allow_U) {
    const shapesExp = buildShapeLibrary(P, allow_I, true);
    if (shapesExp.length > shapes.length) {
      const placementsExp = generatePlacements(cells, shapesExp, pitch, isCustom ? adjThr : null);
      remaining = time_budget_ms - (Date.now() - t0);
      if (placementsExp.length > 0 && remaining > 10) {
        const rawSolExp = solveDLX(N, placementsExp, 5000, remaining);
        processBatch(rawSolExp, placementsExp);
      }
    }
  }

  // ── 랭킹 ─────────────────────────────────────────────
  results.sort((a, b) => {
    const aOk = (a.b_plus_ok && a.b_minus_ok) ? 0 : 1;
    const bOk = (b.b_plus_ok && b.b_minus_ok) ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    if (a.icc_violations !== b.icc_violations) return a.icc_violations - b.icc_violations;
    return b.total_score - a.total_score;
  });

  return results;
}

return { enumeratePentominoTilings };

}); // factory
