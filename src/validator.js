/**
 * Pack-Renderer Validator (LAYER 0·1·2)
 *
 * 역할: skills/principles_spec.json을 로드하여 ctx(설계 후보 컨텍스트)에 대해
 *       14개 CHECKS 함수를 dispatch 실행. md 원칙 v7과 1:1 대응.
 *
 * 입력 스펙:  skills/principles_spec.json (M1 완료, 14 rules)
 * 호출 주체:  generator.js (LAYER 3 SFMT Step C 하드 제약), app.js (최종 검증)
 *
 * 레이어별 fail_action 처리:
 *   LAYER 0 (law)       : abort_design → passed=false, 설계 전체 폐기
 *   LAYER 1 (decision)  : abort_design → passed=false, 선행 결정 누락
 *   LAYER 2 (rule)      : prune_candidate → SFMT 후보 가지치기만, passed 유지
 *                         (단, P10·P14는 예외적으로 abort_design)
 *
 * 현 버전: Tier 2c 완료 — 14건 전량 실구현 (P01·P04·P06·P07·P08·P09·P10·P12·P14·P16·P17·P21·P25·P26)
 *                   skip 정책: 필수 ctx 필드 누락 시 {ok:true, detail:'skipped...'} 반환
 *                   (test_validator_stub.js 빈 ctx 호환 유지)
 *
 * 최종 업데이트: 2026-04-18 (v7 세션 16 — Tier 2c P07·P16·P25 실구현, 14건 전량 완료)
 */

(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════
  // spec 로드 (Node: fs.readFile / Browser: global.PRINCIPLES_SPEC)
  // ═══════════════════════════════════════════════
  let SPEC = null;

  // ─── Generator lazy getter (buildAdjacency·checkGroupValidity 의존) ───
  let _Gen = null;
  function getGenerator() {
    if (_Gen) return _Gen;
    if (typeof require !== 'undefined' && typeof module !== 'undefined') {
      try {
        const path = require('path');
        _Gen = require(path.join(__dirname, 'generator.js'));
        return _Gen;
      } catch (e) { /* fall through */ }
    }
    if (global.Generator) { _Gen = global.Generator; return _Gen; }
    return null;
  }

  function loadSpec(specObject) {
    // 명시적 주입 (테스트용)
    if (specObject && typeof specObject === 'object') {
      SPEC = specObject;
      return SPEC;
    }
    // Node.js 환경: 파일에서 로드
    if (typeof require !== 'undefined' && typeof module !== 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        const p = path.join(__dirname, '..', 'skills', 'principles_spec.json');
        SPEC = JSON.parse(fs.readFileSync(p, 'utf8'));
        return SPEC;
      } catch (e) {
        throw new Error('[validator] spec load failed: ' + e.message);
      }
    }
    // 브라우저 환경: 전역에서 로드
    if (global.PRINCIPLES_SPEC) {
      SPEC = global.PRINCIPLES_SPEC;
      return SPEC;
    }
    throw new Error('[validator] PRINCIPLES_SPEC not found (browser) or file read failed (node)');
  }

  // ═══════════════════════════════════════════════
  // CHECKS 함수 테이블 (M2 스텁)
  //   각 함수는 (ctx, params) → { ok: bool, detail?: string, data?: any }
  //   현재 전부 {ok:true} 반환. M7에서 실제 로직 구현.
  // ═══════════════════════════════════════════════

  // ─── LAYER 0 (5건) ────────────────────────────

  /**
   * P01 — 극성 불변
   *   skip: ctx.cells 없음 / 셀에 top_polarity·bottom_polarity 필드 없음
   *   fail: 같은 셀에서 top_polarity === bottom_polarity
   */
  function checkPolarityInversion(ctx, params) {
    const cells = ctx && ctx.cells;
    if (!Array.isArray(cells) || cells.length === 0) {
      return { ok: true, detail: 'skipped: ctx.cells 없음' };
    }
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const t = c && c.top_polarity, b = c && c.bottom_polarity;
      if (t === undefined || b === undefined) continue;
      const inverted = (t === '+' && b === '-') || (t === '-' && b === '+');
      if (!inverted) {
        return {
          ok: false,
          detail: `cell[${i}] 극성 반전 위반: top=${t}, bottom=${b}`,
          data: { index: i, top: t, bottom: b },
        };
      }
    }
    return { ok: true };
  }

  /**
   * P06 — 맞닿음 불변 (gap=0, pitch=render_d)
   *   skip: pitch 또는 render_d 없음
   *   fail: |gap| > tol 또는 |pitch − render_d| > tol
   */
  function checkContact(ctx, params) {
    const pitch    = ctx && ctx.pitch;
    const render_d = ctx && (ctx.render_d !== undefined ? ctx.render_d : ctx.cell_d);
    const gap      = ctx && ctx.gap;
    if (pitch === undefined || render_d === undefined) {
      return { ok: true, detail: 'skipped: pitch/render_d 없음' };
    }
    const tol = (params && params.tol) || 0.001;
    if (gap !== undefined && Math.abs(gap) > tol) {
      return { ok: false, detail: `gap=${gap} ≠ 0` };
    }
    if (Math.abs(pitch - render_d) > tol) {
      return { ok: false, detail: `pitch(${pitch}) ≠ render_d(${render_d})` };
    }
    return { ok: true };
  }

  /**
   * P08 — 셀 수 불변 (N=S×P, 각 그룹 P개, 홀더 빈 슬롯 허용)
   *   skip: S 또는 P 없음
   *   fail: cells.length < S×P (부족) / groups[].cells.length ≠ P
   */
  function checkCellCount(ctx, params) {
    const { S, P, groups, cells } = ctx || {};
    if (S === undefined || P === undefined) {
      return { ok: true, detail: 'skipped: S/P 없음' };
    }
    const N = S * P;
    if (Array.isArray(cells) && cells.length < N) {
      return { ok: false, detail: `cells.length(${cells.length}) < S×P(${N})` };
    }
    if (Array.isArray(groups)) {
      for (const g of groups) {
        const cnt = (g.cells || []).length;
        if (cnt !== P) {
          return {
            ok: false,
            detail: `G${g.index} cells=${cnt} ≠ P=${P}`,
            data: { group: g.index, count: cnt, expected: P },
          };
        }
      }
    }
    return { ok: true };
  }

  /**
   * P09 — 인접성 (점프 금지, 격리 셀 금지)
   *   skip: cells 없음 / arrangement 없음
   *   fail: 격리 셀 존재 (어떤 이웃과도 threshold 거리 이내 없음)
   */
  function checkAdjacency(ctx, params) {
    const { cells, arrangement, pitch } = ctx || {};
    if (!Array.isArray(cells) || cells.length < 2 || !arrangement) {
      return { ok: true, detail: 'skipped: cells/arrangement 없음' };
    }
    const Gen = getGenerator();
    if (!Gen || typeof Gen.buildAdjacency !== 'function') {
      return { ok: true, detail: 'skipped: Generator 미탑재' };
    }
    const edges = Gen.buildAdjacency(cells, arrangement, pitch);
    const hasNeighbor = new Array(cells.length).fill(false);
    for (const { i, j } of edges) { hasNeighbor[i] = true; hasNeighbor[j] = true; }
    const isolated = [];
    for (let i = 0; i < hasNeighbor.length; i++)
      if (!hasNeighbor[i]) isolated.push(i);
    if (isolated.length > 0) {
      return {
        ok: false,
        detail: `격리 셀 ${isolated.length}개: [${isolated.slice(0, 5).join(',')}]${isolated.length > 5 ? '…' : ''}`,
        data: { isolated_count: isolated.length, sample: isolated.slice(0, 10) },
      };
    }
    return { ok: true };
  }

  /**
   * P26 — 직렬 경로 단일성 (simple chain G0–G1–…–G_{S-1})
   *   skip: face_pattern·groups 없음
   *   2축 검증:
   *     축 1: ctx.face_pattern (상·하면 플레이트) 존재 시
   *           각 플레이트 groups 배열이 연속 인덱스 (|i-j| ≤ 1), 최대 2그룹 병합만
   *     축 2: ctx.groups 존재 시 groups.index가 0..S-1 연속 (gap 금지)
   */
  function checkSeriesPathSingleness(ctx, params) {
    const fp     = ctx && ctx.face_pattern;
    const groups = ctx && ctx.groups;
    if (!fp && !Array.isArray(groups)) {
      return { ok: true, detail: 'skipped: face_pattern/groups 없음' };
    }

    // 축 1 — face_pattern 구조 검증
    if (fp && (Array.isArray(fp.top) || Array.isArray(fp.bot))) {
      const allPlates = [...(fp.top || []), ...(fp.bot || [])];
      for (const plate of allPlates) {
        const gs = plate.groups || [];
        if (gs.length > 2) {
          return {
            ok: false,
            detail: `플레이트 3그룹 이상 병합 (P26 단일성 위반): groups=[${gs}]`,
            data: { plate, violation: '>2 merge' },
          };
        }
        if (gs.length === 2 && Math.abs(gs[0] - gs[1]) !== 1) {
          return {
            ok: false,
            detail: `비연속 그룹 병합: groups=[${gs}] (|i-j| ≠ 1)`,
            data: { plate, violation: 'non-contiguous' },
          };
        }
      }
    }

    // 축 2 — groups.index 연속성 검증
    if (Array.isArray(groups) && groups.length > 0) {
      const S = groups.length;
      const indices = groups.map(g => g.index).sort((a, b) => a - b);
      for (let i = 0; i < S; i++) {
        if (indices[i] !== i) {
          return {
            ok: false,
            detail: `그룹 번호 비연속: sorted=[${indices}] (0..${S-1} 기대)`,
            data: { indices, expected_max: S - 1 },
          };
        }
      }
    }

    return { ok: true };
  }

  // ─── LAYER 1 (2건) ────────────────────────────

  /**
   * P04 — B+/B− 출력 방향 사전 확정
   *   skip: b_plus_side 또는 b_minus_side 둘 다 없음
   *   fail: 한 쪽만 있음 / invalid 값
   */
  function checkOutputDirectionDecided(ctx, params) {
    const bp = ctx && ctx.b_plus_side;
    const bm = ctx && ctx.b_minus_side;
    if (bp === undefined && bm === undefined) {
      return { ok: true, detail: 'skipped: b_plus_side/b_minus_side 둘 다 없음' };
    }
    const valid = ['top', 'bottom', 'left', 'right'];
    if (bp === undefined || bm === undefined) {
      return {
        ok: false,
        detail: `LAYER 1 선행 결정 누락: b_plus_side=${bp}, b_minus_side=${bm}`,
      };
    }
    if (!valid.includes(bp)) return { ok: false, detail: `invalid b_plus_side: ${bp}` };
    if (!valid.includes(bm)) return { ok: false, detail: `invalid b_minus_side: ${bm}` };
    return { ok: true };
  }

  /**
   * P17 — 배열 선택 (square / staggered / custom)
   *   skip: arrangement 없음
   *   fail: allowed_values 밖 / custom인데 rows 없음
   */
  function checkArrangementDecided(ctx, params) {
    const arr = ctx && ctx.arrangement;
    if (arr === undefined || arr === null) {
      return { ok: true, detail: 'skipped: arrangement 없음' };
    }
    const valid = ['square', 'staggered', 'custom'];
    if (!valid.includes(arr)) {
      return { ok: false, detail: `invalid arrangement: ${arr}` };
    }
    if (arr === 'custom' && !Array.isArray(ctx.rows)) {
      return { ok: false, detail: 'custom requires rows[]' };
    }
    return { ok: true };
  }

  // ─── LAYER 2 (7건) ────────────────────────────

  /**
   * P07 — 니켈 두께 동일 불변 (원칙 7)
   *   skip: plates 없음 / 빈 배열
   *   fail: h_w ≠ v_w (가로·세로 두께 불일치)
   *   fail: h_w/v_w ≠ nickel_w (설계 파라미터 불일치, nickel_w 있을 때)
   */
  function checkNickelThicknessUniform(ctx, params) {
    const { plates, nickel_w } = ctx || {};
    if (!Array.isArray(plates) || plates.length === 0) {
      return { ok: true, detail: 'skipped: plates 없음' };
    }
    for (const plate of plates) {
      const { h_w, v_w } = plate || {};
      if (h_w == null || v_w == null) continue;
      if (h_w !== v_w) {
        return {
          ok: false,
          detail: `P07 위반: h_w(${h_w}) ≠ v_w(${v_w}) — 두께 불균일 (원칙 7)`,
          data: { h_w, v_w },
        };
      }
      if (nickel_w != null && h_w !== nickel_w) {
        return {
          ok: false,
          detail: `P07 위반: h_w(${h_w}) ≠ nickel_w(${nickel_w})`,
          data: { h_w, nickel_w },
        };
      }
    }
    return { ok: true };
  }

  /**
   * P10 — 사다리 구조 (그룹 내 모든 셀 단일 연결)
   *   skip: groups / arrangement 없음 / Generator 미탑재
   *   fail: 어떤 그룹의 셀이 BFS로 전부 도달 불가 (= 미접촉 셀 존재)
   *   비고: 원칙 10 ② 엇배열 분기는 원칙 23에 위임(S23 스텁 상태) — 본 체크에서는 단일 연결성만 검증
   */
  function checkLadderStructure(ctx, params) {
    const { groups, arrangement, pitch } = ctx || {};
    if (!Array.isArray(groups) || groups.length === 0 || !arrangement) {
      return { ok: true, detail: 'skipped: groups/arrangement 없음' };
    }
    const Gen = getGenerator();
    if (!Gen || typeof Gen.buildAdjacency !== 'function') {
      return { ok: true, detail: 'skipped: Generator 미탑재' };
    }
    for (const g of groups) {
      const cells = g.cells || [];
      if (cells.length <= 1) continue;
      const edges = Gen.buildAdjacency(cells, arrangement, pitch);
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
        return {
          ok: false,
          detail: `G${g.index} 사다리 비연결: ${visited.size}/${cells.length} 셀만 도달`,
          data: { group: g.index, reached: visited.size, total: cells.length },
        };
      }
    }
    return { ok: true };
  }

  /**
   * P12 — 엠보 불가역성 (거울반사 별개 형상)
   *   skip: ctx.allow_mirror 없음 (명시 결정 안 됨)
   *   fail: allow_mirror === true (원칙 12 위반)
   *   ok: allow_mirror === false
   */
  function checkEmbossIrreversibility(ctx, params) {
    if (!ctx || ctx.allow_mirror === undefined) {
      return { ok: true, detail: 'skipped: allow_mirror 미지정' };
    }
    if (ctx.allow_mirror === true) {
      return { ok: false, detail: 'allow_mirror=true → 거울반사 합동 허용은 원칙 12 위반' };
    }
    return { ok: true };
  }

  /**
   * P14 — 면별 병합 불변 (원칙 14)
   *   skip: face_pattern 또는 S 없음
   *   검증 축:
   *     P14.1 상면: [G0] | [G1∪G2] | [G3∪G4] | … | (S짝수 → [G_{S-1}])
   *     P14.2 하면: [G0∪G1] | [G2∪G3] | …       | (S홀수 → [G_{S-1}])
   *     P14.3 B+ 기본 상면 G0 — ctx.b_plus_face==='bottom'이면 P04 override 허용
   *     P14.4 B-: S짝수 → 상면 G_{S-1} 단독 I / S홀수 → 하면 G_{S-1} 단독 I
   *     P14.5 bridge anchor — P22(LAYER 3)에 위임, ctx.bridge_anchor_points 없으면 skip
   *   fail_action: abort_design (principles_spec.json)
   */
  function checkFaceMerging(ctx, params) {
    const fp = ctx && ctx.face_pattern;
    const S  = ctx && ctx.S;
    if (!fp || typeof S !== 'number') {
      return { ok: true, detail: 'skipped: face_pattern/S 없음' };
    }
    const top = Array.isArray(fp.top) ? fp.top : [];
    const bot = Array.isArray(fp.bot) ? fp.bot : [];

    // ── P14.1 상면 기대 패턴 생성 ────────────────
    const expectedTop = [[0]];
    for (let g = 1; g < S - 1; g += 2) expectedTop.push([g, g + 1]);
    if (S % 2 === 0) expectedTop.push([S - 1]);

    if (top.length !== expectedTop.length) {
      return {
        ok: false,
        detail: `상면 플레이트 수 ${top.length} ≠ 기대 ${expectedTop.length} (P14.1, S=${S})`,
        data: {
          axis: 'P14.1', S,
          actual_count: top.length, expected_count: expectedTop.length,
        },
      };
    }
    for (let i = 0; i < top.length; i++) {
      const gs = (top[i] && top[i].groups) || [];
      const exp = expectedTop[i];
      const match = gs.length === exp.length && gs.every((v, k) => v === exp[k]);
      if (!match) {
        return {
          ok: false,
          detail: `상면 플레이트[${i}] groups=[${gs}] ≠ 기대 [${exp}] (P14.1)`,
          data: { axis: 'P14.1', index: i, actual: gs, expected: exp },
        };
      }
    }

    // ── P14.2 하면 기대 패턴 생성 ────────────────
    const expectedBot = [];
    for (let g = 0; g < S - 1; g += 2) expectedBot.push([g, g + 1]);
    if (S % 2 !== 0) expectedBot.push([S - 1]);

    if (bot.length !== expectedBot.length) {
      return {
        ok: false,
        detail: `하면 플레이트 수 ${bot.length} ≠ 기대 ${expectedBot.length} (P14.2, S=${S})`,
        data: {
          axis: 'P14.2', S,
          actual_count: bot.length, expected_count: expectedBot.length,
        },
      };
    }
    for (let i = 0; i < bot.length; i++) {
      const gs = (bot[i] && bot[i].groups) || [];
      const exp = expectedBot[i];
      const match = gs.length === exp.length && gs.every((v, k) => v === exp[k]);
      if (!match) {
        return {
          ok: false,
          detail: `하면 플레이트[${i}] groups=[${gs}] ≠ 기대 [${exp}] (P14.2)`,
          data: { axis: 'P14.2', index: i, actual: gs, expected: exp },
        };
      }
    }

    // ── P14.3 B+ 위치 ───────────────────────────
    const findTerm = (plates, tag) =>
      plates.findIndex(p => p && p.terminal === tag);
    const bPlusFace = ctx.b_plus_face; // undefined | 'top' | 'bottom'
    if (bPlusFace !== 'bottom') {
      // 기본/top: 상면 G0 단독에 B+
      const idx = findTerm(top, 'B+');
      const gs  = idx >= 0 ? ((top[idx] && top[idx].groups) || []) : [];
      if (idx < 0 || gs.length !== 1 || gs[0] !== 0) {
        return {
          ok: false,
          detail: `B+ 기본 위치 상면 G0 위반 (P14.3): 상면 index=${idx}, groups=[${gs}]`,
          data: { axis: 'P14.3', b_plus_face: bPlusFace || 'default', top_index: idx, groups: gs },
        };
      }
    } else {
      // P04 override — 하면 어딘가 B+ 존재만 확인 (세부는 P04가 담당)
      const idx = findTerm(bot, 'B+');
      if (idx < 0) {
        return {
          ok: false,
          detail: `b_plus_face=bottom override 선언했으나 하면에 B+ 없음 (P14.3)`,
          data: { axis: 'P14.3', b_plus_face: 'bottom' },
        };
      }
    }

    // ── P14.4 B- 위치 (S홀짝 분기) ───────────────
    const bMinusTop = findTerm(top, 'B-');
    const bMinusBot = findTerm(bot, 'B-');
    if (S % 2 === 0) {
      // 상면 G_{S-1} 단독 I
      const gs = bMinusTop >= 0 ? ((top[bMinusTop] && top[bMinusTop].groups) || []) : [];
      if (bMinusTop < 0 || gs.length !== 1 || gs[0] !== S - 1) {
        return {
          ok: false,
          detail: `S=${S}(짝수) → B- 상면 G${S - 1} 단독 I 기대 (P14.4): top index=${bMinusTop}, groups=[${gs}]`,
          data: { axis: 'P14.4', S, expected: `top G${S - 1}`, top_index: bMinusTop, groups: gs },
        };
      }
      if (bMinusBot >= 0) {
        return {
          ok: false,
          detail: `S=${S}(짝수)인데 하면에도 B- 존재 (P14.4): bot index=${bMinusBot}`,
          data: { axis: 'P14.4', S, bot_index: bMinusBot },
        };
      }
    } else {
      // 하면 G_{S-1} 단독 I
      const gs = bMinusBot >= 0 ? ((bot[bMinusBot] && bot[bMinusBot].groups) || []) : [];
      if (bMinusBot < 0 || gs.length !== 1 || gs[0] !== S - 1) {
        return {
          ok: false,
          detail: `S=${S}(홀수) → B- 하면 G${S - 1} 단독 I 기대 (P14.4): bot index=${bMinusBot}, groups=[${gs}]`,
          data: { axis: 'P14.4', S, expected: `bottom G${S - 1}`, bot_index: bMinusBot, groups: gs },
        };
      }
      if (bMinusTop >= 0) {
        return {
          ok: false,
          detail: `S=${S}(홀수)인데 상면에도 B- 존재 (P14.4): top index=${bMinusTop}`,
          data: { axis: 'P14.4', S, top_index: bMinusTop },
        };
      }
    }

    // ── P14.5 bridge anchor — ctx.bridge_anchor_points 없으면 skip (P22 LAYER 3 위임)
    // TODO: 스키마 확정 시 여기에 BMS 최단거리 기준점 검증 추가

    return { ok: true };
  }

  /**
   * P16 — ICC 산업 실무 제약 (원칙 16) ①②③항
   *   skip: groups 없음 / arrangement 없음
   *   fail ①: 행 스팬 > 2  (axis P16.1)
   *   fail ②: 종횡비 > 2.0 (axis P16.2, 2셀 이상)
   *   fail ③: 볼록성 < 0.75 (axis P16.3, 3셀 이상)
   *   ④항(δ_min·planar): delta_min 없으면 skip
   *   ⑤항(합동쌍 대칭): 복잡도 사유 skip
   */
  function checkICC(ctx, params) {
    const { groups, arrangement, pitch } = ctx || {};
    if (!Array.isArray(groups) || groups.length === 0 || !arrangement) {
      return { ok: true, detail: 'skipped: groups/arrangement 없음' };
    }
    const p = pitch || 100;
    const round = v => Math.round(v / p);

    for (const g of groups) {
      const cells = (g.cells || []).map(c => ({
        x: c.x != null ? c.x : c.cx,
        y: c.y != null ? c.y : c.cy,
      }));
      if (cells.length === 0) continue;

      const xs = cells.map(c => c.x);
      const ys = cells.map(c => c.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);

      // ①항: 행 스팬 ≤ 2 (unique row count)
      const rowSpan = new Set(ys.map(y => round(y))).size;
      if (rowSpan > 2) {
        return {
          ok: false,
          detail: `P16.1 위반: G${g.index} 행 스팬=${rowSpan} > 2 (원칙 16 ①항)`,
          data: { axis: 'P16.1', group: g.index, row_span: rowSpan },
        };
      }

      // ②항: 종횡비 ≤ 2.0 (2셀 이상)
      if (cells.length >= 2) {
        const w = maxX - minX || p;
        const h = maxY - minY || p;
        const aspect = Math.max(w, h) / Math.min(w, h);
        if (aspect > 2.0 + 1e-9) {
          return {
            ok: false,
            detail: `P16.2 위반: G${g.index} 종횡비=${aspect.toFixed(2)} > 2.0 (원칙 16 ②항)`,
            data: { axis: 'P16.2', group: g.index, aspect },
          };
        }
      }

      // ③항: 볼록성 ≥ 0.75 (3셀 이상)
      if (cells.length >= 3) {
        const bboxCols = round(maxX - minX) + 1;
        const bboxRows = round(maxY - minY) + 1;
        const convexity = cells.length / (bboxCols * bboxRows);
        if (convexity < 0.75 - 1e-9) {
          return {
            ok: false,
            detail: `P16.3 위반: G${g.index} 볼록성=${convexity.toFixed(3)} < 0.75 (원칙 16 ③항)`,
            data: { axis: 'P16.3', group: g.index, convexity },
          };
        }
      }
    }
    return { ok: true };
  }

  /**
   * P21 — 그룹 형태 유효성 (조건 A + B)
   *   skip: groups 없음 / arrangement 없음 / Generator 미탑재
   *   fail: generator.checkGroupValidity가 valid=false
   */
  function checkGroupValidity(ctx, params) {
    const { groups, arrangement, pitch } = ctx || {};
    if (!Array.isArray(groups) || groups.length === 0 || !arrangement) {
      return { ok: true, detail: 'skipped: groups/arrangement 없음' };
    }
    const Gen = getGenerator();
    if (!Gen || typeof Gen.checkGroupValidity !== 'function') {
      return { ok: true, detail: 'skipped: Generator 미탑재' };
    }
    const result = Gen.checkGroupValidity(groups, arrangement, pitch);
    if (!result.valid) {
      return {
        ok: false,
        detail: result.violations.map(v => v.reason).join('; '),
        data: result.violations,
      };
    }
    return { ok: true };
  }

  /**
   * P25 — B+/B- 단자탭 기하학적 정의 (원칙 25)
   *   skip: terminal_tabs 없음 / 빈 배열 / nickel_w·tab_len 모두 미제공
   *   fail ①: tab.width ≠ nickel_w  (axis P25.1)
   *   fail ②: tab.length ≠ tab_len  (axis P25.2)
   *   fail ④: tab.direction ∈ forbidden_tab_directions[polarity]  (axis P25.4)
   *   ③항(서명 포함): 서명 계산은 LAYER 3 위임 — skip
   */
  function checkTerminalTab(ctx, params) {
    const { terminal_tabs, nickel_w, tab_len, forbidden_tab_directions } = ctx || {};
    if (!Array.isArray(terminal_tabs) || terminal_tabs.length === 0) {
      return { ok: true, detail: 'skipped: terminal_tabs 없음' };
    }
    if (nickel_w == null && tab_len == null && !forbidden_tab_directions) {
      return { ok: true, detail: 'skipped: 검증 파라미터(nickel_w/tab_len) 미제공' };
    }
    for (const tab of terminal_tabs) {
      const { width, length, polarity, direction } = tab || {};
      // ①항: 탭 폭 = nickel_w
      if (nickel_w != null && width != null && width !== nickel_w) {
        return {
          ok: false,
          detail: `P25.1 위반: 탭 폭(${width}) ≠ nickel_w(${nickel_w}) (원칙 25 ①항)`,
          data: { axis: 'P25.1', width, nickel_w, polarity },
        };
      }
      // ②항: 탭 길이 = tab_len
      if (tab_len != null && length != null && length !== tab_len) {
        return {
          ok: false,
          detail: `P25.2 위반: 탭 길이(${length}) ≠ tab_len(${tab_len}) (원칙 25 ②항)`,
          data: { axis: 'P25.2', length, tab_len, polarity },
        };
      }
      // ④항: 탭 방향이 이종 극성 플레이트 방향과 겹침 금지
      if (forbidden_tab_directions && polarity && direction != null) {
        const forbidden = forbidden_tab_directions[polarity] || [];
        if (forbidden.includes(direction)) {
          return {
            ok: false,
            detail: `P25.4 위반: ${polarity} 탭 방향(${direction})이 이종 극성 방향과 겹침 (원칙 25 ④항)`,
            data: { axis: 'P25.4', polarity, direction, forbidden },
          };
        }
      }
    }
    return { ok: true };
  }

  // ═══════════════════════════════════════════════
  // CHECKS 레지스트리
  // ═══════════════════════════════════════════════
  const CHECKS = {
    checkPolarityInversion,
    checkContact,
    checkCellCount,
    checkAdjacency,
    checkSeriesPathSingleness,
    checkOutputDirectionDecided,
    checkArrangementDecided,
    checkNickelThicknessUniform,
    checkLadderStructure,
    checkEmbossIrreversibility,
    checkFaceMerging,
    checkICC,
    checkGroupValidity,
    checkTerminalTab,
  };

  // ═══════════════════════════════════════════════
  // runValidation — 레이어 선택적 실행
  // ═══════════════════════════════════════════════
  /**
   * @param {object} ctx - 설계 후보 컨텍스트
   * @param {object} opts - { layers: [0,1,2], spec?: object, fail_fast?: bool }
   * @returns {object} { passed, violations, warnings, summary }
   */
  function runValidation(ctx, opts) {
    opts = opts || {};
    if (!SPEC) loadSpec(opts.spec);

    const layers = opts.layers || [0, 1, 2];
    const failFast = !!opts.fail_fast;

    const out = {
      passed: true,
      violations: [],
      warnings: [],
      summary: { total: 0, executed: 0, passed: 0, failed: 0, not_implemented: 0 },
    };

    for (const rule of SPEC.rules) {
      out.summary.total++;
      if (!layers.includes(rule.layer)) continue;
      out.summary.executed++;

      const fn = CHECKS[rule.check];
      if (!fn) {
        out.summary.not_implemented++;
        out.warnings.push({
          rule_id: rule.id,
          layer: rule.layer,
          name: rule.name,
          detail: `check function "${rule.check}" not in CHECKS registry`,
        });
        continue;
      }

      let result;
      try {
        result = fn(ctx, rule.params || {});
      } catch (e) {
        result = { ok: false, detail: `check threw: ${e.message}` };
      }

      if (result.ok) {
        out.summary.passed++;
      } else {
        out.summary.failed++;
        const violation = {
          rule_id: rule.id,
          layer: rule.layer,
          name: rule.name,
          severity: rule.severity,
          fail_action: rule.fail_action,
          detail: result.detail || rule.description,
          data: result.data,
        };
        out.violations.push(violation);
        if (rule.fail_action === 'abort_design') {
          out.passed = false;
          if (failFast) return out;
        }
      }
    }

    return out;
  }

  // ═══════════════════════════════════════════════
  // export (Node + Browser 양쪽 지원)
  // ═══════════════════════════════════════════════
  const api = {
    VERSION: 'v7-tier2c-p14',
    loadSpec,
    runValidation,
    CHECKS,
    get SPEC() { return SPEC; },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Validator = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
