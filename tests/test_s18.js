/**
 * S18 — buildStrokeGraph (원칙 18 — 니켈 형상 알고리즘)
 *
 *   입력 ctx: { group_cells:[{x,y}], adjacency_graph:[{i,j}], arrangement?, R? }
 *   출력: {
 *     stroke_graph: { V:[{x,y}], E:[{i,j}] },   // E는 adjacency의 spanning tree
 *     svg_elements: [ { type:'circle'|'line', ... }, ... ]
 *   }
 *
 * 원칙 18 요구:
 *  - V는 group_cells pass-through
 *  - E는 spanning tree (사이클 제거 — 방법 B: BFS/DFS)
 *  - 모든 edge endpoint는 V 인덱스 참조 (floating segment 금지)
 *  - svg_elements:
 *      · 각 V마다 circle(r=R) 1개
 *      · 각 E마다 line(stroke-width=2R, linecap=round) 1개
 *  - 빈 그룹은 빈 graph + 빈 svg_elements
 *  - 단일 셀 그룹은 V=1, E=0, svg에 circle 1개만
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// Helper: svg_elements에서 type별 개수
function countType(els, type) {
  return (els || []).filter(e => e && e.type === type).length;
}

// Helper: edges 정규화 ([{i,j}] → Set("i-j", i<j))
function edgeKey(e) {
  const a = Math.min(e.i, e.j), b = Math.max(e.i, e.j);
  return `${a}-${b}`;
}
function edgeSet(edges) {
  return new Set(edges.map(edgeKey));
}

// ═══════════════════════════════════════════════
// 케이스 A — I형 2셀 → V=2, E=1
// ═══════════════════════════════════════════════
{
  const ctx = {
    group_cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    adjacency_graph: [{ i: 0, j: 1 }],
    arrangement: 'square',
    R: 33,
  };
  const r = G.buildStrokeGraph(ctx);
  assert('A: stroke_graph.V 길이 2',
    r && r.stroke_graph && r.stroke_graph.V && r.stroke_graph.V.length === 2,
    `V=${r && r.stroke_graph && r.stroke_graph.V && r.stroke_graph.V.length}`);
  assert('A: stroke_graph.E 길이 1',
    r.stroke_graph.E && r.stroke_graph.E.length === 1,
    `E=${r.stroke_graph.E && r.stroke_graph.E.length}`);
  assert('A: svg_elements circle 2개',
    countType(r.svg_elements, 'circle') === 2,
    `circle=${countType(r.svg_elements, 'circle')}`);
  assert('A: svg_elements line 1개',
    countType(r.svg_elements, 'line') === 1,
    `line=${countType(r.svg_elements, 'line')}`);
  assert('A: stub 플래그 제거됨',
    !r.stub, `stub=${r.stub}`);
}

// ═══════════════════════════════════════════════
// 케이스 B — 2×2 클러스터 (4셀, adjacency 4 edge, 사이클 有) → spanning tree 3 edges
// ═══════════════════════════════════════════════
{
  // 2×2 격자: (0,0) (100,0) (0,100) (100,100)
  const cells = [
    { x: 0, y: 0 }, { x: 100, y: 0 },
    { x: 0, y: 100 }, { x: 100, y: 100 },
  ];
  // 4-이웃: (0↔1), (0↔2), (1↔3), (2↔3)  — 사각 사이클
  const adj = [
    { i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3 },
  ];
  const r = G.buildStrokeGraph({ group_cells: cells, adjacency_graph: adj, arrangement: 'square', R: 33 });

  assert('B: V 길이 4', r.stroke_graph.V.length === 4);
  assert('B: E 길이 3 (spanning tree, 사이클 제거)',
    r.stroke_graph.E.length === 3,
    `E=${r.stroke_graph.E.length}`);

  // spanning tree 속성: |E|=|V|-1 & 연결성
  // 간단 BFS로 연결성 검증
  const n = r.stroke_graph.V.length;
  const adjList = Array.from({ length: n }, () => []);
  for (const e of r.stroke_graph.E) { adjList[e.i].push(e.j); adjList[e.j].push(e.i); }
  const seen = new Set([0]); const q = [0];
  while (q.length) { const u = q.shift(); for (const v of adjList[u]) if (!seen.has(v)) { seen.add(v); q.push(v); } }
  assert('B: spanning tree 연결성 (BFS 전체 도달)',
    seen.size === n, `reached=${seen.size}/${n}`);

  // 선택된 3 edge는 원래 adjacency의 부분집합
  const origKeys = edgeSet(adj);
  const pickedKeys = [...edgeSet(r.stroke_graph.E)];
  assert('B: 선택 edge는 adjacency 부분집합',
    pickedKeys.every(k => origKeys.has(k)),
    `picked=${pickedKeys.join(',')}`);

  assert('B: svg line = |E| = 3',
    countType(r.svg_elements, 'line') === 3);
  assert('B: svg circle = |V| = 4',
    countType(r.svg_elements, 'circle') === 4);
}

// ═══════════════════════════════════════════════
// 케이스 C — L형 3셀 → V=3, E=2
// ═══════════════════════════════════════════════
{
  // L: (0,0) (100,0) (100,100)
  const cells = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  const adj = [{ i: 0, j: 1 }, { i: 1, j: 2 }];
  const r = G.buildStrokeGraph({ group_cells: cells, adjacency_graph: adj, arrangement: 'square', R: 33 });

  assert('C: V 길이 3', r.stroke_graph.V.length === 3);
  assert('C: E 길이 2', r.stroke_graph.E.length === 2);
  assert('C: line 2개', countType(r.svg_elements, 'line') === 2);
  assert('C: circle 3개', countType(r.svg_elements, 'circle') === 3);
}

// ═══════════════════════════════════════════════
// 케이스 D — 빈 그룹 → 빈 graph
// ═══════════════════════════════════════════════
{
  const r = G.buildStrokeGraph({ group_cells: [], adjacency_graph: [], arrangement: 'square', R: 33 });
  assert('D: V 빈배열',
    Array.isArray(r.stroke_graph.V) && r.stroke_graph.V.length === 0);
  assert('D: E 빈배열',
    Array.isArray(r.stroke_graph.E) && r.stroke_graph.E.length === 0);
  assert('D: svg_elements 빈배열',
    Array.isArray(r.svg_elements) && r.svg_elements.length === 0);
}

// ═══════════════════════════════════════════════
// 케이스 E — 단일 셀 그룹 → V=1, E=0, circle 1개
// ═══════════════════════════════════════════════
{
  const r = G.buildStrokeGraph({
    group_cells: [{ x: 50, y: 50 }],
    adjacency_graph: [],
    arrangement: 'square',
    R: 33,
  });
  assert('E: V=1, E=0',
    r.stroke_graph.V.length === 1 && r.stroke_graph.E.length === 0);
  assert('E: circle 1개, line 0개',
    countType(r.svg_elements, 'circle') === 1 && countType(r.svg_elements, 'line') === 0);
}

// ═══════════════════════════════════════════════
// 케이스 F — floating segment 금지: 모든 edge endpoint는 V 인덱스 범위 내
// ═══════════════════════════════════════════════
{
  const cells = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 },
  ];
  const adj = [
    { i: 0, j: 1 }, { i: 1, j: 2 }, { i: 2, j: 3 },
  ];
  const r = G.buildStrokeGraph({ group_cells: cells, adjacency_graph: adj, arrangement: 'square', R: 33 });
  const V = r.stroke_graph.V.length;
  const allInRange = r.stroke_graph.E.every(e =>
    Number.isInteger(e.i) && Number.isInteger(e.j) &&
    e.i >= 0 && e.i < V && e.j >= 0 && e.j < V && e.i !== e.j);
  assert('F: 모든 E endpoint ∈ [0, V) (floating segment 금지)',
    allInRange);
  assert('F: I형 4셀 spanning tree → E=3',
    r.stroke_graph.E.length === 3);
}

// ═══════════════════════════════════════════════
// 케이스 G — svg_elements 속성 검증 (stroke=2R, linecap=round)
// ═══════════════════════════════════════════════
{
  const R = 33;
  const ctx = {
    group_cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    adjacency_graph: [{ i: 0, j: 1 }],
    arrangement: 'square',
    R,
  };
  const r = G.buildStrokeGraph(ctx);
  const line = (r.svg_elements || []).find(e => e && e.type === 'line');
  const circle = (r.svg_elements || []).find(e => e && e.type === 'circle');

  assert('G: line 존재', !!line);
  assert('G: line stroke-width === 2R',
    line && line.strokeWidth === 2 * R,
    `strokeWidth=${line && line.strokeWidth}`);
  assert('G: line linecap === round',
    line && line.linecap === 'round',
    `linecap=${line && line.linecap}`);
  assert('G: circle 존재', !!circle);
  assert('G: circle r === R',
    circle && circle.r === R, `r=${circle && circle.r}`);
}

// ═══════════════════════════════════════════════
// 결과
// ═══════════════════════════════════════════════
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
