# Pack-Renderer 원칙 감시 파일 (principle-guard용)

> 이 파일은 `.claude/hooks/principle-guard.py`가 읽는 기준 문서입니다.
> 원칙을 추가/수정하면 다음 Edit/Write부터 자동 반영됩니다.
> 전체 원칙은 `principles.md` (프로젝트 루트) 또는 `skills/nickel_plate_principles.md` 참조.

---

## 정적 규칙 (Static Rules) — 정규식으로 즉시 차단

정적 규칙은 패턴이 명확해 AI 판단 없이 바로 차단합니다.

### RULE-P29-VIOLATION [renderer.js]
**설명**: 원칙 29/1 위반 — snake.map + Math.floor(i/cellsPerGroup)로 그룹 인덱스 결정
**패턴**: `snake\.map` 블록 안에서 `Math.floor(i / cellsPerGroup)` 사용
**올바른 구현**:
```javascript
const cellGrpIdx = new Map();
groupCells.forEach((gc, gIdx) => gc.forEach(c => cellGrpIdx.set(`${c.row},${c.col}`, gIdx)));
const topCells = pts.map(pt => {
  const g = cellGrpIdx.get(`${pt.row},${pt.col}`) ?? 0;
  return drawCell(pt.x, pt.y, R, getCellPolarity(g, 'top'), params.scale);
});
```
**차단 사유**: 동일 그룹 P개 셀이 서로 다른 극성 표시 → 단락 → 열폭주

### RULE-P9-THRESHOLD [generator.js]
**설명**: 원칙 9 ③ — 커스텀 배열 인접 판정 임계값
**패턴**: `pitchPx \* pitchPx \* ([\d.]+)` 에서 계수가 1.21 미만(= pitch×1.1 미만)이면 위반
**올바른 값**: `pitchPx * pitchPx * 2.25` (= pitch×1.5, 대각선 인접 √2≈1.414 허용)
**차단 사유**: 너무 작은 임계값 → 대각선 인접 셀 비인접 판정 → 그룹 연결성 오류

### RULE-P8-HARDCODE [*.js]
**설명**: 원칙 8 — S×P 하드코딩 금지
**패턴**: 리터럴 숫자로 `N = 52` 또는 `52 cells` 등 특정 S×P 결과값 고정
**올바른 구현**: 항상 `S * P` 또는 `params.S * params.P` 로 계산
**차단 사유**: 다른 S/P 조합에서 동작 불가

---

## 의미론적 규칙 (Semantic Rules) — AI 판정 필요

다음 패턴이 변경 코드에 포함될 때 `claude -p` 로 판정을 요청합니다.

### SEM-GROUP-INDEX [renderer.js, generator.js]
**트리거 키워드**: `getCellPolarity`, `groupCells`, `cell_groups`, `cellGrpIdx`, `buildNickel`
**판정 질문**: "변경된 코드가 그룹 배정(groupCells)을 우회하여 순번/인덱스로 그룹을 결정하는가?"
**위반 시**: 원칙 29/1 위반으로 차단

### SEM-NICKEL-PLATE-COUNT [renderer.js]
**트리거 키워드**: `buildNickel`, `pairsTop`, `pairsBot`, `S + 1`
**판정 질문**: "변경된 buildNickel 로직이 총 S+1개 플레이트(P/2P/P 구조)를 생성하는가?"
**위반 시**: 원칙 28 위반으로 차단

### SEM-ADJACENCY [generator.js]
**트리거 키워드**: `buildAdjacency`, `isAdj`, `threshold`, `pitchPx`
**판정 질문**: "변경된 인접성 판정이 원칙 9의 정배열 4방향/엇배열 6방향/커스텀 거리 기반 규칙을 따르는가?"
**위반 시**: 원칙 9 위반으로 차단

---

## 허용 예외 (Allowlist)

다음 패턴은 위반처럼 보여도 허용됩니다:

1. `renderer.js` 라인 661-663: `snake.map` + `Math.floor(i/cellsPerGroup)` — **오류 표시 전용** (p9ViolationIdx >= 0 분기)
2. `generator.js` 라인 641: fallback groupCells 초기화 — **외부 그룹 없을 때 대체 로직**
3. 테스트 파일 `tests/*.js` 및 `tmp/*.js` — **테스트 코드는 검사 제외**
