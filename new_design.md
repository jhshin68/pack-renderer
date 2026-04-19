# SL Power — Design Reference (design.md)

> **목적**: 이 문서 하나만 읽어도 SL Power 디자인 시스템의 색·타입·여백·규칙을 그대로 재현/변경할 수 있도록 정리한 단일 레퍼런스.
> **소스**: `colors_and_type.css`, `README.md`, `SKILL.md`, `preview/*`, `ui-kits/*`.

---

## 1. 디자인 철학 (5 Principles)

1. **Engineering-grade precision** — 각진 디테일, 좁은 radius, 견고한 테두리. 둥글고 투명한 소프트 UI 금지.
2. **Signal vs chrome** — Electric Blue(#1E4FD8)는 CTA · 활성 상태 · 라이브 데이터에만. 대형 배경에 절대 금지.
3. **Mono for data, Inter for prose** — 숫자·라벨 = JetBrains Mono, 본문 = Inter / IBM Plex Sans KR.
4. **Authority = deep navy** — `ink-800 #101A2E` 은 사이드바·헤더 권위 색. 캔버스는 `mist-100 #EDF2F8`.
5. **Blueprint mindset** — 치수선, 코너 틱, 도트 그리드로 "이건 엔지니어링 제품" 선언.

---

## 2. 색상 토큰 (Color Tokens)

### 2.1 Blue — Signal (CTA · 활성 · 라이브 데이터 전용)

| Token | HEX | 용도 |
|---|---|---|
| `--slp-blue-50` | `#EEF3FF` | 가장 연한 배경 틴트 |
| `--slp-blue-100` | `#D6E2FE` | hover ghost |
| `--slp-blue-200` | `#B4C9FC` | |
| `--slp-blue-300` | `#87A6F8` | |
| `--slp-blue-400` | `#5E87F4` | **Dark chrome 위 primary** (AA on ink-800 = 6.3:1) |
| `--slp-blue-500` | `#2E6BEA` | |
| `--slp-blue-600` | `#1E4FD8` | **Light 위 primary** (AA on white = 6.1:1) · 브랜드 기본 |
| `--slp-blue-700` | `#1740B5` | hover |
| `--slp-blue-800` | `#143591` | |
| `--slp-blue-900` | `#0E266B` | |

### 2.2 Ink — Authority (딥 네이비, 사이드바·헤더)

| Token | HEX | 용도 |
|---|---|---|
| `--slp-ink-900` | `#070C18` | 가장 깊은 페이지 bg (dark) |
| `--slp-ink-800` | `#101A2E` | **사이드바 base** (권위 색) |
| `--slp-ink-700` | `#18243E` | raised surface |
| `--slp-ink-600` | `#203052` | hover surface |
| `--slp-ink-500` | `#2A3E66` | active / selected |
| `--slp-ink-400` | `#36487A` | dark 위 visible border |
| `--slp-ink-300` | `#4A5E90` | light divider |

### 2.3 Mist — Neutral (캔버스 · 텍스트 · 보더)

| Token | HEX | 용도 |
|---|---|---|
| `--slp-mist-50` | `#F7FAFD` | 마케팅 페이지 bg |
| `--slp-mist-100` | `#EDF2F8` | **내부 툴 캔버스 bg** |
| `--slp-mist-200` | `#CBD6E5` | visible border |
| `--slp-mist-300` | `#9AABC2` | |
| `--slp-mist-400` | `#6B7E9A` | fg3 hint (12px+ only, 4.6:1) |
| `--slp-mist-500` | `#4A5A77` | fg2 secondary (7.2:1) |
| `--slp-mist-600` | `#2F3D5A` | |
| `--slp-mist-700` | `#1E2C47` | |
| `--slp-mist-800` | `#10192E` | **fg1 primary text** (16.1:1 on white) |
| `--slp-mist-900` | `#070C18` | |

### 2.4 Cell — Electrochemistry (제품 시각화 전용, UI chrome 금지)

| Token | HEX | 의미 |
|---|---|---|
| `--slp-cell-positive` | `#E11D48` | B+ 단자 (적색 = anode convention) |
| `--slp-cell-negative` | `#0EA5E9` | B− 단자 |
| `--slp-cell-group-a` | `#8B5CF6` | 그룹 A (보라) |
| `--slp-cell-group-b` | `#10B981` | 그룹 B (에메랄드) |
| `--slp-cell-group-c` | `#F59E0B` | 그룹 C (앰버) |
| `--slp-cell-group-d` | `#EC4899` | 그룹 D (핑크) |

### 2.5 Status — Semantic Feedback

| 상태 | On White | On Dark (ink-800) |
|---|---|---|
| OK | `--slp-ok` `#047857` | `--slp-ok-fg` `#4ADE80` |
| Warn | `--slp-warn` `#B45309` | `--slp-warn-fg` `#FBBF24` |
| Error | `--slp-err` `#B91C1C` | `--slp-err-fg` `#FB7185` |
| Info | `--slp-info` `#1E4FD8` | — |

### 2.6 Semantic Aliases (실제 사용 변수)

```
--bg-canvas    = mist-100 #EDF2F8   (내부 툴 캔버스)
--bg-surface   = #FFFFFF            (카드)
--bg-chrome    = ink-800 #101A2E    (사이드바/헤더)
--bg-chrome-2  = ink-700 #18243E
--bg-chrome-3  = ink-600 #203052
--bg-overlay   = rgba(10,18,32,.72)

--fg1 (light)  = mist-800 #10192E   primary
--fg2 (light)  = mist-500 #4A5A77   secondary
--fg3 (light)  = mist-400 #6B7E9A   tertiary
--fg1-dark     = #F3F6FC            (15:1 on ink-800)
--fg2-dark     = #B8C5DB            (7.1:1)
--fg3-dark     = #8094B4            (4.7:1, 12px+ only)

--bd1          = mist-200 #CBD6E5   visible divider
--bd2          = #DDE5F0            hairline
--bd-dark      = ink-400 #36487A    on dark chrome

--accent       = blue-600 #1E4FD8
--accent-dark  = blue-400 #5E87F4
--accent-hover = blue-700 #1740B5
--accent-tint  = rgba(30,79,216,.14)
--accent-ghost = rgba(30,79,216,.07)
--accent-glow  = 0 0 0 3px rgba(30,79,216,.22)
```

---

## 3. 화면 성격별 색 조합 (Screen Context Map)

| 화면 종류 | Base bg | 주 텍스트 | Accent |
|---|---|---|---|
| 내부 툴 · 엔지니어링 (Pack Intelligence류) | ink-800 사이드바 + mist-100 캔버스 | F3F6FC on dark · 10192E on light | 5E87F4 on dark · 1E4FD8 on light |
| 기업 웹사이트 · 마케팅 | mist-50 #F7FAFD + 히어로만 #070C18 블루프린트 | #10192E | #1E4FD8 |
| 프린트 · 카탈로그 | #FFFFFF | #10192E | #1E4FD8 (아주 절제) |

---

## 4. 타이포그래피 (Typography)

### 4.1 Font Families

```
--font-sans : Inter, IBM Plex Sans KR, system fallback
--font-mono : JetBrains Mono, ui-monospace
--font-kr   : IBM Plex Sans KR, Inter, system
```

### 4.2 Scale (4px base · modular 1.2)

`9.5 · 10 · 11 · 12 · 13 · 14 · 16 · 18 · 20 · 24 · 30 · 36 · 48 · 64` px.

- `13px` = UI 본문 기본
- `12px` = body-sm (fg2)
- `11px` = mono data rows
- `10px` = ALLCAPS 마이크로 라벨
- `48px` = hero / num-lg

### 4.3 Weights

`400 reg · 500 med · 600 sb · 700 b`. Inter 300 금지.

### 4.4 Heading Spec

| Level | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|
| h1 | 48 | 700 | -0.5 (xtight) | 1.15 |
| h2 | 30 | 700 | -0.2 (tight) | 1.35 |
| h3 | 20 | 600 | -0.2 | 1.35 |
| h4 | 16 | 600 | 0 | 1.35 |
| p · body | 13 | 400 | 0 | 1.55 |
| body-sm | 12 | 400 | 0 | 1.55 |

### 4.5 Signature Rules

- **ALLCAPS mono micro-label**: `.ulabel` — `font-mono 10px / 500 / uppercase / letter-spacing 1.5px / fg2`.
- **Accent strip**: `.ulabel-accent` — 좌측 2px×10px 파란 수직 바 (모든 섹션 헤더).
- **Numeric**: `.num` — JetBrains Mono + `font-variant-numeric: tabular-nums` 필수.
- **Hint**: `.hint` — mono 11px, fg3.
- **Korean body**: `:lang(ko)` / `.kr` → Plex KR, `line-height: 1.6–1.7`.

---

## 5. Spacing · Radii · Shadow · Motion

### 5.1 Spacing (4px grid)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96` px.

### 5.2 Radii (작고 엔지니어링적)

`3 · 4 · 5 · 6(default) · 8(cards) · 10` px.  
`999px (pill)` = 탭 / 스코어 칩에만 사용.

### 5.3 Shadows

**System A — 종이 엘리베이션 (light canvas)**
```
--sh-1 : 0 1px 2px rgba(15,23,42,.04)
--sh-2 : 0 1px 6px rgba(0,0,0,.06), 0 4px 20px rgba(0,0,0,.04)
--sh-3 : 0 4px 24px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.06)
--sh-4 : 0 12px 40px rgba(15,23,42,.12)
```

**System B — 시그널 글로우 (파란 CTA·라이브 데이터 전용)**
```
--glow-blue-sm : 0 1px 8px  rgba(37,99,235,.30)
--glow-blue-md : 0 2px 12px rgba(37,99,235,.35)
--glow-blue-lg : 0 4px 20px rgba(37,99,235,.50)
```

### 5.4 Motion

`--dur-fast 0.14s` = UI 기본. ease `cubic-bezier(.4,0,.2,1)`.

---

## 6. 시그니처 (반드시 반복할 DNA)

1. **ALLCAPS mono label + 2px 파란 수직 바** — 모든 섹션 헤더.
2. **Blueprint grid 배경** — 히어로 · 제품 시각화 · PDF export.
3. **Dimension lines (치수선)** — 제품 도면에 `A←→B · 620.0 mm` 스타일.
4. **Cell dot + nickel trace** — 제품·브랜드 비주얼 DNA.
5. **Tabular numerals** — 모든 수치 정렬.

---

## 7. Do / Don't

### ✅ DO

- CTA · 활성 상태 · 라이브 값에만 Electric Blue.
- 섹션 헤더는 ALLCAPS mono + accent strip.
- 숫자는 JetBrains Mono + tabular-nums.
- 라디우스 3~10px, 기본 6px.
- 파란 버튼에만 `glow-blue-*` 사용.

### ❌ DON'T

- `blue-500` 대형 단색 배경 (grad 또는 ink-800만).
- Pill 버튼 (CTA = 6px 사각).
- Inter 300 weight.
- 이모지 UI 장식 (제품 금지 · 기업 사이트도 지양).
- 옛 색 `#2563EB` (→ `#1E4FD8`), `#141E30` (→ `#101A2E`) 재등장.

---

## 8. 접근성 (AA 기준)

| 역할 | 색 | 대비비 |
|---|---|---|
| fg1 on white | `#10192E` | 16:1 |
| fg2 on white | `#4A5A77` | 7.2:1 |
| fg3 on white | `#6B7E9A` | 4.6:1 (12px+) |
| fg1 on ink-800 | `#F3F6FC` | 15:1 |
| fg2 on ink-800 | `#B8C5DB` | 7.1:1 |
| fg3 on ink-800 | `#8094B4` | 4.7:1 (12px+) |
| accent on white | `#1E4FD8` | 6.1:1 |
| accent on ink-800 | `#5E87F4` | 6.3:1 |

---

## 9. 변경 시 체크리스트 (Design Change Protocol)

새 색상/기준으로 바꾸려면 이 순서로:

1. **`colors_and_type.css`의 토큰을 먼저 수정** — 화면별 하드코딩 금지.
2. 새 accent는 반드시 **light(white) + dark(ink-800) 양쪽에서 AA 이상** 확인.
3. 신규 색이 등장하면 `--slp-<family>-50~900` 10단 풀 스케일로 정의.
4. `preview/color-*.html` 에 swatch 카드 추가.
5. `ui-kits/pack-intelligence.html` · `ui-kits/corporate-site.html` 두 화면에서 시각 검수.
6. README / SKILL / **이 design.md**의 해당 표 업데이트.

---

## 10. 파일 진입점

```
colors_and_type.css      ← 토큰 단일 소스 (먼저 수정)
assets/logo-*.svg        ← 브랜드 마크
preview/comp-*.html      ← 컴포넌트 단일 프리뷰
preview/color-*.html     ← 색 스와치
ui-kits/pack-intelligence.html  ← 내부 툴 기준 화면
ui-kits/corporate-site.html     ← 기업 사이트 기준 화면
```

신규 화면:
```html
<link rel="stylesheet" href="../colors_and_type.css">
```
그리고 `ui-kits/*.html` · `preview/*.html` 에서 카피·페이스트.
