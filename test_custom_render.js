/* Node.js test: 13S5P custom rows=[8,8,10,13,13,13], right+stagger */
const fs  = require('fs');
const vm  = require('vm');

const rendererSrc = fs.readFileSync('renderer.js', 'utf8');

// vm context에 필요한 전역을 주입하고, 모든 로직을 context 안에서 실행
const ctx = { require, console, __result: null };
vm.createContext(ctx);

// renderer.js 로드
vm.runInContext(rendererSrc, ctx);

// 테스트 코드도 같은 context에서 실행 (app.js buildNickel 스파인 방식 반영)
vm.runInContext(`
(function() {
  const p = {
    cell_type: '21700', S: 13, P: 5,
    gap: 0.0, scale: 3.5, margin_mm: 3, nickel_w_mm: 3,
    gap_section: 20, show_nickel: true, show_terminal: true, face: 'all',
    custom_align: 'right', custom_stagger: true, custom_stagger_dir: 'R', bms_edge: 'top',
  };
  const rows = [8, 8, 10, 13, 13, 13];

  const spec    = CELL_SPEC[p.cell_type];
  const pitch   = (spec.render_d + p.gap) * p.scale;
  const R       = (spec.render_d / 2) * p.scale;
  const margin  = p.margin_mm * p.scale;
  const stagger = p.custom_stagger;
  const pitchY  = stagger ? pitch * Math.sqrt(3) / 2 : pitch;
  const maxN    = Math.max(...rows);
  const stagDir = (p.custom_stagger_dir === 'L') ? -1 : 1;
  const leftPad = (stagger && stagDir === -1) ? pitch / 2 : 0;

  const pts = [];
  for (let r = 0; r < rows.length; r++) {
    const n          = rows[r];
    const fromBottom = rows.length - 1 - r;
    const stagOffX   = (stagger && fromBottom % 2 === 1) ? stagDir * pitch / 2 : 0;
    const alignOffX  = (maxN - n) * pitch;  // right
    for (let i = 0; i < n; i++)
      pts.push({ x: margin + leftPad + alignOffX + stagOffX + i * pitch + R,
                 y: margin + r * pitchY + R, row: r, col: i });
  }
  const W = margin * 2 + maxN * pitch + (stagger ? pitch / 2 : 0);
  const H = margin * 2 + (rows.length - 1) * pitchY + 2 * R;

  const S = p.S, N = pts.length;
  const cellsPerGroup = Math.ceil(N / S);
  const byRow = rows.map(() => []);
  pts.forEach(pt => byRow[pt.row].push(pt));
  const snake = [];
  for (let r = 0; r < byRow.length; r++) {
    const row = [...byRow[r]];
    if (r % 2 === 1) row.reverse();
    snake.push(...row);
  }
  const groupCells = Array.from({length: S}, () => []);
  snake.forEach((pt, i) => {
    const g = Math.min(S - 1, Math.floor(i / cellsPerGroup));
    groupCells[g].push(pt);
  });

  const isAdj = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  const nw = p.nickel_w_mm * p.scale;

  // circles+lines 방식 (app.js buildNickel과 동일) — 회색 단일색
  function buildNickel(face) {
    if (!p.show_nickel) return '';
    const parts = [];
    const sw = (R * 2).toFixed(1);
    const fc = '#888888';

    const plates = [];
    const paired = new Set();
    const pStart = (face === 'top') ? 1 : 0;
    for (let g = pStart; g + 1 < S; g += 2) {
      plates.push([...groupCells[g], ...groupCells[g + 1]]);
      paired.add(g); paired.add(g + 1);
    }
    for (let g = 0; g < S; g++) {
      if (!paired.has(g))
        plates.splice(g === 0 ? 0 : plates.length, 0, [...groupCells[g]]);
    }

    plates.forEach(plate => {
      if (!plate.length) return;
      for (let a = 0; a < plate.length; a++) {
        for (let b = a + 1; b < plate.length; b++) {
          if (isAdj(plate[a], plate[b])) {
            parts.push('<line x1="'+plate[a].x.toFixed(1)+'" y1="'+plate[a].y.toFixed(1)+'" x2="'+plate[b].x.toFixed(1)+'" y2="'+plate[b].y.toFixed(1)+'" stroke="'+fc+'" stroke-width="'+sw+'" stroke-linecap="round"/>');
          }
        }
      }
      for (const c of plate) {
        parts.push('<circle cx="'+c.x.toFixed(1)+'" cy="'+c.y.toFixed(1)+'" r="'+R.toFixed(1)+'" fill="'+fc+'"/>');
      }
    });
    return parts.join('');
  }

  function buildTerminals(face) {
    const parts = [];
    if (face === 'top') {
      const c0 = groupCells[0]?.[0];
      if (c0) {
        parts.push('<circle cx="'+c0.x.toFixed(1)+'" cy="'+c0.y.toFixed(1)+'" r="'+(nw*0.7).toFixed(1)+'" fill="#C0392B" stroke="#7B241C" stroke-width="1"/>');
        parts.push('<text font-family="Arial" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle" x="'+c0.x.toFixed(1)+'" y="'+(c0.y+4).toFixed(1)+'">B+</text>');
      }
    }
    const bMinusOnTop = (S % 2 === 0);
    if ((face === 'top' && bMinusOnTop) || (face === 'bottom' && !bMinusOnTop)) {
      const lastG = groupCells[S-1];
      const cL = lastG?.[lastG.length-1];
      if (cL) {
        parts.push('<circle cx="'+cL.x.toFixed(1)+'" cy="'+cL.y.toFixed(1)+'" r="'+(nw*0.7).toFixed(1)+'" fill="#0C447C" stroke="#042C53" stroke-width="1"/>');
        parts.push('<text font-family="Arial" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle" x="'+cL.x.toFixed(1)+'" y="'+(cL.y+4).toFixed(1)+'">B-</text>');
      }
    }
    return parts.join('');
  }

  const topCells = snake.map((pt, i) => { const g = Math.min(S-1, Math.floor(i/cellsPerGroup)); return drawCell(pt.x, pt.y, R, getCellPolarity(g,'top'), p.scale); });
  const botCells = snake.map((pt, i) => { const g = Math.min(S-1, Math.floor(i/cellsPerGroup)); return drawCell(pt.x, pt.y, R, getCellPolarity(g,'bottom'), p.scale); });

  const gap = p.gap_section, svgH = H * 2 + gap + 50;
  const ln = [];
  ln.push('<svg width="100%" viewBox="0 0 '+Math.ceil(W)+' '+Math.ceil(svgH)+'" xmlns="http://www.w3.org/2000/svg">');
  ln.push('<rect width="100%" height="100%" fill="#f5f5f5"/>');
  ln.push('<text font-family="Arial" font-size="13" fill="#222" text-anchor="middle" x="'+(W/2)+'" y="18">top face</text>');
  ln.push('<g transform="translate(0,24)">'+buildNickel('top')+topCells.join('')+buildTerminals('top')+'</g>');
  ln.push('<line x1="20" y1="'+(H+24+gap/2)+'" x2="'+(W-20)+'" y2="'+(H+24+gap/2)+'" stroke="#ccc" stroke-width="1" stroke-dasharray="4 3"/>');
  ln.push('<text font-family="Arial" font-size="13" fill="#222" text-anchor="middle" x="'+(W/2)+'" y="'+(H+24+gap/2+14)+'">bottom face</text>');
  ln.push('<g transform="translate(0,'+(H+24+gap)+')">'+buildNickel('bottom')+botCells.join('')+buildTerminals('bottom')+'</g>');
  ln.push('<text font-family="Arial" font-size="9" fill="#27AE60" text-anchor="middle" x="'+(W/2)+'" y="'+(svgH-6)+'">13S5P custom rows=[8,8,10,13,13,13] Right Stagger · spine방식 · N='+N+'셀</text>');
  ln.push('</svg>');

  __result = {
    svg: ln.join('\\n'),
    W, H, N, S, cellsPerGroup,
  };
})();
`, ctx);

const { svg, W, H, N, S, cellsPerGroup } = ctx.__result;
fs.writeFileSync('test_custom_13s5p.svg', svg);
console.log('Saved: test_custom_13s5p.svg');
console.log(`Canvas: ${W.toFixed(0)}×${H.toFixed(0)}, N=${N}, S=${S}, cellsPerGroup=${cellsPerGroup}`);
console.log(`Gray(#888888): ${(svg.match(/#888888/g)||[]).length}`);
console.log(`Lines: ${(svg.match(/<line /g)||[]).length}`);
console.log(`Circles: ${(svg.match(/<circle /g)||[]).length}`);
const i1 = svg.indexOf('#888888'), i2 = svg.indexOf('stroke="#C0392B"');
console.log(`Layer order (nickel < cell): ${i1 < i2} [nickel@${i1} < cell@${i2}]`);
