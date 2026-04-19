# Pack-Renderer — SL Power 니켈 플레이트 설계 검증기

## ⚡ 세션 최초 액션 (다른 모든 것보다 먼저)

**새 세션이 시작되면 첫 번째 액션으로 반드시 아래 두 파일을 순서대로 읽어라. 사용자 메시지에 응답하기 전에 실행한다.**

1. `graphify-out/GRAPH_REPORT.md` — 코드베이스 신 노드·커뮤니티 구조 파악
2. `skills/pack-renderer-session.md` — 7단계 시작 루틴 실행

이 순서를 어기거나 건너뛰는 것은 금지한다.

## 세션 시작·종료 루틴
새 세션 시작 시 **즉시** `skills/pack-renderer-session.md`를 읽고 7단계 시작 루틴을 실행하라.
사용자가 "종료·수고했어·오늘 여기까지" 등 종료 신호를 보내면 동일 파일의 종료 루틴을 실행하라.

## 작업 유형별 필독 파일
작업 시작 전, 아래 파일을 반드시 읽어라. 읽지 않고 코드 작성 금지.

| 작업 종류 | 필독 파일 |
|---|---|
| 설계 검증, 원칙 체크, validator 구현 | `skills/nickel_plate_principles.md` (LAYER 0·1·2) |
| 형상 생성, 알고리즘·generator 구현 | `skills/nickel-plate-design.md` (LAYER 3) |
| SVG 렌더링, 색상·레이어·표시 | `skills/nickel_render_rules.md` (LAYER 4) |
| 플레이트 설계 평가, CHECK-1~4 검증 | `skills/nickel-plate-evaluation-rules.md` (제조 최적성) |
| 작업 종류 불명확 | 위 4개 모두 |

## 개발 규율 (필수 준수)

아래 2개 파일은 **코드를 작성·수정하기 전에 항상** 적용한다. 읽지 않고 코드 수정 금지.

| 상황 | 필독 파일 |
|---|---|
| generator.js / validator.js / renderer.js 순수계산 함수 **추가·수정** | `skills/tdd-first.md` (RED-GREEN-REFACTOR) |
| 버그 보고 수신 / 기대와 다른 출력 발견 | `skills/systematic-debug.md` (5단계 프로토콜) |

핵심 철칙:
- **테스트 없이 알고리즘 코드 커밋 금지** — tdd-first.md
- **재현 불가 버그 수정 금지 / 가설 없이 패치 금지 / 같은 파일 3회 같은 의도 수정 시 중단** — systematic-debug.md

## 레이어 구조 요약
- LAYER 0 (원칙 1·6·8·9·26) — 절대 불변. 위반 시 설계 즉시 폐기.
- LAYER 1 (원칙 4·17) — 선행 결정. 형상 생성 전 확정.
- LAYER 2 (원칙 7·10·12·14·16·21·25) — 룰. 패스/페일 이진 검사.
- LAYER 3 (원칙 2·13·15·18·22·23·24) — 스킬. → `skills/nickel-plate-design.md`
- LAYER 4 (원칙 3·5·11·19·20) — 렌더링 룰. → `skills/nickel_render_rules.md`

## 프로젝트 폴더 구조
- `battery_pack_renderer.html` — 엔트리 HTML
- `src/` — 런타임 JavaScript (`renderer.js` 렌더 엔진, `app.js` UI 컨트롤러)
- `tests/` — Node.js 테스트 (`test_custom_render.js`)
- `skills/` — AI 필독 원칙·룰·스킬·세션 루틴 4종
- `docs/` — 설계 참고 문서·레거시 자료·이론 자료
- `assets/` — 이미지·SVG 리소스
- `state/` — 프로젝트 상태 파일 (`claude-progress.txt`, `feature_list.json`)

## 조기 종료 방지
`state/feature_list.json`의 `passes: false` 항목이 남아 있는 한 "다 됐다"고 선언 금지.
반드시 미완료 항목을 사용자에게 명시하고 다음 작업을 안내하라.

## Skill routing (gstack)

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
