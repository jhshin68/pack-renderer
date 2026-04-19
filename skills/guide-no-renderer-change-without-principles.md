# 렌더러 변경 금지 가이드 — 원칙 미확인 시 코드 수정 금지

> 작성 경위: 2026-04-18 세션에서 원칙 10·18을 읽지 않고 renderer.js를 수정하여
>             잘못된 SVG 출력이 발생했고, 전체 원복이 필요했다. 동일 실수 방지용.

---

## Rule 1 — Renderer 변경 전 의무 체크리스트

renderer.js / drawNickel* / renderCustom* 함수를 수정하기 **전에** 반드시 아래 두 파일을 읽어라.

```
[ ] skills/nickel_plate_principles.md — 원칙 10, 18 확인
[ ] skills/nickel_render_rules.md    — 렌더링 체크리스트 확인
```

읽지 않고 코드 수정 → **즉시 중단, 파일 먼저 읽기**.

---

## Rule 2 — H-block 면 집전 구현의 선행 조건

H-block 면 집전(`<rect>` 기반 솔리드 플레이트)은 **아래 순서가 선행**되어야만 구현 가능하다.

1. **Generator 토폴로지 변경 먼저**: 4그룹 병합 H-block 구조를 generator.js가 생성해야 함
2. **원칙 14 개정 또는 예외 승인**: 현재 원칙 14는 최대 2그룹 병합. H-block은 4그룹 → 충돌
3. **Renderer는 Generator 종속**: Generator 출력 구조가 바뀐 후에야 Renderer 변경 가능

> Renderer만 먼저 바꾸면 Generator가 생성하는 `{type:'U', groups:[g, g+1]}` 구조와
> 맞지 않아 잘못된 시각화가 발생한다.

---

## Rule 3 — `<line>` 요소 = 원칙 10 사다리 구조의 구현체

```
원칙 10 (LAYER 2, 이진 체크 대상):
  "니켈 플레이트는 그룹 내 모든 셀을 접촉하는 사다리(ladder) 구조여야 한다.
   정배열: 수직 스파인 + 수평 브리지 = 직사각형 사다리"
```

**`<line>` = 이 사다리 구조의 정확한 SVG 표현이다.**

"daisy-chain"은 **전기 집전 토폴로지**(셀 순차 연결)를 가리키는 용어이며,
SVG `<line>` 렌더 요소와 **동일하지 않다**.

따라서:
- "`<line>` 요소를 `<rect>`로 교체한다" = 원칙 10 위반
- "`<line>` 0개" 를 성공 기준으로 삼는 테스트 = 잘못된 기준

---

## Rule 4 — 테스트 성공 기준을 원칙과 먼저 대조하라

TDD RED 단계에서 테스트를 작성하기 전에:

```
1. 성공 기준이 원칙(LAYER 0·1·2)과 충돌하지 않는가?
2. 성공 기준이 현재 렌더 규칙(LAYER 4)과 일치하는가?
```

**예시 (잘못된 기준)**:
```js
// ❌ WRONG — <line> 은 원칙 10의 구현체이므로 0개가 정답이 아님
assert('nickel <line> 0개', countNickelLines(svg) === 0);
```

**예시 (올바른 기준)**:
```js
// ✅ CORRECT — 렌더된 원소가 원칙에서 허용하는 형태인지 확인
assert('ladder spine line 존재', svg.includes('<line'));
assert('daisy-chain 연결선 없음', countDaisyChainConnectors(svg) === 0);
```

---

## 사고 순서 요약

```
[요청 수신]
   ↓
[1] 작업 종류 파악 → CLAUDE.md 작업 유형별 필독 파일 확인
   ↓
[2] 렌더링 변경 → nickel_plate_principles.md + nickel_render_rules.md 읽기
   ↓
[3] H-block 구현 요청 → "Generator 먼저" 확인 → 원칙 14 충돌 여부 확인
   ↓
[4] 테스트 작성 → 성공 기준이 원칙과 충돌하지 않는지 대조
   ↓
[5] 코드 수정
```

---

## 사고 실험 체크 (코드 수정 직전)

아래 질문에 모두 YES가 되어야 수정 가능:

- [ ] 관련 원칙 파일을 이 세션에서 읽었는가?
- [ ] 수정 대상 함수의 SVG 요소 변경이 원칙 10 사다리 구조를 보존하는가?
- [ ] 커스텀 경로 수정이 원칙 18 "인접 셀 쌍 연결선" 알고리즘을 보존하는가?
- [ ] Generator 구조 변경 없이 Renderer만 변경하는 것인가? (그렇다면 H-block 구현 불가)
