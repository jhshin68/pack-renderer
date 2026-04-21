'use strict';
/**
 * test_no_crossing.js — 원칙 30: 동일 면 이종 플레이트 비교차 검사
 * RED: checkPlanarNoCrossing() 미구현 시 ReferenceError 또는 undefined → FAIL
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ptSrc     = fs.readFileSync(path.join(ROOT, 'src', 'pentomino_tiling.js'), 'utf8');
const mathSrc   = fs.readFileSync(path.join(ROOT, 'src', 'gen-math.js'), 'utf8');
const layoutSrc = fs.readFileSync(path.join(ROOT, 'src', 'gen-layout.js'), 'utf8');
const enumSrc   = fs.readFileSync(path.join(ROOT, 'src', 'gen-enum.js'), 'utf8');
const genSrc    = fs.readFileSync(path.join(ROOT, 'src', 'generator.js'), 'utf8');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(ptSrc, ctx);
vm.runInContext(mathSrc, ctx);
vm.runInContext(layoutSrc, ctx);
vm.runInContext(enumSrc, ctx);
vm.runInContext(genSrc, ctx);
const Generator = ctx.Generator;

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log(`[PASS] ${label}`); }
  else { fail++; console.log(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); }
}

const fn = Generator.checkPlanarNoCrossing;
check('checkPlanarNoCrossing 함수 존재', typeof fn === 'function');

if (typeof fn === 'function') {
  const pitch = 33; // 21700 @scale=1.5
  const thr = pitch * 1.5;

  // ── 케이스 1: 교차 없음 — 두 그룹이 나란히 수평 배열 ────────────────────
  // G0: (0,0)-(33,0)  G1: (66,0)-(99,0)  → 겹침 없음
  const noXGroups = [
    { cells: [{ x: 0, y: 0 }, { x: 33, y: 0 }] },
    { cells: [{ x: 66, y: 0 }, { x: 99, y: 0 }] },
  ];
  check('case1: 수평 나란히 → 교차 없음(true)', fn(noXGroups, thr) === true);

  // ── 케이스 2: 교차 있음 — X자 형태 ──────────────────────────────────────
  // top face: plate0 = G0(단독 P=1) → 셀 하나짜리는 엣지 없음
  // 실제 교차를 만들려면 plate0이 G0, plate1이 G1∪G2 (2P) 구조
  // G0: (0,0)-(33,33)  G1: (33,0)-(0,33)  → X자 교차
  // 상면 pStart=1: plate=[G1∪G2], G0단독 → G0 엣지와 G1∪G2 엣지 교차
  // 더 명확한 케이스: S=4, P=2
  // top face pStart=1: [G1∪G2], [G3단독]
  // bot face pStart=0: [G0∪G1], [G2∪G3]
  // G0: (0,0),(33,33)  G1: (33,0),(0,33)  ← 두 엣지가 X자
  // G2: (66,0),(99,33) G3: (99,0),(66,33)
  // bot face: G0∪G1 엣지: (0,0)↔(33,33), (0,0)↔(33,0), ...
  //           G2∪G3 엣지: (66,0)↔(99,33), ...  → 이 면은 교차 없음
  // top face: G0단독 엣지: (0,0)↔(33,33)
  //           G1∪G2 엣지: (33,0)↔(0,33)(G1내), (66,0)↔(99,33)(G2내) → G0와 G1 교차!
  const crossGroups = [
    { cells: [{ x:  0, y:  0 }, { x: 33, y: 33 }] }, // G0
    { cells: [{ x: 33, y:  0 }, { x:  0, y: 33 }] }, // G1
    { cells: [{ x: 66, y:  0 }, { x: 99, y: 33 }] }, // G2
    { cells: [{ x: 99, y:  0 }, { x: 66, y: 33 }] }, // G3
  ];
  // top face pStart=1: plate0=[G1∪G2], plate1=[G3단독]
  // G1 엣지: (33,0)↔(0,33), G2 엣지: (66,0)↔(99,33) → 서로 교차 없음
  // bot face pStart=0: plate0=[G0∪G1], plate1=[G2∪G3]
  // G0∪G1 엣지 중: (0,0)↔(33,33)(G0내), (33,0)↔(0,33)(G1내) → 같은 플레이트 내 교차 (무시)
  // G0∪G1 엣지들 vs G2∪G3 엣지들 → X=66~99 vs X=0~33 → 교차 없음
  // → 이 케이스는 교차 없음. 다른 케이스 필요.

  // 진짜 이종 플레이트 교차: S=2, P=2 (top face: G0 단독, bot face: G0∪G1 전체)
  // top face pStart=1: 플레이트 없음 (g=1이 g+1=2 < S=2 → 불성립), G0 단독 → 단일 플레이트만 → 교차 불가
  // bot face pStart=0: G0∪G1 하나 → 단일 플레이트 → 교차 불가
  // S=2는 항상 교차 없음.

  // S=4, P=2로 진짜 이종 교차 케이스:
  // top face pStart=1: plate0=[G1∪G2], plate1=[G3단독]
  //   G1: (0,0)↔(33,33), G2: (66,33)↔(99,0)  ← G1 엣지와 G2 엣지가 교차하는지? NO (다른 x 범위)
  //   G3: (99,33) 단독 → 엣지 없음
  // → 교차 없음

  // 가장 직접적인 케이스: plate0와 plate1이 X자 교차하는 구조
  // S=4, P=2, top face pStart=1:
  //   plate0 = G1∪G2: 4셀
  //   plate1 = G3 단독: 2셀 (G3는 S홀수 아니니 top에 안나옴? S=4는 짝수)
  //   S=4 짝수: top=[G0단독, G1∪G2, G3단독 없음] → pStart=1: g=1→G1∪G2, g=3→G3 단독(paired=no)
  //   실제: top pStart=1: paired={1,2}, unpaired={0,3}
  //   G0 단독(first), G1∪G2, G3 단독(last)
  //   → G0단독 엣지 vs G1∪G2 엣지 교차 가능!

  // G0: cells at (50,0),(50,66) — vertical
  // G1: cells at (0,33),(100,33) — horizontal, intersects G0 visual area
  // G2: cells at (0,0),(100,66) — diagonal
  // G3: cells at (50,33),(50,99) — another vertical
  // top face: G0단독 edge=(50,0)↔(50,66), G1∪G2 edges=(0,33)↔(100,33),(0,0)↔(100,66),(0,33)↔(0,0),(100,33)↔(100,66)
  // (0,33)↔(100,33) vs (50,0)↔(50,66): 교차! at (50,33)

  const xGroups2 = [
    { cells: [{ x: 50, y:  0 }, { x: 50, y: 66 }] }, // G0: vertical
    { cells: [{ x:  0, y: 33 }, { x:100, y: 33 }] }, // G1: horizontal
    { cells: [{ x:  0, y:  0 }, { x:100, y: 66 }] }, // G2: diagonal
    { cells: [{ x: 50, y: 33 }, { x: 50, y: 99 }] }, // G3
  ];
  // thr=49.5: G0 엣지: (50,0)↔(50,66) dist=66 > 49.5 → 비인접! 엣지 없음
  // pitch 키우기: thr = 100
  const thr2 = 100;
  // G0 엣지: (50,0)↔(50,66) dist=66 ✓
  // G1 엣지: (0,33)↔(100,33) dist=100 ✓ (=thr, 포함)
  // top face G0단독 엣지=(50,0)↔(50,66) vs G1∪G2 엣지 중 (0,33)↔(100,33):
  //   proper intersection at (50,33) → 교차!
  check('case2: X자 교차 → checkPlanarNoCrossing returns false',
    fn(xGroups2, thr2) === false);

  // ── 케이스 3: 경계 접촉(endpoint touch)은 교차로 판정 안 함 ──────────────
  // G0 엣지: (0,0)↔(33,0)  G1 엣지: (33,0)↔(66,0) — 끝점 공유
  // 이종 플레이트지만 endpoint만 접촉 → proper intersection 아님 → pass
  const touchGroups = [
    { cells: [{ x:  0, y: 0 }, { x: 33, y: 0 }] }, // G0
    { cells: [{ x: 33, y: 0 }, { x: 66, y: 0 }] }, // G1 — 셀 (33,0) 겹침(허용: 다른 그룹이지만 물리셀 공유는 없어야 하나 테스트용)
    { cells: [{ x: 66, y: 0 }, { x: 99, y: 0 }] }, // G2
    { cells: [{ x: 99, y: 0 }, { x:132, y: 0 }] }, // G3
  ];
  // 모두 수평, 이웃 플레이트 끝점 접촉 → proper intersection 없음 → true
  check('case3: endpoint 접촉만 → 교차 없음(true)', fn(touchGroups, 100) === true);
}

console.log(`\n[TEST RESULT] pass=${pass} fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
