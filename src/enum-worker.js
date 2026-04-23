'use strict';
// Web Worker: G0 고정 병렬 탐색
// importScripts 경로는 이 파일 위치(src/) 기준 상대경로
importScripts('gen-math.js', 'gen-layout.js', 'gen-enum.js');

self.onmessage = function (e) {
  const { enumerateGroupAssignments } = self._GenEnum;

  // G0 열거 전용 모드 — 메인 스레드 블로킹 방지용 (budget_ms: 5000 강제)
  if (e.data.g0_enum_only) {
    const { params, cells, pitch } = e.data;
    const r = enumerateGroupAssignments({
      cells, S: params.S, P: params.P,
      arrangement: 'custom',
      b_plus_side:  params.b_plus_side,
      b_minus_side: params.b_minus_side,
      icc1: params.icc1, icc2: params.icc2, icc3: params.icc3,
      allow_I: params.allow_I, allow_U: params.allow_U,
      pitch,
      custom_stagger: params.custom_stagger || false,
      nickel_w: params.nickel_w,
      g0_anchor: params.g0_anchor,
      enumerate_g0_only: true,
      budget_ms: 5000,
    });
    self.postMessage({ g0_configs: r.g0_configs || [] });
    return;
  }

  const { params, g0Configs, budgetMs, budgetPerG0, cells, pitch, pinnedCellIdxGroups } = e.data;

  // pinnedCellIdxGroups: 고정 그룹 인덱스 배열 → {row,col}[] 변환 헬퍼
  const toRowCol = idxArr => idxArr.map(i => ({ row: cells[i].row, col: cells[i].col }));

  const usesPinned = Array.isArray(pinnedCellIdxGroups) && pinnedCellIdxGroups.length > 0;

  // g0Configs=[] 단일 워커 폴백: pinned·일반 모두 처리
  // pinned: pinnedCellIdxGroups 전달, 일반: 없음
  if (!g0Configs || g0Configs.length === 0) {
    const r = enumerateGroupAssignments({
      cells, S: params.S, P: params.P,
      arrangement: 'custom',
      b_plus_side:  params.b_plus_side,
      b_minus_side: params.b_minus_side,
      icc1: params.icc1, icc2: params.icc2, icc3: params.icc3,
      allow_I: params.allow_I, allow_U: params.allow_U,
      pitch, custom_stagger: params.custom_stagger || false,
      max_candidates: 999999, exhaustive: true, budget_ms: budgetMs,
      nickel_w: params.nickel_w,
      ...(usesPinned ? { pinned_groups: pinnedCellIdxGroups.map(toRowCol) } : {}),
    });
    self.postMessage({ candidates: r.candidates || [], count: (r.candidates || []).length });
    return;
  }

  const deadline = Date.now() + budgetMs;
  const results  = [];

  for (const gk of g0Configs) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const g0Budget = budgetPerG0 ? Math.min(budgetPerG0, remaining) : remaining;

    // pinned 모드: pinnedCellIdxGroups + gk 를 pinned_groups로 전달
    // 일반 모드: fixed_g0 사용
    const callParams = usesPinned
      ? {
          pinned_groups: [...pinnedCellIdxGroups.map(toRowCol), toRowCol(gk)],
          fixed_g0: null,
        }
      : {
          fixed_g0: gk,
          pinned_groups: null,
        };

    const r = enumerateGroupAssignments({
      cells, S: params.S, P: params.P,
      arrangement: 'custom',
      b_plus_side:  params.b_plus_side,
      b_minus_side: params.b_minus_side,
      icc1: params.icc1, icc2: params.icc2, icc3: params.icc3,
      allow_I: params.allow_I, allow_U: params.allow_U,
      pitch,
      custom_stagger: params.custom_stagger || false,
      max_candidates: 999999,
      exhaustive: true,
      budget_ms: g0Budget,
      nickel_w: params.nickel_w,
      ...callParams,
    });
    results.push(...(r.candidates || []));
  }

  self.postMessage({ candidates: results, count: results.length });
};
