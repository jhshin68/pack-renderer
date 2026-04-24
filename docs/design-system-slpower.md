# Design System — SLPOWER BATTERY
> Version 1.0 | 2026.04 | Based on slpower.co.kr

---

## 1. Visual Theme & Atmosphere

SLPOWER BATTERY는 **어둠 위에서 빛나는 에너지**를 시각 언어로 삼는 웹사이트다. 메인 히어로는 보케(bokeh) 파티클이 우주적으로 흩어지는 다크 배경 영상을 전면에 내세우며, 보는 사람을 즉각적으로 첨단 기술의 한가운데로 이끈다. 이 어둠은 공허한 검정이 아니라, 마그네타·시안·퍼플·민트의 발광 입자들이 떠다니는 무대 배경이다 — 마치 산업 현장의 야간 공장과 SF 영화 세트가 겹쳐진 듯한 인상이다.

브랜드의 핵심 신호는 **SL Power Red `#E60012`** 다. 이 레드는 로고의 'SL' 아이콘에서 처음 발사되어 서브 비주얼 배너의 파동형 그래픽, 프로세스 섹션의 오버라인 레이블, 링크 하이라이트에까지 일관되게 등장한다. 기술·에너지 산업에서 레드는 경고가 아닌 파워(출력)를 상징하며, SLPOWER는 이 색을 정확히 그런 의도로 다룬다.

타이포그래피는 이중 체계로 운영된다. 한국어 본문과 UI는 **Pretendard**가, 영문 헤드라인과 숫자·레이블은 **Exo 2**가 맡는다. Exo 2의 기하학적 사각형 구조는 배터리·로봇·자동화라는 산업적 맥락과 정확히 맞닿아 있으며, Pretendard는 그 위에 한국어의 가독성을 확보한다.

레이아웃은 풀페이지 스크롤(fullPage.js)을 채택하여 각 섹션이 독립된 '슬라이드'처럼 전환된다. 흰 배경 섹션과 다크 배경 섹션이 교차하며 리듬을 만들고, 서브 페이지는 상단 300px 비주얼 배너 뒤로 클린한 화이트 본문 영역이 펼쳐진다.

**Key Characteristics:**

- 히어로는 전체화면 다크 배경 + 발광 파티클 영상/이미지 슬라이더
- 브랜드 레드(`#E60012`)가 유일한 고에너지 액센트로 기능
- 이중 폰트 체계: Exo 2(영문·숫자) + Pretendard(한국어·UI)
- 흰 배경(`#FFFFFF`)과 다크 섹션이 교차하는 섹션 리듬
- 카드: 20px border-radius + 단일 소프트 그림자 `rgba(136,136,136,0.2) 0px 0px 30px`
- 서브 비주얼 배너: 300px 고정 높이, 배경 이미지 center/cover
- 푸터: 짙은 차콜(`#111111`)에 30px 상단 라운딩, 분리된 섬처럼 착지

---

## 2. Color Palette & Roles

### Primary

| 이름 | Hex | 역할 |
|---|---|---|
| SL Power Red | `#E60012` | 브랜드 액센트, 로고 아이콘, 오버라인 레이블, 링크 강조, 태그 테두리 |
| Pure White | `#FFFFFF` | 페이지 기본 배경, 다크 표면 위 텍스트, 탭 활성 버튼 배경 |
| Near Black | `#111111` | 최상위 강조 텍스트(헤드라인), 탭 활성 버튼 배경, 푸터 배경 |

### Neutrals & Text

| 이름 | Hex | 역할 |
|---|---|---|
| Deep Ink | `#222222` | 섹션 타이틀(h3 수준), 본문 기본 텍스트 |
| Medium Gray | `#666666` | 가장 빈번한 UI 텍스트 — 네비게이션, 본문, 캡션의 기본 색상 |
| Muted Label | `#999999` | 제품 카드 카테고리 레이블, 서브 텍스트 |
| Light Gray BG | `#F5F5F5` | 해시태그/태그 배경, 입력 필드 배경 |
| Image BG | `#F3F3F3` | 제품 카드 이미지 컨테이너 배경 |
| Divider | `#E0E0E0` | 테이블 라인, 구분선, 카드 테두리 |
| Ghost White | `rgba(255,255,255,0.15)` | 히어로 슬라이드 인디케이터(비활성) |

### Dark Surface

| 이름 | 값 | 역할 |
|---|---|---|
| Charcoal | `#111111` | 푸터 배경 |
| Nav Overlay | `rgba(0,0,0,0.8)` | 스크롤 시 헤더 네비게이션 배경 |
| Hero Dim | `rgba(0,0,0,0.7)` | 비주얼 슬라이드 이미지 위 어두운 오버레이 |

### Semantic

| 이름 | 값 | 역할 |
|---|---|---|
| Copyright Gray | `rgba(255,255,255,0.3)` | 푸터 카피라이트 텍스트 |
| Footer Text | `#FFFFFF` | 푸터 주소/연락처 내용 |
| Footer Label | `#FFFFFF` weight 500 | Address, Tel 등 푸터 DT 레이블 |

---

## 3. Typography Rules

### Font Family

**Display & English Headlines: Exo 2**
```css
--engFont: 'Exo 2', 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', verdana, sans-serif;
```
- 특성: 기하학적 산세리프. 사각형 구조감이 배터리·로봇·자동화 산업 이미지와 정합
- 사용처: 영문 헤드라인, 숫자 강조, 프로세스 레이블, DT 요소, 히어로 서브타이틀, 푸터

**Korean Body & UI: Pretendard**
```css
--baseFont: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', verdana, sans-serif;
```
- 특성: 모던 한국어 산세리프. 다양한 굵기(200–700) 지원, 가독성 최우선
- 사용처: 본문, 설명 텍스트, 네비게이션, 버튼, 캡션, 한국어 헤딩

### Typography Hierarchy

| 역할 | 크기 | 굵기 | 폰트 | 색상 | Letter-Spacing | Line-Height |
|---|---|---|---|---|---|---|
| 히어로 메인 카피 | ~40–48px | 700 | Pretendard | `#FFFFFF` | -0.02em | 1.5 |
| 히어로 서브타이틀 | 21px | 300 | Exo 2 | `rgba(255,255,255,0.85)` | normal | 1.3 |
| 섹션 제목 (title-box h3) | 72px / 7.2rem | 700 | Exo 2 | `#111111` | -0.01em | 1.3 |
| 섹션 부제 (title-box p) | 21px | 300 | Pretendard | `#222222` | -0.03em | 1.3 |
| 서브 비주얼 배너 타이틀 | 40.8px | 600 | Pretendard | `#FFFFFF` | -0.02em | 1.5 |
| 서브 페이지 섹션 h3 | 31.2px | 700 | Pretendard | `#111111` | -0.02em | 1.3 |
| 프로세스 단계명 (dt) | 33.6px | 700 | Exo 2 | `#111111` | -0.02em | 1.3 |
| 파트너/제품 섹션 h3 | 36px | 700 | Pretendard | `#111111` | -0.01em | 1.3 |
| 제품 카드 강조 (dt strong) | 24px | 600 | Pretendard | `#222222` | normal | 1.3 |
| 제품 카드 카테고리 (dt) | 17px | 500 | Pretendard | `#999999` | normal | 1.3 |
| 오버라인 레이블 (em) | 17px | 700 | Exo 2 | `#E60012` | normal | 1.3 |
| 본문 텍스트 (p) | 17px | 300 | Pretendard | `#222222` | -0.02em | 1.6 |
| 강조 본문 (strong) | 17px | 600 | Pretendard | `#222222` | normal | 1.3 |
| 프로세스 설명 (dd) | 17px | 300 | Pretendard | `#666666` | -0.02em | 1.6 |
| UI / 네비 텍스트 | 16px | 400 | Pretendard | `#666666` | normal | 1.3 |
| 탭 버튼 (활성) | 16px | 500 | Pretendard | `#FFFFFF` | normal | 1.3 |
| 탭 버튼 (비활성) | 16px | 600 | Pretendard | `#111111` | normal | 1.3 |
| 해시태그 / 배지 | 15–16px | 400 | Pretendard | `#888888` | normal | 1.3 |
| 푸터 레이블 (dt) | 17px | 500 | Exo 2 | `#FFFFFF` | normal | 1.3 |
| 푸터 내용 (dd) | 17px | 200 | Exo 2 | `#FFFFFF` | normal | 1.3 |
| 푸터 카피라이트 | 17px | 200 | Exo 2 | `rgba(255,255,255,0.3)` | normal | 1.3 |
| Scroll down 텍스트 | 21px | 300 | Exo 2 | `#FFFFFF` | normal | 1.0 |

### Principles

SLPOWER의 타이포그래피는 **영문·숫자는 강하게, 한국어는 유려하게**라는 원칙을 따른다. Exo 2의 기하학적 Bold는 기술 용어(Robot, UPS, ESS, BMS)와 프로세스 단계명에 집중 배치되어 브랜드의 기계적 정밀함을 표현하고, Pretendard의 Light와 Regular는 설명 텍스트에서 접근성을 높인다. 헤드라인은 네거티브 letter-spacing(-0.01em ~ -0.03em)으로 밀도감을 주며, 본문은 1.6의 넉넉한 line-height로 가독성을 확보한다.

---

## 4. Component Stylings

### Buttons

**탭 버튼 — Active (활성)**
```css
background: #191919;
color: #FFFFFF;
border: none;
border-radius: 8px;
padding: 10px 20px;
font-family: var(--baseFont);
font-size: 16px;
font-weight: 500;
```

**탭 버튼 — Inactive (비활성)**
```css
background: transparent;
color: #111111;
border: none;
border-radius: 8px;
padding: 10px 20px;
font-family: var(--baseFont);
font-size: 16px;
font-weight: 600;
```

**태그 / 해시태그 (기본)**
```css
background: #F5F5F5;
color: #888888;
border: none;
border-radius: 5px;
padding: 5px 12px;
font-size: 15px;
font-weight: 400;
```

**레드 태그 (강조 — Filled)**
```css
background: #E60012;
color: #FFFFFF;
border: none;
border-radius: 20px;
padding: 10px 23px;
font-size: 15px;
font-weight: 500;
```

**레드 아웃라인 태그 (Outlined)**
```css
background: transparent;
color: #E60012;
border: 1px solid #E60012;
border-radius: 15px;
padding: 7px 15px;
font-size: 15px;
font-weight: 600;
```

### Cards & Containers

**제품 카드 (.product .box)**
```css
background: #FFFFFF;
border: none;
border-radius: 20px;
box-shadow: rgba(136, 136, 136, 0.2) 0px 0px 30px 0px;
padding: 20px;
transition: transform 0.5s;
/* 이미지 컨테이너 */
/* border-radius: 20px, background: #F3F3F3, padding-bottom: 79% */
/* hover: translateY(-8px), img scale(1.05) */
```

**서브 비주얼 배너**
```css
height: 300px;
background: url(...) center center / cover no-repeat;
/* h2: Pretendard 600, 40.8px, #FFFFFF, letter-spacing: -0.02em */
```

**기업소개 아이템 카드 (.item)**
```css
background: #F5F5F5;
padding: 25px 20px;
border-radius: 8px;
/* 제목(영문): Exo 2 Bold */
/* 설명: Pretendard Regular, #666666 */
```

### Navigation

```css
header {
  position: absolute;
  z-index: 999;
  background: transparent;
}
header .navBg {
  background: rgba(0, 0, 0, 0.8); /* 스크롤 시 활성 */
  transition: background 0.3s;
}
```

| 속성 | 값 |
|---|---|
| Height (>1700px) | 100px |
| Height (≤1700px) | 90px |
| Height (≤1280px) | 80px |
| Height (≤1200px) | 70px |
| 로고 | SVG 157×54px (흰색/컬러 버전) |
| 메뉴 방식 | 햄버거 버튼 우측 + 언어 선택 드롭다운 |
| 드롭다운 | background: #FFFFFF, border-radius: 5px, padding: 10px 0 |
| 컨테이너 | .w1740 (max-width: 1780px, padding: 0 20px) |

### Footer

```css
footer {
  background: #111111;
  border-radius: 30px 30px 0 0;
  padding: 40px 0 30px;
}
```

| 요소 | 스타일 |
|---|---|
| 로고 | SVG 흰색 버전 |
| DT (레이블) | Exo 2, 17px, weight 500, #FFFFFF |
| DD (내용) | Exo 2, 17px, weight 200, #FFFFFF |
| 카피라이트 | Exo 2, 17px, weight 200, rgba(255,255,255,0.3) |

### Hero Visual

| 요소 | 스타일 |
|---|---|
| 전체 높이 | 100svh / var(--vh) |
| 이미지 오버레이 | rgba(0,0,0,0.7) |
| 메인 카피 | Pretendard 700, ~40–48px, #FFFFFF, 좌하단 배치 |
| 서브타이틀 | Exo 2 300, 21px, #FFFFFF |
| 슬라이드 인디케이터 | 40px×3px 바, rgba(255,255,255,0.15) → 활성: #FFFFFF fill |
| Scroll down | Exo 2 300, 21px, 좌측 하단 고정 |

### Process Section

| 요소 | 스타일 |
|---|---|
| 오버라인 (em) | Exo 2, 17px, 700, #E60012 |
| 단계명 (dt) | Exo 2, 33.6px, 700, #111111, letter-spacing: -0.02em |
| 설명 (dd) | Pretendard, 17px, 300, #666666, letter-spacing: -0.02em |
| 단계 내비게이터 | 흰색 텍스트 + 진행 바, 활성 단계 레드 강조 |

---

## 5. Layout Principles

### Spacing System

Base unit: **8px**

| Token | Value | 사용처 |
|---|---|---|
| space-1 | 4px | 인라인 아이콘 간격 |
| space-2 | 8px | 기본 단위, 마이크로 여백 |
| space-3 | 12px | 태그 패딩 수직 |
| space-4 | 16px | 버튼 패딩, 카드 패딩 |
| space-5 | 20px | 카드 패딩, 기본 섹션 좌우 여백 |
| space-6 | 24px | 카드 간격, 내부 컨텐츠 간격 |
| space-7 | 32px | 섹션 간 간격 (소) |
| space-8 | 40px | 카드 하단 패딩, 섹션 패딩 (소) |
| space-9 | 50px | 메인 섹션 상하 패딩 |
| space-10 | 95px | 섹션 타이틀 하단 여백 (title-box margin-bottom) |
| space-11 | 140–200px | 서브 페이지 섹션 상하 패딩 (--subPt: 140px / --subPb: 200px) |

### Grid & Container

```css
.w1920 { max-width: 1920px; }
.w1740 { max-width: 1780px; padding: 0 20px; } /* 기본 컨텐츠 컨테이너 */
.w1720 { max-width: 1760px; padding: 0 20px; }
.w1500 { max-width: 1540px; padding: 0 20px; }
.w1450 { max-width: 1490px; padding: 0 20px; }
.w1300 { max-width: 1340px; padding: 0 20px; }
```

- 제품 카드: 4열 그리드 (데스크탑) → Slick 슬라이더 (1200px 이하)
- 기업소개 아이템: 2열 그리드
- 프로세스: 좌이미지 + 우텍스트 2단 레이아웃

### Whitespace Philosophy

SLPOWER의 여백 전략은 **섹션 내 집중, 섹션 간 전환**이다. fullPage.js의 섹션 전환 방식 덕분에 각 섹션은 뷰포트 전체를 점유하고, 전환 애니메이션이 자연스러운 리듬을 만든다. 서브 페이지에서는 상단 140px, 하단 200px의 넉넉한 패딩으로 콘텐츠를 여유롭게 호흡시킨다. 섹션 타이틀 박스는 margin-bottom: 95px로 타이틀과 콘텐츠 사이를 과감히 띄운다.

### Border Radius Scale

| 값 | 맥락 |
|---|---|
| 0px | 섹션 구분선, 테이블, 직선 요소 |
| 4–5px | 해시태그, 마이크로 배지 |
| 8px | 탭 버튼, 입력 필드, 일반 카드 |
| 20px | 제품 카드, 제품 이미지 컨테이너, 강조 카드 |
| 30px | 푸터 상단 (30px 30px 0 0) |

---

## 6. Depth & Elevation

| 레벨 | 처리 방식 | 사용처 |
|---|---|---|
| Base | 그림자 없음, 화이트/다크 서피스 | 기본 페이지 배경 |
| Soft Glow | rgba(136,136,136,0.2) 0px 0px 30px 0px | 제품 카드 |
| Dark Overlay | rgba(0,0,0,0.7) | 히어로 슬라이드 이미지 위 |
| Nav Overlay | rgba(0,0,0,0.8) | 스크롤 시 헤더 배경 |
| Dropdown | background: #FFFFFF, border-radius: 5px | 언어 선택 드롭다운 |

SLPOWER의 그림자 철학은 **소프트 글로우(soft glow)**다. 경계선을 직접 그리지 않고 넓게 퍼지는 반투명 회색 그림자(0px 0px 30px)로 카드가 배경에서 자연스럽게 분리되게 한다. 히어로와 네비게이션의 다크 오버레이는 깊이감을 레이어 방식으로 표현한다.

### Decorative Depth

- **서브 비주얼 배너**: 레드 계열 파동/입자 그래픽 이미지로 에너지감 표현
- **히어로 파티클**: 보케 볼(bokeh ball) + 퍼플·시안·마그네타 광원이 깊이의 레이어를 형성
- **푸터 라운딩**: 30px 30px 0 0 상단 라운딩으로 페이지에서 물리적으로 분리된 기반석처럼 착지

---

## 7. Do's and Don'ts

### Do

- #E60012 레드를 로고, 오버라인, 레드 태그, 링크 강조 등 브랜드 신호점에만 사용
- 영문 헤드라인과 숫자는 반드시 Exo 2로 처리
- 제품 카드 이미지 컨테이너는 border-radius: 20px 유지
- 카드 그림자는 소프트 글로우 형식(0px 0px 30px) 사용
- 히어로 서브타이틀은 Exo 2 Light(300) 사용
- 섹션 타이틀에는 margin-bottom: 95px 유지
- 푸터는 항상 #111111 배경에 border-radius: 30px 30px 0 0 유지
- 네비게이션은 스크롤 시 rgba(0,0,0,0.8) 오버레이로 배경 처리
- 헤드라인 굵기는 700(Bold) 유지
- 본문 텍스트에는 #222222 사용

### Don't

- 레드(#E60012)를 배경이나 넓은 면적에 사용하지 말 것
- Exo 2와 Pretendard의 역할을 바꾸지 말 것
- 카드에 단단한 테두리선(border: 1px solid)을 추가하지 말 것
- 헤드라인 굵기를 700 이하로 낮추지 말 것
- 본문 텍스트에 #000000 순수 검정을 사용하지 말 것
- 히어로 배경을 단색으로 처리하지 말 것
- 서브 비주얼 배너를 300px 이하로 줄이지 말 것
- border-radius: 0px 직각을 메인 카드/버튼에 사용하지 말 것
- letter-spacing에 양수를 사용하지 말 것
- 모든 섹션을 흰 배경으로 통일하지 말 것

---

## 8. Responsive Behavior

### Breakpoints

| 이름 | 너비 | 주요 변화 |
|---|---|---|
| Large Desktop | >1700px | 기본 레이아웃, headerH: 100px |
| Desktop | 1280–1700px | headerH: 90px, html font-size: 50%, title-box margin-bottom: 70px |
| Medium | 1200–1280px | headerH: 80px, html font-size: 40%, title-box margin-bottom: 40px |
| Tablet | 900–1200px | headerH: 70px, 제품 카드 슬라이더 전환 |
| Mobile | <900px | html font-size: 30%, title-box h3: 7.5rem, 단일 열 레이아웃 |

```css
:root { --headerH: 100px; }

@media screen and (max-width: 1700px) {
  :root { --headerH: 90px; }
  html { font-size: 50%; }
  .title-box { margin-bottom: 70px; }
}
@media screen and (max-width: 1280px) {
  :root { --headerH: 80px; }
  html { font-size: 40%; }
  .title-box { margin-bottom: 40px; }
}
@media screen and (max-width: 1200px) {
  :root { --headerH: 70px; }
}
@media screen and (max-width: 900px) {
  html { font-size: 30%; }
  .title-box h3 { font-size: 7.5rem; }
}
```

### Touch Targets

- 햄버거 메뉴 버튼: 최소 44×44px (padding: 15px)
- 탭 버튼: padding: 10px, 최소 44px 터치 영역
- 슬라이드 인디케이터: 40px 너비, 클릭 가능 영역 확보

### Collapsing Strategy

- **네비게이션**: 데스크탑부터 이미 햄버거 메뉴 사용 — 언어 선택 + 메뉴 버튼 우측 배치
- **히어로**: 반응형 뷰포트 높이(100svh) 유지, 텍스트만 rem 스케일 자동 조정
- **제품 카드**: 4열 그리드 → 1200px 이하에서 Slick 슬라이더로 전환
- **섹션 제목**: 72px(7.2rem) → html font-size 변경으로 rem 비례 축소 자동 적용
- **서브 비주얼**: 300px 고정 유지 → 모바일에서 텍스트만 비례 축소
- **서브 섹션 패딩**: --subPt: 140px / --subPb: 200px → 1280px 이하 90px로 조정

---

## 9. Agent Prompt Guide

### Quick Color Reference

```
브랜드 액센트      #E60012
헤드라인 텍스트    #111111
기본 본문 텍스트   #222222
UI / 네비 텍스트   #666666
서브 레이블        #999999
페이지 배경        #FFFFFF
푸터 배경          #111111
카드 이미지 BG     #F3F3F3
태그 배경          #F5F5F5
히어로 오버레이    rgba(0,0,0,0.7)
네비 스크롤 BG     rgba(0,0,0,0.8)
```

### Quick Font Reference

```
영문 헤드라인 / 숫자    Exo 2         Bold(700)              기술·산업 정밀감
한국어 본문 / UI        Pretendard    Light(300)~Bold(700)   가독성·접근성
푸터 정보               Exo 2         ExtraLight(200)~Medium(500)
```

### Example Component Prompts

**히어로 섹션**
전체화면 다크 배경(보케 파티클 이미지), rgba(0,0,0,0.7) 오버레이 위에 Pretendard 700 흰색 메인 카피, Exo 2 300 21px 서브타이틀, 좌하단 배치, 40px×3px 슬라이드 인디케이터 바 형태

**제품 카드**
흰 배경, border-radius: 20px, rgba(136,136,136,0.2) 0px 0px 30px 소프트 글로우 그림자, 상단 이미지 20px 라운딩 + #F3F3F3 bg, 하단 24px Exo 2 Bold 제품명 + 17px 500 #999999 카테고리 레이블

**섹션 타이틀 블록**
중앙 정렬, Exo 2 700 72px #111111 h3, letter-spacing: -0.01em, margin-bottom: 95px, 하단 17px 300 #222222 Pretendard 서브 설명

**오버라인 레이블**
Exo 2 700 17px #E60012, 섹션 타이틀 위에 배치, 프로세스·카테고리 구분용

**푸터**
#111111 배경, border-radius: 30px 30px 0 0, padding: 40px 0 30px, DT: Exo 2 500 #FFFFFF / DD: Exo 2 200 #FFFFFF / 카피라이트: Exo 2 200 rgba(255,255,255,0.3)

**탭 버튼**
활성: #191919 배경 + 흰 텍스트 + border-radius: 8px + Pretendard 500 16px
비활성: transparent + #111111 텍스트 + border-radius: 8px + Pretendard 600 16px

### Iteration Guide

1. 브랜드 레드(#E60012)는 오버라인, 로고 아이콘, 레드 태그에만 — 절대 배경 전체에 쓰지 말 것
2. 헤드라인은 Exo 2 + Bold(700) 조합이 정체성 — 가늘게 만들면 SLPOWER답지 않음
3. 카드 그림자는 소프트 글로우 방식 — 단단한 테두리선 없이 0px 0px 30px 넓게 퍼지게
4. 섹션 배경은 화이트 ↔ 다크 교차 리듬 — 모든 섹션을 흰색으로 통일하지 말 것
5. 히어로에는 반드시 발광 파티클/보케 이미지가 있어야 에너지감이 살아남
6. 반응형은 html font-size 변경으로 전체 rem 스케일을 조절하는 방식 사용
7. 서브 비주얼 배너는 항상 300px 이상 유지 — 페이지 아이덴티티 공간
8. 푸터 라운딩(30px 30px 0 0)은 브랜드 레이아웃의 마침표 — 절대 변경하지 말 것
