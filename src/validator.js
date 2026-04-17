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
 * 현 버전: M2 스텁 — 14개 CHECKS 함수는 모두 {ok:true} 반환.
 *                   M7에서 실제 판정 로직 구현 예정.
 *
 * 최종 업데이트: 2026-04-17 (v7 M2 스텁)
 */

(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════
  // spec 로드 (Node: fs.readFile / Browser: global.PRINCIPLES_SPEC)
  // ═══════════════════════════════════════════════
  let SPEC = null;

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
  function checkPolarityInversion(ctx, params) {
    // P01: 상면+ 이면 하면- 불변
    // TODO M7: ctx.cells.every(c => c.top_polarity !== c.bottom_polarity)
    return { ok: true, stub: 'P01' };
  }

  function checkContact(ctx, params) {
    // P06: gap=0, pitch=render_d
    // TODO M7: Math.abs(ctx.gap) < tol && Math.abs(ctx.pitch - ctx.render_d) < tol
    return { ok: true, stub: 'P06' };
  }

  function checkCellCount(ctx, params) {
    // P08: N = S×P, 모든 그룹 P개 셀, custom rows 합 = N
    // TODO M7: N === S*P && groups.every(g=>g.cell_count===P) && (rows? rows.reduce((a,b)=>a+b)===N : true)
    return { ok: true, stub: 'P08' };
  }

  function checkAdjacency(ctx, params) {
    // P09: 정배열 4-이웃 / 엇배열 6-이웃 / 커스텀 distance ≤ pitch × 1.1
    // TODO M7: arrangement별 인접성 그래프 검증
    return { ok: true, stub: 'P09' };
  }

  function checkSeriesPathSingleness(ctx, params) {
    // P26: 그룹 토폴로지 단순 체인 (분기·루프 금지)
    // TODO M7: 중간 그룹 neighbors.length===2, 양끝 ===1, acyclic, connected
    return { ok: true, stub: 'P26' };
  }

  // ─── LAYER 1 (2건) ────────────────────────────
  function checkOutputDirectionDecided(ctx, params) {
    // P04: B+·B− 출력 방향 사전 확정 + 경로 형태 + 셀 면 교번
    // TODO M7: ctx.b_plus_direction !== null && ctx.b_minus_direction !== null
    return { ok: true, stub: 'P04' };
  }

  function checkArrangementDecided(ctx, params) {
    // P17: arrangement ∈ {square, staggered, custom}, custom은 rows[]·S 필수
    // TODO M7: allowed_values 포함 + custom 시 rows 존재 확인
    return { ok: true, stub: 'P17' };
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

  function checkGroupValidity(ctx, params) {
    // P21: 조건 A (그룹 내 인접 체인) + 조건 B (Gi-G_{i+1} 인접 셀 쌍 ≥ 1)
    // TODO M7: adjacency_subgraph connected + 쌍 존재 확인
    return { ok: true, stub: 'P21' };
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
    VERSION: 'v7-M2-stub',
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
