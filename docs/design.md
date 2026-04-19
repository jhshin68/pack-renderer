# SL Power — Pack Intelligence Design System

> **목적**: 이 문서 하나만 읽어도 Pack-Renderer UI의 색·타입·여백·규칙을 그대로 재현/변경할 수 있는 단일 레퍼런스.

---

## 1. 디자인 철학 (5 Principles)

1. **Engineering-grade precision** — 각진 디테일, 좁은 radius(3–10px), 견고한 테두리. 둥글고 투명한 소프트 UI 금지.
2. **Signal vs chrome** — Electric Blue(`#1E4FD8`)는 CTA · 활성 상태 · 라이브 데이터에만. 대형 배경 사용 절대 금지.
3. **Mono for data, Inter for prose** — 숫자·라벨 = JetBrains Mono, 본문/한국어 = Inter / IBM Plex Sans KR.
4. **Authority = deep navy** — `ink-800 #101A2E`는 사이드바·헤더 권위 색. 캔버스는 `mist-100 #EDF2F8`.
5. **Blueprint mindset** — 치수선, 코너 틱, ALLCAPS mono 레이블로 "이건 엔지니어링 제품" 선언.

---

## 2. 색상 토큰 (CSS Custom Properties)

### 2.1 `:root` 전체 목록

```css
:root {
  /* ── Ink (Authority — 사이드바·헤더) ── */
  --ink-900: #070C18;
  --ink-800: #101A2E;   /* 사이드바 base */
  --ink-700: #18243E;   /* raised surface */
  --ink-600: #203052;   /* hover surface */
  --ink-500: #2A3E66;   /* active / selected */
  --ink-400: #36487A;   /* visible border on dark */

  /* ── Mist (Neutral — 캔버스·텍스트·보더) ── */
  --mist-100: #EDF2F8;  /* 내부 툴 캔버스 bg */
  --mist-200: #CBD6E5;  /* visible border */
  --mist-400: #6B7E9A;  /* fg3 hint (12px+) */
  --mist-500: #4A5A77;  /* fg2 secondary */
  --mist-800: #10192E;  /* fg1 primary (light surface) */

  /* ── Blue (Signal — CTA·활성·라이브 전용) ── */
  --blue-400: #5E87F4;  /* dark chrome 위 primary */
  --blue-600: #1E4FD8;  /* light 위 primary · 브랜드 기본 */
  --blue-700: #1740B5;  /* hover */

  /* ── Status ── */
  --ok:      #047857;   --ok-fg:   #4ADE80;
  --warn:    #B45309;   --warn-fg: #FBBF24;
  --err:     #B91C1C;   --err-fg:  #FB7185;

  /* ── Semantic Aliases (실제 사용 변수) ── */
  --bg-canvas:  var(--mist-100);   /* 중앙 캔버스 배경 */
  --bg-surface: #FFFFFF;           /* 카드 */
  --bg-chrome:  var(--ink-800);    /* 사이드바/헤더 */
  --bg-chrome-2: var(--ink-700);
  --bg-chrome-3: var(--ink-600);

  --fg1-dark: #F3F6FC;   /* 15:1 on ink-800 — 주 텍스트 */
  --fg2-dark: #B8C5DB;   /* 7.1:1 — 보조 텍스트 */
  --fg3-dark: #8094B4;   /* 4.7:1, 12px+ — 힌트 */

  --fg1: var(--mist-800);  /* 16:1 on white */
  --fg2: var(--mist-500);  /* 7.2:1 */
  --fg3: var(--mist-400);  /* 4.6:1 */

  --bd-dark: var(--ink-400);    /* dark chrome 위 보더 */
  --bd-light: var(--mist-200);  /* light canvas 위 보더 */

  --accent:       var(--blue-600);
  --accent-dark:  var(--blue-400);   /* dark chrome 위 accent */
  --accent-hover: var(--blue-700);
  --accent-tint:  rgba(30,79,216,.14);
  --accent-ghost: rgba(30,79,216,.07);
  --accent-glow:  0 0 0 3px rgba(30,79,216,.22);

  /* ── Shadow ── */
  --sh-1: 0 1px 2px rgba(15,23,42,.04);
  --sh-2: 0 1px 6px rgba(0,0,0,.06), 0 4px 20px rgba(0,0,0,.04);
  --sh-3: 0 4px 24px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.06);
  --glow-blue-sm: 0 1px 8px  rgba(30,79,216,.30);
  --glow-blue-md: 0 2px 12px rgba(30,79,216,.35);
  --glow-blue-lg: 0 4px 20px rgba(30,79,216,.50);

  /* ── Motion ── */
  --dur-fast: 0.14s;
  --ease: cubic-bezier(.4,0,.2,1);

  /* ── Radius ── */
  --r: 6px;   /* 기본 */
}
```

### 2.2 화면별 색 조합

| 영역 | Base bg | 주 텍스트 | Accent |
|---|---|---|---|
| 사이드바 (좌·우) | `ink-800 #101A2E` | `#F3F6FC` (fg1-dark) | `#5E87F4` (blue-400) |
| 중앙 캔버스 | `mist-100 #EDF2F8` | `#10192E` (fg1) | `#1E4FD8` (blue-600) |
| SVG 카드 | `#FFFFFF` | `#10192E` | — |

### 2.3 전기화학 시각화 전용 색 (UI chrome 금지)

| 역할 | HEX |
|---|---|
| B+ 단자 (양극) | `#E11D48` |
| B− 단자 (음극) | `#0EA5E9` |
| 그룹 A | `#8B5CF6` |
| 그룹 B | `#10B981` |
| 그룹 C | `#F59E0B` |

---

## 3. 타이포그래피

### 3.1 Font Stack

```css
--font-sans: 'Inter', 'IBM Plex Sans KR', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;
```

Google Fonts 로드:
```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### 3.2 타입 스케일 (4px base)

| 역할 | px | weight | 비고 |
|---|---|---|---|
| micro-label | 10 | 500 | ALLCAPS, mono, letter-spacing 1.5px |
| hint | 11 | 400 | mono, fg3 |
| body-sm | 12 | 400 | |
| body | 13 | 400 | UI 기본 |
| body-md | 14 | 500 | 강조 body |
| ui-label | 16 | 600 | 버튼, 탭 |

### 3.3 시그니처 규칙

- **ALLCAPS mono micro-label**: 모든 섹션 헤더 → `10px / 500 / uppercase / 1.5px tracking / fg2-dark / JetBrains Mono`
- **Accent strip**: 섹션 헤더 좌측 `2px × 10px` 파란 수직 바 (`.ctrl-label::before`)
- **Numeric**: JetBrains Mono + `font-variant-numeric: tabular-nums`
- **한국어 본문**: IBM Plex Sans KR, `line-height: 1.65`

---

## 4. 여백 · Radii · 그림자

### 4.1 Spacing (4px grid)

`4 · 8 · 10 · 12 · 16 · 20 · 24 · 28 · 32` px.

### 4.2 Radii

| 값 | 용도 |
|---|---|
| 3px | 칩, 뱃지 |
| 4px | 버튼, 입력 |
| 6px | 카드 기본 (`--r`) |
| 8px | 모달, SVG 카드 |
| 10px | 팝오버 |

Pill(9999px) 금지 — CTA는 6px 사각.

### 4.3 그림자 사용 규칙

- 캔버스 카드: `--sh-2`
- 사이드바 raised surface: 없음 (border만)
- 파란 CTA 버튼: `--glow-blue-md`
- 파란 버튼 hover: `--glow-blue-lg`

---

## 5. 컴포넌트 규칙

### 5.1 사이드바 섹션 헤더 (`.ctrl-label`)

```css
.ctrl-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px; font-weight: 500;
  letter-spacing: 1.5px; text-transform: uppercase;
  color: var(--fg2-dark);
  position: relative; padding-left: 9px;
}
.ctrl-label::before {
  content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 2px; height: 10px; background: var(--accent-dark); border-radius: 1px;
}
```

### 5.2 Segmented Control (`.seg`)

- Base: `ink-700` bg + `ink-400` border
- Active: `blue-600` bg, white text, `glow-blue-sm`
- Hover: `ink-600` bg

### 5.3 Number Stepper

- 버튼: 17px × 17px, `ink-700` bg, `ink-400` border
- 값 표시: JetBrains Mono, 12px/500, `fg1-dark`
- 입력 포커스: `blue-600` border

### 5.4 Toggle

- Off: `ink-400` track
- On: `blue-600` track
- Knob: white, `0 1px 3px rgba(0,0,0,.3)` shadow

### 5.5 Primary CTA Button (`.render-btn`)

```css
background: var(--accent);
color: #fff;
box-shadow: var(--glow-blue-md);
border-radius: var(--r);   /* 6px, NOT pill */
```
Hover: `--accent-hover` + `--glow-blue-lg` + `translateY(-1px)`

### 5.6 후보 카드 (`.cand-card`)

- Base: `ink-700` bg + `ink-400` border
- Hover: `blue-600` border
- Selected: `blue-600` border + `accent-ghost` bg

### 5.7 섹션 구분선 (`.ctrl-sep`)

```css
height: 1px; background: var(--bd-dark); opacity: .8; margin: 4px 0;
```

---

## 6. Do / Don't

### ✅ DO

- CTA · 활성 상태 · 라이브 값에만 Electric Blue.
- 섹션 헤더는 ALLCAPS mono + 좌측 2px 파란 accent strip.
- 숫자는 JetBrains Mono + `tabular-nums`.
- Radius 3–10px. CTA는 6px 사각.
- 파란 버튼에만 `glow-blue-*` 사용.
- Dark surface 위 fg: `#F3F6FC` → `#B8C5DB` → `#8094B4` 순서 사용.

### ❌ DON'T

- `blue-600` 대형 단색 배경.
- Pill 버튼 (9999px radius).
- Inter 300 weight.
- 이모지 UI 장식.
- 구 accent 색 `#2563EB` 재사용 (→ `#1E4FD8`).
- 사이드바 위 `#EDF2F8` 밝은 요소 삽입.

---

## 7. 접근성 (AA 기준)

| 역할 | 색 | 대비비 |
|---|---|---|
| fg1 on white | `#10192E` | 16:1 |
| fg2 on white | `#4A5A77` | 7.2:1 |
| fg3 on white | `#6B7E9A` | 4.6:1 (12px+) |
| fg1-dark on ink-800 | `#F3F6FC` | 15:1 |
| fg2-dark on ink-800 | `#B8C5DB` | 7.1:1 |
| fg3-dark on ink-800 | `#8094B4` | 4.7:1 (12px+) |
| accent on white | `#1E4FD8` | 6.1:1 |
| accent-dark on ink-800 | `#5E87F4` | 6.3:1 |

---

## 8. 변경 시 체크리스트

1. `:root` 토큰만 수정 — 컴포넌트 하드코딩 금지.
2. 새 accent는 light(white) + dark(ink-800) 양쪽 AA 이상 확인.
3. 신규 색은 `50~900` 풀 스케일로 정의.
4. `docs/design.md` 해당 표 업데이트.
