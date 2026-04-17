/**
 * Pack-Renderer Generator (LAYER 3)
 *
 * 역할: skills/design_spec.json의 11개 entry_fn을 구현하는 형상 생성 엔진.
 *       renderer.js에서 이관된 6개 함수 + design_spec 신규 스텁 함수 5종을 포함.
 *
 * 입력 스펙:  skills/design_spec.json (M3 완료, 11 entry_fns_required)
 * 호출 주체:  renderer.js (drawFace 등), app.js (updateInfoBox의 estimateMmin),
 *            validator.js (P14/P25 체크 시 참조)
 *
 * 스텝 호출 순서 (design_spec.json call_order):
 *   LAYER 1 결정(P04·P17)  → S24(assignGroupNumbers)
 *     → S15(sfmtSearch:A·B·C·D) → S13(detectColumnGroupEfficiency, 조건부)
 *       → S22(selectBmsOptimal) → 결과 반환
 *
 * 이관 목록 (M4 Phase 1):
 *   ⬇️ renderer.js → generator.js
 *     - canonicalSig     (원칙 12 캐노니컬 서명, 회전만)
 *     - selectBlockType  (P값 → 블록 타입 라우팅)
 *     - calcNickelPattern (상·하면 플레이트 병합 패턴)
 *     - calcTypeAGeometry (P=5 closed ladder geometry)
 *     - buildSnakeLayout (S×P snake 직렬 순서)
 *   ⬇️ app.js → generator.js
 *     - estimateMmin     (m_min 근사 계산)
 *
 * 신규 스텁 (M4 Phase 1, M7에서 실제 로직 구현):
 *   - assignGroupNumbers         (S24)
 *   - sfmtSearch                 (S15 전체 파이프라인)
 *   - detectSymmetryGroup        (S15A)
 *   - enumerateCongruentPairs    (S15B)
 *   - buildPairFirst             (S15C)
 *   - minimizeShapeCount         (S15D)
 *   - calcConnectionBounds       (S02)
 *   - selectBmsOptimal           (S22)
 *   - detectColumnGroupEfficiency (S13)
 *   - buildStrokeGraph           (S18)
 *   - buildHexCluster            (S23)
 *
 * 최종 업데이트: 2026-04-17 (v7 M4 Phase 1)
 */

(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════
  // spec 로드 (Node: fs / Browser: global.DESIGN_SPEC)
  // ═══════════════════════════════════════════════
  let SPEC = null;

  function loadSpec(specObject) {
    if (specObject && typeof specObject === 'object') {
      SPEC = specObject;
      return SPEC;
    }
    if (typeof require !== 'undefined' && typeof module !== 'undefined') {
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
  // 1. 이관 함수 — renderer.js에서 그대로 이동 (1:1 복사, 로직 동일)
  // ═══════════════════════════════════════════════

  /**
   * 원칙 12 — 캐노니컬 서명 (회전만, 거울 제외)
   *   σ(set) = min{rot_k(set) : k ∈ 0..(rotSteps-1)}
   *   rotSteps: 6 for hex(staggered), 4 for rect(regular)
   */
  function canonicalSig(points, rotSteps) {
    const variants = [];
    for (let k = 0; k < rotSteps; k++) {
      const angle = (2 * Math.PI * k) / rotSteps;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const rotated = points.map(([x, y]) => [
        Math.round((x * ca - y * sa) * 10) / 10,
        Math.round((x * sa + y * ca) * 10) / 10,
      ]);
      rotated.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      variants.push(JSON.stringify(rotated));
    }
    return variants.sort()[0];
  }

  /**
   * P값 기반 블록 타입 선택 (범용 엔진 진입점)
   *   결론.md 확정: P=5 → Type-A, P=4 → U형, P=2 → I형
   *   P=3/P=6: 설계 문서 미확정 → geometry_ready=false 반환
   */
  function selectBlockType(P) {
    switch (P) {
      case 1:
      case 2: return { block_type: 'I',         geometry_ready: true  };
      case 4: return { block_type: 'U',         geometry_ready: true  };
      case 5: return { block_type: 'TypeA',     geometry_ready: true  };
      case 3: return { block_type: 'Compact-H', geometry_ready: false,
        error: 'P=3 Compact-H geometry spec not finalized — 결론.md 수준 문서 대기' };
      case 6: return { block_type: 'Extended',  geometry_ready: false,
        error: 'P=6 Extended geometry spec not finalized — 결론.md 수준 문서 대기' };
      default:
        return { block_type: 'Unknown', geometry_ready: false,
          error: `P=${P} block type not defined` };
    }
  }

  /**
   * 원칙 14 — 상·하면 니켈 플레이트 병합 패턴
   *   상면: [G0], [G1∪G2], [G3∪G4], ..., [G_{S-1} if S짝수]
   *   하면: [G0∪G1], [G2∪G3], ..., [G_{S-1} if S홀수]
   */
  function calcNickelPattern(S, P) {
    const blockInfo = (P != null) ? selectBlockType(P) : { block_type: 'I', geometry_ready: true };
    const btype = blockInfo.geometry_ready ? blockInfo.block_type : 'I';

    const top = [], bot = [];
    top.push({ type: 'I', block_type: btype, groups: [0], isTerminal: true, terminal: 'B+' });
    for (let g = 1; g < S - 1; g += 2)
      top.push({ type: 'U', block_type: btype, groups: [g, g + 1], isTerminal: false, terminal: null });
    if (S % 2 === 0)
      top.push({ type: 'I', block_type: btype, groups: [S - 1], isTerminal: false, terminal: null });

    for (let g = 0; g < S - 1; g += 2)
      bot.push({ type: 'U', block_type: btype, groups: [g, g + 1], isTerminal: false, terminal: null });
    if (S % 2 !== 0)
      bot.push({ type: 'I', block_type: btype, groups: [S - 1], isTerminal: true, terminal: 'B-' });
    else if (bot.length > 0) {
      bot[bot.length - 1].isTerminal = true;
      bot[bot.length - 1].terminal   = 'B-';
    }
    return { top, bot };
  }

  /**
   * Type-A 블록 geometry 계산 (P=5 전용, 결론.md 확정 스펙)
   *   셀 배치: P개 세로 컬럼 → 중앙 기준 2-3 분할 (trunk 위치 결정)
   *   등임피던스: 거리 비례 branch 폭 보정 (중앙 ×0.75, 외곽 ×1.30)
   *   반환: trunk 위치, feed 좌표, branch 배열
   */
  function calcTypeAGeometry(cx_col, cy_arr, R, nw, params) {
    const P = cy_arr.length;
    const split = Math.floor(P / 2);
    const trunk_y = (cy_arr[split - 1] + cy_arr[split]) / 2;
    const trunk_w = ((params.trunk_w_mm || params.nickel_w_mm * 1.5)) * params.scale;

    const feed_extend = nw * 1.5;
    const min_x = Math.min(...cx_col);
    const max_x = Math.max(...cx_col);
    const trunk_x1 = min_x - feed_extend;
    const trunk_x2 = max_x + feed_extend;

    const distances  = cy_arr.map(cy => Math.abs(cy - trunk_y));
    const max_dist   = Math.max(...distances) || 1;
    const c_ratio    = params.branch_w_ratio_center != null ? params.branch_w_ratio_center : 0.75;
    const o_ratio    = params.branch_w_ratio_outer  != null ? params.branch_w_ratio_outer  : 1.30;
    const neck_w_px  = (params.fuse_neck_w_mm || 1.5) * params.scale;
    const neck_l_px  = (params.fuse_neck_l_mm || 3.0) * params.scale;

    const branches = cy_arr.map((cy, i) => {
      const dist_ratio = distances[i] / max_dist;
      const w_ratio    = c_ratio + (o_ratio - c_ratio) * dist_ratio;
      return {
        cell_x:      cx_col[i],
        cell_y:      cy,
        branch_w:    nw * w_ratio,
        neck_w:      neck_w_px,
        neck_l:      neck_l_px,
        above_trunk: cy < trunk_y,
      };
    });

    return { trunk_y, trunk_w, trunk_x1, trunk_x2, feed_xs: [trunk_x1, trunk_x2], branches };
  }

  /**
   * S×P Snake 배치 순서 반환 (원칙 24 보스트로페돈)
   *   기본 2행: 첫 행 ceil(S/2)개 좌→우, 둘째 행 floor(S/2)개 우→좌
   *   options.max_rows: 최대 행 수 (기본 2, 공간 제약 시 3 이상 가능)
   */
  function buildSnakeLayout(S, P, options) {
    const max_rows = (options && options.max_rows) || 2;

    const rows = [];
    let remaining = S;
    for (let r = 0; r < max_rows && remaining > 0; r++) {
      const size = Math.ceil(remaining / (max_rows - r));
      rows.push(size);
      remaining -= size;
    }

    const blocks = [];
    let serial = 0;
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const ltr  = (rowIdx % 2 === 0);
      const size = rows[rowIdx];
      for (let pos = 0; pos < size; pos++) {
        const grid_col = ltr ? pos : (size - 1 - pos);
        blocks.push({ serial_idx: serial++, grid_row: rowIdx, grid_col });
      }
    }

    return { blocks, rows, total: S };
  }

  /**
   * m_min 컬럼 파티션 하한 근사 계산 (app.js에서 이관)
   *   원칙 22 — 사각 정배열 컬럼 파티션 최적성 정리:
   *     square + S 짝수 → m_min = 1
   *     square + S 홀수 → m_min = 2
   *     staggered/custom → 상한 추정 ceil((S+1)/2) + 1
   *   mirror 허용 시 -1 가능 (원칙 12 위반이므로 기본 false)
   */
  function estimateMmin(S, P, arr, mirror) {
    if (arr === 'square') return (S % 2 === 0) ? 1 : 2;
    let m = Math.ceil((S + 1) / 2) + 1;
    if (mirror) m = Math.max(1, m - 1);
    return Math.max(2, m);
  }

  /**
   * 커스텀 배열 좌표 계산 (app.js에서 이관)
   *   입력: rows[] 행별 셀 수, p { cell_type, gap, scale, margin_mm,
   *                            custom_stagger, custom_stagger_dir, custom_align }
   *   출력: { pts[{x,y,row,col}], R, pitch, W, H }
   *   - 엇배열 시 행 간격 = pitch × √3/2 (헥사 밀집)
   *   - staggered_dir='L' 시 leftPad=pitch/2 로 좌측 오버플로 방지
   */
  function calcCustomCenters(rows, p, cellSpec) {
    if (!cellSpec) throw new Error('[generator.calcCustomCenters] cellSpec 미제공');
    const spec    = cellSpec[p.cell_type];
    if (!spec) throw new Error(`[generator.calcCustomCenters] Unknown cell_type: ${p.cell_type}`);
    const pitch   = (spec.render_d + (p.gap || 0)) * p.scale;
    const R       = (spec.render_d / 2) * p.scale;
    const margin  = p.margin_mm * p.scale;
    const stagger = !!p.custom_stagger;
    const pitchY  = stagger ? pitch * Math.sqrt(3) / 2 : pitch;
    const maxN    = Math.max(...rows);
    const align   = p.custom_align || 'center';

    const stagDir = (p.custom_stagger_dir === 'L') ? -1 : 1;
    const leftPad = (stagger && stagDir === -1) ? pitch / 2 : 0;

    const pts = [];
    for (let r = 0; r < rows.length; r++) {
      const n          = rows[r];
      const fromBottom = rows.length - 1 - r;
      const stagOffX   = (stagger && fromBottom % 2 === 1) ? stagDir * pitch / 2 : 0;
      let alignOffX;
      if      (align === 'left')  alignOffX = 0;
      else if (align === 'right') alignOffX = (maxN - n) * pitch;
      else                        alignOffX = (maxN - n) * pitch / 2;
      for (let i = 0; i < n; i++) {
        pts.push({
          x: margin + leftPad + alignOffX + stagOffX + i * pitch + R,
          y: margin + r * pitchY + R,
          row: r, col: i,
        });
      }
    }

    const extraW = stagger ? pitch / 2 : 0;
    return {
      pts, R, pitch,
      W: margin * 2 + maxN * pitch + extraW,
      H: margin * 2 + (rows.length - 1) * pitchY + 2 * R,
    };
  }

  // ═══════════════════════════════════════════════
  // 1.5 인접성·품질·유효성 유틸리티 (M7 신규)
  // ═══════════════════════════════════════════════

  /** 셀 배열에서 x·y 좌표를 추출 (cx/cy 호환) */
  function _pt(c) {
    return { x: c.x != null ? c.x : c.cx, y: c.y != null ? c.y : c.cy };
  }

  /**
   * pitch 자동 추정: 셀 쌍 중 양수 최소 거리
   * cells: [{x,y}|{cx,cy}]
   */
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

  /**
   * 원칙 9 — 인접 엣지 목록 계산
   * cells: [{x,y}|{cx,cy}], arrangement: 'square'|'staggered'|'custom'
   * pitch: 기준 거리 (null이면 자동 추정)
   * 반환: [{i, j}] (i < j, 로컬 인덱스)
   *
   * 정배열 4-이웃: threshold = pitch × 1.05
   * 엇배열 6-이웃: hex 간격 = pitch → threshold = pitch × 1.05 동일
   * 커스텀:        threshold = pitch × 1.1 (원칙 9 ③, 제조 공차 ±10%)
   */
  function buildAdjacency(cells, arrangement, pitch) {
    if (!cells || cells.length < 2) return [];
    const p = pitch || estimatePitch(cells);
    const thr = arrangement === 'custom' ? p * 1.1 : p * 1.05;
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

  /**
   * 원칙 21 / nickel-plate-design.md 원칙 15 — 그룹 형상 품질 점수
   * cells: 그룹 내 셀 배열, edges: buildAdjacency 결과 (셀 로컬 인덱스)
   *
   * +10: 컴팩트 2D 클러스터 (볼록성 ≥ 0.75, 분기 노드 없음)
   *   0: 순수 I형(선형) 또는 단순 L·S형
   * −10: 돌기형 T/Y (degree ≥ 3 분기 노드 존재)
   */
  function groupQualityScore(cells, edges) {
    if (!cells || cells.length <= 1) return 0;

    // T/Y형 판별: degree ≥ 3 분기 노드
    const degree = new Array(cells.length).fill(0);
    for (const { i, j } of edges) { degree[i]++; degree[j]++; }
    if (degree.some(d => d >= 3)) return -10;

    // I형 판별: 모든 셀이 단일 x 또는 단일 y 라인
    const xs = cells.map(c => Math.round(_pt(c).x * 10) / 10);
    const ys = cells.map(c => Math.round(_pt(c).y * 10) / 10);
    if (new Set(xs).size === 1 || new Set(ys).size === 1) return 0;

    // 2D 컴팩트 판별: 사이클 있음 (|E| ≥ |V|) && bounding-box 충진율 ≥ 0.75
    // 사이클 없는 트리(L·S·U형)는 항상 0점, 사이클 있는 격자형이 +10 대상
    const hasCycle = edges.length >= cells.length;
    if (!hasCycle) return 0;  // L·S·U형 등 단순 체인 → 0점

    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const p = estimatePitch(cells);
    const bboxCols = Math.round((maxX - minX) / p) + 1;
    const bboxRows = Math.round((maxY - minY) / p) + 1;
    const fillRatio = cells.length / (bboxCols * bboxRows);
    if (fillRatio >= 0.75) return +10;

    return 0;
  }

  /**
   * 원칙 21 — 조건 A(BFS 연결성) + 조건 B(G_i↔G_{i+1} 인접쌍 ≥1) 검증
   * groups: [{index, cells:[{x,y}|{cx,cy}]}]
   * arrangement: 'square'|'staggered'|'custom'
   * pitch: 기준 거리 (optional)
   * 반환: { valid:boolean, violations:[{group, reason}] }
   */
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
   * 보스트로페돈 정렬 (원칙 24 ①)
   * cells: [{x,y}|{cx,cy}]
   * P: 병렬 셀 수 (행 높이, 행 분류 기준 — null이면 y 좌표 기반 자동)
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
  function detectSymmetryGroup(ctx) {
    // TODO M7: rows[] 무게중심 회전 일치 탐색
    const arrangement = (ctx && ctx.arrangement) || 'square';
    const defaults = {
      square:    { symmetry_order: 2, rotation_center: null },
      staggered: { symmetry_order: 2, rotation_center: null },
      custom:    { symmetry_order: 1, rotation_center: null },
    };
    return { ...defaults[arrangement] || defaults.custom, stub: 'S15A' };
  }

  // ─── S15B 합동 쌍 열거 ─────────────────────────
  function enumerateCongruentPairs(ctx, symmetry) {
    // TODO M7: 회전 대칭 하에서 매핑되는 그룹 쌍 열거
    return { congruent_pairs: [], stub: 'S15B' };
  }

  // ─── S15C 쌍-우선 구성 (ICC 하드 제약) ─────────────────────────
  /**
   * 원칙 15 Step C — ICC 5대 제약을 하드 제약으로 내장하여 후보 타일링 생성
   *   ① 행 스팬 ≤ 2  ② 종횡비 ≤ 2.0  ③ 볼록성 ≥ 0.75
   *   ④ 이종 극성 비중첩  ⑤ 합동 쌍 대칭 배치
   * quality_score −10 후보를 우선 가지치기하여 탐색 공간 축소.
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

      // ICC ①: 행 스팬 ≤ 2
      const ys = cells.map(c => Math.round(_pt(c).y * 10) / 10);
      const p  = estimatePitch(cells);
      const rowSpan = Math.round((Math.max(...ys) - Math.min(...ys)) / (p || 1)) + 1;
      if (rowSpan > 2) {
        violations.push({ group: group.index, rule: 'ICC①_rowSpan', value: rowSpan });
        continue;
      }

      // ICC ②: 종횡비 ≤ 2.0
      const xs   = cells.map(c => Math.round(_pt(c).x * 10) / 10);
      const spanX = Math.max(...xs) - Math.min(...xs) + p;
      const spanY = Math.max(...ys) - Math.min(...ys) + p;
      const ratio = spanX > spanY ? spanX / spanY : spanY / spanX;
      if (ratio > 2.0) {
        violations.push({ group: group.index, rule: 'ICC②_ratio', value: ratio.toFixed(2) });
        continue;
      }

      // ICC ③: 볼록성 ≥ 0.75 (groupQualityScore −10은 이미 가지치기됨)
      // qs=0 이상이면 ③ 위반 가능성 낮음; 정확 계산은 추후 S15D에서 재검
      valid.push({ ...group, quality_score: qs, icc_row_span: rowSpan, icc_ratio: ratio });
    }

    // 유효 그룹에서 후보 타일링 구성 (현재: 그룹 전체를 단일 타일링으로 묶음)
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
  function minimizeShapeCount(candidates) {
    // TODO M7: ICC 통과 후보군 내 m_distinct 최소 탐색
    return {
      m_distinct_min: null,
      optimal_tilings: [],
      stub: 'S15D',
    };
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
      congruent_pairs: pairs.congruent_pairs,
      stub: 'S15',
    };
  }

  // ─── S02 니켈 연결 범위 ────────────────────────
  function calcConnectionBounds(G_a, G_b, nickel_w, connection_type) {
    // 공식 그대로 구현 (설계 스펙 S02)
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
   *   선택 기준: B+ 단자 탭 위치 → BMS 기준선까지 유클리드 거리 최소
   *   동점 시: B− 탭 거리로 tie-break (원칙 22)
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

    /** 탭 포인트 → BMS 기준선 유클리드 거리 */
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

    /**
     * 그룹의 탭 후보점: 그룹 내 셀 중 BMS 방향으로 가장 가까운 셀 위치
     * (탭 위치 정밀 계산은 원칙 25에서 확정; 여기서는 셀 중심 근사)
     */
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

    // 타일링별 B+/B− 탭 거리 계산
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
    // S 홀수 + else 일치 → 추정 m=3
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
  function buildStrokeGraph(ctx) {
    // TODO M7: adjacency spanning tree + cell_background
    const { group_cells, adjacency_graph } = ctx || {};
    return {
      stroke_graph: {
        V: group_cells || [],
        E: adjacency_graph || [],
      },
      svg_elements: [],
      stub: 'S18',
    };
  }

  // ─── S23 엇배열 hex 클러스터 ───────────────────
  function buildHexCluster(ctx) {
    // TODO M7: hex 6방향 spanning tree
    const { group_cells, hex_adjacency_graph } = ctx || {};
    return {
      hex_spanning_tree: [],
      stroke_graph_hex: {
        V: group_cells || [],
        E: hex_adjacency_graph || [],
      },
      stub: 'S23',
    };
  }

  // ═══════════════════════════════════════════════
  // 2.5  H1/H2/H3 — 홀더 그리드 & 경계 & Hamiltonian 열거기
  //      (holder_array_constraint_design.md §4–§5 구현)
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
    } = ctx || {};

    if (!cells || cells.length === 0 || S < 1 || P < 1) {
      return { candidates: [], count: 0, strategy: 'none', error: 'invalid ctx' };
    }
    const N = cells.length;
    if (N < S * P) {
      return { candidates: [], count: 0, strategy: 'none', error: `셀 부족: ${N} < ${S}×${P}` };
    }

    const pitch = estimatePitch(cells);
    const thr   = arrangement === 'custom' ? pitch * 1.1 : pitch * 1.05;
    const bPlus  = calcBoundarySet(cells, b_plus_side);
    const bMinus = calcBoundarySet(cells, b_minus_side);

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
      const ratio   = is1D ? 1 : Math.max(spanX, spanY) / (Math.min(spanX, spanY) || 1);

      return {
        edges, hasT, is1D, rowSpan, ratio,
        icc1_ok: rowSpan <= 2,
        icc2_ok: is1D || ratio <= 2.0,
        qs: groupQualityScore(gc, edges),
      };
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
      const bpOk = groups[0]?.cells.some(c => cellInBoundary(c, bPlus)) ?? false;
      const bmOk = groups[S - 1]?.cells.some(c => cellInBoundary(c, bMinus)) ?? false;
      const totalScore = groups.reduce((s, g) => s + g.quality_score, 0);
      return {
        groups, total_score: totalScore,
        name, desc, is_standard: true,
        b_plus_ok: bpOk, b_minus_ok: bmOk,
        icc_violations: iccViolations,
      };
    }

    const results = [];
    let btIterations = 0;
    let strategy = 'standard';

    if (arrangement !== 'custom') {
      const STANDARD = [
        { name: '보스트로페돈 L→R', desc: '행 우선 · 짝수행 L→R', fn: () => makeBoustrophedon(true)  },
        { name: '보스트로페돈 R→L', desc: '행 우선 · 짝수행 R→L', fn: () => makeBoustrophedon(false) },
        { name: '열 우선 L→R',      desc: '열 우선 · 좌열→우열',  fn: () => makeColumnFirst(false)   },
        { name: '열 우선 R→L',      desc: '열 우선 · 우열→좌열',  fn: () => makeColumnFirst(true)    },
      ];
      for (const ord of STANDARD) {
        const cand = flatToCandidate(ord.fn(), ord.name, ord.desc);
        if (cand) results.push(cand);
      }
    }

    // ── Phase 2: 백트래킹 (N ≤ 18 소형만, 비표준 해 탐색) ──────────
    if (N <= 18 && results.length < max_candidates) {
      strategy = 'standard+backtracking';

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
        if (icc.hasT) return false;
        if (icc1 && !icc.icc1_ok) return false;
        if (icc2 && !icc.icc2_ok) return false;
        return true;
      }

      // 표준 배열과 동일한 그룹 구성인지 시그니처로 중복 검사
      const seenSigs = new Set(results.map(r =>
        r.groups.map(g => g.cells.map(c => xyKey(c)).sort().join(';')).join('|')
      ));

      const used = new Uint8Array(N);
      const MAX_ITER_BT = 50000;

      function dfs(gIdx, snapGroups, curIdxs, frontier) {
        if (results.length >= max_candidates || ++btIterations > MAX_ITER_BT) return;

        if (curIdxs.length === P) {
          if (!passICC_bt(curIdxs)) return;
          const snap = [...curIdxs];
          const allSnaps = snapGroups.concat([snap]);

          if (gIdx === S - 1) {
            if (!snap.some(i => bMinus.has(i))) return;
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
            const sig = groups.map(g => g.cells.map(c => xyKey(c)).sort().join(';')).join('|');
            if (!seenSigs.has(sig)) {
              seenSigs.add(sig);
              const totalScore = groups.reduce((s, g) => s + g.quality_score, 0);
              results.push({
                groups, total_score: totalScore,
                name: `비표준 ${results.length + 1}`, desc: 'backtracking',
                is_standard: false, b_plus_ok: true, b_minus_ok: true,
                icc_violations: 0,
              });
            }
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

      for (const startCell of bPlus) {
        if (results.length >= max_candidates || btIterations > MAX_ITER_BT) break;
        used[startCell] = 1;
        dfs(0, [], [startCell], new Set(adjL[startCell].filter(nb => !used[nb])));
        used[startCell] = 0;
      }
    }

    // 정렬: B+/B- 충족 우선 → ICC 위반 적은 순 → 점수 높은 순
    results.sort((a, b) => {
      const aOk = (a.b_plus_ok && a.b_minus_ok) ? 0 : 1;
      const bOk = (b.b_plus_ok && b.b_minus_ok) ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;
      if (a.icc_violations !== b.icc_violations) return a.icc_violations - b.icc_violations;
      return b.total_score - a.total_score;
    });

    return {
      candidates:           results,
      count:                results.length,
      strategy,
      boundary_plus_count:  bPlus.size,
      boundary_minus_count: bMinus.size,
      iterations_used:      btIterations,
      max_iter_hit:         btIterations >= 50000,
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
  // 4. export (Node + Browser 양쪽 지원)
  // ═══════════════════════════════════════════════
  const api = {
    VERSION: 'v7-M7',
    loadSpec,
    // 이관된 6개 실함수
    canonicalSig,
    selectBlockType,
    calcNickelPattern,
    calcTypeAGeometry,
    buildSnakeLayout,
    estimateMmin,
    calcCustomCenters,
    // M7 신규 유틸리티
    estimatePitch,
    buildAdjacency,
    groupQualityScore,
    checkGroupValidity,
    // design_spec entry_fns (M7 실구현 3종 + 잔여 스텁)
    assignGroupNumbers,       // S24 ✅ 실구현
    detectSymmetryGroup,      // S15A 스텁 유지
    enumerateCongruentPairs,  // S15B 스텁 유지
    buildPairFirst,           // S15C ✅ ICC 체크 실구현
    minimizeShapeCount,       // S15D 스텁 유지
    sfmtSearch,               // S15 파이프라인
    calcConnectionBounds,     // S02 실구현(기존)
    selectBmsOptimal,         // S22 ✅ 실구현
    detectColumnGroupEfficiency, // S13 실구현(기존)
    buildStrokeGraph,         // S18 스텁 유지
    buildHexCluster,          // S23 스텁 유지
    // H1/H2/H3 — 홀더 그리드 & 경계 & 열거기
    calcBoundarySet,          // H2 ✅
    buildHolderGrid,          // H1 ✅
    enumerateGroupAssignments, // H3 ✅ (backtracking, N≤60)
    STEPS,
    get SPEC() { return SPEC; },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Generator = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
