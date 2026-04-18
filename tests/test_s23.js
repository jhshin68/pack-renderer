/**
 * S23 — buildHexCluster (원칙 23 — 엇배열 hex 클러스터)
 *
 *   입력 ctx: { group_cells:[{x,y}], hex_adjacency_graph:[{i,j}], R? }
 *   출력: {
 *     hex_spanning_tree: [{i,j}],        // BFS spanning tree of hex adjacency
 *     stroke_graph_hex: { V:[{x,y}], E:[{i,j}] },
 *     svg_elements: [...]
 *   }
 *
 * 원칙 23 요구:
 *  - hex 6방향 spanning tree (사이클 제거 — BFS 방법 B)
 *  - V = group_cells pass-through
 *  - E = hex_spanning_tree (= hex adjacency BFS spanning tree)
 *  - svg_elements: V별 circle(r=R) + E별 line(strokeWidth=2R, linecap='round')
 *  - 빈/단일 셀 그룹 처리
 *  - stub 플래그 없음
 *
 * hex 좌표 참고 (pitch=100):
 *   dy = pitch × √3/2 ≈ 86.6 (홀수 행 수직 간격)
 *   홀수 행 x-offset = pitch/2 = 50
 */
'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}
function countType(els, type) { return (els || []).filter(e => e && e.type === type).length; }

// BFS 연결성 검사 헬퍼
function isConnected(n, edges) {
  if (n === 0) return true;
  const adj = Array.from({ length: n }, () => []);
  for (const e of edges) { adj[e.i].push(e.j); adj[e.j].push(e.i); }
  const seen = new Set([0]); const q = [0];
  while (q.length) { const u = q.shift(); for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); q.push(v); } }
  return seen.size === n;
}

// ═══════════════════════════════════════════════
// 케이스 A — 2셀 (같은 행, 수평 인접) → V=2, E=1
// ═══════════════════════════════════════════════
{
  const cells = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const hexAdj = [{ i: 0, j: 1 }];
  const r = G.buildHexCluster({ group_cells: cells, hex_adjacency_graph: hexAdj, R: 33 });

  assert('A: hex_spanning_tree 길이 1',
    r && Array.isArray(r.hex_spanning_tree) && r.hex_spanning_tree.length === 1,
    `len=${r && r.hex_spanning_tree && r.hex_spanning_tree.length}`);
  assert('A: stroke_graph_hex.V 길이 2',
    r.stroke_graph_hex && r.stroke_graph_hex.V && r.stroke_graph_hex.V.length === 2);
  assert('A: stroke_graph_hex.E 길이 1',
    r.stroke_graph_hex.E && r.stroke_graph_hex.E.length === 1);
  assert('A: svg circle 2개', countType(r.svg_elements, 'circle') === 2);
  assert('A: svg line 1개', countType(r.svg_elements, 'line') === 1);
  assert('A: stub 플래그 없음', !r.stub, `stub=${r.stub}`);
}

// ═══════════════════════════════════════════════
// 케이스 B — 2-1-2 다이아몬드 (5셀, hex 6-이웃, 사이클 有) → spanning tree 4 edges
//
// 좌표 (pitch=100, dy≈86):
//   셀0=(0,0)  셀1=(100,0)          ← row 0 (짝수)
//   셀2=(50,86)                     ← row 1 (홀수, x-offset=50)
//   셀3=(0,172) 셀4=(100,172)       ← row 2 (짝수)
//
// hex adj 6 edges: (0↔1),(0↔2),(1↔2),(2↔3),(2↔4),(3↔4)
// ═══════════════════════════════════════════════
{
  const cells = [
    { x: 0,   y: 0   },
    { x: 100, y: 0   },
    { x: 50,  y: 86  },
    { x: 0,   y: 172 },
    { x: 100, y: 172 },
  ];
  const hexAdj = [
    { i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 },
    { i: 2, j: 3 }, { i: 2, j: 4 }, { i: 3, j: 4 },
  ];
  const r = G.buildHexCluster({ group_cells: cells, hex_adjacency_graph: hexAdj, R: 33 });

  assert('B: hex_spanning_tree 길이 4 (5셀-1)',
    r.hex_spanning_tree.length === 4,
    `len=${r.hex_spanning_tree.length}`);
  assert('B: stroke_graph_hex.E === hex_spanning_tree',
    r.stroke_graph_hex.E && r.stroke_graph_hex.E.length === 4);

  // spanning tree 연결성
  assert('B: spanning tree 연결 (BFS 전체 5셀 도달)',
    isConnected(5, r.hex_spanning_tree));

  // 선택 edge는 원래 adjacency의 부분집합
  const origKeys = new Set(hexAdj.map(e => `${Math.min(e.i,e.j)}-${Math.max(e.i,e.j)}`));
  const picked = r.hex_spanning_tree.map(e => `${Math.min(e.i,e.j)}-${Math.max(e.i,e.j)}`);
  assert('B: 선택 edge는 hex_adjacency 부분집합',
    picked.every(k => origKeys.has(k)), `picked=${picked.join(',')}`);

  assert('B: svg circle 5개', countType(r.svg_elements, 'circle') === 5);
  assert('B: svg line 4개',   countType(r.svg_elements, 'line') === 4);
}

// ═══════════════════════════════════════════════
// 케이스 C — 7셀 hex ring (center + 6-이웃)
//   center=(0,0), ring 6셀 at 60° × pitch=100
//   adj: center↔each ring = 6, ring neighbors = 6  → total 12 edges
//   spanning tree = 6 edges (7셀-1)
// ═══════════════════════════════════════════════
{
  const p = 100;
  const ring = [0, 60, 120, 180, 240, 300].map(deg => ({
    x: Math.round(p * Math.cos(deg * Math.PI / 180)),
    y: Math.round(p * Math.sin(deg * Math.PI / 180)),
  }));
  // cells: idx 0=center, 1..6=ring
  const cells = [{ x: 0, y: 0 }, ...ring];
  // edges: center(0) to each ring + ring neighbors
  const hexAdj = [];
  for (let k = 1; k <= 6; k++) hexAdj.push({ i: 0, j: k });           // center↔ring
  for (let k = 1; k <= 6; k++) hexAdj.push({ i: k, j: k % 6 + 1 }); // ring neighbors

  const r = G.buildHexCluster({ group_cells: cells, hex_adjacency_graph: hexAdj, R: 33 });

  assert('C: hex_spanning_tree 길이 6 (7셀-1)',
    r.hex_spanning_tree.length === 6,
    `len=${r.hex_spanning_tree.length}`);
  assert('C: spanning tree 연결', isConnected(7, r.hex_spanning_tree));
  assert('C: svg circle 7개', countType(r.svg_elements, 'circle') === 7);
  assert('C: svg line 6개',   countType(r.svg_elements, 'line') === 6);
}

// ═══════════════════════════════════════════════
// 케이스 D — 빈 그룹 → 빈 graph
// ═══════════════════════════════════════════════
{
  const r = G.buildHexCluster({ group_cells: [], hex_adjacency_graph: [], R: 33 });
  assert('D: hex_spanning_tree 빈배열', Array.isArray(r.hex_spanning_tree) && r.hex_spanning_tree.length === 0);
  assert('D: V 빈배열', r.stroke_graph_hex.V.length === 0);
  assert('D: svg_elements 빈배열', Array.isArray(r.svg_elements) && r.svg_elements.length === 0);
}

// ═══════════════════════════════════════════════
// 케이스 E — 단일 셀 → V=1, E=0, circle 1개
// ═══════════════════════════════════════════════
{
  const r = G.buildHexCluster({ group_cells: [{ x: 50, y: 50 }], hex_adjacency_graph: [], R: 33 });
  assert('E: V=1, E=0', r.stroke_graph_hex.V.length === 1 && r.stroke_graph_hex.E.length === 0);
  assert('E: circle 1개, line 0개',
    countType(r.svg_elements, 'circle') === 1 && countType(r.svg_elements, 'line') === 0);
}

// ═══════════════════════════════════════════════
// 케이스 F — svg_elements 속성 (strokeWidth=2R, linecap=round, circle r=R)
// ═══════════════════════════════════════════════
{
  const R = 33;
  const r = G.buildHexCluster({
    group_cells: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    hex_adjacency_graph: [{ i: 0, j: 1 }],
    R,
  });
  const line   = (r.svg_elements || []).find(e => e && e.type === 'line');
  const circle = (r.svg_elements || []).find(e => e && e.type === 'circle');

  assert('F: line strokeWidth === 2R', line && line.strokeWidth === 2 * R, `sw=${line && line.strokeWidth}`);
  assert('F: line linecap === round',  line && line.linecap === 'round', `lc=${line && line.linecap}`);
  assert('F: circle r === R', circle && circle.r === R, `r=${circle && circle.r}`);
}

// ═══════════════════════════════════════════════
// 결과
// ═══════════════════════════════════════════════
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
