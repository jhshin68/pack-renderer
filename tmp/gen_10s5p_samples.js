/**
 * 10S5P 샘플 5종 SVG 생성 스크립트
 * 원칙 28: P/2P/P 연결성 검증 포함
 * 1자 정배열·엇배열 제외 — 비정형 5종만
 */
const fs   = require('fs');
const path = require('path');

const root     = path.join(__dirname, '..');
const Renderer = require(path.join(root, 'src', 'renderer.js'));

const base = {
  cell_type: '21700', S: 10, P: 5,
  gap: 0.0, scale: 3.8, margin_mm: 4, nickel_w_mm: 3.5,
  gap_section: 24, show_nickel: true, show_terminal: true,
  face: 'all', custom_stagger: false,
};

const samples = [
  {
    name: '01_vertical_10rows',
    label: '수직 10행×5열 (rows=[5×10])',
    rows: [5,5,5,5,5,5,5,5,5,5],
    custom_align: 'center',
  },
  {
    name: '02_wide_2rows',
    label: '광폭 2행×25열 (rows=[25,25])',
    rows: [25,25],
    custom_align: 'center',
  },
  {
    name: '03_step_wide_top',
    label: '계단형 상폭 (rows=[10,10,10,10,5,5])',
    rows: [10,10,10,10,5,5],
    custom_align: 'left',
  },
  {
    name: '04_step_wide_bottom',
    label: '역계단형 하폭 (rows=[5,5,10,10,10,10])',
    rows: [5,5,10,10,10,10],
    custom_align: 'left',
  },
  {
    name: '05_hourglass',
    label: '모래시계형 (rows=[10,10,5,5,10,10])',
    rows: [10,10,5,5,10,10],
    custom_align: 'left',
  },
];

const outDir = path.join(__dirname);
let allOk = true;

samples.forEach(({ name, label, rows, custom_align }) => {
  const params = { ...base, rows, custom_align };
  try {
    const svg = Renderer.renderCustomRows(params);
    const outPath = path.join(outDir, `10s5p_${name}.svg`);
    fs.writeFileSync(outPath, svg, 'utf8');

    // 원칙 9 위반 체크
    const violated = svg.includes('원칙 9 위반');
    const status = violated ? '❌ 원칙9 위반' : '✅ OK';
    console.log(`${status}  ${name}  rows=[${rows.join(',')}]  align=${custom_align}`);
    if (violated) allOk = false;
  } catch (e) {
    console.error(`❌ ERROR  ${name}: ${e.message}`);
    allOk = false;
  }
});

console.log('');
console.log(allOk ? '모든 배열 유효 — SVG 5종 생성 완료' : '일부 배열 무효 — 위 오류 확인 필요');
