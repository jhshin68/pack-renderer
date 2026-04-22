/**
 * gen-layout.js — Generator 레이아웃·패턴 유틸리티 (LAYER 3 공유 서브모듈)
 *
 * 추출 출처: generator.js §1 이관 함수 (renderer.js / app.js 이관본)
 * 의존 관계: 없음 (다른 gen-* 파일 불필요)
 * 공개 API:  canonicalSig, selectBlockType, calcNickelPattern,
 *            buildSnakeLayout, estimateMmin, calcCustomCenters
 *
 * 이중 런타임:
 *   Node.js  → module.exports = { ... }
 *   Browser  → window._GenLayout = { ... }  (generator.js 로드 전에 먼저 로드해야 함)
 */
(function (global) {
  'use strict';

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
    // 사용자 지시 (세션 13.5): "P는 특별하지 않다. 모든 P에 동일 원칙 적용."
    // 원칙 14(면별 병합)가 U/I 분류를 담당하므로 block_type은 정보 필드로만 남김.
    // P=1 → calcNickelPattern이 I만 생성 / P≥2 → I + U 혼합. 모두 동일 렌더.
    if (P < 1 || !Number.isInteger(P)) {
      return { block_type: 'Unknown', geometry_ready: false,
        error: `P=${P} invalid (양의 정수 필요)` };
    }
    return { block_type: 'Generic', geometry_ready: true };
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
    // 원칙 14 ④항: S 짝수 → B- 는 상면 G_{S-1} 단독 I형에 위치
    if (S % 2 === 0)
      top.push({ type: 'I', block_type: btype, groups: [S - 1], isTerminal: true, terminal: 'B-' });

    for (let g = 0; g < S - 1; g += 2)
      bot.push({ type: 'U', block_type: btype, groups: [g, g + 1], isTerminal: false, terminal: null });
    // 원칙 14 ④항: S 홀수 → B- 는 하면 G_{S-1} 단독 I형에 위치
    if (S % 2 !== 0)
      bot.push({ type: 'I', block_type: btype, groups: [S - 1], isTerminal: true, terminal: 'B-' });
    return { top, bot };
  }

  // calcTypeAGeometry 제거 (세션 13.5 사용자 지시 — P=5 전용 특수화 폐기)

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
    const rowOffsets = (Array.isArray(p.row_offsets) && p.row_offsets.length === rows.length)
      ? p.row_offsets : null;
    const stagger = !!p.custom_stagger;
    const pitchY  = stagger ? pitch * Math.sqrt(3) / 2 : pitch;
    const maxN    = Math.max(...rows);
    const stagDir = (p.custom_stagger_dir === 'L') ? -1 : 1;
    const leftPad = (stagger && stagDir === -1) ? pitch / 2 : 0;
    // row_offsets 있으면 left 정렬 기준 (1단 왼쪽 끝 = 기준점)
    const align = rowOffsets ? 'left' : (p.custom_align || 'center');

    const pts = [];
    for (let r = 0; r < rows.length; r++) {
      const n          = rows[r];
      const fromBottom = rows.length - 1 - r;
      const stagOffX   = (stagger && fromBottom % 2 === 1) ? stagDir * pitch / 2 : 0;
      let alignOffX;
      if      (align === 'left')  alignOffX = 0;
      else if (align === 'right') alignOffX = (maxN - n) * pitch;
      else                        alignOffX = (maxN - n) * pitch / 2;
      const extraOffX = rowOffsets ? rowOffsets[r] * pitch : 0;
      for (let i = 0; i < n; i++) {
        pts.push({
          x: margin + leftPad + alignOffX + stagOffX + extraOffX + i * pitch + R,
          y: margin + r * pitchY + R,
          row: rows.length - 1 - r, col: i,  // r0=하단, 위로 갈수록 증가
        });
      }
    }

    // 음수 오프셋으로 왼쪽 경계 침범 시 전체 오른쪽으로 이동
    if (pts.length > 0) {
      const minX = Math.min(...pts.map(pt => pt.x));
      const shift = (minX < margin + R) ? (margin + R - minX) : 0;
      if (shift > 0) pts.forEach(pt => pt.x += shift);
    }

    const maxX = pts.length > 0 ? Math.max(...pts.map(pt => pt.x)) : margin + R;
    return {
      pts, R, pitch,
      W: maxX + R + margin,
      H: margin * 2 + (rows.length - 1) * pitchY + 2 * R,
    };
  }

  // ═══════════════════════════════════════════════
  // export (Node + Browser 양쪽 지원)
  // ═══════════════════════════════════════════════
  const _exports = {
    canonicalSig,
    selectBlockType,
    calcNickelPattern,
    buildSnakeLayout,
    estimateMmin,
    calcCustomCenters,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = _exports;
  } else {
    global._GenLayout = _exports;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
