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
 * 현 버전: Tier 2a — 7건 (P01·P04·P06·P08·P09·P17·P21) 실구현 + 나머지 7건 스텁
 *                   skip 정책: 필수 ctx 필드 누락 시 {ok:true, detail:'skipped...'} 반환
 *                   (test_validator_stub.js 빈 ctx 호환 유지)
 *
 * 최종 업데이트: 2026-04-17 (v7 세션 13.5 Tier 2a)
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

  function checkSeriesPathSingleness(ctx, params) {
    // P26: Tier 2b에서 실구현 예정 (ctx.face_pattern + checkGroupValidity 조합)
    return { ok: true, stub: 'P26' };
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
  function checkNickelThicknessUniform(ctx, params) {
    // P07: 가로·세로 두께 = nickel_w 동일
    // TODO M7: plate마다 h_w === v_w === nickel_w (허용 공차 ±0.05mm)
    return { ok: true, stub: 'P07' };
  }

  function checkLadderStructure(ctx, params) {
    // P10: 사다리 구조 + 모든 셀 접촉 (미접촉 셀 0개)
    // TODO M7: arrangement별 분기 + untouched_cells === 0
    return { ok: true, stub: 'P10' };
  }

  function checkEmbossIrreversibility(ctx, params) {
    // P12: 캐노니컬 서명 회전만 (거울 제외)
    // TODO M7: allow_mirror === false, 서명 계산에 rot_k만 사용
    return { ok: true, stub: 'P12' };
  }

  function checkFaceMerging(ctx, params) {
    // P14: 상·하면 병합 패턴, B+/B− S홀짝 배치, 브리지 기준점 P22 연동
    // TODO M7: top_plates/bottom_plates 패턴 검증
    return { ok: true, stub: 'P14' };
  }

  function checkICC(ctx, params) {
    // P16: 5대 제약 (행스팬·종횡비·볼록성·δ_min·합동쌍 대칭) + planar
    //      staggered_reinterpretation으로 hex 재해석
    // TODO M7: 각 plate별 bbox/convexity/edge_distance 계산
    return { ok: true, stub: 'P16' };
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

  function checkTerminalTab(ctx, params) {
    // P25: 탭 폭=nickel_w, 길이=tab_len, 기하 중심 기원, 이종 극성 방향 금지
    // TODO M7: tab dimensions + direction vs opposite_polarity_plates
    return { ok: true, stub: 'P25' };
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
    VERSION: 'v7-tier2a',
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
