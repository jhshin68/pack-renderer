// explore_pentomino_quality.js
// 이미지 패턴(10S5P P-pentomino 타일링)을 validator/quality로 실측.
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const ctx = { console: { log: () => {}, warn: () => {}, error: () => {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/generator.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/renderer.js'), 'utf8'), ctx);

// 5×10 holder 셀 생성
vm.runInContext(`
  __cells = Generator.buildHolderGrid(5, 10, 'square', [], {
    cell_type: '21700', scale: 1.5, gap: 0, margin_mm: 8
  }, CELL_SPEC);
`, ctx);

const cells = ctx.__cells;
const gridMap = {};
for (const c of cells) {
  if (!gridMap[c.row]) gridMap[c.row] = {};
  gridMap[c.row][c.col] = c;
}

// 이미지 기반 10개 P-pentomino 그룹 (red 5 + black 5)
const imageGroups = [
  // 상단 red
  [[0,0],[0,1],[1,0],[1,1],[2,0]],
  [[0,4],[0,5],[1,4],[1,5],[2,4]],
  [[0,8],[0,9],[1,8],[1,9],[2,8]],
  // 하단 red
  [[2,2],[3,2],[3,3],[4,2],[4,3]],
  [[2,6],[3,6],[3,7],[4,6],[4,7]],
  // 상단 black
  [[0,2],[0,3],[1,2],[1,3],[2,3]],
  [[0,6],[0,7],[1,6],[1,7],[2,7]],
  // 하단 black
  [[2,1],[3,0],[3,1],[4,0],[4,1]],
  [[2,5],[3,4],[3,5],[4,4],[4,5]],
  [[2,9],[3,8],[3,9],[4,8],[4,9]],
].map(g => g.map(([r, c]) => gridMap[r][c]));

// groupICC를 직접 호출할 수 없으므로 vm 안에서 실행
vm.runInContext(`
  __result = (function(){
    // generator.js 내부 함수 접근을 위한 미니 래퍼
    const S = 10, P = 5, arrangement = 'square';
    const groupSets = ${JSON.stringify(imageGroups.map(g => g.map(c => ({x: c.x, y: c.y, row: c.row, col: c.col}))))};

    // groupICC는 generator IIFE 내부 — 공개 API 중 적합한 것 사용
    // 대체: enumerateGroupAssignments가 내부에서 groupICC를 씀 → 우리는 flat 순열로 이걸 주입할 방법 없음
    // 대신 단순 재구현으로 rowSpan/ratio/convexity/qs 계산
    const pitch = (() => {
      const ys = __cells.map(c => c.y).sort((a,b)=>a-b);
      const ds = [];
      for (let i=1;i<ys.length;i++) if (ys[i]-ys[i-1] > 0.01) ds.push(ys[i]-ys[i-1]);
      return ds.sort((a,b)=>a-b)[0] || 1;
    })();
    const thr = pitch * 1.3;

    function buildAdj(gc){
      const edges = [];
      for (let i=0;i<gc.length;i++) for (let j=i+1;j<gc.length;j++){
        const dx = gc[i].x - gc[j].x, dy = gc[i].y - gc[j].y;
        if (Math.hypot(dx,dy) <= thr) edges.push({i,j});
      }
      return edges;
    }

    function groupHealth(gc){
      const edges = buildAdj(gc);
      const deg = new Array(gc.length).fill(0);
      for (const {i,j} of edges){ deg[i]++; deg[j]++; }
      const hasT = deg.some(d => d >= 3);
      const gxs = gc.map(c=>c.x), gys = gc.map(c=>c.y);
      const spanX = Math.max(...gxs) - Math.min(...gxs);
      const spanY = Math.max(...gys) - Math.min(...gys);
      const is1D  = spanX < thr * 0.1 || spanY < thr * 0.1;
      const rowSpan = Math.round(spanY / pitch) + 1;
      const colSpan = Math.round(spanX / pitch) + 1;
      const ratio = is1D ? 1 : Math.max(spanX, spanY) / (Math.min(spanX, spanY) || 1);
      // 연결성: edges 수 >= gc.length-1 + 트리
      const connected = edges.length >= gc.length - 1;
      // quality_score 근사: hasT면 -10, 1D이면 0, 2D이면 +10
      const qs = hasT ? -10 : (is1D ? 0 : 10);
      return { hasT, is1D, rowSpan, colSpan, ratio, connected, qs, edges: edges.length };
    }

    const details = groupSets.map((gc, i) => {
      const h = groupHealth(gc);
      return {
        group: i,
        cells: gc.map(c => '(r'+c.row+',c'+c.col+')').join(','),
        rowSpan: h.rowSpan, colSpan: h.colSpan,
        qs: h.qs, hasT: h.hasT, is1D: h.is1D,
        ratio: h.ratio.toFixed(2),
        connected: h.connected,
      };
    });
    const totalQS = details.reduce((s,d) => s + d.qs, 0);
    const icc1_viol = details.filter(d => d.rowSpan > 2).length;
    const icc3_viol = details.filter(d => d.hasT).length;
    return { details, totalQS, icc1_viol, icc3_viol };
  })();
`, ctx);

const r = ctx.__result;
console.log('\n=== 이미지 P-pentomino 타일링 품질 실측 (10S5P 정배열) ===\n');
console.log('그룹 ID  rowSpan  colSpan   ratio  hasT  qs   cells');
console.log('-------  -------  -------  ------  ----  ---  ------------------------------------');
for (const d of r.details) {
  console.log(
    String(d.group).padStart(2) + '       ' +
    String(d.rowSpan).padStart(3) + '      ' +
    String(d.colSpan).padStart(3) + '    ' +
    d.ratio.padStart(5) + '    ' +
    (d.hasT ? 'Y' : 'N') + '   ' +
    String(d.qs).padStart(3) + '   ' +
    d.cells
  );
}
console.log('\n총 quality_score Σ = ' + (r.totalQS >= 0 ? '+' : '') + r.totalQS);
console.log('ICC① (rowSpan≤2) 위반 그룹 수: ' + r.icc1_viol + ' / 10');
console.log('ICC③ (T/Y 분기) 위반 그룹 수:  ' + r.icc3_viol + ' / 10');
