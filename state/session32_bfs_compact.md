# 세션 32 — pickCompactHoriz BFS 수평 우선 픽커

날짜: 2026-04-20  
목표: 13S4P 커스텀 배열 BFS 픽커에서 수평 이웃 우선 선택 구현

---

## 작업 배경

세션 31 말미에 확인된 문제:
- 기존 `pickMRV` → G0=[#23,#11,#36,#48] (4행 스팬 I형 체인) → allow_I=false 거부 → 0 후보
- 사용자 요구: 2번째 픽에서 수평(같은 행) 이웃을 사선(다른 행)보다 먼저 선택
- 사용자 예시: `G0={#48,#49,#37,#36}` (2행 스팬 컴팩트 클러스터)

---

## 시도 이력

### 시도 1: pickCompactHoriz + checkFutureConn (실패)

연결성 가드 추가:
```javascript
function checkFutureConn(c, group) {
  // c 픽 후 P개 미만 고립 컴포넌트 발생 시 return false
  const pickingLast = (group.length === P - 1);
  if (pickingLast || !comp.some(ci => adjL[ci].some(nb => groupAndC.has(nb)))) return false;
}
```

실패 원인 분석:
- G7=[#29,#30,#31,?] 상황에서 checkFutureConn이 #42,#43 등 비-I형 후보를 모두 차단
- 원인: `#41`(Row3) adj [#28(G3),#29(G7),#40(G3),#42,#52], `#52`(Row4) adj [#40(G3),#41,#51(G2)]
- #42 픽 시 {#41,#52}가 2-cell 고립 → pickingLast=true → 무조건 차단
- 결과: safe=[#19,#32,#44] (I형), I형 필터 적용 후 safe=[](비어있음) → fallback → I형 선택 → allow_I=false 거부 → 0후보

### 시도 2: pickSmartMRV (부분 성공 — 방향 규칙 미충족)

```javascript
function pickSmartMRV(candidates, group) {
  const score = (isLinear ? -1000 : 0) - mrv;
}
```

결과: 5/5 테스트 PASS, 846/846 회귀 PASS  
문제: G0=[#23,**#11**,#36,#24] — #11(MRV=1)이 #24(MRV=4)보다 먼저 선택됨 → 방향 규칙 위반

### 시도 3: pickCompactHoriz 최종 (채택)

핵심 인사이트:
- 연결성 가드 불필요: MRV가 자연스럽게 병목 셀(낮은 degree) 우선 처리
- 수평 우선은 **step 2만** (group.length=1)에서 적용하면 충분
- I형 회피는 **step 4만** (마지막 픽)에서 적용

최종 구현:
```javascript
function pickCompactHoriz(candidates, group) {
  const groupCells = group.map(i => cells[i]);
  let pool = candidates;
  // step 2: 수평(같은 행) 우선
  if (group.length === 1) {
    const sameRow = pool.filter(c => cells[c].row === groupCells[0].row);
    if (sameRow.length > 0) pool = sameRow;
  }
  // step 4: I형 체인 회피
  if (group.length === P - 1) {
    const notLinear = pool.filter(c => !_isLinearGroup([...groupCells, cells[c]]));
    if (notLinear.length > 0) pool = notLinear;
  }
  // MRV 선택
  let best = -1, bestD = Infinity;
  for (const c of pool) {
    const d = adjL[c].filter(j => !used[j]).length;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
```

---

## 최종 결과

### 그룹 배정 (g0start=#48, 첫 번째 B+ 성공)

```
G0:  [#48,#49,#36,#37]  rows=[4,3]  B+  — 수평 #49 먼저 ✓
G1:  [#23,#24,#11,#12]  rows=[2,1]  B+  — #23 시작, #24 수평 2번째 ✓
G2:  [#1,#2,#13,#25]    rows=[0,1,2]
...
G12: [#34,#35,#22,#47]  rows=[2,1,3] B-  — B- 셀 포함 ✓
```

### 검증 결과

| 검사 항목 | 결과 |
|---|---|
| 후보 존재 | ✓ (candidates ≥ 1) |
| G0 컴팩트 (max pairwise ≤ 2×pitch) | ✓ 32.9mm ≤ 38.0mm |
| G0 I형 아님 | ✓ (#37 degree 3 → T/Y 모양) |
| G0 행 스팬 ≤ 2개 | ✓ rows=[4,3] |
| 전체 52셀 배정 | ✓ |
| G12 B- 셀 포함 | ✓ |
| 회귀 846/846 | ✓ |

---

## 파일 변경 목록

| 파일 | 변경 내용 |
|---|---|
| `src/generator.js` | pickMRV → pickCompactHoriz (step2 수평 우선 + step4 I형 회피) |
| `tests/test_bfs_compact.js` | 신규: 6개 assertion (compact/non-I/row-span/52cells/B-) |
| `state/claude-progress.txt` | 세션 32 진행 사항 업데이트 |
| `state/session32_bfs_compact.md` | 이 파일 |

---

## 커밋

```
fdaa234 feat(session32): pickCompactHoriz — 수평 우선 + I형 회피 BFS 픽커
```

---

## 다음 세션 할 일

1. **브라우저 확인**: 13S4P 커스텀 배열에서 G0=[#48,#49,#36,#37] 포함 후보 정상 렌더 확인
2. **브라우저 확인**: staggered+holder 모드 니켈 플레이트 형상 확인
3. **도메인 확인**: 13S4P 비균일 staggerON 0후보 — 물리적 불가능 여부
4. **선택 과제**: test_enumerate_integration C3/C4 실패(10S5P snake=0) 원인 분석
