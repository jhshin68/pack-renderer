/**
 * M7 핵심 함수 테스트
 *   - buildAdjacency  (원칙 9 인접성)
 *   - groupQualityScore (+10/0/−10)
 *   - checkGroupValidity (조건 A + B)
 *   - assignGroupNumbers  (S24 보스트로페돈/BFS)
 *   - selectBmsOptimal    (S22 유클리드 거리)
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// ─── 격자 셀 생성 헬퍼 ──────────────────────────────
function makeGrid(S, P, pitch = 100) {
  const cells = [];
  for (let r = 0; r < P; r++)
    for (let c = 0; c < S; c++)
      cells.push({ x: c * pitch, y: r * pitch });
  return cells;
}

// ─── buildAdjacency ─────────────────────────────────
{
  // 3×1 가로 선형
  const cells = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }];
  const edges = G.buildAdjacency(cells, 'square', 100);
  assert('buildAdjacency 3×1: edge count === 2', edges.length === 2);

  // 2×2 격자 → 4-이웃 엣지 4개
  const g2x2 = makeGrid(2, 2, 100);
  const e2x2 = G.buildAdjacency(g2x2, 'square', 100);
  assert('buildAdjacency 2×2 square: 4 edges', e2x2.length === 4);

  // 격리 셀 (거리 300 > 1.05×100) → 엣지 없음
  const isolated = [{ x: 0, y: 0 }, { x: 300, y: 0 }];
  const eIso = G.buildAdjacency(isolated, 'square', 100);
  assert('buildAdjacency isolated cells: 0 edges', eIso.length === 0);

  // pitch 자동 추정
  const auto = G.buildAdjacency(cells, 'square', null);
  assert('buildAdjacency auto-pitch: 2 edges', auto.length === 2);
}

// ─── groupQualityScore ──────────────────────────────
{
  // I형: 3×1 → 0점
  const iCells = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }];
  const iEdges = G.buildAdjacency(iCells, 'square', 100);
  assert('groupQualityScore I형 → 0', G.groupQualityScore(iCells, iEdges) === 0);

  // T형: (0,0)-(100,0)-(200,0) + (100,100) → T → −10
  const tCells = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 100 }];
  const tEdges = G.buildAdjacency(tCells, 'square', 100);
  assert('groupQualityScore T형 → -10', G.groupQualityScore(tCells, tEdges) === -10);

  // 2×2 컴팩트 → +10
  const compCells = makeGrid(2, 2, 100);
  const compEdges = G.buildAdjacency(compCells, 'square', 100);
  assert('groupQualityScore 2×2 컴팩트 → +10', G.groupQualityScore(compCells, compEdges) === +10);

  // 단일 셀 → 0
  assert('groupQualityScore 단일 셀 → 0', G.groupQualityScore([{ x: 0, y: 0 }], []) === 0);

  // L형: 2×1 + 1 아래 → 0점 (체인, 분기 없음)
  const lCells = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }];
  const lEdges = G.buildAdjacency(lCells, 'square', 100);
  assert('groupQualityScore L형 → 0', G.groupQualityScore(lCells, lEdges) === 0);
}

// ─── checkGroupValidity ─────────────────────────────
{
  // 정상: 2그룹, 각 3셀 연결, G0↔G1 인접
  // G0: (0,0)(0,100)(0,200)  G1: (100,0)(100,100)(100,200)
  const groups2 = [
    { index: 0, cells: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 0, y: 200 }] },
    { index: 1, cells: [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 200 }] },
  ];
  const res2 = G.checkGroupValidity(groups2, 'square', 100);
  assert('checkGroupValidity 정상 2그룹: valid', res2.valid);
  assert('checkGroupValidity 정상 2그룹: violations empty', res2.violations.length === 0);

  // 조건 A 위반: G0 내 셀 분리
  const groupsA = [
    { index: 0, cells: [{ x: 0, y: 0 }, { x: 500, y: 0 }] },  // 거리 500 >> pitch
    { index: 1, cells: [{ x: 100, y: 0 }, { x: 200, y: 0 }] },
  ];
  const resA = G.checkGroupValidity(groupsA, 'square', 100);
  assert('checkGroupValidity 조건 A 위반: invalid', !resA.valid);
  assert('checkGroupValidity 조건 A 위반 메시지 포함', resA.violations.some(v => v.reason.includes('조건 A')));

  // 조건 B 위반: G0·G1 사이 간격 너무 큼
  const groupsB = [
    { index: 0, cells: [{ x: 0, y: 0 }, { x: 0, y: 100 }] },
    { index: 1, cells: [{ x: 500, y: 0 }, { x: 500, y: 100 }] },  // 거리 500 >> 1.05×100
  ];
  const resB = G.checkGroupValidity(groupsB, 'square', 100);
  assert('checkGroupValidity 조건 B 위반: invalid', !resB.valid);
  assert('checkGroupValidity 조건 B 위반 메시지 포함', resB.violations.some(v => v.reason.includes('조건 B')));
}

// ─── assignGroupNumbers ─────────────────────────────
{
  // 4S2P square: 8셀 → 4그룹 각 2셀
  const ctx4s2p = {
    S: 4, P: 2, arrangement: 'square',
    cell_centers: makeGrid(4, 2, 100),
  };
  const r4 = G.assignGroupNumbers(ctx4s2p);
  assert('S24 4S2P: groups.length === 4', r4.groups.length === 4);
  assert('S24 4S2P: G0 is_b_plus', r4.groups[0].is_b_plus);
  assert('S24 4S2P: G3 is_b_minus', r4.groups[3].is_b_minus);
  assert('S24 4S2P: each group 2 cells', r4.groups.every(g => g.cells.length === 2));

  // 13S3P square: 39셀 → 13그룹 각 3셀
  const ctx13 = {
    S: 13, P: 3, arrangement: 'square',
    cell_centers: makeGrid(13, 3, 100),
  };
  const r13 = G.assignGroupNumbers(ctx13);
  assert('S24 13S3P: groups.length === 13', r13.groups.length === 13);
  assert('S24 13S3P: total cells === 39', r13.groups.reduce((s, g) => s + g.cells.length, 0) === 39);
  assert('S24 13S3P: quality_score defined', r13.groups.every(g => g.quality_score !== undefined));

  // G0 보스트로페돈: 첫 행 좌→우 시작점이 G0의 첫 셀이어야 함
  const r13_g0_x = r13.groups[0].cells[0].x;
  assert('S24 13S3P: G0 시작 x===0 (보스트로페돈 LTR)', r13_g0_x === 0);

  // custom 배열: BFS 순서
  const ctxCustom = {
    S: 3, arrangement: 'custom',
    cell_centers: [
      { x: 0, y: 200 }, { x: 100, y: 200 }, { x: 200, y: 200 },
      { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 200, y: 100 },
      { x: 0, y: 0   }, { x: 100, y: 0   }, { x: 200, y: 0   },
    ],
  };
  const rCustom = G.assignGroupNumbers(ctxCustom);
  assert('S24 custom: groups.length === 3', rCustom.groups.length === 3);
}

// ─── selectBmsOptimal ────────────────────────────────
{
  // 빈 타일링 → null 반환
  const ctxEmpty = { candidate_tilings: [], bms_side: 'top', groups: [] };
  const rEmpty = G.selectBmsOptimal(ctxEmpty);
  assert('S22 empty: selected_tiling null', rEmpty.selected_tiling === null);
  assert('S22 empty: bms_side preserved', rEmpty.bms_side === 'top');

  // 1개 타일링 → 그대로 선택
  const grps = [
    { is_b_plus: true,  cells: [{ x: 0,   y: 0 }, { x: 0,   y: 100 }] },
    { is_b_minus: true, cells: [{ x: 100, y: 0 }, { x: 100, y: 100 }] },
  ];
  const tilings = [{ id: 'T1', groups: grps }];
  const ctx1 = { candidate_tilings: tilings, bms_side: 'top', groups: grps };
  const r1 = G.selectBmsOptimal(ctx1);
  assert('S22 1타일링: selected not null', r1.selected_tiling !== null);
  assert('S22 1타일링: b_plus_tab_position defined', r1.b_plus_tab_position !== null);
  assert('S22 1타일링: dist_b_plus is number', typeof r1.dist_b_plus === 'number');

  // bms_side=bottom → B+ 탭이 y 최대인 셀에서 더 가까워야 함
  const ctxBot = { candidate_tilings: tilings, bms_side: 'bottom', groups: grps };
  const rBot = G.selectBmsOptimal(ctxBot);
  assert('S22 bottom: bms_side === bottom', rBot.bms_side === 'bottom');
  assert('S22 bottom: dist_b_plus >= 0', rBot.dist_b_plus >= 0);
}

// ─── buildPairFirst ICC 체크 ────────────────────────
{
  // 정상 그룹 (2×1, I형, 종횡비·행스팬 OK)
  const grpsOK = [
    { index: 0, cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    { index: 1, cells: [{ x: 0, y: 100 }, { x: 100, y: 100 }] },
  ];
  const rOK = G.buildPairFirst({ groups: grpsOK, arrangement: 'square', nickel_w: 10 }, {}, {});
  assert('buildPairFirst 정상: candidate_tilings not empty', rOK.candidate_tilings.length > 0);
  assert('buildPairFirst 정상: icc_violations empty', rOK.icc_violations.length === 0);

  // 행스팬 3 → ICC① 위반 → 가지치기
  const grpsSpan = [
    {
      index: 0,
      quality_score: 0,
      cells: [
        { x: 0, y: 0 }, { x: 100, y: 0 },
        { x: 0, y: 100 }, { x: 100, y: 100 },
        { x: 0, y: 200 }, { x: 100, y: 200 },
      ],
    },
  ];
  const rSpan = G.buildPairFirst({ groups: grpsSpan, arrangement: 'square', nickel_w: 10 }, {}, {});
  assert('buildPairFirst 행스팬3: ICC①위반 감지', rSpan.icc_violations.some(v => v.rule === 'ICC①_rowSpan'));

  // T형(quality_score=-10) → 즉시 가지치기
  const grpsT = [
    {
      index: 0,
      quality_score: -10,
      cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 100 }],
    },
  ];
  const rT = G.buildPairFirst({ groups: grpsT, arrangement: 'square', nickel_w: 10 }, {}, {});
  assert('buildPairFirst T형: quality_score 위반 감지', rT.icc_violations.some(v => v.rule === 'quality_score'));
}

// ─── 결과 ────────────────────────────────────────────
console.log('────────────────────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
