# Pack-Renderer 아키텍처 v7 — 4파일 체제 · 3종 JSON 스펙

> 목적: 원칙 v7(skills/ 폴더 3종 md)을 코드가 구조적으로 추종하도록 책임을 분리하고, md ↔ 코드 drift를 JSON 중간 표현으로 차단한다.
> 전제: CLAUDE.md의 레이어 구조(LAYER 0·1·2·3·4)를 파일 경계로 1:1 대응시킨다.
> 최종 업데이트: 2026-04-17 (v7 아키텍처 확정)

---

## 1. 설계 원칙

### 1.1 레이어 = 파일 경계

| md 파일 (원칙 v7) | 레이어 | 책임 영역 | 대응 코드 파일 |
|---|---|---|---|
| `skills/nickel_plate_principles.md` | 0 · 1 · 2 | 절대 법칙 · 선행 결정 · 룰 | `src/validator.js` (신규) |
| `skills/nickel-plate-design.md` | 3 | 알고리즘 · 형상 생성 | `src/generator.js` (신규) |
| `skills/nickel_render_rules.md` | 4 | SVG 렌더링 룰 | `src/renderer.js` (기존 수정) |
| — | — | UI · 상태 · 이벤트 | `src/app.js` (기존 수정) |

### 1.2 파일 간 의존 방향

```
app.js
  ↓ (render request)
validator.js  ──→  generator.js  ──→  renderer.js
  (LAYER 0·1·2)      (LAYER 3)        (LAYER 4)
       ↑                  ↑                  ↑
principles_spec.json  design_spec.json  render_spec.json
```

의존은 한 방향. renderer.js는 validator.js를 import하지 않는다. generator.js가 validator의 rule 엔진을 호출해 LAYER 0·1·2를 통과한 설계만 renderer에 넘긴다.

### 1.3 JSON 중간 표현의 실익

- md 원칙 추가 시: JSON 한 rule 추가 + validator/generator/renderer에 check 함수 1개 추가만 하면 적용.
- 회귀 테스트: `for (rule of spec.rules) runCheck(rule, ctx)` 루프로 자동화.
- 버전 관리: JSON의 `version` 필드로 md 버전과 lock-step.
- 금지: md 문구를 코드 상수에 하드코딩하는 패턴(현 renderer.js v0.3.1의 주석 쿼리문 상태).

---

## 2. 4파일 책임 경계 상세

### 2.1 src/validator.js (신규)

**입력**: 설계 후보 컨텍스트 `ctx = { S, P, cell_type, arrangement, rows, cell_centers, polarity_map, nickel_connections, group_topology, bms_side, tab_positions, ... }`

**출력**: `{ passed: bool, violations: [{rule_id, severity, detail}], warnings: [...] }`

**담당 원칙**: 1 · 4 · 6 · 7 · 8 · 9 · 10 · 12 · 14 · 16 · 17 · 21 · 25 · 26 (LAYER 0·1·2)

**핵심 구조**:

```js
const CHECKS = {
  checkPolarityInversion,       // P01
  checkContact,                  // P06
  checkCellCount,                // P08
  checkAdjacency,                // P09
  checkLadderStructure,          // P10
  checkEmbossIrreversibility,    // P12
  checkFaceMerging,              // P14
  checkICC,                      // P16 (δ_min·planar·행스팬·종횡비·볼록성)
  checkGroupValidity,            // P21
  checkTerminalTab,              // P25
  checkSeriesPathSingleness,     // P26
};

function runValidation(ctx, spec) {
  const out = { passed: true, violations: [], warnings: [] };
  for (const rule of spec.rules) {
    const fn = CHECKS[rule.check];
    if (!fn) continue;
    const r = fn(ctx, rule.params || {});
    if (!r.ok) {
      if (rule.fail_action === 'abort_design') out.passed = false;
      out.violations.push({ rule_id: rule.id, ...r });
    }
  }
  return out;
}
```

**LAYER 0 실패** → `passed: false` → 설계 즉시 폐기.
**LAYER 2 실패** → `fail_action: "prune_candidate"` → SFMT 탐색 중 가지치기만 수행. 최종 설계는 계속 진행.

### 2.2 src/generator.js (신규)

**입력**: `{ S, P, arrangement, rows, bms_side, cell_type, user_constraints }`

**출력**: `{ cell_centers, group_assignment, nickel_plates[], tab_positions, m_distinct, ranking_info }`

**담당 원칙**: 2 · 13 · 15 · 18 · 22 · 23 · 24 (LAYER 3)

**이관 대상(현 renderer.js에서)**:
- `canonicalSig()` (원칙 12 기반 서명)
- `calcNickelPattern()` (원칙 14 면별 병합)
- `selectBlockType()` (P→block type 라우팅)
- `calcTypeAGeometry()` (P=5 geometry)
- `buildSnakeLayout()` (원칙 24 보스트로페돈 번호 부여)

**이관 대상(현 app.js에서)**:
- `calcCustomCenters()` (커스텀 rows[] 좌표)
- `estimateMmin()` (원칙 13 근사)

**신규 함수**:
- `detectSymmetryGroup()` (원칙 15 Step A)
- `enumerateCongruentPairs()` (원칙 15 Step B)
- `buildStrokeGraph()` (원칙 18 stroke graph + spanning tree)
- `selectBmsOptimal()` (원칙 22 최단 거리 tie-break)

**SFMT 루프 골격**:

```js
function generateDesign(input) {
  const ctx = initContext(input);                 // LAYER 1 (원칙 4·17)
  runValidation(ctx, principlesSpec.layer1);      // 선행 결정 확정
  assignGroupNumbers(ctx);                        // 원칙 24
  const candidates = sfmtSearch(ctx);             // 원칙 15 A→B→C→D
                                                   //   Step C에 validator.checkICC 내장
  const best = selectBmsOptimal(candidates, ctx); // 원칙 22
  return best;
}
```

### 2.3 src/renderer.js (기존 수정)

**입력**: generator.js 출력 객체 `{ cell_centers, nickel_plates[], tab_positions, face, scale, ... }`

**출력**: SVG 문자열.

**담당 원칙**: 3 · 5 · 11 · 19 · 20 (LAYER 4)

**남기는 함수**:
- `drawCell()` (원칙 5 — 단, 캡 직경 `cell_d × 0.55`로 수정)
- `drawNickelI()`, `drawNickelU()`, `drawNickelTypeA()` (원칙 19·20 — 은색 #888888 · z-order)
- `drawTerminal()` (원칙 25 시각 부분만, 기하 중심은 generator가 계산해 전달)
- `resolveLayout()` (원칙 3 상하/좌우 자동)

**제거·이관**:
- `canonicalSig`, `calcNickelPattern`, `selectBlockType`, `calcTypeAGeometry`, `buildSnakeLayout` → generator.js
- `OBJECTIVE_WEIGHTS`, `COST_MODEL`, `USER_CONSTRAINTS_DEFAULT` → generator.js

**수정 항목(v7 원칙 반영)**:
- `PLUS_CAP_DIAMETER_MM = 10.0` 상수 제거 → `capR = R * 2 * 0.55 / 2 = R * 0.55` (원칙 5 v7)
- z-order: 셀 → 니켈 → 탭 (원칙 20) — 현 코드 순서 재확인 후 필요 시 재정렬
- m_distinct 수치 표시 hook (원칙 11)
- 단자탭 라벨 "B+" 빨강 / "B−" 검정, 탭 외곽 10% 마진 바깥 (원칙 25 + 렌더링 세부)

### 2.4 src/app.js (기존 수정)

**남기는 역할**:
- DOM 이벤트 핸들러
- 상태 객체 `state` 관리
- UI → generator → renderer 파이프라인 호출
- SVG 다운로드, BMS 엣지 선택, face 필터

**제거**:
- `renderCustomLayout()` (generator.js로 이관)
- `calcCustomCenters()` (generator.js로 이관)
- `estimateMmin()` (generator.js로 이관)

**단일 진입점**:

```js
function rerender() {
  const input = buildInputFromState(state);
  const design = Generator.generateDesign(input);
  if (!design.validation.passed) {
    showViolations(design.validation.violations);
    return;
  }
  lastSVG = Renderer.render(design, viewOptions);
  mountSVG(lastSVG);
  updateInfoBox(design);  // m_distinct, 비용, BMS 거리
}
```

---

## 3. 3종 JSON 스키마

### 3.1 공통 메타

```json
{
  "$schema_version": "1.0",
  "source_md": "skills/<file>.md",
  "source_version": "v7",
  "last_updated": "YYYY-MM-DD",
  "rules": [ /* rule objects */ ]
}
```

### 3.2 principles_spec.json (LAYER 0·1·2)

**rule 객체 스키마**:

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | Y | `P01` ~ `P26` (원칙 번호와 1:1) |
| `layer` | int | Y | 0 · 1 · 2 |
| `name` | string | Y | 원칙 한글 명칭 |
| `type` | enum | Y | `law` (L0) · `decision` (L1) · `rule` (L2) |
| `check` | string | Y | validator.js의 함수명 |
| `inputs` | string[] | Y | ctx에서 참조할 키 목록 |
| `params` | object | N | check 함수에 전달할 파라미터 |
| `fail_action` | enum | Y | `abort_design` · `prune_candidate` · `warn` |
| `severity` | enum | Y | `critical` · `error` · `warning` |
| `depends_on` | string[] | N | 선행 rule id (원칙 참조 테이블 반영) |
| `source_section` | string | Y | md 내 "원칙 N —" 섹션 제목 |

### 3.3 design_spec.json (LAYER 3)

**step 객체 스키마**:

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | Y | `S02`, `S13`, `S15A`, `S15B`, ... |
| `phase` | int | Y | 호출 순서 (1 = 가장 먼저) |
| `name` | string | Y | 원칙 한글 명칭 |
| `type` | literal | Y | `"procedure"` |
| `entry_fn` | string | Y | generator.js의 함수명 |
| `prereq_rules` | string[] | Y | 실행 전 통과 필요한 principles_spec rule id |
| `outputs` | string[] | Y | ctx에 기록되는 키 |
| `branches` | object | N | 조건 분기 (예: `arrangement === 'staggered' → S23`) |
| `source_section` | string | Y | md 내 섹션 제목 |

### 3.4 render_spec.json (LAYER 4)

**render 객체 스키마**:

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | Y | `R03`, `R05`, `R11`, `R19`, `R20` |
| `element` | enum | Y | `cell_plus` · `cell_minus` · `nickel` · `tab` · `label` · `layout` |
| `z_order` | int | Y | 0 = 최하단. 셀=0, 니켈=1, 탭=2 (원칙 20) |
| `style` | object | Y | 색상·두께·형상 속성 (formula 가능) |
| `formula` | object | N | 동적 계산식 (예: `cap_r: "R * 0.55"`) |
| `constraints` | object | N | 원칙 20 ①②③ 같은 전제 체크 |
| `source_section` | string | Y | md 섹션 제목 |

**예시**:

```json
{
  "id": "R05",
  "element": "cell_plus",
  "z_order": 0,
  "style": {
    "stroke": "#C0392B",
    "stroke_width_formula": "R * 0.08",
    "fill": "none",
    "cap_fill": "#C0392B",
    "cap_r_formula": "R * 0.55"
  },
  "source_section": "원칙 5 — 셀 색상 불변"
}
```

---

## 4. 마이그레이션 로드맵

| 단계 | 산출물 | 이 문서 기준 완료 조건 |
|---|---|---|
| M0 | architecture_v7.md (이 파일) + principles_spec.json LAYER 0 | 본 문서 승인 + JSON 스켈레톤 존재 |
| M1 | principles_spec.json LAYER 1·2 완성 (원칙 4·7·10·12·14·16·17·21·25 추가) | 26개 원칙 중 14개 rule 객체화 |
| M2 | validator.js 신규 + CHECKS 13개 함수 스텁 | `runValidation()` 호출 가능, 각 스텁은 pass 반환 |
| M3 | design_spec.json + render_spec.json 작성 | 26개 원칙 전체가 JSON에 매핑 |
| M4 | generator.js 신규 + renderer.js에서 로직 이관 | 현 renderer.js 기능 regression 0 |
| M5 | renderer.js 축소 (LAYER 4 전용) + 원칙 5 캡 비율화 반영 | 원칙 5·19·20·25·3·11 자동화 |
| M6 | app.js 단일 진입점 `rerender()` + renderCustomLayout 제거 | feature_list.json F14 완료 |
| M7 | validator CHECKS 13개 실제 구현 + 회귀 테스트 | 모든 rule 통과 + F29 자동 회귀 틀 |

---

## 5. 원칙 v7 대비 현 코드 gap 체크리스트 (추정)

| 원칙 | 현 구현 상태 | M단계 |
|---|---|---|
| 1 · 6 · 8 | 렌더 시 암묵 적용, 명시적 check 없음 | M2 |
| 4 · 17 | app.js 상태로 받음, 검증 없음 | M2 |
| 5 | 캡 직경 10mm 고정(v6 하드코딩), 비율화 미반영 | M5 |
| 9 | square/staggered는 적용, 커스텀 pitch×1.1 adjacency는 미구현(추정) | M2·M4 |
| 10 | 사다리 구조는 draw에 내장, 독립 check 없음 | M2 |
| 12 | canonicalSig로 구현 | M4 이관 |
| 13 | estimateMmin 근사만 존재 | M4 이관 |
| 14 | calcNickelPattern으로 구현 | M4 이관 |
| 15 | SFMT 골격 주석에만 기술, 완전 구현 여부 불명(추정) | M4 |
| 16 | ICC 주석에 있으나 δ_min·planar 미반영(추정) | M4·M7 |
| 18 | stroke graph 대체 구현 존재(drawNickel*), spanning tree 명시 여부 불명(추정) | M4 |
| 19 | 회색 #888888 단일 적용 완료 | OK |
| 20 | z-order 순서 재검증 필요 | M5 |
| 21 | 조건 A·B 품질 점수 미구현(추정) | M4 |
| 22 | BMS 맨해튼 거리 app.js에 존재, planar 통합은 M4 | M4 |
| 23 | 엇배열 분기 존재 | M4 이관 |
| 24 | buildSnakeLayout 존재 | M4 이관 |
| 25 | drawTerminal 존재, 기하 중심 기반 여부 미확인(추정) | M5 |
| 26 | 단일 체인 토폴로지 check 없음 | M2 |

---

## 6. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v7 | 2026-04-17 | 최초 4파일 체제 + 3종 JSON 스펙 확정. 마이그레이션 M0~M7 정의. |
