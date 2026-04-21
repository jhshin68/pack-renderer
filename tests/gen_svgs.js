'use strict';
const fs = require('fs');
const renderer = require('../src/renderer');
const _layout  = require('../src/gen-layout');
const _enum    = require('../src/gen-enum');
const { enumerateGroupAssignments, buildHolderGrid } = _enum;
const { calcNickelPattern, canonicalSig } = _layout;
const { CELL_SPEC } = renderer;
const _math = require('../src/gen-math');
const { _pt } = _math;

const pts = buildHolderGrid(2, 3, 'square', [], {
  cell_type:'21700', gap:0, scale:1.5, margin_mm:8.0,
  custom_stagger:false, custom_stagger_dir:'R', custom_align:'center', row_offsets:[]
}, CELL_SPEC);
const spec = CELL_SPEC['21700'];
const pitch = (spec.render_d + 0) * 1.5;

const r = enumerateGroupAssignments({
  cells:pts, S:3, P:2, arrangement:'square',
  b_plus_side:'left', b_minus_side:'right',
  icc1:true, icc2:true, icc3:false,
  allow_I:false, allow_U:false,
  pitch, custom_stagger:false,
  max_candidates:500, exhaustive:true, budget_ms:10000,
});
const cands = r.candidates || [];
const {top, bot} = calcNickelPattern(3);
const allPlates = [...top, ...bot];

console.log('총 후보 수:', cands.length);

function adjPairs(cells) {
  const pairs = [];
  for (let i = 0; i < cells.length; i++)
    for (let j = i+1; j < cells.length; j++) {
      const pi = _pt(cells[i]), pj = _pt(cells[j]);
      if (Math.hypot(pi.x-pj.x, pi.y-pj.y) < pitch*1.1) pairs.push([i,j]);
    }
  return pairs;
}

function getPolarity(gi, face) {
  return (gi%2===0) ? (face==='top' ? '+' : '-') : (face==='top' ? '-' : '+');
}

function plateSig(cells) {
  const ppts = cells.map(c => { const p=_pt(c); return [p.x, p.y]; });
  const cx = ppts.reduce((s,p) => s+p[0], 0) / ppts.length;
  const cy = ppts.reduce((s,p) => s+p[1], 0) / ppts.length;
  return canonicalSig(ppts.map(([x,y]) => [x-cx, y-cy]), 4);
}

cands.forEach((cand, ci) => {
  const groups = cand.groups;
  const m = cand.m_distinct || 0;

  // 형상 타입 번호 매핑
  const sigToType = new Map();
  let typeCount = 0;
  const plateTypes = allPlates.map((pl) => {
    const cells = pl.groups.flatMap(gi => groups[gi] ? groups[gi].cells : []);
    const sig = plateSig(cells);
    if (!sigToType.has(sig)) sigToType.set(sig, ++typeCount);
    return sigToType.get(sig);
  });

  const SCALE = 3.5;
  const CR = 14*SCALE, NW = 10*SCALE;
  const BASE = 28.5;
  const PITCH = 33;
  const PX = 45, PY = 75;
  const panelW = 3*PITCH*SCALE + PX*2;
  const panelH = 2*PITCH*SCALE + PY*2;
  const GAP = 50;
  const W = panelW*2 + GAP + 30;
  const H = panelH + 100;

  const lines = [];
  lines.push('<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'">');
  lines.push('<rect width="100%" height="100%" fill="#1a1a2e"/>');

  const candName = cand.name || ('후보 '+(ci+1));
  const bFlag = (!cand.b_plus_ok || !cand.b_minus_ok) ? '  ⚠ B±?' : '';
  const title = (ci+1)+'. '+candName+bFlag+'  |  플레이트 '+m+'종';
  lines.push('<text x="'+(W/2)+'" y="32" text-anchor="middle" font-size="20" font-weight="bold" fill="#ffffff">'+title+'</text>');

  const gInfo = groups.map((g,gi) => {
    const cs = g.cells.map(c => {
      const p=_pt(c);
      return 'R'+Math.round((p.y-BASE)/PITCH)+'C'+Math.round((p.x-BASE)/PITCH);
    });
    return 'G'+gi+':['+cs.join(',')+']';
  }).join('  ');
  lines.push('<text x="'+(W/2)+'" y="52" text-anchor="middle" font-size="12" fill="#aaaaaa">'+gInfo+'</text>');

  ['top','bot'].forEach((face, fi) => {
    const ox = 15 + fi*(panelW + GAP);
    const oy = 65;
    const faceLabel = face==='top' ? '상면 (TOP FACE)' : '하면 (BOTTOM FACE)';
    const fColor = face==='top' ? '#5dade2' : '#82e0aa';

    lines.push('<rect x="'+ox+'" y="'+oy+'" width="'+panelW+'" height="'+panelH+'" rx="10" fill="#0d1b2a" stroke="'+fColor+'" stroke-width="2"/>');
    lines.push('<text x="'+(ox+panelW/2)+'" y="'+(oy+22)+'" text-anchor="middle" font-size="15" font-weight="bold" fill="'+fColor+'">'+faceLabel+'</text>');

    const bX = ox + PX + BASE*SCALE;
    const bY = oy + PY + BASE*SCALE;

    // 셀 배경
    pts.forEach(c => {
      const p = _pt(c);
      const px = bX+(p.x-BASE)*SCALE, py = bY+(p.y-BASE)*SCALE;
      let gi = groups.findIndex(g => g.cells.includes(c));
      if(gi<0) gi=0;
      const pol = getPolarity(gi, face);
      const border = pol==='+' ? '#e74c3c' : '#666666';
      const fill   = pol==='+' ? '#2a0000' : '#111111';
      lines.push('<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="'+CR.toFixed(1)+'" fill="'+fill+'" stroke="'+border+'" stroke-width="3"/>');
      if(pol==='-') {
        lines.push('<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="'+(CR*0.22).toFixed(1)+'" fill="#888"/>');
      } else {
        lines.push('<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="'+(CR*0.5).toFixed(1)+'" fill="#c0392b" opacity="0.85"/>');
      }
      const tCol = pol==='+' ? '#ff8888' : '#888888';
      lines.push('<text x="'+px.toFixed(1)+'" y="'+(py+CR+15).toFixed(1)+'" text-anchor="middle" font-size="11" fill="'+tCol+'">'+pol+'</text>');
    });

    // 니켈 플레이트
    const facePlates = face==='top' ? top : bot;
    const plColor = face==='top' ? '#cccccc' : '#eeeeee';

    facePlates.forEach((pl, pli) => {
      const pcells = pl.groups.flatMap(gi => groups[gi] ? groups[gi].cells : []);
      if(!pcells.length) return;
      const pIdx = (face==='top' ? 0 : top.length) + pli;
      const typeNum = plateTypes[pIdx];

      // 연결선 (니켈 스트립)
      adjPairs(pcells).forEach(([i,j]) => {
        const pi2=_pt(pcells[i]), pj2=_pt(pcells[j]);
        const x1=bX+(pi2.x-BASE)*SCALE, y1=bY+(pi2.y-BASE)*SCALE;
        const x2=bX+(pj2.x-BASE)*SCALE, y2=bY+(pj2.y-BASE)*SCALE;
        lines.push('<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="'+plColor+'" stroke-width="'+NW.toFixed(1)+'" stroke-linecap="round" opacity="0.88"/>');
      });
      // 접촉원
      pcells.forEach(c => {
        const p2 = _pt(c);
        const px2=bX+(p2.x-BASE)*SCALE, py2=bY+(p2.y-BASE)*SCALE;
        lines.push('<circle cx="'+px2.toFixed(1)+'" cy="'+py2.toFixed(1)+'" r="'+(CR*0.58).toFixed(1)+'" fill="'+plColor+'" opacity="0.82"/>');
      });
      // 라벨: P번호 (형상X)
      const cxp = pcells.reduce((s,c) => s+_pt(c).x, 0) / pcells.length;
      const cyp = pcells.reduce((s,c) => s+_pt(c).y, 0) / pcells.length;
      lines.push('<text x="'+(bX+(cxp-BASE)*SCALE).toFixed(1)+'" y="'+(bY+(cyp-BASE)*SCALE-3).toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="bold" fill="#1a1a2e">P'+(pIdx+1)+'</text>');
      lines.push('<text x="'+(bX+(cxp-BASE)*SCALE).toFixed(1)+'" y="'+(bY+(cyp-BASE)*SCALE+11).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#1a1a2e">[형'+typeNum+']</text>');
    });
  });

  // 하단 형상 요약
  const bottomY = H - 38;
  lines.push('<rect x="15" y="'+(bottomY-16)+'" width="'+(W-30)+'" height="32" rx="5" fill="#16213e"/>');

  const typeGroups = new Map();
  allPlates.forEach((pl, pi) => {
    const t = plateTypes[pi];
    const face = pi < top.length ? '상' : '하';
    const grpStr = 'G'+pl.groups.join('+G');
    if(!typeGroups.has(t)) typeGroups.set(t,[]);
    typeGroups.get(t).push('P'+(pi+1)+'('+face+' '+grpStr+')');
  });

  let tx = 25;
  typeGroups.forEach((list, t) => {
    const txt = '형상'+t+': '+list.join(' = ');
    lines.push('<text x="'+tx+'" y="'+(bottomY+5)+'" font-size="12" fill="#f0e0a0">'+txt+'</text>');
    tx += txt.length * 7.2 + 18;
  });

  lines.push('</svg>');
  const fname = 'tests/result_3s2p_'+(ci+1)+'_'+candName.replace(/[→←\s]/g,'_')+'.svg';
  fs.writeFileSync(fname, lines.join('\n'));
  console.log('저장: '+fname+'  (m_distinct='+m+')');
});
