/**
 * Pack-Renderer Generator (LAYER 3) — Facade
 *
 * 역할: skills/design_spec.json의 11개 entry_fn을 구현하는 형상 생성 엔진.
 *       서브모듈(gen-math / gen-layout / gen-enum)을 조합하는 단일 진입점.
 *
 * 파일 구조 (분리 후):
 *   gen-math.js   — 수학 기초 (_pt, estimatePitch, buildAdjacency, ...)
 *   gen-layout.js — 레이아웃 (canonicalSig, calcNickelPattern, ...)
 *   gen-enum.js   — 열거기 (enumerateGroupAssignments, buildHolderGrid, ...)
 *   generator.js  — 이 파일: SFMT 파이프라인 + 검증 + API facade
 *
 * 호출 주체:  renderer.js, app.js, validator.js, tests/
 * 입력 스펙:  skills/design_spec.json
 *
 * 스텝 호출 순서 (design_spec.json call_order):
 *   LAYER 1 결정(P04·P17)  → S24(assignGroupNumbers)
 *     → S15(sfmtSearch:A·B·C·D) → S13(detectColumnGroupEfficiency, 조건부)
 *       → S22(selectBmsOptimal) → 결과 반환
 *
 * 최종 업데이트: 2026-04-21 (session38 — 서브모듈 분리)
 */

(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════
  // 서브모듈 로드 (Node: require / Browser: window._Gen*)
  // ═══════════════════════════════════════════════
  const _isNode = typeof require !== 'undefined' && typeof module !== 'undefined';

  const _math   = _isNode ? require('./gen-math')   : (global._GenMath   || {});
  const _layout = _isNode ? require('./gen-layout')  : (global._GenLayout || {});
  const _enum   = _isNode ? require('./gen-enum')    : (global._GenEnum   || {});

  const {
    _pt, _segmentsProperIntersect, checkPlanarNoCrossing,
    estimatePitch, buildAdjacency, groupQualityScore, compactShapeScore,
  } = _math;

  const {
    canonicalSig, selectBlockType, calcNickelPattern,
    buildSnakeLayout, estimateMmin, calcCustomCenters,
  } = _layout;

  const {
    _shapeSigOf, calcBoundarySet, calcCustomBoundarySet,
    buildHolderGrid, enumerateGroupAssignments,
  } = _enum;

  // ═══════════════════════════════════════════════
  // spec 로드 (Node: fs / Browser: global.DESIGN_SPEC)
  // ═══════════════════════════════════════════════
  let SPEC = null;

  function loadSpec(specObject) {
    if (specObject && typeof specObject === 'object') {
      SPEC = specObject;
      return SPEC;
    }
    if (_isNode) {
      try {
        const fs = require('fs');
        const path = require('path');
        const p = path.join(__dirname, '..', 'skills', 'design_spec.json');
        SPEC = JSON.parse(fs.readFileSync(p, 'utf8'));
        return SPEC;
      } catch (e) {
        throw new Error('[generator] spec load failed: ' + e.message);
      }
    }
    if (global.DESIGN_SPEC) {
      SPEC = global.DESIGN_SPEC;
      return SPEC;
    }
    throw new Error('[generator] DESIGN_SPEC not found (browser) or file read failed (node)');
  }

  // ═══════════════════════════════════════════════
  // 원칙 21 — 조건 A(BFS 연결성) + 조건 B(G_i↔G_{i+1} 인접쌍 ≥1) 검증
  // groups: [{index, cells:[{x,y}|{cx,cy}]}]
  // arrangement: 'square'|'staggered'|'custom'
  // pitch: 기준 거리 (optional)
  // 반환: { valid:boolean, violations:[{group, reason}] }
  // ═══════════════════════════════════════════════
  function checkGroupValidity(groups, arrangement, pitch) {
    const violations = [];

    for (const group of groups) {
      const cells = group.cells || [];
      if (cells.length === 0) continue;

      // 조건 A: BFS 연결성
      const p = pitch || estimatePitch(cells);
      const edges = buildAdjacency(cells, arrangement, p);
      const adj = cells.map(() => []);
      for (const { i, j } of edges) { adj[i].push(j); adj[j].push(i); }

      const visited = new Set([0]);
      const queue = [0];
      while (queue.length) {
        const cur = queue.shift();
        for (const nb of adj[cur]) {
          if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
        }
      }
      if (visited.size < cells.length) {
        violations.push({
          group: group.index,
          reason: `조건 A 위반: G${group.index} 셀 비연결 (연결=${visited.size}/${cells.length})`,
        });
      }
    }

    // 조건 B: G_i ↔ G_{i+1} 인접 쌍 ≥ 1
    for (let gi = 0; gi < groups.length - 1; gi++) {
      const cellsA = groups[gi].cells || [];
      const cellsB = groups[gi + 1].cells || [];
      const allAB = [...cellsA, ...cellsB];
      const p = pitch || estimatePitch(allAB);
      const thr = arrangement === 'custom' ? p * 1.1 : p * 1.05;

      let found = false;
      outer: for (const ca of cellsA) {
        const a = _pt(ca);
        for (const cb of cellsB) {
          const b = _pt(cb);
          if (Math.hypot(a.x - b.x, a.y - b.y) <= thr) { found = true; break outer; }
        }
      }
      if (!found) {
        violations.push({
          group: gi,
          reason: `조건 B 위반: G${gi} ↔ G${gi + 1} 인접 쌍 없음`,
        });
      }
    }

    return { valid: violations.length === 0, violations };
  }

  /**
   * 원칙 28 — P/2P/P 셀 수 + 연결성 불변 검증
   * S: 직렬 수, P: 병렬 수
   * groupCells: 길이 S인 배열, 각 원소는 셀 좌표 배열 [{x,y}|{cx,cy}]
   * arrangement: 'square'|'staggered'|'custom'
   * pitch: 기준 거리 (optional)
   *
   * 반환: { valid:boolean, violations:[{group, reason}] }
   *   - 각 그룹은 정확히 P개 셀이어야 함
   *   - 각 그룹은 BFS 연결이어야 함 (원칙 28 ③)
   *   - 인접 그룹 간 ≥1 인접 쌍 필수 (원칙 21B = 원칙 28의 연결성 근거)
   */
  function validateP28(S, P, groupCells, arrangement, pitch) {
    if (!Array.isArray(groupCells) || groupCells.length !== S) {
      return { valid: false, violations: [{ group: -1, reason: `그룹 수 불일치: expected ${S}, got ${groupCells ? groupCells.length : 0}` }] };
    }

    const violations = [];

    for (let g = 0; g < S; g++) {
      const cells = groupCells[g] || [];

      // 셀 수 검증
      if (cells.length !== P) {
        violations.push({ group: g, reason: `원칙 28 ② 위반: G${g} 셀 수=${cells.length}, 기대=${P}` });
        continue;
      }

      // BFS 연결성 검증
      if (cells.length > 1) {
        const p = pitch || estimatePitch(cells);
        const edges = buildAdjacency(cells, arrangement || 'custom', p);
        const adj = cells.map(() => []);
        for (const { i, j } of edges) { adj[i].push(j); adj[j].push(i); }
        const visited = new Set([0]);
        const queue = [0];
        while (queue.length) {
          const cur = queue.shift();
          for (const nb of adj[cur]) {
            if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
          }
        }
        if (visited.size < cells.length) {
          violations.push({ group: g, reason: `원칙 28 ③ 위반: G${g} 셀 비연결 (연결=${visited.size}/${cells.length})` });
        }
      }
    }

    // 인접 그룹 간 ≥1 인접 쌍 (원칙 21B)
    for (let g = 0; g + 1 < S; g++) {
      const cellsA = groupCells[g] || [];
      const cellsB = groupCells[g + 1] || [];
      if (!cellsA.length || !cellsB.length) continue;
      const allAB = [...cellsA, ...cellsB];
      const p = pitch || estimatePitch(allAB);
      const thr = (arrangement === 'custom') ? p * 1.1 : p * 1.05;
      let found = false;
      outer28: for (const ca of cellsA) {
        const a = _pt(ca);
        for (const cb of cellsB) {
          const b = _pt(cb);
          if (Math.hypot(a.x - b.x, a.y - b.y) <= thr) { found = true; break outer28; }
        }
      }
      if (!found) {
        violations.push({ group: g, reason: `원칙 28 ③ (P21B) 위반: G${g}↔G${g + 1} 인접 쌍 없음` });
      }
    }

    return { valid: violations.length === 0, violations };
  }

  /**
   * 보스트로페돈 정렬 (원칙 24 ①)
   * cells: [{x,y}|{cx,cy}]
   */
  function _boustrophedon(cells) {
    if (!cells || cells.length === 0) return [];
    // y좌표 기준 행 분류
    const rowMap = new Map();
    for (let i = 0; i < cells.length; i++) {
      const y = Math.round(_pt(cells[i]).y);
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y).push(i);
    }
    const rowYs = [...rowMap.keys()].sort((a, b) => a - b);
    const result = [];
    rowYs.forEach((y, rowIdx) => {
      const indices = rowMap.get(y);
      indices.sort((a, b) => _pt(cells[a]).x - _pt(cells[b]).x);
      if (rowIdx % 2 === 1) indices.reverse();  // 홀수 행: RTL
      result.push(...indices.map(i => cells[i]));
    });
    return result;
  }

  /**
   * BFS 셀 순서 (원칙 24 ③, 커스텀 배열)
   * 시작점: 가장 아래(y 최대)·가장 왼쪽(x 최소) 셀 = B+ 기점
   */
  function _bfsCellOrder(cells, arrangement) {
    if (!cells || cells.length === 0) return [];
    const edges = buildAdjacency(cells, arrangement, null);
    const adj = cells.map(() => []);
    for (const { i, j } of edges) { adj[i].push(j); adj[j].push(i); }

    // B+ 시작점: y 최대(아래), 동점이면 x 최소(왼쪽)
    let startIdx = 0;
    for (let i = 1; i < cells.length; i++) {
      const a = _pt(cells[startIdx]), b = _pt(cells[i]);
      if (b.y > a.y || (b.y === a.y && b.x < a.x)) startIdx = i;
    }

    const visited = new Set([startIdx]);
    const queue = [startIdx];
    const order = [];
    while (queue.length) {
      const cur = queue.shift();
      order.push(cells[cur]);
      // 이웃을 x 오름차순으로 정렬하여 결정적 탐색 보장
      const nbs = adj[cur].filter(n => !visited.has(n));
      nbs.sort((a, b) => _pt(cells[a]).x - _pt(cells[b]).x);
      for (const nb of nbs) { visited.add(nb); queue.push(nb); }
    }
    // 연결 안 된 셀 후미 추가 (비정상 케이스 방어)
    for (let i = 0; i < cells.length; i++) {
      if (!visited.has(i)) order.push(cells[i]);
    }
    return order;
  }

  // ═══════════════════════════════════════════════
  // 2. design_spec entry_fns (M7 실구현 + 잔여 스텁)
  //    각 함수는 (ctx|inputs, params) → output object 반환
  // ═══════════════════════════════════════════════

  // ─── S24 그룹 번호 부여 ─────────────────────────────────────────
  /**
   * 원칙 24 — 보스트로페돈(square·staggered) / BFS(custom) 순서로 그룹 번호 부여
   * ctx.cell_centers: 전체 셀 좌표 배열
   * ctx.S: 직렬 수 (그룹 수)
   * ctx.arrangement: 'square'|'staggered'|'custom'
   * 반환: { groups:[{index, cells, quality_score}], G0_is_B_plus, G_last_is_B_minus }
   */
  function assignGroupNumbers(ctx) {
    const { S, arrangement, cell_centers } = ctx || {};
    if (!cell_centers || !S) {
      return { groups: [], G0_is_B_plus: true, G_last_is_B_minus: true };
    }

    const N = cell_centers.length;
    const cellsPerGroup = Math.ceil(N / S);

    // 원칙 24: 배열 방식에 따라 셀 순서 결정
    const ordered = (arrangement === 'custom')
      ? _bfsCellOrder(cell_centers, arrangement)
      : _boustrophedon(cell_centers);

    const groups = [];
    for (let g = 0; g < S; g++) {
      const cells = ordered.slice(g * cellsPerGroup, Math.min((g + 1) * cellsPerGroup, N));
      const adj   = buildAdjacency(cells, arrangement, null);
      const qs    = groupQualityScore(cells, adj);
      groups.push({
        index:         g,
        cells,
        is_b_plus:     g === 0,
        is_b_minus:    g === S - 1,
        quality_score: qs,
      });
    }

    return { groups, G0_is_B_plus: true, G_last_is_B_minus: true };
  }

  // ─── S15A 대칭군 탐지 ──────────────────────────
  /**
   * 원칙 15 Step A — 팩 대칭군 탐지 (회전 대칭만)
   *   반사 대칭은 원칙 21에 의해 엠보 불가역으로 별개 형상 → 여기서는 제외.
   *   회전 대칭만 공유 형상 도출에 유효 (원칙 12).
   *
   * ctx.cells: [{x,y}|{cx,cy}] — 전체 셀 좌표 (없으면 ctx.groups에서 flatten)
   * ctx.arrangement: 'square'|'staggered'|'custom'
   */
  function detectSymmetryGroup(ctx) {
    const arrangement = (ctx && ctx.arrangement) || 'square';
    const cells = (ctx && ctx.cells && ctx.cells.length)
      ? ctx.cells
      : (ctx && ctx.groups ? ctx.groups.flatMap(g => g.cells || []) : []);

    if (cells.length === 0) {
      return { symmetry_order: 1, rotation_center: null };
    }

    // 무게중심 계산
    const pts = cells.map(_pt);
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const center = { x: cx, y: cy };

    // 배열별 후보 차수 (높은 차수 먼저 시도)
    const candidates = ({
      square:    [4, 2],
      staggered: [6, 3, 2],
      custom:    [6, 4, 3, 2],
    })[arrangement] || [2];

    // 공차: pitch × 0.15 (최소 1)
    const pitch = estimatePitch(cells);
    const tol = Math.max(pitch * 0.15, 1);

    for (const k of candidates) {
      if (_isRotationSymmetric(pts, center, k, tol)) {
        return { symmetry_order: k, rotation_center: center };
      }
    }
    return { symmetry_order: 1, rotation_center: center };
  }

  /**
   * 점 집합이 중심(c) 기준 2π/k 회전에 대해 닫혀 있는지 검사.
   * 각 점 p 회전 후 p' 가 pts 내 어떤 점과 tol 이내에 매칭되면 OK.
   */
  function _isRotationSymmetric(pts, c, k, tol) {
    const a = 2 * Math.PI / k;
    const cos = Math.cos(a), sin = Math.sin(a);
    const tol2 = tol * tol;
    for (const p of pts) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const rx = c.x + cos * dx - sin * dy;
      const ry = c.y + sin * dx + cos * dy;
      let matched = false;
      for (const q of pts) {
        const ex = q.x - rx, ey = q.y - ry;
        if (ex * ex + ey * ey <= tol2) { matched = true; break; }
      }
      if (!matched) return false;
    }
    return true;
  }

  // ─── S15B 합동 쌍 열거 ─────────────────────────
  /**
   * 원칙 15 Step B — 회전 대칭 하에서 서로 매핑되는 그룹 쌍(Gi ↔ Gj) 열거.
   *
   * ctx.groups: [{ index, cells }]
   * symmetry: detectSymmetryGroup 결과 { symmetry_order, rotation_center }
   * 반환: { congruent_pairs: [{ groupA, groupB, rotation }] }
   */
  function enumerateCongruentPairs(ctx, symmetry) {
    const pairs = [];
    const groups = (ctx && ctx.groups) || [];
    const k = (symmetry && symmetry.symmetry_order) || 1;

    if (k <= 1 || groups.length < 2) {
      return { congruent_pairs: pairs };
    }

    // 공차용 pitch: 전체 셀 기준
    const allCells = groups.flatMap(g => g.cells || []);
    if (allCells.length === 0) return { congruent_pairs: pairs };
    const pitch = estimatePitch(allCells);
    const tol = Math.max(pitch * 0.15, 1);
    const tol2 = tol * tol;

    // rotation_center 결정 (symmetry 제공 없으면 전체 셀 무게중심)
    let center = symmetry && symmetry.rotation_center;
    if (!center) {
      const pts = allCells.map(_pt);
      center = {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      };
    }

    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const ptsA = (groups[i].cells || []).map(_pt);
        const ptsB = (groups[j].cells || []).map(_pt);
        if (ptsA.length === 0 || ptsA.length !== ptsB.length) continue;

        for (let c = 1; c < k; c++) {
          if (_isSetRotationMatch(ptsA, ptsB, center, c, k, tol2)) {
            pairs.push({ groupA: i, groupB: j, rotation: c });
            break; // 최소 c로 기록 후 다음 쌍
          }
        }
      }
    }

    return { congruent_pairs: pairs };
  }

  /**
   * ptsA를 중심(center) 기준 c·(2π/k) 회전한 점 집합이
   * ptsB와 (tol² 공차 내) 완전 일치하는지 검사.
   */
  function _isSetRotationMatch(ptsA, ptsB, center, c, k, tol2) {
    const a = c * 2 * Math.PI / k;
    const cos = Math.cos(a), sin = Math.sin(a);
    const used = new Array(ptsB.length).fill(false);
    for (const p of ptsA) {
      const dx = p.x - center.x, dy = p.y - center.y;
      const rx = center.x + cos * dx - sin * dy;
      const ry = center.y + sin * dx + cos * dy;
      let matched = -1;
      for (let m = 0; m < ptsB.length; m++) {
        if (used[m]) continue;
        const ex = ptsB[m].x - rx, ey = ptsB[m].y - ry;
        if (ex * ex + ey * ey <= tol2) { matched = m; break; }
      }
      if (matched < 0) return false;
      used[matched] = true;
    }
    return true;
  }

  // ─── S15C 쌍-우선 구성 (ICC 하드 제약) ─────────────────────────
  /**
   * 원칙 15 Step C — ICC 5대 제약을 하드 제약으로 내장하여 후보 타일링 생성
   *
   * ctx.groups: assignGroupNumbers 결과 groups[]
   * ctx.arrangement: 배열 방식
   * ctx.nickel_w: 니켈 폭 (px, ICC ①②③ 계산 기준)
   * symmetry: detectSymmetryGroup 결과
   * pairs: enumerateCongruentPairs 결과
   */
  function buildPairFirst(ctx, symmetry, pairs) {
    const { groups, arrangement, nickel_w } = ctx || {};
    if (!groups || groups.length === 0) {
      return { candidate_tilings: [], icc_violations: [] };
    }

    const nw = nickel_w || 1;
    const violations = [];
    const valid = [];

    // 각 그룹을 ICC 체크
    for (const group of groups) {
      const cells = group.cells || [];
      if (cells.length === 0) { valid.push(group); continue; }

      const adj = buildAdjacency(cells, arrangement, null);
      const qs  = group.quality_score != null ? group.quality_score : groupQualityScore(cells, adj);

      // quality_score −10 → 즉시 가지치기 (원칙 15 Step C)
      if (qs === -10) {
        violations.push({ group: group.index, rule: 'quality_score', value: qs });
        continue;
      }

      // ICC ①: min(rowSpan, colSpan) ≤ 2 — 세로 P-pentomino(3×2) 포함 통과
      const ys = cells.map(c => Math.round(_pt(c).y * 10) / 10);
      const xs = cells.map(c => Math.round(_pt(c).x * 10) / 10);
      const p  = estimatePitch(cells);
      const rowSpan = Math.round((Math.max(...ys) - Math.min(...ys)) / (p || 1)) + 1;
      const colSpan = Math.round((Math.max(...xs) - Math.min(...xs)) / (p || 1)) + 1;
      if (Math.min(rowSpan, colSpan) > 2) {
        violations.push({ group: group.index, rule: 'ICC①_minSpan', value: Math.min(rowSpan, colSpan) });
        continue;
      }

      // ICC ②: 종횡비 ≤ 2.0
      const spanX = Math.max(...xs) - Math.min(...xs) + p;
      const spanY = Math.max(...ys) - Math.min(...ys) + p;
      const ratio = spanX > spanY ? spanX / spanY : spanY / spanX;
      if (ratio > 2.0) {
        violations.push({ group: group.index, rule: 'ICC②_ratio', value: ratio.toFixed(2) });
        continue;
      }

      // ICC ③: 볼록성 ≥ 0.75 (groupQualityScore −10은 이미 가지치기됨)
      valid.push({ ...group, quality_score: qs, icc_row_span: rowSpan, icc_ratio: ratio });
    }

    // 유효 그룹에서 후보 타일링 구성
    const candidate = {
      groups: valid,
      m_distinct: new Set(valid.map(g => JSON.stringify(
        buildAdjacency(g.cells, arrangement, null).map(e => [e.i, e.j])
      ))).size,
    };

    return {
      candidate_tilings: [candidate],
      icc_violations: violations,
    };
  }

  // ─── S15D 종수 최소화 ──────────────────────────
  /**
   * 원칙 15 Step D — 종수 최소화
   *   ICC 통과 후보 타일링 집합에서 각 candidate의 그룹 형상 개수(m_distinct)를
   *   canonicalSig(회전만, 거울 제외) 기반으로 산출하고 최소값 후보만 선택.
   *
   * @param {Array} candidates - buildPairFirst.candidate_tilings 형식
   * @param {object} [options] - { rotSteps: 4|6 } (기본 4 square)
   */
  function minimizeShapeCount(candidates, options) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return { m_distinct_min: null, optimal_tilings: [] };
    }
    const rotSteps = (options && options.rotSteps) || 4;

    const scored = candidates.map(c => {
      const sigs = new Set();
      for (const g of (c.groups || [])) sigs.add(_shapeSigOf(g, rotSteps));
      return { candidate: c, m_distinct: sigs.size, signatures: [...sigs] };
    });

    const minVal = scored.reduce((m, r) => Math.min(m, r.m_distinct), Infinity);
    const optimal_tilings = scored
      .filter(r => r.m_distinct === minVal)
      .map(r => Object.assign({}, r.candidate, {
        m_distinct: r.m_distinct,
        signatures: r.signatures,
      }));

    return { m_distinct_min: minVal, optimal_tilings };
  }

  // ─── S15 전체 파이프라인 ───────────────────────
  function sfmtSearch(ctx) {
    const sym = detectSymmetryGroup(ctx);
    const pairs = enumerateCongruentPairs(ctx, sym);
    const built = buildPairFirst(ctx, sym, pairs);
    const minimized = minimizeShapeCount(built.candidate_tilings);
    return {
      candidates: built.candidate_tilings,
      m_distinct: minimized.m_distinct_min,
      symmetry_group: sym.symmetry_order,
      icc_violations: built.icc_violations,
    };
  }

  // ─── S02 니켈 연결 범위 ────────────────────────
  function calcConnectionBounds(G_a, G_b, nickel_w, connection_type) {
    const type = connection_type || 'horizontal';
    const half = nickel_w / 2;
    if (type === 'horizontal') {
      const left = G_a.cx <= G_b.cx ? G_a : G_b;
      const right = G_a.cx > G_b.cx ? G_a : G_b;
      return {
        x_range: [left.cx - half, right.cx + half],
        y_range: [Math.min(G_a.cy, G_b.cy) - half, Math.max(G_a.cy, G_b.cy) + half],
      };
    }
    if (type === 'vertical') {
      const top = G_a.cy <= G_b.cy ? G_a : G_b;
      const bot = G_a.cy > G_b.cy ? G_a : G_b;
      return {
        x_range: [Math.min(G_a.cx, G_b.cx) - half, Math.max(G_a.cx, G_b.cx) + half],
        y_range: [top.cy - half, bot.cy + half],
      };
    }
    // diagonal
    return {
      x_range: [Math.min(G_a.cx, G_b.cx) - half, Math.max(G_a.cx, G_b.cx) + half],
      y_range: [Math.min(G_a.cy, G_b.cy) - half, Math.max(G_a.cy, G_b.cy) + half],
    };
  }

  // ─── S22 BMS 근접 선택 ──────────────────────────────────────────
  /**
   * 원칙 22 — BMS 최단 거리 기준으로 후보 타일링 중 최적 선택
   *
   * ctx.candidate_tilings: buildPairFirst 결과
   * ctx.bms_side: 'top'|'bottom'|'left'|'right'
   * ctx.all_cells: 전체 팩 셀 (bounding box 계산용)
   * ctx.groups: assignGroupNumbers 결과 (B+ 탭 위치 계산용)
   */
  function selectBmsOptimal(ctx) {
    const { candidate_tilings, bms_side, all_cells, groups } = ctx || {};
    const side = bms_side || 'top';

    if (!candidate_tilings || candidate_tilings.length === 0) {
      return {
        selected_tiling: null,
        b_plus_tab_position: null,
        b_minus_tab_position: null,
        bridge_anchor_points: [],
        bms_side: side,
      };
    }

    // 팩 bounding box (기준선 계산용)
    const allCells = all_cells || (groups || []).flatMap(g => g.cells || []);
    const packXs   = allCells.map(c => _pt(c).x);
    const packYs   = allCells.map(c => _pt(c).y);
    const packBox  = {
      minX: Math.min(...packXs), maxX: Math.max(...packXs),
      minY: Math.min(...packYs), maxY: Math.max(...packYs),
    };

    function bmsDist(pt) {
      const { x, y } = _pt(pt);
      switch (side) {
        case 'top':    return Math.abs(y - packBox.minY);
        case 'bottom': return Math.abs(y - packBox.maxY);
        case 'left':   return Math.abs(x - packBox.minX);
        case 'right':  return Math.abs(x - packBox.maxX);
        default:       return Infinity;
      }
    }

    function groupTabPt(groupCells) {
      if (!groupCells || groupCells.length === 0) return null;
      return groupCells.reduce((best, c) => {
        const a = _pt(best), b = _pt(c);
        switch (side) {
          case 'top':    return b.y < a.y ? c : best;
          case 'bottom': return b.y > a.y ? c : best;
          case 'left':   return b.x < a.x ? c : best;
          case 'right':  return b.x > a.x ? c : best;
          default:       return best;
        }
      });
    }

    const grps = groups || [];
    const gPlus  = grps.find(g => g.is_b_plus)  || grps[0];
    const gMinus = grps.find(g => g.is_b_minus) || grps[grps.length - 1];
    const bPlusTab  = gPlus  ? groupTabPt(gPlus.cells)  : null;
    const bMinusTab = gMinus ? groupTabPt(gMinus.cells) : null;

    const ranked = candidate_tilings.map(tiling => {
      const bPlusDist  = bPlusTab  ? bmsDist(bPlusTab)  : Infinity;
      const bMinusDist = bMinusTab ? bmsDist(bMinusTab) : Infinity;
      return { tiling, bPlusDist, bMinusDist };
    });
    ranked.sort((a, b) => a.bPlusDist - b.bPlusDist || a.bMinusDist - b.bMinusDist);

    const best = ranked[0];
    return {
      selected_tiling:    best.tiling,
      b_plus_tab_position:  bPlusTab,
      b_minus_tab_position: bMinusTab,
      bridge_anchor_points: [],
      bms_side:  side,
      dist_b_plus:  best.bPlusDist,
      dist_b_minus: best.bMinusDist,
    };
  }

  // ─── S13 컬럼그룹 금형 효율 ────────────────────
  function detectColumnGroupEfficiency(ctx) {
    const { S, P, arrangement, group_shape, series_path_shape, b_plus_face, b_minus_face } = ctx || {};
    const cond_1 = (S % 2 === 0);
    const cond_2 = (arrangement === 'square');
    const cond_3 = (group_shape === 'column_Px1');
    const prereq_5 = (series_path_shape === 'linear_boustrophedon') && (b_plus_face !== b_minus_face);
    const eligible = cond_1 && cond_2 && cond_3;

    if (eligible) {
      return {
        eligible: true,
        m_min_estimated: prereq_5 ? 2 : null,
        shape_category: 'terminal_plate + bridge_plate',
        prereq_5_satisfied: prereq_5,
      };
    }
    if (!cond_1 && cond_2 && cond_3) {
      return {
        eligible: false,
        m_min_estimated: 3,
        shape_category: 'S_odd_estimated (C2 회전 대칭 검증 필요)',
        prereq_5_satisfied: prereq_5,
      };
    }
    return { eligible: false, m_min_estimated: null, shape_category: null };
  }

  // ─── S18 니켈 형상 (stroke graph) ──────────────
  /**
   * 원칙 18 — adjacency spanning tree + cell 원형 배경
   *   입력 ctx: { group_cells:[{x,y}|{cx,cy}], adjacency_graph:[{i,j}], R? }
   *   출력: { stroke_graph:{V,E}, svg_elements:[{type:'circle'|'line', ...}] }
   */
  function buildStrokeGraph(ctx) {
    const { group_cells = [], adjacency_graph = [], R = 33 } = ctx || {};
    const V = group_cells;
    const n = V.length;

    // BFS spanning tree — 컴포넌트별로 첫 미방문 노드부터 확장
    const adj = Array.from({ length: n }, () => []);
    for (const e of adjacency_graph) {
      if (!Number.isInteger(e.i) || !Number.isInteger(e.j)) continue;
      if (e.i < 0 || e.i >= n || e.j < 0 || e.j >= n || e.i === e.j) continue;
      adj[e.i].push(e.j);
      adj[e.j].push(e.i);
    }
    const visited = new Array(n).fill(false);
    const E = [];
    for (let start = 0; start < n; start++) {
      if (visited[start]) continue;
      visited[start] = true;
      const queue = [start];
      while (queue.length) {
        const u = queue.shift();
        for (const v of adj[u]) {
          if (visited[v]) continue;
          visited[v] = true;
          E.push({ i: Math.min(u, v), j: Math.max(u, v) });
          queue.push(v);
        }
      }
    }

    // svg_elements — 원칙 18: stroke=2R, linecap=round + cell circle 배경
    const svg_elements = [];
    for (const c of V) {
      const p = _pt(c);
      svg_elements.push({ type: 'circle', cx: p.x, cy: p.y, r: R });
    }
    for (const e of E) {
      const a = _pt(V[e.i]);
      const b = _pt(V[e.j]);
      svg_elements.push({
        type: 'line',
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        strokeWidth: 2 * R,
        linecap: 'round',
      });
    }

    return {
      stroke_graph: { V, E },
      svg_elements,
    };
  }

  // ─── S23 엇배열 hex 클러스터 ───────────────────
  /**
   * 원칙 23 — hex 6방향 adjacency spanning tree + cell 원형 배경
   *   입력 ctx: { group_cells:[{x,y}|{cx,cy}], hex_adjacency_graph:[{i,j}], R? }
   *   출력: { hex_spanning_tree:[{i,j}], stroke_graph_hex:{V,E}, svg_elements }
   */
  function buildHexCluster(ctx) {
    const { group_cells = [], hex_adjacency_graph = [], R = 33 } = ctx || {};
    const V = group_cells;
    const n = V.length;

    // BFS spanning tree — 방법 B (hex 6-이웃 기반)
    const adj = Array.from({ length: n }, () => []);
    for (const e of hex_adjacency_graph) {
      if (!Number.isInteger(e.i) || !Number.isInteger(e.j)) continue;
      if (e.i < 0 || e.i >= n || e.j < 0 || e.j >= n || e.i === e.j) continue;
      adj[e.i].push(e.j);
      adj[e.j].push(e.i);
    }
    const visited = new Array(n).fill(false);
    const spanTree = [];
    for (let start = 0; start < n; start++) {
      if (visited[start]) continue;
      visited[start] = true;
      const queue = [start];
      while (queue.length) {
        const u = queue.shift();
        for (const v of adj[u]) {
          if (visited[v]) continue;
          visited[v] = true;
          spanTree.push({ i: Math.min(u, v), j: Math.max(u, v) });
          queue.push(v);
        }
      }
    }

    // svg_elements — 원칙 23 (stroke=2R, linecap=round + cell 원형 배경)
    const svg_elements = [];
    for (const c of V) {
      const p = _pt(c);
      svg_elements.push({ type: 'circle', cx: p.x, cy: p.y, r: R });
    }
    for (const e of spanTree) {
      const a = _pt(V[e.i]);
      const b = _pt(V[e.j]);
      svg_elements.push({
        type: 'line',
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        strokeWidth: 2 * R,
        linecap: 'round',
      });
    }

    return {
      hex_spanning_tree: spanTree,
      stroke_graph_hex: { V, E: spanTree },
      svg_elements,
    };
  }

  // ═══════════════════════════════════════════════
  // 3. STEPS 레지스트리 (design_spec step id ↔ entry_fn 매핑)
  // ═══════════════════════════════════════════════
  const STEPS = {
    S24: assignGroupNumbers,
    S15: sfmtSearch,
    S15A: detectSymmetryGroup,
    S15B: enumerateCongruentPairs,
    S15C: buildPairFirst,
    S15D: minimizeShapeCount,
    S02: calcConnectionBounds,
    S22: selectBmsOptimal,
    S13: detectColumnGroupEfficiency,
    S18: buildStrokeGraph,
    S23: buildHexCluster,
  };

  // ═══════════════════════════════════════════════
  // 4. 공개 API
  // ═══════════════════════════════════════════════
  const api = {
    VERSION: 'v7-tier2d-p29',
    loadSpec,
    // gen-layout.js 이관 함수 (하위 호환 re-export)
    canonicalSig,
    selectBlockType,
    calcNickelPattern,
    buildSnakeLayout,
    estimateMmin,
    calcCustomCenters,
    // gen-math.js 이관 함수 (하위 호환 re-export)
    checkPlanarNoCrossing,
    _segmentsProperIntersect,
    estimatePitch,
    buildAdjacency,
    groupQualityScore,
    compactShapeScore,
    // 검증 함수 (이 파일 정의)
    checkGroupValidity,
    validateP28,            // 원칙 28 — P/2P/P 셀 수 + BFS 연결성 불변
    // design_spec entry_fns (M7 실구현 3종 + 잔여 스텁)
    assignGroupNumbers,       // S24 ✅ 실구현
    detectSymmetryGroup,      // S15A 실구현 (M7 세션 11)
    enumerateCongruentPairs,  // S15B 실구현 (M7 세션 13)
    buildPairFirst,           // S15C ✅ ICC 체크 실구현
    minimizeShapeCount,       // S15D 스텁 유지
    sfmtSearch,               // S15 파이프라인
    calcConnectionBounds,     // S02 실구현(기존)
    selectBmsOptimal,         // S22 ✅ 실구현
    detectColumnGroupEfficiency, // S13 실구현(기존)
    buildStrokeGraph,         // S18 실구현 (원칙 18 spanning tree)
    buildHexCluster,          // S23 실구현 (원칙 23 hex spanning tree)
    // H1/H2/H3 — 홀더 그리드 & 경계 & 열거기 (gen-enum.js re-export)
    calcBoundarySet,          // H2 ✅
    buildHolderGrid,          // H1 ✅
    enumerateGroupAssignments, // H3 ✅ (backtracking, N≤60)
    STEPS,
    get SPEC() { return SPEC; },
  };

  // ═══════════════════════════════════════════════
  // export (Node + Browser 양쪽 지원)
  // ═══════════════════════════════════════════════
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Generator = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
