# Pack-Renderer — 시스템 아키텍처

**문서 버전**: 1.0
**최종 업데이트**: 2026-04-24
**상태**: Layer 2 (가변 — 아키텍처 변경 시 업데이트)
**참조**: pack_design/ARCHITECTURE.md 형식 기반

---

## 시스템 개요

Pack-Renderer(SL Power SELA)는 **브라우저 단일 파일로 동작하는 배터리팩 니켈플레이트 설계 검증기**다.

- **입력**: 셀 타입(18650/21700), S(직렬), P(병렬), 배열 방식(square/staggered/custom), 홀더 제약, BMS 위치
- **처리**: 26개 설계 원칙 검증 → SFMT 타일링 알고리즘 → 형상 생성 → SVG 렌더링
- **출력**: 니켈플레이트 연결 패턴 SVG, PNG, BMS 맨해튼 거리, 금형 비용 추정

빌드 시스템 없음. `battery_pack_renderer.html` 브라우저 직실행 방식을 의도적으로 유지한다.

---

## 아키텍처 — 5계층 레이어 구조

Pack-Renderer의 핵심 설계 원칙은 **단방향 의존성**이다. 상위 레이어는 하위 레이어를 호출하지만, 역방향 호출은 금지된다.

```
┌──────────────────────────────────────────────────────┐
│  LAYER 4 — 렌더링 (Rendering)                        │
│  src/renderer.js                                     │
│  SVG 생성, 색상·레이어·표시 규칙 (원칙 3·5·11·19·20)  │
├──────────────────────────────────────────────────────┤
│  LAYER 3 — 형상 생성 (Generation)                    │
│  src/generator.js / gen-math.js / gen-layout.js      │
│  src/gen-enum.js / enum-worker.js                    │
│  SFMT 알고리즘, ICC 제약, Hamiltonian 열거기           │
│  원칙 2·13·15·18·22·23·24                            │
├──────────────────────────────────────────────────────┤
│  LAYER 2 — 룰 검증 (Rules)                           │
│  src/validator.js                                    │
│  패스/페일 이진 검사 (원칙 7·10·12·14·16·21·25)       │
├──────────────────────────────────────────────────────┤
│  LAYER 1 — 선행 결정 (Pre-conditions)                │
│  src/validator.js (선행 검사 포함)                    │
│  형상 생성 전 확정 사항 (원칙 4·17)                   │
├──────────────────────────────────────────────────────┤
│  LAYER 0 — 절대 불변 원칙 (Invariants)               │
│  코드 전체에 내재 (원칙 1·6·8·9·26)                   │
│  위반 시 설계 즉시 폐기                               │
└──────────────────────────────────────────────────────┘
         ↑ 단방향 의존 (하위→상위 호출 금지)
┌──────────────────────────────────────────────────────┐
│  UI 계층 (UI Layer)                                  │
│  src/app.js / app-state.js / app-panel.js / app-ui.js│
│  battery_pack_renderer.html / src/style.css          │
│  rerender() 유일 진입점                              │
└──────────────────────────────────────────────────────┘
```

---

## 모듈 상세

### LAYER 0 — 절대 불변 원칙
**내재 위치**: 모든 레이어에 적용  
**원칙**: 1(셀 좌표 정확성), 6(극성 교차), 8(직렬 연속성), 9(병렬 균등), 26(SVG 유효성)  
**규칙**: 위반 시 해당 설계 즉시 폐기. 코드로 우회 불가.

---

### LAYER 1 — 선행 결정
**파일**: `src/validator.js` (선행 검사 섹션)  
**원칙**: 4(홀더 크기 분리 — holder_rows × holder_cols), 17(B+/B- 출력 방향 결정)  
**규칙**: 형상 생성 진입 전 확정. 이후 변경 금지.

---

### LAYER 2 — 룰 검증
**파일**: `src/validator.js`  
**원칙**: 7(행 스팬 ≤2), 10(종횡비 ≤2.0), 12(니켈 병합 패턴), 14(ICC 볼록성), 16(엠보 불가역성), 21(캐노니컬 서명), 25(비용 모델)  
**인터페이스**: `validate(config) → { pass: bool, violations: [] }`

---

### LAYER 3 — 형상 생성

#### `src/generator.js`
LAYER 3 오케스트레이션. gen-math / gen-layout / gen-enum을 조합해 최종 형상 후보 목록 반환.

#### `src/gen-math.js`
순수 수학 함수 집합.
- `canonicalSig(shape)` — 캐노니컬 서명 (4회전 최솟값)
- `calcSFMT(S, P)` — Symmetry-First Minimum-Type 타일링
- `estimateMmin(candidates)` — m_distinct (금형 종수) 최소화

#### `src/gen-layout.js`
셀 중심 좌표 계산.
- `calcCellCenters(config)` — square / staggered 분기
- `calcCustomCenters(rows, config)` — custom rows 배치
- `buildSnakeLayout(S, max_rows)` — 직렬 스네이크 순서

#### `src/gen-enum.js`
Hamiltonian 그룹 배정 열거기.
- `enumerateGroupAssignments(holderGrid, boundary)` — backtracking + ICC①②③ 가지치기
- `max_candidates = 20` — 실용 범위 제한

#### `src/enum-worker.js` + `enum-worker-init.js` + `enum-worker-bundle.js`
Web Worker 비동기 열거. 메인 스레드 블로킹 없이 후보 목록 계산.

---

### LAYER 4 — 렌더링

#### `src/renderer.js`
SVG 렌더링 전체 담당.
- `render(config, candidates)` → SVG element
- `drawNickelI()` — I형 (P=1,2)
- `drawNickelU()` — Generic ㄷ자 사다리 (P=3,4,5,6 이상 전체 통일)
- `drawTerminal()` — B+/B- 단자탭
- `drawFace()` — 상면/하면 dispatcher
- `getCellPolarity()` — 극성 패턴 (짝/홀 교차)

> **설계 결정 (세션 13.5)**: TypeA 닫힌 사다리 폐기. 모든 P에 Generic(drawNickelU) 통일. F10 TypeA 기록은 역사 보존 목적으로만 유지.

---

### UI 계층

#### `src/app.js`
메인 진입점. `rerender()` 유일 진입점 원칙 유지.  
doRender() 삭제 완료 (M5 — 2026-04-17).

#### `src/app-state.js`
UI 상태 관리. 단방향 흐름 보장.

#### `src/app-panel.js`
후보 패널 렌더링. enumerateGroupAssignments 결과 카드 4개 표시.

#### `src/app-ui.js`
입력 컨트롤 바인딩. 셀 타입, S/P, 배열 방식, BMS 위치, max_plates 등.

---

## 데이터 흐름

```
사용자 입력 (app-ui.js)
        │
        ▼
상태 업데이트 (app-state.js)
        │
        ▼
rerender() ← 유일 진입점 (app.js)
        │
        ├─► LAYER 1/2 선행 검증 + 룰 검증 (validator.js)
        │         │ 위반 시 → 캔버스 클리어 + 오류 메시지
        │
        ├─► LAYER 3 형상 생성 (generator.js 오케스트레이션)
        │         │
        │         ├─ gen-math.js (SFMT, 캐노니컬 서명)
        │         ├─ gen-layout.js (좌표 계산)
        │         └─ enum-worker.js (비동기 Hamiltonian 열거)
        │
        └─► LAYER 4 SVG 렌더링 (renderer.js)
                  │
                  ▼
           SVG 표시 + 후보 패널 (app-panel.js)
           BMS 거리 / 비용 모델 정보박스 표시
```

---

## 테스트 구조

```
tests/
├── test_regression_all_sp.js   ─ 144 S×P 조합 전체 회귀 (2S~13S × 1P~6P × square/staggered)
│                                  SHA-256 baseline 비교 (--save / --compare)
├── test_validator_*.js          ─ validator.js 각 원칙별 단위 테스트
├── test_generator_*.js          ─ gen-math / gen-layout / gen-enum 단위 테스트
├── test_renderer_*.js           ─ renderer.js SVG 유효성 (NaN·크래시·셀수)
└── test_custom_render.js        ─ custom rows 배치 엣지케이스

전체: 13개 파일, 406개 assertion, 모두 PASS (2026-04-18 기준)
```

---

## 향후 확장 고려 사항

### SaaS 플랫폼 확장 시 (pack_design 참조)
현재 Pack-Renderer는 브라우저 단일 파일 도구다. 외부 열/전기/기계 엔진과 통합하거나 백엔드 API로 확장할 경우, `pack_design/ARCHITECTURE.md`의 엔진 어댑터 패턴(NormalizedEngineResult + Strategy A/B/C)을 참조한다.

### UI 브랜드 개선 시 (pack_design 참조)
고객 시연용 UI 개선이 필요할 경우, `pack_design/design-system-slpower.md`를 기준으로 적용한다.
- SL Power Red `#E60012` 액센트
- Exo 2(영문/숫자) + Pretendard(한국어) 이중 폰트
- 소프트 글로우 그림자 `rgba(136,136,136,0.2) 0px 0px 30px`

---

## 변경 이력

| 버전 | 날짜 | 변경 사항 |
|------|------|---------|
| 1.0 | 2026-04-24 | 초기 문서 작성. pack_design/ARCHITECTURE.md 형식 참조. Pack-Renderer 실제 5계층 구조 기준 |
