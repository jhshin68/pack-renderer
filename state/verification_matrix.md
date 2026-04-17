# Pack-Renderer 검증 매트릭스 (Phase 2 산출물)

> 작성: 2026-04-17 세션 13.5
> 목적: feature_list.json F01~F35 × [대응 원칙 / 구현 함수 / 테스트 assertion]
> Phase 3(실증 검증)의 탐색 목록으로 사용

## 범례
- **원칙**: `nickel_plate_principles.md` (P01~P26) + LAYER 3/4 원칙
- **구현**: `src/{generator|renderer|validator}.js:라인` — 실구현 / `stub`은 껍데기만
- **테스트**: 테스트 파일 + 대표 assertion 라벨. `—` = 자동 테스트 없음
- **Lx**: LAYER 번호

---

## 매트릭스 — 셀 렌더링 (F01~F02)

| ID | Feature | 원칙 | 구현 함수 | 테스트 |
|---|---|---|---|---|
| F01 | 18650/21700 셀 규격 렌더링 | P05·P06·P20 (L4) | renderer.js `drawCell:230` | — (시각만 — test_custom_render svg 문자열 검사) |
| F02 | 극성 패턴 (그룹 짝/홀 교차) | P01 (L0) | renderer.js `getCellPolarity:219` | — (test_custom_render에서 간접 호출만) |

**갭**: P01 극성 불변은 validator.js `checkPolarityInversion`도 **스텁** → 실검증 0.

---

## 매트릭스 — 배열 레이아웃 (F03~F07)

| ID | Feature | 원칙 | 구현 함수 | 테스트 |
|---|---|---|---|---|
| F03 | square S×P 격자 | P06·P17 (L0·L1) | renderer.js `calcCellCenters:197`, `resolveLayout:185` | test_f14 case5 (square fallback) |
| F04 | staggered hex 격자 | P06·P17·P23 (L0·L1·L3) | renderer.js `calcCellCenters` | — (직접 unit test 없음) |
| F05 | custom 행별 셀 수 | P08·P17 (L0·L1) | renderer.js `renderCustomGrid:530`, `renderCustomRows:688`, generator.js `calcCustomCenters:239` | test_f14 case1/6, test_custom_render |
| F06 | custom 정렬 L/C/R | P17 (L1) | renderer.js `renderCustomGrid` align branch | test_f14 case3(right) |
| F07 | custom 엇배열 방향 L/R | P17·P23 (L1·L3) | renderer.js `renderCustomGrid:543` stagger branch | test_f14 case3, test_custom_render |

**갭**: F04 staggered 단독 테스트 없음. 원칙 9 ②(6-이웃) 검증 0.

---

## 매트릭스 — 니켈 블록 (F08~F14)

| ID | Feature | 원칙 | 구현 함수 | 테스트 |
|---|---|---|---|---|
| F08 | 니켈 I형 (P=1,2) | P10·P18 (L2·L3) | renderer.js `drawNickelI:258` | — |
| F09 | 니켈 U형 (P=4) | P10·P14 (L2) | renderer.js `drawNickelU:280` | — |
| F10 | TypeA (P=5) 닫힌 사다리 | P10·P18 (L2·L3) | renderer.js `drawNickelTypeA:323`, generator.js `calcTypeAGeometry:151` | test_generator_stub (trunk_y/w, branches=5) |
| F11 | Compact-H (P=3) 미확정 | P10 (L2) | generator.js `selectBlockType:102` → geometry_ready:false | test_generator_stub `P=3 geometry_ready===false` |
| F12 | Extended (P=6) 미확정 | P10 (L2) | 동일 `selectBlockType` | test_generator_stub block types table |
| F13 | P=7 이상 | P10 (L2) | `selectBlockType` Unknown 처리 | — |
| F14 | renderer rows[] 직접 지원 | P17 (L1) | renderer.js `renderCustomRows:688`, generator.js `calcCustomCenters` | test_f14_custom_rows 22개 assertion |

**갭**: F08·F09 원칙 10 사다리 구조 테스트 0. F13 미구현은 경고 없이 Unknown 리턴.

---

## 매트릭스 — 단자 & 패턴 (F15~F17)

| ID | Feature | 원칙 | 구현 함수 | 테스트 |
|---|---|---|---|---|
| F15 | B+/B− 단자탭 렌더 | P04·P14·P25 (L1·L2) | renderer.js `drawTerminal:408`, `drawFace:425` | test_f14/test_custom_render (B+/B- 라벨 문자열만) |
| F16 | 상·하면 병합 패턴 | P14 (L2) | generator.js `calcNickelPattern:123`, renderer.js `drawFace` | test_generator_stub (has B+/B-) |
| F17 | 직렬 브리지 | P14·P26 (L2·L0) | renderer.js `drawFace` TypeA dispatcher | — |

**갭**:
- P25 ④ (탭 이종 극성 겹침 금지) 검증 코드 **없음**
- P26 (단일 체인) 검증은 validator 스텁 상태
- F17 브리지 기하 정확성 테스트 0

---

## 매트릭스 — UI 컨트롤 (F18~F24)

| ID | Feature | 원칙 | 구현 함수 | 테스트 |
|---|---|---|---|---|
| F18 | face 필터 top/bot/all | P03·P20 (L4) | renderer.js `render`의 svgH/svgW 분기 | test_f14 case4 (top only header) |
| F19 | BMS 마커 (엣지+비율) | P22 (L3) | app.js `setBmsEdge/addBmsMarkerToDOM` (src/ 아님) | — |
| F20 | BMS 거리 square/staggered | P22 (L3) | app.js `calcBmsDistances` | — |
| F21 | BMS 거리 custom | P22 (L3) | **미구현** (`—` 표시) | — |
| F22 | 비용 모델 표시 | P11·P13 (L4·L3) | generator.js `estimateMmin:224` | test_generator_stub (S=4 square=1, S=5 square=2, staggered≥2) |
| F23 | SVG 다운로드 | (UX) | app.js `downloadSVG` | — |
| F24 | PNG 내보내기 | (UX) | **미구현** | — |

**갭**:
- F20 BMS 거리 계산 수학적 정확성 검증 0 (값 오류 감지 불가)
- F22 estimateMmin이 원칙 13 ⑤항(경로 변경 시 m_min=3) 반영 여부 미확인

---

## 매트릭스 — 알고리즘 (F25~F28)

| ID | Feature | 원칙 | 구현 함수 | 테스트 |
|---|---|---|---|---|
| F25 | SFMT 타일링 | P12·P15·P18 (L2·L3) | generator.js `sfmtSearch:783`, `canonicalSig:82` | test_generator_stub (canonicalSig g===r, sfmt 스텁 반환 형태) |
| F26 | ICC 5대 제약 | P16 (L2) | generator.js `buildPairFirst:710` (S15C) | test_m7_core (ICC①rowSpan, ratio, quality_score=-10 가지치기) |
| F27 | 엠보 캐노니컬 서명 | P12 (L2) | generator.js `canonicalSig:82` | test_generator_stub `canonicalSig === string` |
| F28 | buildSnakeLayout | P04·P24 (L1·L3) | generator.js `buildSnakeLayout:191` | test_generator_stub (total, row0 LTR, row1 RTL) |

**갭**:
- F26 **ICC hex 재해석 (staggered) 테스트 0** — 원칙 16 엇배열 재해석 미검증
- F26 ICC ③ 볼록성(0.75) 실제 수치 계산 테스트 없음 — 현재 `buildPairFirst`는 qs 기반 근사
- F26 ICC ④ planar 교차 / δ_min 이종 극성 겹침 검증 **없음**
- F27 원칙 12 "거울반사 별개 형상" allow_mirror 파라미터 테스트 없음

---

## 매트릭스 — 테스트 & 검증 (F29~F30)

| ID | Feature | 원칙 | 구현 함수 | 테스트 |
|---|---|---|---|---|
| F29 | 전 S×P 회귀 자동화 | (메타) | **미구현** | — |
| F30 | TypeA 엣지케이스 검증 | P10·P18 | **미구현** | — |

---

## 매트릭스 — 홀더 배열 제약 (F31~F35)

| ID | Feature | 원칙 | 구현 함수 | 테스트 |
|---|---|---|---|---|
| F31 | H1 홀더 크기 분리 | P08·P17 Level 1 (L0·L1) | generator.js `buildHolderGrid:1010` | **— (unit test 0)** |
| F32 | H2 B+/B− 출력 방향 | P04 ④·P17 Level 2 (L1) | generator.js `calcBoundarySet:982` | **— (unit test 0)** |
| F33 | H3 Hamiltonian 배정 | P17 Level 3 (L1) | generator.js `enumerateGroupAssignments:1056` | **— (unit test 0)** |
| F34 | H4 우측 패널 UI | (UI) | app.js `populateCandidatePanel` | — |
| F35 | H5 원칙 문서 업데이트 | (docs) | 문서만 | — |

**갭**: 세션 9에 세 기능(F31~F33) 구현 완료됐으나 **자동 테스트 0건** → 브라우저 육안 검증만 존재. TDD 규율 소급 적용 필요.

---

## LAYER 3 스텁 상태 (generator.js)

| Step | 함수 | 구현 상태 | 테스트 |
|---|---|---|---|
| S02 | calcConnectionBounds:798 | ✅ 실구현 (horizontal만?) | test_generator_stub (x_range horizontal) |
| S13 | detectColumnGroupEfficiency:916 | 확인 필요 (S홀수 3종 분기) | test_generator_stub (S=4 eligible, S=5 not) |
| S15A | detectSymmetryGroup:552 | ✅ 세션 11 실구현 | test_generator_stub + test_m7_core |
| S15B | enumerateCongruentPairs:628 | ✅ 세션 13 실구현 (오늘) | **test_s15b.js 12 assert** |
| S15C | buildPairFirst:710 | ✅ 실구현 (ICC ①② 하드체크) | test_m7_core |
| **S15D** | **minimizeShapeCount:773** | **❌ 스텁 (m_distinct_min:null 반환)** | test_generator_stub (has key만) |
| **S18** | **buildStrokeGraph:945** | **❌ 스텁** | test_generator_stub (V 존재만) |
| S22 | selectBmsOptimal:836 | ✅ 실구현 | test_m7_core |
| **S23** | **buildHexCluster:959** | **❌ 스텁** | test_generator_stub (array만) |
| S24 | assignGroupNumbers:505 | ✅ 실구현 (보스트로페돈+BFS) | test_m7_core |

---

## validator.js — 🚨 전체 스텁

14개 체크 함수 모두 `{ok:true, stub:'P##'}` 반환:

| 원칙 | 함수 | 상태 |
|---|---|---|
| P01 | checkPolarityInversion | stub |
| P04 | checkOutputDirectionDecided | stub |
| P06 | checkContact | stub |
| P07 | checkNickelThicknessUniform | stub |
| P08 | checkCellCount | stub |
| P09 | checkAdjacency | stub |
| P10 | checkLadderStructure | stub |
| P12 | checkEmbossIrreversibility | stub |
| P14 | checkFaceMerging | stub |
| P16 | checkICC | stub |
| P17 | checkArrangementDecided | stub |
| P21 | checkGroupValidity | stub (generator.js의 동명 함수는 실구현) |
| P25 | checkTerminalTab | stub |
| P26 | checkSeriesPathSingleness | stub |

**test_validator_stub.js 35 assertion은 전부 인프라 검증(spec 로드·레지스트리 크기·스텁 반환)이며, 어떤 원칙도 의미적으로 검증하지 않는다.**

---

## Phase 2 통계

- **F01~F35 = 35개 feature** 중 passes:true 28개, passes:false 7개
- **자동 테스트로 실증 가능한 feature: 약 13개** (F05, F10, F11, F14, F16, F18, F22, F25, F26, F27, F28 + S15A/B)
- **테스트 0건 feature: 22개** (나머지 전부)
- **validator 체크 함수 14개 전원 스텁** — 원칙 검증 인프라는 있으나 판정 로직 0

---

## Phase 3 우선순위 제안 (실증 검증 순서)

### Tier 1 — 안전성 위험 (먼저 봐야 함)
1. **P01 극성 불변** (F02) — 상/하면 반전 케이스 테스트
2. **P09 인접성** (F04) — staggered 6-이웃, custom 1.1 계수
3. **P26 직렬 경로 단일성** — 분기·루프 검출 테스트
4. **F31·F32·F33** 홀더 제약 — 이미 구현, TDD 소급 적용

### Tier 2 — 설계 품질 핵심
5. **원칙 16 ICC hex 재해석** (F26 staggered) — 엇배열 행스팬 오판 리스크
6. **P25 ④ 탭 이종 극성 금지** (F15)
7. **원칙 12 거울반사** (F27) — allow_mirror 케이스
8. **S18 buildStrokeGraph** 실구현 (planar + floating segment 금지)

### Tier 3 — 완성도
9. **F20 BMS 거리 수학 검증**
10. **F21 custom BMS 거리** 구현
11. **S15D minimizeShapeCount** 실구현
12. **S23 buildHexCluster** 실구현
13. **F29 회귀 자동화 · F30 TypeA 엣지케이스**

### Tier 4 — 문서-코드 정합
14. 원칙 13 ⑤항 ↔ estimateMmin 대응 확인
15. 원칙 4 ④⑤항 ↔ calcBoundarySet + enumerateGroupAssignments 연결 재점검
