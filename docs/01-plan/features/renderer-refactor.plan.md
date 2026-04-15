# Plan: Battery Pack Renderer 수정 계획

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | renderer-refactor |
| 작성일 | 2026-04-15 |
| 예상 범위 | 3단계 (즉시 / 단기 / 중기) |

### 1.3 Value Delivered (4-Perspective)

| 관점 | 내용 |
|------|------|
| **Problem** | HTML 인라인 JS가 renderer.js(v0.2.18)와 불일치 — 브라우저에서 구버전 셀심볼·검정 니켈 렌더링 |
| **Solution** | HTML을 renderer.js에 연결·통합하고, 미구현 원칙(커스텀 니켈, SFMT, BMS)을 단계적으로 구현 |
| **Function UX Effect** | 최신 이론(23대 원칙)이 브라우저 UI에 즉시 반영되고, 금형 비용 최적화 기능이 실제로 동작 |
| **Core Value** | 13S5P 기준 금형 비용 ₩80~90M 절감 가능한 설계 도구를 정확하게 운용 |

---

## 1. 현황 분석 (As-Is)

### 1.1 파일 구조

```
Pack-Renderer/
├── battery_pack_renderer.html  ← 브라우저 UI (인라인 JS 내장, 구버전)
├── renderer.js                 ← 독립 모듈 v0.2.18 (최신, CLI 지원)
├── BatteryPack_Theory_v02.md   ← 이론 문서 (23대 불변 원칙 완결)
├── 13s5p_sfmt_icc_icc_6types.svg  ← 참조 SVG
└── 배열 샘플.xlsx
```

### 1.2 핵심 불일치 (HTML vs renderer.js)

| 항목 | HTML 인라인 JS (현재) | renderer.js v0.2.18 (목표) |
|------|----------------------|--------------------------|
| 셀 심볼 (+면) | 3겹 연빨강 + ✕ 파랑 | 흰색 원 + 빨강 캡 10mm 고정 |
| 셀 심볼 (−면) | 파란 3겹 + 교차선 | fill=none + 중앙 검정 점 R×0.25 |
| 니켈 색상 | 검정 `#1a1a18` | 회색 `#888888 / #555555` |
| 니켈 스파인 범위 | cy[0]-R×0.75 ~ cy[P-1]+R×0.75 | cy[0] ~ cy[P-1] (셀 밖 확장 금지) |
| `bar_h_mm` | 3mm 별도 파라미터 | 폐기 → nickel_w로 통일 |
| 커스텀 배열 니켈 | 미구현 (주석: "추가 구현 필요") | renderCustomGrid() 구현됨 |
| 플레이트 BFS 연결성 검증 | 없음 | 있음 (경고 라벨 포함) |

### 1.3 미구현 기능 (이론 있으나 코드 없음)

| 원칙 | 내용 | 우선순위 |
|------|------|---------|
| **원칙 16** | BMS 근접 단자 최적화 (맨해튼 거리) | 중 |
| **원칙 17** | 엇배열 hex 펜토미노 그룹 완전체 | 중 |
| **원칙 18** | SFMT 4단계 알고리즘 (최소 형상 자동 탐색) | 높음 |
| **원칙 19** | ICC 검증 (행스팬/종횡비/볼록성) | 중 |

---

## 2. 목표 (To-Be)

### Phase 1 — 즉시 수정 (HTML-renderer 통합)
**목적**: 브라우저 UI가 최신 이론(v0.2.18)을 즉시 반영  
**방법**: HTML이 renderer.js를 `<script src="renderer.js">` 로 직접 참조

- [ ] HTML 인라인 JS 제거
- [ ] `<script src="renderer.js"></script>` 추가
- [ ] 브라우저 UI 이벤트 핸들러를 별도 `app.js`로 분리
- [ ] `render()`, `renderCustomGrid()` 등 renderer.js API 직접 호출
- [ ] 커스텀 배열 렌더링 → `renderCustomGrid()` 연결

**기대 효과**:
- 구버전 셀심볼 → 최신 심볼 자동 적용
- 검정 니켈 → 회색 니켈 자동 적용
- 코드 중복 완전 제거 (현재 렌더 로직이 2벌 존재)

### Phase 2 — 단기 기능 추가
**목적**: 핵심 사용자 요구 기능 완성

- [ ] 커스텀 배열 니켈 패턴 (HTML에서 호출 가능하도록 renderer.js의 renderCustomGrid 완성 검증)
- [ ] ICC 실시간 표시 패널 (행스팬 / 종횡비 / 볼록성 — info-box에 추가)
- [ ] 엇배열 hex 그룹 형성 시각화 개선

### Phase 3 — 중기 알고리즘 구현
**목적**: 금형 비용 최적화의 핵심 기능

- [ ] SFMT Step A: 팩 대칭군 탐지 (C1/C2/D1/D2)
- [ ] SFMT Step B: 국소 합동 쌍 열거 (canonicalSig 활용)
- [ ] SFMT Step C: 쌍-우선 구성 (백트래킹)
- [ ] SFMT Step D: m_distinct 최소화 + Tie-breaker
- [ ] BMS 좌표 입력 UI + 맨해튼 거리 기반 단자 배치 (원칙 16)

---

## 3. 수정 우선순위

```
우선순위 1 (즉시, 1~2시간)
  → HTML ↔ renderer.js 통합
    이유: 현재 브라우저 결과가 이론 문서와 불일치 — 데모·공유 시 신뢰성 손상

우선순위 2 (단기, 반나절)
  → ICC 패널 + 커스텀 니켈 검증
    이유: 실무 설계 검토에 직접 필요

우선순위 3 (중기, 2~3일)
  → SFMT 알고리즘 구현
    이유: 금형 비용 최적화의 핵심 — 13S5P 기준 ₩80M 절감 가능
```

---

## 4. 기술 아키텍처 결정

### 4.1 통합 방식 선택

**옵션 A**: HTML에 `<script src="renderer.js">` 추가 + 별도 `app.js`
- 장점: 구조 단순, renderer.js 독립성 유지, 즉시 적용
- 단점: 두 파일 배포 필요

**옵션 B**: renderer.js를 ES Module로 변환, HTML에서 `import`
- 장점: 모던 JS 구조
- 단점: 로컬 파일 CORS 이슈 (file:// 프로토콜)

**결정**: **옵션 A 선택** — file:// 프로토콜에서도 동작해야 하므로

### 4.2 파일 구조 (수정 후)

```
Pack-Renderer/
├── battery_pack_renderer.html  ← UI + 이벤트 핸들러만 (app.js 참조)
├── renderer.js                 ← 렌더링 엔진 (변경 최소화)
├── app.js                      ← UI ↔ 렌더러 연결 로직 (신규)
└── docs/
    └── 01-plan/features/renderer-refactor.plan.md
```

---

## 5. 위험 요소 및 대응

| 위험 | 가능성 | 대응 |
|------|--------|------|
| renderer.js의 `module.exports`가 브라우저에서 오류 | 중 | `if(typeof module !== 'undefined')` 가드 이미 있음 — 확인 필요 |
| 커스텀 배열 renderCustomGrid() API 시그니처 불일치 | 낮 | 호출 전 파라미터 매핑 검토 |
| SFMT 알고리즘 복잡도 (조합 폭발) | 높 | P≤8, S≤23 제한 내에서 timeout guard 추가 |

---

## 6. 완료 기준 (Definition of Done)

### Phase 1
- [ ] 브라우저에서 Render 클릭 시 v0.2.18 기준 셀심볼(흰색+빨강 캡 10mm) 표시
- [ ] 니켈이 회색(#888888)으로 렌더링
- [ ] 커스텀 배열에서 니켈 패턴 표시
- [ ] SVG 다운로드 정상 동작
- [ ] 기존 기능 (S/P 조절, Gap, 면 전환) 모두 동작

### Phase 2
- [ ] info-box에 ICC 지표 (행스팬, 종횡비) 표시
- [ ] 엇배열 렌더링 시각적 검증

### Phase 3
- [ ] 13S5P 정배열에서 m_min=2 자동 산출 및 SVG 렌더
- [ ] SFMT 탐색 결과 info-box에 표시
