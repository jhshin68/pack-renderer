# Pack-Renderer TDD 규칙 (RED-GREEN-REFACTOR)

> 목적: 알고리즘·기하·검증 로직의 버그를 조기에 포착한다.
> 호출 시점: generator.js / validator.js / renderer.js 의 **새 함수를 추가하거나 기존 함수의 로직을 수정할 때**
> 최종 업데이트: 2026-04-17 (v1)

순서를 바꾸거나 단계를 건너뛰지 말 것. "작은 수정"이라는 이유로 테스트 없이 커밋 금지.

---

## 적용 대상 — 반드시 TDD

1. **`src/generator.js`의 모든 알고리즘 함수**
   예: S15A~D, S18, S22~24, enumerateGroupAssignments, calcBoundarySet, estimatePitch, groupQualityScore
2. **`src/validator.js`의 모든 체크 함수** (LAYER 0·1·2)
3. **`src/renderer.js`의 순수 계산 함수** (calcTypeAGeometry, calcBmsDistances, calcNickelPattern 등)
4. **기존 함수 버그 수정** — 수정 전에 **먼저 실패하는 테스트**로 버그를 박제한다.

## 적용 제외 — TDD 선택 사항

- UI 이벤트 핸들러, DOM 조작 (app.js 대부분)
- 순수 SVG element 생성 (drawXxx)
- 스타일·색상·레이아웃 CSS

## RED-GREEN-REFACTOR 3단계

**RED — 실패하는 테스트 먼저 쓴다**
1. `tests/` 폴더에 테스트 파일이 없으면 새로 만든다. 파일명 규칙: `test_{대상함수}.js`.
2. 함수의 **입력 → 기대 출력** 케이스를 최소 3개 작성한다:
   - 정상 케이스 1개 (happy path)
   - 경계 케이스 2개 이상 (최소/최대/대칭경계/빈배열 등)
3. `node tests/test_xxx.js` 실행하여 **반드시 실패를 눈으로 확인**한다.
   함수가 아직 없어서 `ReferenceError`가 나는 것도 RED로 인정한다.
4. 실패 출력을 사용자에게 보고한 뒤 GREEN으로 넘어간다.

**GREEN — 테스트를 통과할 최소 구현**
1. 테스트를 통과시키는 **가장 단순한** 코드를 쓴다. 미래를 위한 일반화 금지 (YAGNI).
2. 다시 실행하여 PASS 확인. FAIL이면 구현을 고친다. 테스트를 느슨하게 고치지 말 것.
3. 기존 테스트 전체(`node tests/<파일>.js` 모두)가 깨지지 않았는지 확인한다.

**REFACTOR — 중복·네이밍 정리**
1. 중복 코드 추출, 변수명 정리. 구조 개선.
2. 각 수정마다 테스트 재실행. 한 번이라도 실패하면 그 수정을 되돌린다.
3. 새 헬퍼가 공용이면 단위 테스트를 추가로 작성한다.

## 금지 사항

- **테스트 없이 알고리즘 함수 커밋 금지.** "급해서", "간단해서" 예외 없음.
- **기존 테스트를 수정하여 통과시키는 것 금지.** 테스트가 틀렸다고 판단되면 사용자에게 근거와 함께 확인받는다.
- **구현 먼저 → 테스트 나중 금지.** 이 순서로 쓰면 구현의 허점을 놓친다.
- **"수동으로 브라우저에서 확인"으로 테스트 대체 금지.** 기하·수치 로직은 반드시 자동 테스트.

## 기존 함수 버그 수정 절차

1. 사용자가 보고한 버그의 **입력·기대 출력·실제 출력**을 받아낸다.
2. 그 입력을 그대로 테스트로 복사해 넣는다. 실행하여 FAIL 확인(= 버그 재현 성공).
3. 구현 수정 → 해당 테스트 PASS + 기존 테스트 전체 PASS.
4. 커밋 메시지에 `fix(xxx): {증상} — 재현 테스트 추가` 형식으로 기록한다.

## 테스트 실행

```bash
node tests/test_generator_stub.js
node tests/test_custom_render.js
node tests/test_m7_core.js
# 새 파일 추가 시: node tests/test_새파일.js
```

모든 테스트 파일이 `node` 단독 실행으로 PASS해야 한다.
테스트 러너 프레임워크(Jest 등) 도입 금지 — 바닐라 assert로 충분하다.

## M7 잔여 스텁 (TDD 필수 적용)

- [ ] S15B `enumerateCongruentPairs`
- [ ] S15D `minimizeShapeCount`
- [ ] S18 `buildStrokeGraph`
- [ ] S23 `buildHexCluster`

각 함수는 반드시 **테스트 파일이 먼저 존재**해야 한다.
