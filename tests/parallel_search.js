/**
 * parallel_search.js — 병렬 탐색 (시간제한 모드)
 *
 * 원리:
 *   1단계(Main): G0 구성 열거
 *   2단계(Workers): 각 워커가 할당된 G0에서 budget_ms 동안 최대한 탐색
 *
 * 사용:
 *   node tests/parallel_search.js           → 기본 5분, custom 배열
 *   node tests/parallel_search.js 10        → 10분
 *   node tests/parallel_search.js 10 square → 10분, 정배열
 *   node tests/parallel_search.js 10 staggered → 10분, 엇배열
 */

'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

// ── 파라미터 ───────────────────────────────────────
const PARAMS = {
  S: 13, P: 4,
  // custom 배열
  arrangement: 'custom',
  rows:    [5, 12, 13, 12, 10],
  offsets: [-1, -2, -2, -2, 0],
  // square/staggered 배열 (arrangement 변경 시 사용)
  hRows: 7, hCols: 8,
  b_plus_side:  'left',
  b_minus_side: 'right',
  g0_anchor:    'TL',
  icc1: true, icc2: true, icc3: false,
  allow_I: false, allow_U: false,
};

// 셀 좌표 계산 헬퍼 (arrangement에 따라 분기)
function buildCells(params, _layout, _enum, renderer) {
  const { CELL_SPEC } = renderer;
  const { calcCustomCenters } = _layout;
  const { buildHolderGrid } = _enum;

  const cp = {
    cell_type: '21700', gap: 0, scale: 1.5, margin_mm: 8.0,
    custom_stagger: false, custom_stagger_dir: 'R',
    custom_align: 'center', row_offsets: params.offsets,
  };

  if (params.arrangement === 'custom') {
    const cc = calcCustomCenters(params.rows, cp, CELL_SPEC);
    return { pts: cc.pts, pitch: cc.pitch };
  } else {
    const pts = buildHolderGrid(
      params.hRows, params.hCols,
      params.arrangement,   // 'square' | 'staggered'
      [],                   // emptyCells 없음
      cp, CELL_SPEC
    );
    const spec = CELL_SPEC['21700'];
    const pitch = (spec.render_d + 0) * 1.5;
    return { pts, pitch };
  }
}

// ═══════════════════════════════════════════════════
// WORKER THREAD
// ═══════════════════════════════════════════════════
if (!isMainThread) {
  const renderer = require('../src/renderer');
  const _layout  = require('../src/gen-layout');
  const _enum    = require('../src/gen-enum');
  const { enumerateGroupAssignments } = _enum;

  const { params, g0Configs, budgetMs } = workerData;
  const { pts, pitch } = buildCells(params, _layout, _enum, renderer);

  const deadline = Date.now() + budgetMs;
  const results  = [];

  for (const g0 of g0Configs) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const r = enumerateGroupAssignments({
      cells: pts, S: params.S, P: params.P,
      arrangement: params.arrangement,
      b_plus_side:  params.b_plus_side,
      b_minus_side: params.b_minus_side,
      g0_anchor:    params.g0_anchor,
      icc1: params.icc1, icc2: params.icc2, icc3: params.icc3,
      allow_I: params.allow_I, allow_U: params.allow_U,
      pitch, custom_stagger: false,
      fixed_g0: g0,
      max_candidates: 999999,
      exhaustive: false,
      budget_ms: remaining,
    });
    results.push(...(r.candidates || []));
  }

  parentPort.postMessage({ candidates: results, count: results.length });
  return;
}

// ═══════════════════════════════════════════════════
// MAIN THREAD
// ═══════════════════════════════════════════════════
(async () => {
  const renderer = require('../src/renderer');
  const _layout  = require('../src/gen-layout');
  const _enum    = require('../src/gen-enum');
  const { enumerateGroupAssignments } = _enum;

  // 명령행 인수
  const budgetMin   = parseFloat(process.argv[2]) || 5;
  const budgetMs    = Math.round(budgetMin * 60 * 1000);
  const arrangement = process.argv[3] || PARAMS.arrangement;

  const params = { ...PARAMS, arrangement };

  const { pts, pitch } = buildCells(params, _layout, _enum, renderer);

  // ─── 1단계: G0 후보 열거 ────────────────────────────────────────────
  console.log(`\n[1단계] G0 구성 열거 중... (배열 종류: ${arrangement})`);
  const g0Result = enumerateGroupAssignments({
    cells: pts, S: params.S, P: params.P,
    arrangement: params.arrangement,
    b_plus_side: params.b_plus_side, b_minus_side: params.b_minus_side,
    g0_anchor:   params.g0_anchor,
    icc1: params.icc1, icc2: params.icc2, icc3: params.icc3,
    allow_I: params.allow_I, allow_U: params.allow_U,
    pitch, custom_stagger: false,
    enumerate_g0_only: true,
  });

  const g0Configs = g0Result.g0_configs || [];
  console.log(`  G0 후보 수: ${g0Configs.length}개`);

  if (g0Configs.length === 0) { console.log('G0 후보 없음'); process.exit(1); }

  // ─── 2단계: G0 배치를 코어 수로 분할 ─────────────────────────────────
  const totalCores = os.cpus().length;
  const numCores   = Math.min(Math.max(1, totalCores - 2), g0Configs.length);
  console.log(`[2단계] ${numCores}워커 병렬 탐색 (논리 ${totalCores}코어 중 ${numCores}개 사용) — 탐색 시간: ${budgetMin}분`);
  console.log(`  G0 ${g0Configs.length}개 → 워커당 ~${Math.ceil(g0Configs.length / numCores)}개 × ${budgetMin}분`);
  console.log(`  파라미터: ${params.S}S${params.P}P ${arrangement} allow_I=${params.allow_I}\n`);

  const chunks = Array.from({ length: numCores }, () => []);
  g0Configs.forEach((g0, i) => chunks[i % numCores].push(g0));

  const t0 = Date.now();
  let done = 0;
  let partialCount = 0;

  const timer = setInterval(() => {
    const elapsed   = ((Date.now() - t0) / 1000).toFixed(0);
    const remaining = (budgetMs / 1000 - (Date.now() - t0) / 1000).toFixed(0);
    process.stdout.write(
      `\r  경과: ${elapsed}s | 남은: ${remaining}s | 완료 워커: ${done}/${numCores} | 수집 후보: ${partialCount}개`
    );
  }, 1000);

  // ─── 워커 실행 ───────────────────────────────────────────────────────
  const allCandidates = await Promise.all(
    chunks.map((g0Chunk, idx) =>
      new Promise((resolve, reject) => {
        const w = new Worker(__filename, {
          workerData: { params, g0Configs: g0Chunk, budgetMs },
        });
        w.on('message', msg => {
          done++;
          partialCount += msg.count || 0;
          resolve(msg.candidates);
        });
        w.on('error', reject);
        w.on('exit', code => { if (code !== 0) reject(new Error(`worker ${idx} exit ${code}`)); });
      })
    )
  );

  clearInterval(timer);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n');

  // ─── 결과 병합 + 중복 제거 ───────────────────────────────────────────
  const seen   = new Set();
  const merged = [];
  for (const batch of allCandidates) {
    for (const cand of batch) {
      const key = (cand.groups || []).map(g =>
        (g.cells || []).map(c => `${c.row},${c.col}`).sort().join('|')
      ).join('§');
      if (!seen.has(key)) { seen.add(key); merged.push(cand); }
    }
  }

  // ─── 조기 종료 여부 판단 ─────────────────────────────────────────────
  const actualMs  = Date.now() - t0;
  const earlyStop = actualMs < budgetMs * 0.95;

  // ─── 통계 출력 ───────────────────────────────────────────────────────
  const mDist = {}, qDist = {};
  merged.forEach(c => {
    const m = c.m_distinct || 0, q = c.total_score || 0;
    mDist[m] = (mDist[m] || 0) + 1;
    qDist[q] = (qDist[q] || 0) + 1;
  });

  console.log('═══════════════════════════════════════');
  console.log(' 병렬 탐색 완료');
  console.log('═══════════════════════════════════════');
  console.log(` 소요 시간      : ${elapsed}s${earlyStop ? ' (조기 종료 — 탐색 공간 소진)' : ''}`);
  console.log(` 탐색 예산      : ${budgetMin}분`);
  console.log(` 배열 종류      : ${arrangement}`);
  console.log(` G0 구성 수     : ${g0Configs.length}개`);
  console.log(` 사용 코어 수   : ${numCores}개`);
  console.log(` 총 후보 수     : ${merged.length}개 (중복 제거 후)`);
  console.log(` m_distinct 분포: ${JSON.stringify(mDist)}`);
  console.log(` quality 분포   : ${JSON.stringify(qDist)}`);
  console.log('───────────────────────────────────────');
  console.log(' 상위 10개 (m_distinct 오름차순 → quality 내림차순):');
  merged
    .sort((a, b) => (a.m_distinct || 0) - (b.m_distinct || 0) || (b.total_score || 0) - (a.total_score || 0))
    .slice(0, 10)
    .forEach((c, i) => {
      console.log(`  [${i + 1}] m_distinct=${c.m_distinct}  quality=${c.total_score || 0}`);
    });
  console.log('═══════════════════════════════════════');
})();
