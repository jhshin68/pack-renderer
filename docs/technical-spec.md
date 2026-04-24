# Battery Pack Intelligence — 기술 스펙 & 아키텍처 문서

> SL Power Co., Ltd. — Pack-Renderer 프로젝트  
> 작성 기준: 소스 버전 v0.3.2-unified (2026-04-23)  
> 대상 독자: 설계 엔지니어, 소프트웨어 개발자, 기술 검토자

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [수학적 기초](#3-수학적-기초)
4. [그룹 배정 알고리즘 파이프라인](#4-그룹-배정-알고리즘-파이프라인)
5. [병렬 연산 설계](#5-병렬-연산-설계)
6. [원칙 체계 (Principles v8)](#6-원칙-체계-principles-v8)
7. [렌더링 시스템](#7-렌더링-시스템)
8. [비용 모델 & 목적 함수](#8-비용-모델--목적-함수)
9. [데이터 흐름 & API 계층](#9-데이터-흐름--api-계층)

---

## 1. 프로젝트 개요

**Battery Pack Intelligence**는 리튬이온 배터리팩의 니켈 플레이트 형상을 자동으로 설계·검증·시각화하는 단일 파일 브라우저 앱이다.

### 1.1 해결하는 문제

| 문제 | 해결 방법 |
|---|---|
| S×P 셀 배치에서 유효한 그룹 배정 조합이 수천 가지 | DFS 백트래킹 + ICC 가지치기로 최적 후보만 열거 |
| 니켈 금형 종류 수(m_distinct)가 제조 비용을 결정 | SFMT 알고리즘으로 m_distinct 최소화 |
| 비정형 홀더(불규칙 행별 셀 수)에서 탐색 공간 폭발 | 빔 서치 + 병렬 Web Worker로 10분 내 완료 |
| 동일 면 이종 극성 플레이트 단락 위험 | 원칙 30 비교차 검사(checkPlanarNoCrossing) |
| 설계자가 일부 그룹을 수동으로 고정하고 싶음 | 부분 고정 탐색(Pinned Groups) + 비연속 고정(Sparse) |

### 1.2 핵심 개념 용어

| 기호 | 의미 | 단위 |
|---|---|---|
| S | 직렬 그룹 수 | 개 |
| P | 그룹당 병렬 셀 수 | 개 |
| N = S×P | 총 셀 수 | 개 |
| pitch | 인접 셀 중심 간 거리 (= cell_d, gap=0) | mm |
| m_distinct | 팩 전체 니켈 플레이트 형상 종수 | 개 |
| G_i | i번째 그룹 (i=0: B+, i=S-1: B-) | — |
| ICC | Industrial Compactness Constraint (5대 제약) | — |
| SFMT | Symmetry-First Minimum-Type 알고리즘 | — |

---

## 2. 시스템 아키텍처

### 2.1 4-파일 런타임 구조

```
battery_pack_renderer.html   ← 진입점 (UI HTML)
    │
    ├── src/gen-math.js       ← LAYER 3: 수학 기초 (순수 함수)
    ├── src/gen-layout.js     ← LAYER 3: 레이아웃·패턴 (순수 함수)
    ├── src/gen-enum.js       ← LAYER 3: 열거기 (그룹 배정 핵심)
    ├── src/pentomino_tiling.js ← LAYER 3: DLX 폴리오미노 타일러
    ├── src/generator.js      ← LAYER 3: SFMT 파이프라인 Facade
    │
    ├── src/renderer.js       ← LAYER 4: SVG 렌더링 엔진
    │
    ├── src/app-state.js      ← UI: 전역 상태
    ├── src/app-ui.js         ← UI: 컨트롤 이벤트
    ├── src/app-render.js     ← UI: 렌더 파이프라인
    ├── src/app-panel.js      ← UI: 후보 카드 패널
    │
    └── src/enum-worker.js    ← Web Worker: 병렬 그룹 배정 탐색
         (번들: enum-worker-bundle.js + enum-worker-init.js)
```

### 2.2 모듈 의존성 그래프

```
gen-math.js ──────────────────────┐
gen-layout.js ────────────────────┤
pentomino_tiling.js ──────────────┤──► gen-enum.js
                                   │
gen-math.js ─────────────────────┐ │
gen-layout.js ───────────────────┤ │
gen-enum.js ─────────────────────┤─┴─► generator.js (Facade)
                                  │
                                  └──► renderer.js
                                         └──► app-render.js
```

### 2.3 이중 런타임 지원

모든 계산 모듈은 **Node.js**(테스트)와 **브라우저**(프로덕션) 양쪽에서 실행된다.

```js
// 환경 감지 패턴 (모든 gen-*.js 공통)
const _isNode = typeof require !== 'undefined' && typeof module !== 'undefined';
const _math = _isNode ? require('./gen-math') : (global._GenMath || {});

// 브라우저: window._GenMath, Node: module.exports 동시 지원
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
} else {
  global._GenMath = _exports;
}
```

### 2.4 JSON 스펙 파일 3종

| 파일 | 역할 |
|---|---|
| `skills/design_spec.json` | SFMT 11개 스텝 함수 매핑 (entry_fn, call_order) |
| `skills/principles_spec.json` | 30개 원칙 메타데이터 |
| `state/feature_list.json` | F01~F36 기능 구현 상태 (passes: true/false) |

---

## 3. 수학적 기초

### 3.1 피치 추정 — `estimatePitch(cells)`

셀 쌍 중 **양수 최소 유클리드 거리**를 피치로 사용한다.

$$\text{pitch} = \min_{\substack{i < j \\ d_{ij} > 0}} \| \mathbf{c}_i - \mathbf{c}_j \|_2$$

여기서 $\mathbf{c}_i = (x_i, y_i)$는 셀 $i$의 중심 좌표.

**근거**: gap=0 맞닿음 배치(원칙 6)에서는 인접 셀이 항상 최근접 쌍이므로 전수 탐색 없이도 정확하다. 비정형(커스텀) 배열에도 동일하게 적용된다.

```js
function estimatePitch(cells) {
  let minDist = Infinity;
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const d = Math.hypot(cells[i].x - cells[j].x, cells[i].y - cells[j].y);
      if (d > 0 && d < minDist) minDist = d;
    }
  return minDist === Infinity ? 1 : minDist;
}
```

시간 복잡도: O(N²), N = 셀 수. 실제 팩(N≤100)에서는 무시할 수 있다.

---

### 3.2 인접성 판정 — `buildAdjacency(cells, arrangement, pitch)`

두 셀이 "인접"한지 판정하는 임계값은 배열 방식에 따라 다르다.

| 배열 방식 | 임계값 수식 | 물리적 의미 |
|---|---|---|
| square (정배열) | thr = pitch × 1.05 | 4-이웃(상하좌우), 대각 거리 ≈ 1.41P 제외 |
| staggered (엇배열) | thr = pitch × 1.05 | hex 6-이웃 모두 포함 (hex 대각 = P) |
| custom (비 스태거) | thr = pitch × 1.05 | 동일 행 인접만 허용 |
| custom (스태거) | thr = pitch × 1.2 | hex 대각 ≈ 1.118P 허용 |

인접 엣지 집합:
$$E = \{ (i,j) \mid i < j, \, \|\mathbf{c}_i - \mathbf{c}_j\|_2 \leq \text{thr} \}$$

---

### 3.3 캐노니컬 서명 — `canonicalSig(points, rotSteps)`

같은 금형으로 찍을 수 있는 형상을 동일하게 인식하기 위한 **정규 표현(canonical form)**.

원칙 12(엠보 불가역성)에 따라 **회전만 동등**, 거울반사는 별개 형상으로 처리한다.

$$\sigma(\text{set}) = \min_{k \in 0 \ldots \text{rotSteps}-1} \text{sort}\!\left( R_{2\pi k/\text{rotSteps}}(\text{set}) \right)$$

$R_\theta$는 2D 회전 행렬:
$$R_\theta = \begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix}$$

- **정배열**: rotSteps = 4 (0°·90°·180°·270°)
- **엇배열**: rotSteps = 6 (0°·60°·120°·180°·240°·300°)

구현에서는 centroid를 원점으로 이동 후 각 회전 결과를 JSON 직렬화하여 사전식 최솟값을 서명으로 사용한다.

---

### 3.4 대칭군 탐지 — `detectSymmetryGroup(ctx)`

팩 전체 셀 집합의 **회전 대칭 차수** k를 탐지한다.

정의: 점 집합 S가 무게중심 c 기준 $2\pi/k$ 회전에 대해 닫혀 있으면(공차 tol = pitch × 0.15) 차수 k의 회전 대칭.

```
검사 순서 (높은 차수 우선):
  square    → k ∈ {4, 2}
  staggered → k ∈ {6, 3, 2}
  custom    → k ∈ {6, 4, 3, 2}
```

수학적으로: 각 점 $\mathbf{p} \in S$에 대해 회전 영상 $R_{2\pi/k}(\mathbf{p} - \mathbf{c}) + \mathbf{c}$가 S의 어떤 점과 공차 내에 있으면 OK.

이 정보는 SFMT Step B(합동 쌍 열거)의 입력이 된다.

---

### 3.5 그룹 형상 품질 점수 — `groupQualityScore(cells, edges)`

그룹의 제조 적합성을 나타내는 정수 점수.

| 조건 | 점수 | 물리 의미 |
|---|---|---|
| 컴팩트 2D 클러스터 (bbox 충진율 ≥ 0.75) | **+10** | 최적: 정사각형 근접 블록 |
| 순수 I형 (모든 셀이 단일 축 직선) | **0** | 허용: 1자 스트립 |
| 단순 체인 (L·S·U·Z·W·V·N) | **0** | 허용: 굴절 경로 |
| 사이클 없는 T/Y/X 분기 (degree≥3) | **−10** | 기피: 돌기형 (전류 집중) |

컴팩트 판정:
$$\text{fillRatio} = \frac{|\text{cells}|}{w_\text{bbox} \times h_\text{bbox}} \geq 0.75$$

---

### 3.6 컴팩트 형상 점수 — `compactShapeScore(groupCells, pitch, arrangement)`

연속적 컴팩트 척도로, 후보 정렬 tie-break에 사용된다.

$$S(G) = 10 \cdot D \cdot \sqrt{A} - 10 \cdot \sigma$$

| 항 | 정의 | 범위 |
|---|---|---|
| D (밀도) | $\|G\| / (w_\text{cells} \times h_\text{cells})$ | [0, 1] |
| A (종횡비 품질) | $\min(w, h) / \max(w, h)$ | (0, 1] |
| σ (돌기 페널티) | T/Y 분기 있고, D < 0.95이며, 사이클 없으면 1 | {0, 1} |

$S(G)$의 이론 범위: 약 [−10, +10].

---

### 3.7 교차 검사 — `checkPlanarNoCrossing(groups, thr)`

**원칙 30**: 동일 면(상면 또는 하면)에 배치된 서로 다른 플레이트의 인접선이 교차하면 단락 → 즉시 폐기.

알고리즘:
1. 원칙 14 패턴으로 상면·하면 플레이트를 각각 구성
2. 각 플레이트의 인접 엣지 집합 $E_p$ 계산 (거리 ≤ thr²)
3. 서로 다른 두 플레이트 $p_1, p_2$의 모든 엣지 쌍에 대해 **proper intersection** 검사

proper intersection (끝점 공유 제외):
$$d_1 = \text{cross}(C \to D, A), \quad d_2 = \text{cross}(C \to D, B)$$
$$d_3 = \text{cross}(A \to B, C), \quad d_4 = \text{cross}(A \to B, D)$$
$$\text{intersect} \Leftrightarrow (d_1 \cdot d_2 < 0) \land (d_3 \cdot d_4 < 0)$$

cross product: $\text{cross}(\mathbf{p}_1 \to \mathbf{p}_2, \mathbf{q}) = (p_{2x}-p_{1x})(q_y-p_{1y}) - (p_{2y}-p_{1y})(q_x-p_{1x})$

---

### 3.8 경계 셀 집합 — `calcBoundarySet(cells, side)`

B+/B− 배치 방향(원칙 4)에 따른 경계 셀 집합.

공차 tol = pitch × 0.5를 사용하여 부동소수점 오차를 흡수한다.

| 방향 | 조건 |
|---|---|
| left  | $x \leq x_\min + \text{tol}$ |
| right | $x \geq x_\max - \text{tol}$ |
| top   | $y \leq y_\min + \text{tol}$ |
| bottom| $y \geq y_\max - \text{tol}$ |

커스텀 배열 전용 `calcCustomBoundarySet()`은 **행별 좌우 극단 셀**을 사용한다(전역 min/max 아님). 이유: 커스텀 배열에서는 행 오프셋이 있어 전역 x_min이 특정 행에만 해당할 수 있다.

---

### 3.9 홀더 그리드 좌표 — `buildHolderGrid(hRows, hCols, pattern, emptyCells, params, cellSpec)`

물리적 셀 중심 좌표를 계산한다 (LAYER 3 H1).

**정배열(square)**:
$$x_{r,c} = \text{margin} + c \cdot \text{pitch} + R$$
$$y_{r,c} = \text{margin} + r \cdot \text{pitch} + R$$

**엇배열(staggered)**:
$$x_{r,c} = \text{margin} + (r \bmod 2) \cdot \frac{\text{pitch}}{2} + c \cdot \text{pitch} + R$$
$$y_{r,c} = \text{margin} + r \cdot \text{pitch} \cdot \frac{\sqrt{3}}{2} + R$$

(hex 밀집 배치: 행 간격 = pitch × √3/2)

빈 슬롯(emptyCells)은 `Set<"r,c">` 로 O(1) 조회.

---

### 3.10 커스텀 배열 좌표 — `calcCustomCenters(rows, p, cellSpec)`

행별 셀 수 배열 `rows = [n₁, n₂, …]`로부터 좌표 계산.

**정렬 오프셋** (align ∈ {left, center, right}):
$$\text{alignOff}_r = \begin{cases} 0 & \text{(left)} \\ (n_\max - n_r) \cdot \text{pitch} & \text{(right)} \\ (n_\max - n_r) \cdot \text{pitch} / 2 & \text{(center)} \end{cases}$$

**엇배열(custom_stagger) 오프셋**:
- `stagger_dir='R'`: 홀수 행(하단 기준) `stagOff = +pitch/2`
- `stagger_dir='L'`: 홀수 행 `stagOff = -pitch/2` + leftPad = pitch/2 좌측 여백 추가

행별 row_offsets 파라미터로 임의 수평 이동도 지원한다.

전체 패키지 크기:
$$W = x_\max + R + \text{margin}, \quad H = \text{margin} \times 2 + (n_\text{rows}-1) \cdot \text{pitchY} + 2R$$

---

## 4. 그룹 배정 알고리즘 파이프라인

N개의 셀을 S개의 그룹으로 배정하는 문제는 원칙 체계 상의 제약(원칙 1·8·9·21·28·30 등)을 만족하는 **유효 후보(candidate)**를 찾는 조합 최적화 문제다.

### 4.1 전체 파이프라인 개요

```
입력: cells[], S, P, arrangement, b_plus_side, b_minus_side, ICC 설정

Phase 1: 표준 배열 4종 (O(N), 결정론적)
  └─ 보스트로페돈 L→R / R→L
  └─ 열 우선 L→R / R→L

Phase 4: DLX 폴리오미노 타일링 (P≥2, N≤50, 1.5초 제한)
  └─ 정확한 커버 문제(Exact Cover)로 변환 후 Dancing Links 탐색

Phase 2: 백트래킹 (arrangement=custom 또는 N≤18)
  ├─ BFS Greedy (MRV 휴리스틱, 1회 결정론적)
  ├─ Beam Search (width=5, 4 프리셋, 10초 제한)
  └─ DFS 체이닝 (인접 우선, 시간 예산 내)

출력: 후보 배열, B+/B- 충족 순 → m_distinct 오름차순 → ICC 위반 오름차순 → 점수 내림차순
```

---

### 4.2 Phase 1: 표준 배열 4종

두 가지 순서 전략 × 2방향 = 4종의 결정론적 배열.

**보스트로페돈(Boustrophedon)**:  
행 우선 지그재그 스캔. 짝수 행은 L→R, 홀수 행은 R→L. 고대 그리스 문자 방향에서 유래한 이름.

```
행 0: ← 1 2 3 4 5 →
행 1: → 10 9 8 7 6 ←
행 2: ← 11 12 13 14 15 →
...
```

**열 우선(Column-First)**:  
열 단위로 위→아래 스캔. L→R 또는 R→L.

각 순서의 셀 배열을 `[G0 cells | G1 cells | … | G(S-1) cells]`로 분할하면 하나의 후보가 된다.

---

### 4.3 Phase 4: DLX 폴리오미노 타일링

**문제 정의**: N = S×P개 셀을 S개의 P-셀 폴리오미노로 정확히 분할(exact cover).

**Dancing Links (DLX)**: Knuth의 Algorithm X를 원형 이중 연결 리스트로 구현한 백트래킹 알고리즘. 행(후보 그룹)과 열(셀 인덱스)로 이루어진 희소 이진 행렬에서 모든 열을 정확히 1회 커버하는 행 집합을 탐색한다.

| DLX 입력 | 의미 |
|---|---|
| 행(row) | P개 셀의 연결 부분집합 하나 (폴리오미노 후보) |
| 열(column) | 개별 셀 인덱스 (0 ~ N-1) |
| 목표 | 각 열을 정확히 1회 포함하는 S개 행 선택 |

**포함 후처리 필터**:
- 원칙 28③ 연결성 (renderThr 기준)
- 원칙 30 비교차

**시간 제한**: 기본 1500ms. 초과 시 이미 찾은 후보만 반환.

---

### 4.4 Phase 2: BFS Greedy (MRV 휴리스틱)

커스텀 배열에서 DFS가 탐색 공간 폭발로 0개를 반환하는 문제를 해결하기 위한 **탐욕(greedy) 1회 탐색**.

알고리즘:
1. x 오름차순 스캔 순서로 B+ 경계 셀을 G0 시작점으로 시도
2. 각 그룹에서 P개 셀을 BFS 확장으로 수집
3. 다음 셀 선택 기준: **MRV (Minimum Remaining Values)** — 미사용 이웃이 가장 적은 셀을 먼저 선택 (탐색 공간을 조기에 수렴)
4. step 2 (group.length=1): 같은 행 후보 우선 (수평 확장 선호)
5. step P-1: I형 완성 방지 (선형 그룹 기피)

결과: 결정론적 1개 후보. 이후 DFS로 추가 후보를 탐색한다.

---

### 4.5 Phase 2: Beam Search

너비 w=5의 빔 서치로 BFS Greedy보다 다양한 후보를 탐색한다.

**4개 프리셋 가중치**:

| 프리셋 | wH | wV | wD | wC | wS | 특성 |
|---|---|---|---|---|---|---|
| HORIZ_FIRST | 1.0 | 0.5 | 0.3 | 1.0 | 0.8 | 수평 확장 우선 |
| VERT_FIRST  | 0.5 | 1.0 | 0.3 | 1.0 | 0.8 | 수직 확장 우선 |
| COMPACT     | 0.8 | 0.8 | 0.4 | 2.0 | 1.0 | 컴팩트 블록 |
| SHAPE_MATCH | 0.7 | 0.7 | 0.3 | 1.2 | 2.0 | 이전 그룹 형상 일치 |

**셀 점수 함수** (후보 셀 c에 대해):
$$\text{score}(c) = w_H H + w_V V + w_D D + w_C C + w_S M - p_\text{iso} I - p_\text{icc} X$$

| 항 | 의미 |
|---|---|
| H | 직전 셀과 같은 행이면 1 |
| V | 직전 셀과 x 좌표 동일(±0.1P)이면 1 |
| D | 대각선 이동이면 1 |
| C | 그룹 무게중심 접근도 (1 − 거리/pitch, [0,1]) |
| M | 이전 그룹 bbox 종횡비와의 일치도 (exp(−Δaspect)) |
| I | 미사용 이웃 0개(고립 위험)이면 1 |
| X | I형 체인 완성이면 1 |

각 G 단계에서 상위 w개 빔 상태를 유지하며 진행한다.

---

### 4.6 Phase 2: DFS 체이닝

정배열(N≤18)과 커스텀 배열 모두에서 비표준 해를 탐색하는 완전 DFS.

**핵심 가지치기**:
1. **ICC 가지치기**: 부분 그룹 완성 즉시 ICC① (rowSpan≤2) · ICC② (ratio≤2.0) 검사
2. **I형 완성 방지**: 마지막(P-1번째) 셀 선택 시 I형이 완성되는 셀 제거
3. **B− 경계 강제**: 마지막 그룹(G(S-1))은 반드시 B− 경계 셀 포함
4. **시간 예산**: `budget_ms`로 탐색 시간 제한 (기본: custom=10초, square=무제한)

**후보 기록 정책 (우선순위 축출)**:
- max_candidates 이하: 직접 추가
- 초과 시: 현재 후보 집합에서 `worst`를 찾아 새 후보가 더 좋으면 교체
- worst 기준: B+/B- 미충족 > m_distinct 크기 > ICC 위반 > 점수 낮음

---

### 4.7 부분 고정 탐색 — `pinned_groups`

G0 ~ G(k-1)을 사용자가 수동으로 지정하고, G(k) ~ G(S-1)만 DFS로 탐색.

```
입력: pinned_groups = [ [{row,col},…] × k개 ]
처리:
  1. row,col → cellIdx 변환 (rcIdxMap)
  2. B+ 그룹을 앞으로, B- 그룹을 뒤로 정렬 (자동 재배열)
  3. 고정 그룹 전체를 used[] = 1로 마킹
  4. 마지막 고정 그룹의 인접 셀에서 G(k)로 DFS 시작
```

**원칙 21B 자동 검증**: 인접 그룹 쌍 사이 인접 셀이 없으면 해당 고정 배치 자체가 유효하지 않으므로 탐색 생략.

---

### 4.8 비연속 고정 탐색 — `pinned_groups_sparse`

임의 인덱스의 그룹을 고정. 예) G0·G11·G12 고정 → G1~G10만 DFS.

```
입력 형식:
  [{groupIdx: 0,  cells: [{row,col}…]},
   {groupIdx: 11, cells: [{row,col}…]},
   {groupIdx: 12, cells: [{row,col}…]}]

사전 마킹:
  - sparse 핀 셀 전체: used[ci] = 2 (예약)
  - G0이 sparse 핀이면: B+ 경계 확인 후 useSparsePin(0) 직접 진입
  - G0이 자유이면: B+ 셀에서 DFS 시작, sparse 핀 그룹에 도달 시 useSparsePin() 호출

useSparsePin(gIdx, snapGroups):
  1. 직전 그룹과 P21B 인접 확인
  2. ICC 체크
  3. 다음 그룹이 또 sparse 핀이면 재귀 호출
  4. 아니면 DFS 재개
```

---

### 4.9 후보 정렬 기준

최종 후보 집합을 다음 기준으로 오름차순 정렬:

```
1순위: B+/B- 충족 여부 (충족=0, 미충족=1)
2순위: m_distinct (금형 종수, 낮을수록 우선)
3순위: icc_violations (ICC 위반 수)
4순위: total_score 내림차순 (그룹 품질 점수 합계)
5순위: compactShapeScore 합계 내림차순
```

---

## 5. 병렬 연산 설계

### 5.1 왜 병렬인가

커스텀 배열에서 S=13, P=4인 경우 탐색 공간은 수천~수만 개의 G0 후보를 순차적으로 처리해야 한다. 단일 스레드에서 10분이 걸릴 탐색을 여러 Worker에 분산하여 수십 초로 단축한다.

### 5.2 병렬 전략: G0 고정 분할

```
메인 스레드 (enumerate_g0_only=true):
  └─ G0(또는 첫 자유 그룹) 후보 목록 수집 (최대 500개, 5초)
      → g0Configs = [[idx1,idx2,…], …]

Worker 풀 (navigator.hardwareConcurrency):
  각 Worker에 g0Configs 균등 분할 배정
  Worker i: g0Configs[i×chunk … (i+1)×chunk] 처리
    └─ 각 G0 후보 고정 후 G1~G(S-1) DFS
    └─ 결과 candidates[] 메인으로 postMessage

메인 스레드:
  └─ 모든 Worker 결과 합산
  └─ 중복 제거(sig 기준)
  └─ 최종 정렬
```

### 5.3 Worker 메시지 프로토콜

**메인 → Worker**:
```js
{
  params: { S, P, b_plus_side, b_minus_side, icc1, icc2, icc3, ... },
  cells: [{x, y, row, col}],
  pitch: number,
  g0Configs: [[cellIdx…]…],   // 이 Worker가 처리할 G0 후보 슬라이스
  budgetMs: number,            // 전체 시간 예산
  budgetPerG0: number,         // G0당 시간 예산
  pinnedCellIdxGroups: [...],  // pinned 모드
  pinnedCellIdxGroupsSparse: [...], // sparse 모드
  sparseFirstFreeIdx: number,  // sparse: 첫 자유 그룹 인덱스
}
```

**Worker → 메인**:
```js
{ candidates: [...], count: number }
```

### 5.4 Sparse 고정 탐색 병렬화

Sparse 핀 모드에서는 "첫 자유 그룹 Gk" 후보를 분할 기준으로 사용.

```
1단계: enumerate_g0_only + pinned_groups_sparse →
       첫 자유 그룹 Gk 후보 목록 반환
       (반환 필드: g0_configs, sparse_first_free_idx)

2단계: Gk 후보를 Worker들에 분산
       Worker i: 기존 sparse 핀 + Gk 고정 후 나머지 DFS
```

### 5.5 폴백 동작

- g0Configs = [] (G0 후보 없음): 단일 Worker가 전체 탐색 (g0_enum_only 모드 불필요)
- Worker 생성 실패: 메인 스레드에서 직접 `enumerateGroupAssignments()` 호출

---

## 6. 원칙 체계 (Principles v8)

30개 이상의 원칙이 4개 레이어로 구성된다.

### 6.1 레이어 개요

| 레이어 | 명칭 | 원칙 번호 | 위반 시 |
|---|---|---|---|
| **0** | 절대 불변 법칙 | 1·6·8·9·26·28·29·30 | 설계 즉시 폐기 |
| **1** | 설계 선행 결정 | 4·17 | 형상 생성 불가 |
| **2** | 룰 | 7·10·12·14·16·21·25·27 | 패스/페일 이진 체크 |
| **3** | 스킬 | 2·13·15·18·22·23·24 | 알고리즘 실행 |
| **4** | 렌더링 룰 | 3·5·11·19·20 | 표시 문제 |

---

### 6.2 LAYER 0 — 절대 불변 법칙

**원칙 1 — 극성 불변**  
셀 상면(+)·하면(−) 관계는 절대 불변. 위반 시 단락.

**원칙 6 — 맞닿음 불변**  
gap = 0. pitch = cell_d. 셀과 셀이 항상 맞닿음.

**원칙 8 — 셀 수 불변**  
N = S×P는 설계 확정 시 불변. 각 그룹 Gi는 항상 P개 셀.

**원칙 9 — 인접성 절대 규칙**  
점프(셀 건너뜀) 절대 금지.
- 정배열: 4-이웃 (상하좌우)
- 엇배열: 6-이웃 (hex)
- 커스텀: 거리 기반 임계값 (비 스태거 1.05P, 스태거 1.2P)

**원칙 26 — 직렬 경로 단일성**  
G0–G1–…–G(S-1)의 단순 체인. 분기·루프·우회 금지.

**원칙 28 — P/2P/P 셀 수·연결성 불변**
```
플레이트 #1:       P개 셀 (B+ 터미널)
플레이트 #2 ~ #S:  2P개 셀 (브리지)
플레이트 #(S+1):   P개 셀 (B- 터미널)
총 S+1개 플레이트
```
각 플레이트는 BFS 연결 필수. renderThr = pitch×1.05 (비 스태거) or pitch×1.2 (스태거) 정합성 강제.

**원칙 29 — 그룹 내 병렬 극성 일관성**  
그룹 내 P개 셀은 동일 극성(단극성). 혼합 극성 → 판 내 단락 → 열폭주.

**원칙 30 — 동일 면 이종 플레이트 비교차**  
동일 면 플레이트 간 인접선의 proper intersection 절대 금지. 교차 = 금속판 직접 접촉 = 대전류 단락.

---

### 6.3 LAYER 1 — 설계 선행 결정

**원칙 4 — B+·B- 출력 방향 선결**  
출력 방향 결정 → 경계 셀 집합 도출(`calcBoundarySet`) → G0/G(S-1) 배정 제한.

2단계 결정 구조:
1. `b_plus_side` / `b_minus_side` ∈ {top, bottom, left, right}
2. `calcBoundarySet(cells, side)` → G0/G(S-1) 후보 집합 제한

**원칙 17 — 3-way 배열 선택 + 3레벨 계층**

| 레벨 | 파라미터 | 구현 함수 |
|---|---|---|
| Level 1 (물리 홀더) | holder_rows × holder_cols | `buildHolderGrid()` |
| Level 2 (B+/B- 방향) | b_plus_side / b_minus_side | `calcBoundarySet()` |
| Level 3 (그룹 배정) | 자동 탐색 | `enumerateGroupAssignments()` |

---

### 6.4 LAYER 2 — 룰

**원칙 7** — 니켈 두께 = nickel_w (세로·가로 동일)

**원칙 10** — 니켈 형태 사다리(ladder) 구조  
- 정배열: 수직 스파인 + 수평 브리지  
- 엇배열: 원칙 23 hex 클러스터  
- 커스텀: 원칙 18 인접 셀 spanning tree

**원칙 12** — 엠보 불가역성  
뒤집기 불가 → 거울반사 = 별개 형상 → 별도 금형

**원칙 14** — 면별 병합 불변
```
상면: [G0] [G1∪G2] [G3∪G4] … [G(S-1)] (S짝수)
하면: [G0∪G1] [G2∪G3] … [G(S-1)] (S홀수)
```

**원칙 16** — ICC 5대 제약 (SFMT Step C 하드 제약)
1. 행 스팬 ≤ 2
2. 종횡비 ≤ 2.0
3. 볼록성 ≥ 0.75
4. 동일 면 이종 플레이트 비교차, 에지 간격 ≥ δ_min (≥ nickel_w/2)
5. 합동 쌍 대칭 배치

엇배열 재해석: hex row 기반 행 스팬, hex convex hull 기반 볼록성.

**원칙 21** — 그룹 형태 유효성
- 조건 A: 그룹 내 셀 BFS 연결
- 조건 B: Gi ↔ G(i+1) 인접 쌍 ≥ 1개

**원칙 25** — B+/B- 단자탭 기하학  
탭 폭 = nickel_w, 탭 길이 = tab_len, 탭 방향 = 이종 극성 방향 제외

**원칙 27** — m_distinct 계산 기준
- 회전 동등 (정배열 4회전, 엇배열 6회전)
- 거울 비동등 (엠보 불가역)
- 교차면 동등 (상면→하면 재사용 가능하면 1종으로 계산)
- 목표: m_distinct ≥ 2 (이론 최솟값)

---

### 6.5 LAYER 3 — 스킬

**원칙 2** — 직렬·병렬·혼합 연결 설계 지원

**원칙 13** — 사각 정배열 컬럼 파티션 최적성 정리

$$m_\min = \begin{cases} 1 & S \text{ 짝수, square} \\ 2 & S \text{ 홀수, square} \\ \lceil(S+1)/2\rceil + 1 & \text{staggered/custom} \end{cases}$$

**원칙 15** — SFMT (Symmetry-First Minimum-Type) 알고리즘

| Step | 함수 | 내용 |
|---|---|---|
| A | `detectSymmetryGroup()` | 팩 회전 대칭군 탐지 |
| B | `enumerateCongruentPairs()` | 회전 대칭으로 매핑되는 그룹 쌍 열거 |
| C | `buildPairFirst()` | ICC 하드 제약 + 합동 쌍 고정 후 나머지 백트래킹 |
| D | `minimizeShapeCount()` | m_distinct 최솟값 후보만 선택 |

이론 하한: $m_\text{distinct} \geq \lceil (\text{plates}-1) / k_\text{local} \rceil + 1$

**원칙 18** — 커스텀 배열 니켈 형상: 인접 셀 BFS spanning tree + 원형 배경

**원칙 22** — BMS 최단 맨해튼 거리 기준 후보 선택

**원칙 23** — 엇배열 hex 클러스터: hex 6-이웃 BFS spanning tree

**원칙 24** — 그룹 번호 부여 순서
- square/staggered: 보스트로페돈(행 우선 지그재그)
- custom: BFS (B+ 기점, x 오름차순 이웃 확장)

---

### 6.6 LAYER 4 — 렌더링 룰

**원칙 3** — 셀 심볼: + 단자 = 빨강 테두리 + 빨강 캡(φ10mm), − 단자 = 검정 테두리 + 중앙 점

**원칙 5** — 니켈 색상: 회색 #888888 (stroke #555555)

**원칙 11** — 양면(상면+하면) 동시 표시. 면 간격 = gap_section px

**원칙 19** — 표시 필터: ICC 위반 후보 표시 제어

**원칙 20** — 금형 수 최소화 목적 함수:
$$\text{cost} = m_\text{distinct} \times \text{₩20M} + N_\text{plates} \times \text{₩300} + m_\text{distinct} \times \text{₩5M/년}$$

---

## 7. 렌더링 시스템

### 7.1 SVG 렌더링 파이프라인

```
renderer._renderSVG(params) 진입
    │
    ├── 1. 셀 좌표 계산
    │     ├── square/staggered: calcCellCenters(S, P, params)
    │     └── custom: Generator.calcCustomCenters(rows, params, CELL_SPEC)
    │
    ├── 2. 그룹 배정 결과 가져오기
    │     └── _enumResult (enumerateGroupAssignments 캐시)
    │
    ├── 3. 니켈 패턴 결정
    │     └── calcNickelPattern(S) → {top:[], bot:[]}
    │
    ├── 4. 상면 그리기 (drawFace 'top')
    │     ├── 셀 심볼 (drawCell × N)
    │     ├── 니켈 플레이트 (drawNickelI / drawNickelU per plate)
    │     └── 단자탭 (drawTerminal)
    │
    ├── 5. 하면 그리기 (drawFace 'bottom')
    │
    └── 6. SVG 문자열 반환
```

### 7.2 셀 좌표계

렌더링 좌표계는 **픽셀 스케일**을 사용한다 (`scale` 파라미터, 기본 4.0).

```
픽셀 좌표 = mm 좌표 × scale
예) 21700 셀: render_d = 22mm, scale=4 → 픽셀 지름 = 88px
```

### 7.3 셀 배치 수식 (정배열)

$$x_{g,p} = \text{margin} + g \cdot \text{pitch} + R$$
$$y_{g,p} = \text{margin} + p \cdot \text{pitch} + R$$

엇배열:
$$x_{g,p} = \text{margin} + g \cdot \text{pitch} + R + \begin{cases} \text{pitch}/2 & p \bmod 2 = 1 \\ 0 & \text{otherwise} \end{cases}$$
$$y_{g,p} = \text{margin} + p \cdot \text{pitch} \cdot \frac{\sqrt{3}}{2} + R$$

### 7.4 셀 극성 규칙

그룹 인덱스 g의 상면 극성:
$$\text{polarity}(g, \text{top}) = \begin{cases} + & g \bmod 2 = 0 \\ - & g \bmod 2 = 1 \end{cases}$$

하면은 반전: $\text{polarity}(g, \text{bottom}) = -\text{polarity}(g, \text{top})$

이것이 직렬 배터리 연결의 교번 극성을 SVG로 표현하는 방법이다.

### 7.5 니켈 플레이트 그리기

**I형 플레이트** (단독 그룹 P개 셀):  
- 수직 스파인: y_min ~ y_max, 폭 nickel_w
- 수평 브리지 P개: 각 셀 y좌표, 폭 nickel_w

**U형 플레이트** (인접 두 그룹 2P개 셀):  
- 두 그룹의 인접 셀 쌍을 찾아 spanning tree로 연결
- 커스텀 배열: BFS spanning tree (buildStrokeGraph)
- stroke-width = nickel_w, stroke-linecap = round

### 7.6 커스텀 배열 렌더 (`renderCustomRows`)

커스텀 배열에서는 그룹 배정이 사전 계산된 `_enumResult`에서 가져온다.

극성 결정은 순번 기반이 아닌 **그룹 배정(groupCells) 직접 참조** (원칙 29② cellGrpIdx 패턴):

```js
const cellGrpIdx = new Map();  // 셀좌표 → 그룹인덱스
for (let g = 0; g < groups.length; g++)
  for (const c of groups[g].cells)
    cellGrpIdx.set(`${c.x},${c.y}`, g);
// 렌더 시: polarity = cellGrpIdx.get(key) % 2 === 0 ? '+' : '-'
```

---

## 8. 비용 모델 & 목적 함수

### 8.1 금형 비용 모델 (원칙 20)

$$\text{TotalCost} = m_\text{distinct} \times C_\text{mold} + N_\text{plates} \times C_\text{material} + m_\text{distinct} \times C_\text{sku}$$

| 항 | 기본값 |
|---|---|
| $C_\text{mold}$ (금형 1종) | ₩20M |
| $C_\text{material}$ (플레이트 1장) | ₩300 |
| $C_\text{sku}$ (형상 1종 SKU 관리) | ₩5M/년 |

예시: 13S5P, m_distinct=6 → 금형 ₩120M + SKU ₩30M/년

### 8.2 목적 함수 가중치 (원칙 20)

```js
OBJECTIVE_WEIGHTS = {
  m_distinct:   1_000_000,  // 최우선 (₩M 단위 반영)
  icc_rowspan:        100,
  icc_aspect:          50,
  bms_manhattan:       10,
  hamilton_cost:        1,
}
```

### 8.3 m_min 이론 하한 (원칙 13)

$$m_\min = \begin{cases}
1 & \text{square, S 짝수} \\
2 & \text{square, S 홀수} \\
\max\!\left(2,\, \lceil(S+1)/2\rceil + 1\right) & \text{staggered/custom}
\end{cases}$$

**증명 스케치 (square, S 짝수)**:  
컬럼 P×1 폴리오미노는 모두 합동(회전 동등) → m_distinct = 1 달성 가능.  
S 홀수이면 양 끝 단독 I형 플레이트가 U형과 합동 불가 → m_distinct ≥ 2.

### 8.4 재사용률

$$\text{reuseRatio} = \frac{N_\text{plates}}{m_\text{distinct}}$$

m_distinct = 1인 S짝수 square 배열에서 최대치 달성: 모든 플레이트를 동일 금형으로 제작.

---

## 9. 데이터 흐름 & API 계층

### 9.1 사용자 입력 → SVG 출력

```
[사용자 입력]
  cell_type, S, P, arrangement, rows(custom),
  b_plus_side, b_minus_side, icc1/2/3,
  pinned_groups, search_budget_ms

     │
     ▼
[app-render.js: _runCustomSearch() / _runSearch()]
  1. 셀 좌표 계산 (Generator.calcCustomCenters or calcCellCenters)
  2. G0 후보 열거 (enumerate_g0_only=true → Worker 분할)
  3. Worker 풀 생성 및 g0Configs 분배
  4. Worker 결과 수신 및 합산
  5. 중복 제거 + 정렬 + 패널 업데이트

     │
     ▼
[enumerateGroupAssignments()]
  Phase 1 (표준 4종) + Phase 4 (DLX) + Phase 2 (백트래킹)
  → candidates[]

     │
     ▼
[renderer._renderSVG(params)]
  선택된 candidate의 groups[]로 SVG 생성
  → HTML canvas 업데이트
```

### 9.2 주요 함수 위치 색인

| 함수 | 파일 | 역할 |
|---|---|---|
| `enumerateGroupAssignments()` | `src/gen-enum.js` | 그룹 배정 핵심 열거기 |
| `buildHolderGrid()` | `src/gen-enum.js` | 물리 홀더 그리드 좌표 |
| `calcBoundarySet()` | `src/gen-enum.js` | 경계 셀 집합 |
| `estimatePitch()` | `src/gen-math.js` | 피치 자동 추정 |
| `buildAdjacency()` | `src/gen-math.js` | 인접 엣지 목록 |
| `compactShapeScore()` | `src/gen-math.js` | 컴팩트 형상 점수 |
| `checkPlanarNoCrossing()` | `src/gen-math.js` | 원칙 30 교차 검사 |
| `canonicalSig()` | `src/gen-layout.js` | 캐노니컬 서명 (회전) |
| `calcNickelPattern()` | `src/gen-layout.js` | 상/하면 플레이트 패턴 |
| `calcCustomCenters()` | `src/gen-layout.js` | 커스텀 배열 좌표 |
| `sfmtSearch()` | `src/generator.js` | SFMT A→B→C→D 파이프라인 |
| `detectSymmetryGroup()` | `src/generator.js` | 회전 대칭군 탐지 |
| `_renderSVG()` | `src/renderer.js` | SVG 렌더링 엔진 |
| `populateCandidatePanel()` | `src/app-panel.js` | 후보 카드 UI |
| `_runCustomSearch()` | `src/app-render.js` | 병렬 탐색 오케스트레이터 |

### 9.3 상태 관리

모든 UI 상태는 `app-state.js`의 `state` 단일 객체에서 관리된다. 컴포넌트 간 공유 데이터:

```js
let lastSVG = '';          // 마지막 렌더 SVG 문자열
let _enumResult = null;    // 마지막 열거 결과 (후보 배열)
let _sortedCandidates = null; // 필터·정렬 적용 후 후보 배열
```

---

## 부록 A. 알고리즘 복잡도 요약

| 알고리즘 | 시간 복잡도 | 비고 |
|---|---|---|
| 피치 추정 | O(N²) | N ≤ 100 |
| 인접성 계산 | O(N²) | N ≤ 100 |
| 표준 배열 4종 | O(N) | 결정론적 |
| DLX 폴리오미노 | 지수 최악, 실제 1.5초 제한 | P-셀 exact cover |
| DFS 백트래킹 | 지수 최악, 시간 예산 제한 | max_candidates·budget_ms |
| Beam Search | O(w × S × N) | w=5, 4 프리셋 |
| 비교차 검사 | O(P_count² × E²) | P_count = 플레이트 수 |
| 캐노니컬 서명 | O(N_cells × rotSteps) | rotSteps ∈ {4, 6} |
| Worker 병렬화 | O(g0Count / W) × DFS | W = Worker 수 |

---

## 부록 B. 셀 규격

| 셀 타입 | 실제 직경 | 렌더 직경 | 기본 피치 | 최소 피치 |
|---|---|---|---|---|
| 18650 | 18.0 mm | 19.0 mm | 20.0 mm | 19.5 mm |
| 21700 | 21.0 mm | 22.0 mm | 23.0 mm | 22.5 mm |

gap = 0 (원칙 6), 따라서 pitch = render_d.

---

## 부록 C. 코드 품질 & 테스트

- **TDD 원칙 적용**: `skills/tdd-first.md` — RED-GREEN-REFACTOR 사이클
- **테스트 위치**: `tests/test_custom_render.js`
- **현재 테스트 상태**: 9/9 sparse TDD green + 9/9 consecutive 회귀 (총 18 green)
- **테스트 실행**: `node tests/test_custom_render.js`
- **Worker 번들 재생성**: `node scripts/build-worker-bundle.js` (gen-enum.js 수정 후 필수)

---

*이 문서는 Pack-Renderer 소스 코드에서 직접 추출된 기술 정보를 기반으로 작성되었습니다.*
