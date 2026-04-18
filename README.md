# Pack-Renderer

SL Power Co., Ltd. SELA — 배터리팩 셀 배치 및 니켈플레이트 SVG 렌더러·설계 검증기

---

## 개요

18650/21700 셀로 구성된 배터리팩의 셀 배치를 계산하고, 니켈플레이트 연결 패턴을 SVG로 렌더링하는 브라우저 기반 도구입니다.  
설계 원칙 26개(LAYER 0~4)를 기반으로 형상 생성·렌더링·검증 세 계층이 분리되어 있습니다.

---

## 빠른 시작

별도 서버 설치 없이 `battery_pack_renderer.html`을 브라우저에서 직접 열면 됩니다.

```
battery_pack_renderer.html  →  Chrome / Edge에서 열기
```

Node.js 테스트 실행:

```bash
node tests/test_custom_render.js
node tests/test_p01_polarity.js
# ... 또는 개별 파일 실행
```

---

## 폴더 구조

```
Pack-Renderer/
├── battery_pack_renderer.html   # 브라우저 UI 진입점 (다크테마)
├── src/
│   ├── renderer.js              # LAYER 4 — SVG 렌더 엔진 (v0.3.2-unified)
│   ├── generator.js             # LAYER 3 — 형상 생성 엔진 (v7-M7)
│   ├── validator.js             # LAYER 0·1·2 — 설계 검증기 (v7-tier2b)
│   └── app.js                   # UI 컨트롤러
├── tests/                       # Node.js 테스트 (406 assertion, 전부 PASS)
│   ├── test_custom_render.js
│   ├── test_p01_polarity.js
│   ├── test_p09_adjacency.js
│   ├── test_p26_series_path.js
│   └── ... (총 13개 파일)
├── skills/                      # AI 필독 원칙·룰·스킬 문서
│   ├── nickel_plate_principles.md   # 원칙 LAYER 0~2 (26개 원칙)
│   ├── nickel-plate-design.md       # LAYER 3 형상 생성 알고리즘
│   ├── nickel_render_rules.md       # LAYER 4 렌더링 규칙
│   ├── tdd-first.md                 # 개발 규율: RED-GREEN-REFACTOR
│   └── systematic-debug.md          # 개발 규율: 5단계 디버깅 프로토콜
├── state/
│   ├── claude-progress.txt          # 세션별 작업 기록 및 재개 지침
│   ├── feature_list.json            # F01~F35 기능 구현 현황
│   └── verification_matrix.md      # 원칙 × 구현 × 테스트 검증 매트릭스
├── docs/                        # 설계 참고 문서 및 이론 자료
└── assets/                      # 이미지·SVG 리소스
```

---

## 아키텍처 — 4계층 레이어

| 레이어 | 파일 | 역할 |
|--------|------|------|
| LAYER 0·1·2 | `validator.js` | 설계 원칙 검증 (26개 원칙 체크) |
| LAYER 3 | `generator.js` | 형상 생성·타일링·그룹 배정 |
| LAYER 4 | `renderer.js` | SVG 렌더링·색상·레이어 표시 |
| UI | `app.js` | 사용자 입력 처리·UI 컨트롤 |

각 계층은 단방향 의존성을 가집니다: `app.js → renderer.js → generator.js ← validator.js`

---

## 주요 기능

### 셀 배치
- **정배열 (square)**: S×P 직사각 격자
- **엇배열 (staggered)**: hex 피치 (pitchY = pitch × √3/2)
- **커스텀**: 행별 셀 수 `rows=[8,8,10,13,...]` 직접 지정, 정렬(L/C/R) + 엇배열 방향(L/R) 선택

### 니켈플레이트 렌더링
- **I형** (P=1,2): 단일 그룹 세로 연결선
- **U형** (P=4): 2그룹 묶음, 좌우 세로선 + 가로 연결선
- **Generic** (모든 P): 단일 원칙 적용 — P값에 따른 특별 처리 없음

### 설계 검증 (validator.js)
10개 원칙 실구현 완료:

| 원칙 | 함수 | 내용 |
|------|------|------|
| P01 | checkPolarityInversion | 극성 불변 |
| P04 | checkOutputDirectionDecided | B+/B− 출력 방향 결정 |
| P06 | checkContact | 셀 접촉 |
| P08 | checkCellCount | 셀 수 정합 |
| P09 | checkAdjacency | 인접성 (6-이웃) |
| P10 | checkLadderStructure | 사다리 구조 연결성 |
| P12 | checkEmbossIrreversibility | 엠보 비가역성 |
| P17 | checkArrangementDecided | 배열 방식 결정 |
| P21 | checkGroupValidity | 그룹 유효성 |
| P26 | checkSeriesPathSingleness | 직렬 경로 단일성 |

스텁 유지 (Tier 2c): P07, P14, P16, P25

### 홀더 배열
- 물리 홀더(행·열·빈 슬롯)와 논리 구성(S×P) 분리
- B+/B− 출력 방향 4방향 선택
- Hamiltonian 그룹 배정 열거 (보스트로페돈 + BFS 백트래킹)

---

## 테스트 현황

```
총 406 assertion — 전부 PASS (2026-04-17 기준)
```

| 파일 | 내용 | assertion |
|------|------|-----------|
| test_custom_render.js | SVG 구조 통합 검증 | ~ |
| test_f14_custom_rows.js | custom rows 렌더 22케이스 | 22 |
| test_generator_stub.js | generator 스텁 인프라 | ~ |
| test_m7_core.js | M7 핵심 함수 | 35 |
| test_p_invariant.js | P 무관 단일 원칙 | 15 |
| test_p01_polarity.js | P01 극성 불변 | 40 |
| test_p09_adjacency.js | P09 인접성 | 18 |
| test_p26_series_path.js | P26 직렬 경로 단일성 | 43 |
| test_s15b.js | S15B 합동 쌍 열거 | 12 |
| test_validator_stub.js | validator 인프라 | 35 |
| test_validator_tier2a.js | Tier 2a 7건 검증 | 38 |
| test_validator_tier2b.js | Tier 2b 3건 검증 | 28 |
| test_holder_constraints.js | 홀더 제약 H1~H3 | 36 |

---

## 개발 규율

코드 수정 전 반드시 준수:

- **`skills/tdd-first.md`** — 알고리즘 함수는 테스트 먼저 (RED → GREEN → REFACTOR)
- **`skills/systematic-debug.md`** — 재현 불가 수정 금지, 가설 없이 패치 금지, 같은 파일 3회 같은 의도 수정 시 즉시 중단

---

## 미완료 항목

`state/feature_list.json` 기준 `passes:false` 7건:

| ID | 내용 |
|----|------|
| F11 | P=3 Compact-H 블록 형상 — 설계 스펙 확정 후 구현 |
| F12 | P=6 Extended 블록 형상 — 동일 |
| F13 | P>6 형상 — 산업 사례 조사 후 타입 확정 필요 |
| F21 | custom 모드 BMS 거리 계산 미구현 |
| F24 | SVG→PNG 내보내기 미구현 |
| F29 | 전 S×P 조합 회귀 자동화 미구현 |
| F30 | 엣지 케이스 렌더 정확성 확인 |

---

## 환경

- 브라우저: Chrome / Edge (Playwright 브라우저는 레이아웃 검증에 부적합)
- Node.js: v18+ (테스트 전용, 런타임 불필요)
- 운영 OS: Windows 11
