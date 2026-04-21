/**
 * gen-math.js — Generator 수학 기초 유틸리티 (LAYER 3 공유 서브모듈)
 *
 * 추출 출처: generator.js §1.5 인접성·품질·유효성 유틸리티 (M7 신규)
 * 의존 관계: 없음 (순수 수학 함수)
 * 공개 API:  _pt, _segmentsProperIntersect, checkPlanarNoCrossing,
 *            estimatePitch, buildAdjacency, groupQualityScore, compactShapeScore
 *
 * 이중 런타임:
 *   Node.js  → module.exports = { ... }
 *   Browser  → window._GenMath = { ... }  (generator.js 로드 전에 먼저 로드해야 함)
 */
(function (global) {
  'use strict';

  /** 셀 배열에서 x·y 좌표를 추출 (cx/cy 호환) */
  function _pt(c) {
    return { x: c.x != null ? c.x : c.cx, y: c.y != null ? c.y : c.cy };
  }

  // ─────────────────────────────────────────────
  // 원칙 30: 동일 면 이종 플레이트 비교차 절대 금지
  // ─────────────────────────────────────────────

  /** 두 선분의 proper intersection 판정 (endpoint 접촉 제외) */
  function _segmentsProperIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    function cross2(ox, oy, px, py, qx, qy) {
      return (px - ox) * (qy - oy) - (py - oy) * (qx - ox);
    }
    const d1 = cross2(cx, cy, dx, dy, ax, ay);
    const d2 = cross2(cx, cy, dx, dy, bx, by);
    const d3 = cross2(ax, ay, bx, by, cx, cy);
    const d4 = cross2(ax, ay, bx, by, dx, dy);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  /**
   * 원칙 30: 동일 면 이종 플레이트 비교차 검사
   * groups: [{cells:[{x,y,...}]}]  thr: isAdj 거리 임계값(px)
   * 반환: true = 교차 없음(pass) / false = 교차 발견 → 설계 폐기
   */
  function checkPlanarNoCrossing(groups, thr) {
    const S = groups.length;
    if (S < 2) return true;
    const thrSq = thr * thr;

    for (const pStart of [0, 1]) {
      // 원칙 14 면별 플레이트 구성
      const plateCells = [];
      const paired = new Set();
      for (let g = pStart; g + 1 < S; g += 2) {
        plateCells.push([...groups[g].cells, ...groups[g + 1].cells]);
        paired.add(g); paired.add(g + 1);
      }
      for (let g = 0; g < S; g++) {
        if (!paired.has(g))
          plateCells.splice(g === 0 ? 0 : plateCells.length, 0, [...groups[g].cells]);
      }

      // 각 플레이트의 인접 쌍 엣지 수집
      const plateEdges = plateCells.map(pc => {
        const edges = [];
        for (let a = 0; a < pc.length; a++) {
          for (let b = a + 1; b < pc.length; b++) {
            const dx = pc[a].x - pc[b].x, dy = pc[a].y - pc[b].y;
            if (dx * dx + dy * dy <= thrSq) edges.push([pc[a], pc[b]]);
          }
        }
        return edges;
      });

      // 플레이트 쌍 간 교차 검사 (원칙 30①②)
      for (let p1 = 0; p1 < plateEdges.length; p1++) {
        for (let p2 = p1 + 1; p2 < plateEdges.length; p2++) {
          for (const [a, b] of plateEdges[p1]) {
            for (const [c, d] of plateEdges[p2]) {
              if (_segmentsProperIntersect(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y))
                return false;
            }
          }
        }
      }
    }
    return true;
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
   * 커스텀:        threshold = pitch × 1.5 (행 오프셋 시 대각 인접 √2·pitch ≈ 1.414 포함)
   */
  function buildAdjacency(cells, arrangement, pitch) {
    if (!cells || cells.length < 2) return [];
    const p = pitch || estimatePitch(cells);
    const thr = arrangement === 'custom' ? p * 1.5 : p * 1.05;
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

    // I형 판별: 모든 셀이 단일 x 또는 단일 y 라인
    const xs = cells.map(c => Math.round(_pt(c).x * 10) / 10);
    const ys = cells.map(c => Math.round(_pt(c).y * 10) / 10);
    if (new Set(xs).size === 1 || new Set(ys).size === 1) return 0;

    // 사이클 판별 먼저: P-pentomino처럼 degree≥3 이지만 compact한 2D 그룹을 보호
    const hasCycle = edges.length >= cells.length;
    if (hasCycle) {
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const p = estimatePitch(cells);
      const bboxCols = Math.round((maxX - minX) / p) + 1;
      const bboxRows = Math.round((maxY - minY) / p) + 1;
      const fillRatio = cells.length / (bboxCols * bboxRows);
      if (fillRatio >= 0.75) return +10;  // compact 2D (P-pent, 2×2 블록 등)
      return 0;                           // 듬성 사이클
    }

    // 트리: T/Y/X/F형 분기 노드 판별
    const degree = new Array(cells.length).fill(0);
    for (const { i, j } of edges) { degree[i]++; degree[j]++; }
    if (degree.some(d => d >= 3)) return -10;

    return 0;  // L·S·U·Z·W·V·N 단순 체인
  }

  /**
   * HANDOFF §4 — 컴팩트 형상 점수 (연속 버전)
   * S(G) = 10·D·√A − 10·σ  (범위 약 [-10, +10])
   *   D = |G| / (wCells × hCells)  -- bbox 밀도
   *   A = min(w,h) / max(w,h)      -- 종횡비 품질
   *   σ = 1  iff  (maxDeg≥3) AND (D<0.95) AND (사이클 없음)
   *
   * groupCells: [{x,y}|{cx,cy}], pitch: 피치(mm), arrangement: 배열 종류
   */
  function compactShapeScore(groupCells, pitch, arrangement) {
    if (!groupCells || groupCells.length <= 1) return 0;

    const pts = groupCells.map(c => _pt(c));
    const pitchY = arrangement === 'staggered' ? pitch * Math.sqrt(3) / 2 : pitch;

    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const wCells = Math.round((maxX - minX) / pitch) + 1;
    const hCells = Math.round((maxY - minY) / pitchY) + 1;

    const D = groupCells.length / (wCells * hCells);
    const A = Math.min(wCells, hCells) / Math.max(wCells, hCells);

    // σ: 사이클 없는 T/Y 분기 → 돌기 페널티
    const adj = buildAdjacency(groupCells, arrangement, pitch);
    const degree = new Array(groupCells.length).fill(0);
    for (const { i, j } of adj) { degree[i]++; degree[j]++; }
    const maxDeg = degree.length > 0 ? Math.max(...degree) : 0;
    const hasCycle = adj.length >= groupCells.length;
    const sigma = (maxDeg >= 3 && D < 0.95 && !hasCycle) ? 1 : 0;

    return 10 * D * Math.sqrt(A) - 10 * sigma;
  }

  // ═══════════════════════════════════════════════
  // export (Node + Browser 양쪽 지원)
  // ═══════════════════════════════════════════════
  const _exports = {
    _pt,
    _segmentsProperIntersect,
    checkPlanarNoCrossing,
    estimatePitch,
    buildAdjacency,
    groupQualityScore,
    compactShapeScore,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = _exports;
  } else {
    global._GenMath = _exports;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
