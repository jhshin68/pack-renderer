# QUALITY_SCORE.md
## Pack-Renderer — 모듈 품질 등급

**마지막 업데이트**: 2026-04-24
**프로젝트**: Pack-Renderer (SL Power SELA — 셀 배치 & 니켈플레이트 렌더러)
**버전**: v0.3.1+TypeAEngine
**전체 피처**: F01 ~ F36 (36개 전 항목 passes: true)

---

## 1. 모듈별 품질 등급 현황

| 모듈 | 파일 | 등급 | 테스트 커버리지 | 기술 부채 | 마지막 검증일 | 비고 |
|------|------|------|---------|----------|--------|------|
| validator | `src/validator.js` | **A** | 높음 | 없음 | 2026-04-18 | LAYER 0~2 원칙 전체 검증. 26개 원칙 기반 이진 pass/fail 체계 완비 |
| gen-math | `src/gen-math.js` | **A** | 높음 | 없음 | 2026-04-18 | SFMT 알고리즘, ICC 제약, 캐노니컬 서명 — 순수 수학 함수. 파라미터화 테스트 커버 |
| gen-layout | `src/gen-layout.js` | **A** | 높음 | 없음 | 2026-04-18 | square/staggered/custom 배치 + buildSnakeLayout() 검증 완료 |
| gen-enum | `src/gen-enum.js` | **A** | 높음 | 없음 | 2026-04-17 | Hamiltonian 열거기 + ICC 제약 + backtracking 가지치기 완비 |
| generator | `src/generator.js` | **A** | 높음 | 없음 | 2026-04-18 | LAYER 3 형상 생성 오케스트레이션. 36개 피처 생성 로직 통합 |
| renderer | `src/renderer.js` | **A** | 높음 | 없음 | 2026-04-18 | LAYER 4 SVG 렌더링 전체. TypeA 폐기 이후 Generic 통일 완료 |
| app-state | `src/app-state.js` | **A** | 중간 | 낮음 | 2026-04-18 | UI 상태 관리. 단방향 흐름 보장 |
| app-panel | `src/app-panel.js` | **B** | 중간 | 낮음 | 2026-04-18 | 후보 패널 렌더링. UI 로직이므로 자동화 테스트 범위 제한 |
| app-ui | `src/app-ui.js` | **B** | 중간 | 낮음 | 2026-04-18 | 입력 컨트롤 바인딩. DOM 의존성으로 순수 테스트 한계 |
| app | `src/app.js` | **B** | 중간 | 낮음 | 2026-04-18 | 메인 진입점. rerender() 유일 진입점 정착 완료 |
| enum-worker | `src/enum-worker.js` | **A** | 높음 | 없음 | 2026-04-17 | Web Worker 기반 비동기 열거. 메인 스레드 블로킹 없음 |
| tests | `tests/` | **A** | 전체 회귀 | 없음 | 2026-04-18 | 13개 테스트 파일. 144 S×P 조합 회귀 포함. SHA-256 baseline 비교 |
| style | `src/style.css` | **B** | N/A | 낮음 | 2026-04-18 | 기능 중심 다크 테마. SL Power 브랜드 컬러 미적용 (향후 과제) |
| HTML 진입점 | `battery_pack_renderer.html` | **B** | N/A | 낮음 | 2026-04-18 | 단일 파일 번들. 빌드 시스템 없음 — 의도적 설계 (브라우저 직실행) |
| skills 문서 | `skills/` | **A** | N/A | 없음 | 2026-04-24 | 26개 원칙 4종 문서(nickel_plate_principles / nickel-plate-design / nickel_render_rules / nickel-plate-evaluation-rules) + TDD + 디버그 루틴 완비 |

---

## 2. 등급 정의

| 등급 | 기준 | 설명 |
|------|------|------|
| **A** | 핵심 로직 전체 테스트 커버, 기술 부채 없음 | 프로덕션 준비 완료. 변경 시 Level A 전체 회귀 필수 |
| **B** | 기능 동작 안정, DOM·UI 의존성으로 자동화 테스트 일부 제한 | 안정적 상태. 변경 시 Level B 범위 검증 |
| **C** | 기본 기능 동작, 일부 미검증 경로 존재 | 개선 계획 필요 |
| **D** | 초기 구현, 재작업 예상 | 운영 투입 전 재검증 필수 |
| **F** | 미구현 | 로드맵 대기 |

> **Pack-Renderer 현황**: A 등급 9개, B 등급 5개, C/D/F 등급 없음. 전 모듈 운영 가능 상태.

---

## 3. 전체 프로젝트 품질 점수

### 가중치 기반 계산

```
계산 엔진 계층 (50%): validator(10%), gen-math(10%), gen-layout(10%),
                       gen-enum(10%), generator(10%)
렌더링 계층 (20%):    renderer(20%)
UI 계층 (15%):        app(5%), app-state(5%), app-panel+app-ui(5%)
테스트/문서 (15%):    tests(10%), skills 문서(5%)
```

### 현재 점수 (2026-04-24)

| 구분 | 점수 | 상태 |
|------|------|------|
| **현재 가중치 품질 점수** | **92/100** | 🟢 안정 |
| 전체 피처 수 | 36개 | F01~F36 전 passes: true |
| A 등급 모듈 | 9개 | 계산 엔진 + 테스트 전체 |
| B 등급 모듈 | 5개 | UI·HTML·CSS 계층 |
| C/D/F 등급 모듈 | 0개 | 없음 |

---

## 4. 검증 레벨 정의 (변경 작업 시 필수 적용)

| 레벨 | 적용 대상 | 검증 범위 |
|------|----------|----------|
| **Level A** | validator / gen-math / gen-layout / gen-enum / generator / renderer / enum-worker | 전체 회귀 테스트 실행 (tests/ 13개 파일 전체 + SHA-256 baseline 비교) |
| **Level B** | app / app-state / app-panel / app-ui | 영향 범위 테스트 + 브라우저 수동 확인 |
| **Level C** | style.css / battery_pack_renderer.html / skills 문서 | 피어 리뷰 (코드리뷰 또는 AI 리뷰) |

---

## 5. 품질 게이트 규칙 (변경 시 준수 사항)

```
Level A 변경 시:
  - 전체 회귀 테스트 통과 (node tests/run_all.js 또는 개별 실행)
  - SHA-256 baseline 비교에서 의도하지 않은 해시 변경 없음
  - 26개 설계 원칙 위반 없음 (validator.js 자체 검증)
  - TDD: 신규 알고리즘 함수는 테스트 선작성 후 구현

Level B 변경 시:
  - 변경된 UI 기능 브라우저 직접 확인
  - rerender() 유일 진입점 원칙 유지

Level C 변경 시:
  - skills 문서 변경 시 코드와 동기화 여부 확인
  - 원칙 번호·레이어 분류 변경 금지 (LAYER 0 절대 불변)
```

---

## 6. 기술 부채 현황

| 항목 | 우선순위 | 상태 | 비고 |
|------|---------|------|------|
| SL Power 브랜드 디자인 시스템 적용 (style.css) | 낮음 | 미진행 | 엔지니어링 도구 우선, 고객 시연 UI 개선 시 적용 |
| 빌드 시스템 / 번들러 도입 | 낮음 | 미진행 | 현재 브라우저 직실행 방식 의도적 유지 |
| SaaS 플랫폼 확장 (외부 열/전기/기계 엔진 연동) | 중간 | 미진행 | 엔진 어댑터 패턴 도입 필요 시 pack_design ARCHITECTURE.md 참조 |

---

## 7. 변경 이력

| 날짜 | 변경 사항 |
|------|---------|
| 2026-04-24 | 초기 문서 작성. pack_design QUALITY_SCORE.md 형식 참조. F01~F36 전 완료 기준으로 A/B 등급 할당 |
| 2026-04-18 | (기준일) feature_list.json F36까지 전 passes: true 확인 |

---

**관리자**: 신진형 (SL Power 대표)
**참조**: `state/feature_list.json`, `skills/nickel_plate_principles.md`, `pack_design/QUALITY_SCORE.md`
