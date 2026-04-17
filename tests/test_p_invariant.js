/**
 * P 무관 원칙 불변 테스트
 *   사용자 지시 (세션 13.5): "5P는 특별하지 않다. 모든 P에 동일 원칙 적용.
 *                              5P만의 별도 이론·프로그램 금지."
 *
 *   → Type-A (P=5 전용 closed ladder) 폐기.
 *   → P=5도 다른 P와 동일하게 calcNickelPattern → drawNickelI/U 경로 사용.
 *
 * 검증 항목:
 *   A. selectBlockType(5) → 'U' (또는 P 무관 단일 타입)
 *      · 'TypeA' 블록 타입 값 금지
 *   B. calcNickelPattern(S, 5)의 plate.block_type === 비-TypeA
 *   C. P=4·P=5 렌더 시 동일 패턴 구조 (stroke-width=nw, stroke-linecap=round)
 *      · <rect ... stroke="#888888" ...> 패턴 부재 (Type-A rect 렌더 금지)
 *   D. 12S4P vs 12S5P SVG 구조 유사도 (line·circle 개수 비례)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm');

const G = require(path.join(__dirname, '..', 'src', 'generator.js'));

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { console.log(`[PASS] ${label}`); pass++; }
  else       { console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// ─── Case A — selectBlockType(5) 비-TypeA ──────────────
{
  const b5 = G.selectBlockType(5);
  assert('A1: selectBlockType(5).block_type !== TypeA',
    b5.block_type !== 'TypeA',
    `got ${b5.block_type}`);
  assert('A2: selectBlockType(5).geometry_ready === true',
    b5.geometry_ready === true);
  assert('A3: selectBlockType(4)와 block_type 동일 (또는 둘 다 U)',
    b5.block_type === G.selectBlockType(4).block_type ||
    (b5.block_type === 'U' || b5.block_type === 'Generic'),
    `P=5:${b5.block_type}, P=4:${G.selectBlockType(4).block_type}`);
}

// ─── Case B — calcNickelPattern(S, 5) 비-TypeA ──────────
{
  const pat = G.calcNickelPattern(5, 5);
  const allPlates = [...pat.top, ...pat.bot];
  const hasTypeA = allPlates.some(p => p.block_type === 'TypeA');
  assert('B1: calcNickelPattern(5,5) plates에 TypeA 없음', !hasTypeA);

  for (const S of [3, 5, 8, 13]) {
    const p = G.calcNickelPattern(S, 5);
    const ok = [...p.top, ...p.bot].every(pl => pl.block_type !== 'TypeA');
    assert(`B2-S${S}: P=5 plates 전부 비-TypeA`, ok);
  }
}

// ─── Case C — P=4·P=5 렌더 결과 패턴 비교 ─────────────
// Type-A의 고유 SVG 시그니처 = <rect> 요소. P=4는 <line>만. P=5도 <line>만이어야.
{
  const rendererSrc  = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
  const generatorSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'generator.js'), 'utf8');

  function renderSVG(S, P) {
    const ctx = { console, __result: null };
    vm.createContext(ctx);
    vm.runInContext(generatorSrc, ctx);
    vm.runInContext(rendererSrc, ctx);
    vm.runInContext(`__result = render({
      cell_type: '21700', S: ${S}, P: ${P}, arrangement: 'square',
      gap: 0, scale: 1.5, nickel_w_mm: 3, margin_mm: 8,
      gap_section: 30, show_nickel: true, show_terminal: true, face: 'all',
    });`, ctx);
    return ctx.__result;
  }

  const svg4 = renderSVG(6, 4);
  const svg5 = renderSVG(6, 5);

  const cnt = (s, pat) => (s.match(new RegExp(pat, 'g')) || []).length;

  // 니켈 요소 검사: P=4는 <line stroke="#888888">만 가짐
  const p4Lines = cnt(svg4, '<line [^>]*stroke="#888888"');
  const p5Lines = cnt(svg5, '<line [^>]*stroke="#888888"');
  assert('C1: P=4 SVG — 니켈 <line> 요소 있음', p4Lines > 0, `got ${p4Lines}`);
  assert('C2: P=5 SVG — 니켈 <line> 요소 있음', p5Lines > 0, `got ${p5Lines}`);

  // ★ 핵심 RED: P=5는 <rect stroke="#888888"> 같은 Type-A 시그니처 없어야
  // drawNickelTypeA는 <rect ... fill="#888888"> 다수 생성
  const p5Rects = cnt(svg5, '<rect [^>]*fill="#888888"');
  assert('C3: P=5 SVG — <rect fill="#888888"> (Type-A 시그니처) 없음',
    p5Rects === 0, `got ${p5Rects} (Type-A rect 잔존)`);

  // P=4는 line 기반, P=5도 line 기반이어야 하므로 line:cell 비율 유사
  const p4Cells = cnt(svg4, '<circle ');
  const p5Cells = cnt(svg5, '<circle ');
  const r4 = p4Lines / Math.max(p4Cells, 1);
  const r5 = p5Lines / Math.max(p5Cells, 1);
  assert('C4: P=4와 P=5 line:cell 비율 근접 (±50%)',
    Math.abs(r4 - r5) / Math.max(r4, r5, 0.1) < 0.5,
    `P=4 ratio=${r4.toFixed(2)}, P=5 ratio=${r5.toFixed(2)}`);
}

// ─── Case D — drawNickelTypeA 함수 부재 확인 ────────────
// 구현 제거 후 이 테스트는 PASS. 현재는 FAIL (함수 존재).
{
  const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
  const hasDrawTypeA = /function\s+drawNickelTypeA\s*\(/.test(rendererSrc);
  assert('D1: renderer.js에 drawNickelTypeA 함수 없음',
    !hasDrawTypeA,
    hasDrawTypeA ? '함수 잔존 — 제거 필요' : '');

  const hasBuildTypeA = /buildTypeANickel/.test(rendererSrc);
  assert('D2: renderer.js에 buildTypeANickel 호출 없음',
    !hasBuildTypeA,
    hasBuildTypeA ? '함수/호출 잔존' : '');

  const generatorSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'generator.js'), 'utf8');
  const hasCalcTypeA = /function\s+calcTypeAGeometry\s*\(/.test(generatorSrc);
  assert('D3: generator.js에 calcTypeAGeometry 함수 없음',
    !hasCalcTypeA,
    hasCalcTypeA ? '함수 잔존' : '');
}

// ─── 결과 ──────────────────────────────────────────────
console.log('────────────────────────────────');
console.log(`[TEST RESULT] pass=${pass}  fail=${fail}`);
if (fail > 0) process.exit(1);
