'use strict';
// Web Worker: G0 고정 병렬 탐색
// importScripts 경로는 이 파일 위치(src/) 기준 상대경로
importScripts('gen-math.js', 'gen-layout.js', 'gen-enum.js');

self.onmessage = function (e) {
  const { params, g0Configs, budgetMs, cells, pitch } = e.data;
  const { enumerateGroupAssignments } = self._GenEnum;

  const deadline = Date.now() + budgetMs;
  const results  = [];

  for (const g0 of g0Configs) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const r = enumerateGroupAssignments({
      cells, S: params.S, P: params.P,
      arrangement: 'custom',
      b_plus_side:  params.b_plus_side,
      b_minus_side: params.b_minus_side,
      icc1: params.icc1, icc2: params.icc2, icc3: params.icc3,
      allow_I: params.allow_I, allow_U: params.allow_U,
      pitch,
      custom_stagger: false,
      fixed_g0: g0,
      max_candidates: 999999,
      exhaustive: false,
      budget_ms: remaining,
      nickel_w: params.nickel_w,
    });
    results.push(...(r.candidates || []));
  }

  self.postMessage({ candidates: results, count: results.length });
};
