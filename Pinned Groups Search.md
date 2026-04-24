# 부분 고정 탐색 (Pinned Groups Search) — 상세 실행 계획



## Context



사용자가 실물 image1.png(커스텀 배열 니켈 플레이트 사진)와 브라우저 렌더를 대조하여 알고 있는 그룹 몇 개를 직접 지정하고, 나머지를 알고리즘이 자동 탐색하는 기능. 총 4단계로 구성. **이번 세션은 전체 4단계 모두 구현.**



---



## 수정 대상 파일 (8개)



| 파일 | 역할 |

|---|---|

| `src/app-state.js` | `show_coords`, `pinned_groups_raw` 상태 추가 |

| `src/renderer.js` | `renderCustomRows`에 좌표 레이블 오버레이 |

| `battery_pack_renderer.html` | 좌표 토글 + 고정 그룹 패널 HTML |

| `src/app-ui.js` | `toggleShowCoords()` 핸들러 |

| `src/app-panel.js` | 핀 그룹 파서, 검증, UI 헬퍼 |

| `src/app-render.js` | 핀 그룹을 워커/열거기에 전달 |

| `src/gen-enum.js` | `pinned_groups` 파라미터 추가 + 알고리즘 확장 |

| `src/enum-worker.js` | `pinned_groups` 메시지 수신 + 전달 |



---



## 단계 1 — 셀 좌표 레이블 SVG 표시



### 어떻게



`renderer.js` `renderCustomRows` 함수는 이미 `pts[]` 배열(각 원소에 `pt.row`, `pt.col` 있음)을 가짐 (line 625). 렌더링 루프 이후 좌표 텍스트 오버레이만 추가.



**`src/renderer.js` — `renderCustomRows` 하단 추가 (반환 직전):**

```js

// show_coords 오버레이: 각 셀 중심에 "r{row}c{col}" 표시

if (params.show_coords) {

  const fSize = Math.max(5, Math.min(8, R * 0.5)).toFixed(1);

  // ln[] 배열에 SVG text 요소 삽입 (top face 와 bottom face 모두)

  pts.forEach(pt => {

    ln.push(`<text font-family="monospace" font-size="${fSize}"

      fill="#ffee00" text-anchor="middle" dominant-baseline="middle"

      x="${pt.x.toFixed(1)}" y="${pt.y.toFixed(1)}"

      style="pointer-events:none">r${pt.row}c${pt.col}</text>`);

  });

}

```

→ 단, `ln`이 `<svg>` 범위 안인지 확인: `renderCustomRows`의 두 face SVG(`svgW2`) 구조상 text 삽입 위치를 각 `<g transform>` 블록 안에 넣어야 함. 기존 패턴(`buildNickel`, 셀 렌더 루프)과 같은 방식으로 `ln.push` 추가.



**`src/app-state.js`에 추가:**

```js

show_coords: false,

```



**`src/app-ui.js`에 추가:**

```js

function toggleShowCoords() {

  state.show_coords = !state.show_coords;

  document.getElementById('togShowCoords').classList.toggle('on', state.show_coords);

  if (lastSVG) _renderSVG();  // 재열거 없이 재렌더만

}

```



**`battery_pack_renderer.html` — Display Options 섹션에 추가:**

```html

<div class="toggle-row">

  <span class="toggle-label">셀 좌표 표시</span>

  <button class="toggle" id="togShowCoords" onclick="toggleShowCoords()"></button>

</div>

```



**`renderer.js` `render()` 함수 (square/staggered):** 이번 단계에서는 구현 생략. 사용자가 비교하는 image1.png는 custom 배열 — custom만 지원으로 MVP 범위 충분.



---



## 단계 2 — 고정 그룹 입력 UI



### 상태 설계



**`src/app-state.js`에 추가:**

```js

pinned_groups_raw: [],  // ['r4c0 r3c0 r3c1 r4c1', 'r4c2 r4c3 r3c2 r3c3']

```



### HTML (오른쪽 패널 — 기존 `candList` div 위)



```html

<!-- 고정 그룹 지정 패널 -->

<div id="pinnedGroupsPanel" style="display:none">

  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">

    <div class="ctrl-label" style="margin-bottom:0">고정 그룹 지정</div>

    <button onclick="addPinnedGroupRow()"

      style="font-size:10px;background:var(--bg2);color:var(--dt);border:1px solid var(--border);border-radius:3px;padding:2px 6px;cursor:pointer">+ 행 추가</button>

  </div>

  <div id="pinnedGroupList"></div>

  <div style="margin-top:6px;display:flex;gap:6px">

    <button onclick="validatePinnedGroups()"

      style="flex:1;font-size:10px;padding:4px;background:var(--bg2);color:var(--dt3);border:1px solid var(--border);border-radius:3px;cursor:pointer">검증</button>

    <button onclick="runPinnedSearch()"

      style="flex:2;font-size:10px;padding:4px;background:#1a4a2e;color:#4ADE80;border:1px solid #2d6a3f;border-radius:3px;cursor:pointer">📌 탐색 시작</button>

  </div>

  <div id="pinnedGroupHint" style="margin-top:4px;font-size:9px;color:var(--dt3)">

    셀 좌표: r{행}c{열}  예) r4c0 r3c0 r3c1 r4c1

  </div>

  <div class="rp-divider"></div>

</div>

```



패널 표시 조건: `arrangement === 'custom'` 일 때만 `display:block`.



### `src/app-panel.js`에 추가할 함수들



```js

// 고정 그룹 행 추가

function addPinnedGroupRow(initVal = '') {

  state.pinned_groups_raw.push(initVal);

  _renderPinnedGroupList();

}



// 고정 그룹 목록 렌더

function _renderPinnedGroupList() {

  const el = document.getElementById('pinnedGroupList');

  if (!el) return;

  el.innerHTML = '';

  state.pinned_groups_raw.forEach((raw, i) => {

    const row = document.createElement('div');

    row.style.cssText = 'display:flex;gap:4px;margin-bottom:3px;align-items:center';

    row.innerHTML =

      `<span style="font-size:9px;color:var(--dt3);min-width:24px">G${i}:</span>` +

      `<input type="text" value="${raw}"

        style="flex:1;font-size:9px;font-family:monospace;background:var(--sb2);color:var(--dt);border:1px solid var(--border);border-radius:3px;padding:2px 4px"

        oninput="state.pinned_groups_raw[${i}]=this.value"

        placeholder="r4c0 r3c0 r3c1 r4c1">` +

      `<button onclick="state.pinned_groups_raw.splice(${i},1);_renderPinnedGroupList()"

        style="font-size:10px;background:none;color:var(--dt3);border:none;cursor:pointer;padding:0 3px">✕</button>`;

    el.appendChild(row);

  });

}



// "rNcM rNcM ..." 문자열 → 셀 인덱스 배열 (pts[] 기준)

function _parsePinnedGroupStr(raw, pts) {

  const matches = [...raw.matchAll(/r(\d+)c(\d+)/g)];

  if (matches.length === 0) return null;

  const result = [];

  for (const m of matches) {

    const row = parseInt(m[1], 10), col = parseInt(m[2], 10);

    const idx = pts.findIndex(p => p.row === row && p.col === col);

    if (idx < 0) return null;  // 좌표 없음

    result.push(idx);

  }

  return result;

}



// 검증만 실행

function validatePinnedGroups() {

  const hintEl = document.getElementById('pinnedGroupHint');

  const { parsed, error } = _getParsedPinnedGroups();

  if (error) { if (hintEl) hintEl.innerHTML = `<span style="color:var(--red)">${error}</span>`; return; }

  if (hintEl) hintEl.innerHTML = `<span style="color:#4ADE80">${parsed.length}개 그룹 검증 완료 (각 ${parsed[0].length}셀)</span>`;

}



// 파싱 + 기본 검증 (P셀 수 체크)

function _getParsedPinnedGroups() {

  if (!state.pinned_groups_raw.length) return { parsed: [], error: null };

  const cc = Generator.calcCustomCenters(parseCustomRows(), {

    ...state, layout: 'auto', scale: 1.5, nickel_w_mm: 4.0, margin_mm: 8.0,

    rows: parseCustomRows(),

  }, CELL_SPEC);

  const pts = cc.pts;

  const parsed = [];

  for (let i = 0; i < state.pinned_groups_raw.length; i++) {

    const raw = state.pinned_groups_raw[i].trim();

    if (!raw) continue;

    const idxs = _parsePinnedGroupStr(raw, pts);

    if (!idxs) return { parsed: [], error: `G${i}: 좌표 인식 실패 ("r{행}c{열}" 형식으로 입력)` };

    if (idxs.length !== state.P) return { parsed: [], error: `G${i}: ${idxs.length}셀 ≠ P=${state.P}셀` };

    parsed.push(idxs);

  }

  return { parsed, error: null };

}

```



---



## 단계 3 — 알고리즘 확장: `pinned_groups` 파라미터



### `src/gen-enum.js` — `enumerateGroupAssignments` ctx 구조분해에 추가



```js

pinned_groups = null,  // ★ 고정 그룹: [[idx,...], [idx,...], ...]

```



### 알고리즘 변경 위치 — 기존 `fixed_g0` 블록(line 895) 앞에 삽입



```

흐름 다이어그램:



pinned_groups 있음?

  └── YES: 정렬 (B+ 포함 → 맨 앞, B- 포함 → 맨 뒤)

           각 그룹 ICC + 연결성 검증

           used[] 에 모두 마킹

           initialSnaps = pinned_groups

           dfsCustom(gIdx=pinned_groups.length, initialSnaps, ...)

  └── NO: 기존 fixed_g0 / BFS Greedy / Beam Search 경로 그대로

```



**구체적 코드 (gen-enum.js 백트래킹 블록 내 삽입):**



```js

// ★ pinned_groups 고정 모드: 복수 그룹 선행 배정

if (pinned_groups && pinned_groups.length > 0) {

  // 정렬: bPlus 포함 그룹 → 인덱스 0, bMinus 포함 그룹 → 마지막

  const sorted = [...pinned_groups];

  const bpIdx = sorted.findIndex(g => g.some(i => bPlus.has(i)));

  if (bpIdx > 0) { const [g] = sorted.splice(bpIdx, 1); sorted.unshift(g); }

  const bmIdx = sorted.findLastIndex(g => g.some(i => bMinus.has(i)));

  if (bmIdx >= 0 && bmIdx < sorted.length - 1) {

    const [g] = sorted.splice(bmIdx, 1); sorted.push(g);

  }



  // 각 그룹 검증

  for (const pg of sorted) {

    if (!passICC_bt(pg)) {

      return { candidates: [], count: 0, strategy: 'none',

               error: '고정 그룹 ICC 위반' };

    }

    if (!isGroupConnected(pg.map(i => cells[i]))) {

      return { candidates: [], count: 0, strategy: 'none',

               error: '고정 그룹 내부 비연결' };

    }

  }



  // used[] 마킹 + DFS 진입

  for (const pg of sorted) for (const ci of pg) used[ci] = 1;



  const adjStarts = new Set();

  const lastPinned = sorted[sorted.length - 1];

  for (const ci of lastPinned) {

    for (const nb of adjL[ci]) { if (!used[nb]) adjStarts.add(nb); }

  }

  const starts = [...adjStarts].length > 0

    ? [...adjStarts]

    : (() => { for (const ci of scanOrder) { if (!used[ci]) return [ci]; } return []; })();



  for (const nextStart of starts) {

    if (Date.now() - btStart > btBudgetMs) break;

    used[nextStart] = 1;

    dfsCustom(sorted.length, sorted, [nextStart],

      new Set(adjL[nextStart].filter(nb => !used[nb])));

    used[nextStart] = 0;

  }

  for (const pg of sorted) for (const ci of pg) used[ci] = 0;

}

```



**주의:** `pinned_groups` 경로는 `dfsCustom` (custom 배열 DFS) 안에서만 실행. `arrangement !== 'custom'` 일 때는 무시.



---



## 단계 4 — 워커 통합 & 결과 표시



### `src/app-panel.js` — `runPinnedSearch()` 함수



```js

async function runPinnedSearch() {

  const { parsed, error } = _getParsedPinnedGroups();

  const hintEl = document.getElementById('pinnedGroupHint');

  if (error) { if (hintEl) hintEl.innerHTML = `<span style="color:var(--red)">${error}</span>`; return; }

  if (parsed.length === 0) {

    if (hintEl) hintEl.textContent = '고정 그룹을 1개 이상 입력하세요';

    return;

  }

  // state에 임시 저장 후 generateLayout 호출

  state._pinned_groups_parsed = parsed;

  await generateLayout();

  state._pinned_groups_parsed = null;

}

```



### `src/app-render.js` — `_runCustomSearch` 수정 포인트



`enumBase` 객체 구성 시:

```js

const enumBase = {

  // ... 기존 파라미터 ...

  pinned_groups: state._pinned_groups_parsed || null,

};

```



`pinned_groups`가 설정된 경우 G0 열거 단계 건너뜀:

```js

let g0Configs = [];

if (!enumBase.pinned_groups) {

  // 기존 enumerate_g0_only 경로

  try {

    const g0r = Generator.enumerateGroupAssignments({ ...enumBase, enumerate_g0_only: true });

    g0Configs = g0r.g0_configs || [];

  } catch (_) {}

}

```



`pinned_groups`가 있으면 단일 메인 스레드 탐색 (워커 분할 생략):

```js

if (enumBase.pinned_groups) {

  // 단일 탐색 — 워커 불필요

  result = Generator.enumerateGroupAssignments({

    ...enumBase, arrangement: 'custom',

    pitch: customPitch, custom_stagger: !!state.custom_stagger,

    exhaustive: true, budget_ms: budgetMs,

    max_candidates: 999999,

  });

} else if (g0Configs.length >= 2 && typeof Worker !== 'undefined') {

  // 기존 워커 병렬 탐색 경로

  ...

}

```



### `src/enum-worker.js` — `pinned_groups` 지원 추가



```js

self.onmessage = function (e) {

  const { params, g0Configs, budgetMs, budgetPerG0, cells, pitch, pinned_groups } = e.data;

  // ... 기존 로직 ...

  // pinned_groups 있으면 g0Configs 루프 대신 단일 탐색

  if (pinned_groups && pinned_groups.length > 0) {

    const r = enumerateGroupAssignments({

      cells, ...params_spread,

      pinned_groups, exhaustive: true, budget_ms: budgetMs,

    });

    self.postMessage({ candidates: r.candidates || [] });

    return;

  }

  // 기존 g0Configs 루프 ...

};

```



### 결과 카드 태그 추가 (`app-panel.js` `_renderCandCards`)



`commitCandidate` 에서 `pinned_groups` 있으면 후보에 `is_pinned: true` 플래그 추가 → `_renderCandCards`에서 뱃지 표시:



```js

const pinnedTag = cand.is_pinned

  ? ` <span style="background:#3a1a4a;color:#c084fc;font-size:8px;padding:1px 4px;border-radius:3px">📌 고정</span>`

  : '';

```



---



## 데이터 흐름 요약



```

사용자 입력: "r4c0 r3c0 r3c1 r4c1"

        │

        ▼

_parsePinnedGroupStr() → cell index 배열 [i0, i1, i2, i3]

        │

        ▼

state._pinned_groups_parsed = [[i0,i1,i2,i3], ...]

        │

        ▼

_runCustomSearch()

  ├── enumBase.pinned_groups = parsed

  ├── (G0 열거 단계 건너뜀)

  └── enumerateGroupAssignments({ pinned_groups, ... })

             │

             ▼ gen-enum.js

        sorted = 정렬(pinned_groups)

        used[] 마킹

        dfsCustom(gIdx=k, sorted, ...)

             │

             ▼

        commitCandidate → is_pinned:true

             │

             ▼

        후보 리스트 (📌 고정 태그 포함)

```



---



## 검증 방법



1. `arrangement=custom`, `rows=[5,4,4,4,5]`, `S=9`, `P=2` 설정

2. "셀 좌표 표시" 토글 ON → SVG 각 원에 `r0c0` 등 레이블 확인

3. 고정 그룹 입력: `r4c0 r3c0` (P=2 기준)

4. [검증] → "1개 그룹 검증 완료" 메시지

5. [탐색 시작] → 후보 리스트에 "📌 고정" 태그 후보 등장 확인

6. 선택한 후보에서 G0가 입력한 셀과 일치하는지 SVG에서 확인

7. 빈 입력으로 탐색 시 기존 동작 불변 확인 (회귀 방지)

8. `node tests/test_g0_anchor.js` 등 기존 테스트 통과 확인



---



## 구현 순서 (단일 세션 권장 순서)



1. `app-state.js` — 상태 2개 추가 (1분)

2. `renderer.js` — 좌표 레이블 오버레이 (20분)

3. `app-ui.js` — `toggleShowCoords` (5분)

4. `battery_pack_renderer.html` — 토글 + 패널 HTML (15분)

5. `app-panel.js` — 파서 + 검증 + UI 함수 (30분)

6. `gen-enum.js` — `pinned_groups` 파라미터 + DFS 진입 (40분)

7. `app-render.js` — 탐색 분기 수정 (15분)

8. `enum-worker.js` — 메시지 핸들러 추가 (10분)

9. 브라우저 테스트 + 기존 테스트 실행 (20분)

