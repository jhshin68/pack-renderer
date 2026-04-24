 AI 판단 레이어 추가 — Pack-Renderer

 Context

 현재 앱은 완전 결정론적(rule-based)이라 사용자가 막히는 순간에 아무 정보도 주지 않는다.
 가장 큰 공백은 후보 0개 상황 — "배열을 만들 수 없습니다" 한 줄만 표시하고 원인·해결책이 전혀 없다.
 AI를 붙이면 "holder_rows=3이 너무 작습니다. 4로 늘리거나 ICC① 제약을 풀면 후보가 생깁니다" 같은
 구체적인 조언이 가능해진다.

 ---
 Max Plan vs API — 핵심 정리

 Max 플랜으로 이 앱에서 Claude API를 직접 호출하는 것은 불가능하다.

 - Claude.ai Max 플랜 = 웹 인터페이스(claude.ai) + Claude Code CLI 전용
 - Anthropic API(코드에서 fetch로 호출) = 별도 Console 계정 + 토큰 과금
 - 두 채널은 완전히 분리되어 있으며, 구독 잔액을 API에 쓸 수 없다

 현실적 대안: Google Gemini 무료 API

 - Gemini 2.0 Flash Lite: 1,500 req/day, 30 req/min — 완전 무료, 신용카드 불필요
 - Google 계정으로 https://aistudio.google.com → "Get API key" (1분)
 - 한국어 품질 우수, 응답 속도 빠름
 - 사용자가 자신의 무료 키를 앱 UI에서 한 번 입력 → localStorage 저장

 ---
 구현 목표 — AI 판단 3지점

 ┌─────┬──────────────────────┬──────────────────────────────────────────────────┐
 │  #  │        트리거        │                   AI가 하는 것                   │
 ├─────┼──────────────────────┼──────────────────────────────────────────────────┤
 │ ①   │ 후보 0개 (가장 중요) │ 현재 state 분석 → 원인 + 파라미터 조정 제안      │
 ├─────┼──────────────────────┼──────────────────────────────────────────────────┤
 │ ②   │ 후보 카드 선택       │ 선택 후보의 제조 리스크 + 추천 이유 요약         │
 ├─────┼──────────────────────┼──────────────────────────────────────────────────┤
 │ ③   │ Generate 완료 후     │ ICC 경계값 근처 설계 경고 (rowSpan, aspectRatio) │
 └─────┴──────────────────────┴──────────────────────────────────────────────────┘

 ---
 데이터 흐름

 state (app-state.js)
     │  _enumResult (후보 목록)
     ▼
 ai-advisor.js
   ├── buildDiagnosisPrompt(state, reason)   → Gemini API →  한국어 진단문
   ├── buildCandidatePrompt(state, cand)     → Gemini API →  설계 조언
   └── buildBoundaryPrompt(state, metrics)   → Gemini API →  경계값 경고
     │
     ▼
 UI 삽입: emptyState 텍스트 / candDetailBox 하단 / 상단 배너

 ---
 변경 파일 목록

 신규 생성

 - src/ai-advisor.js — Gemini API 클라이언트 + 프롬프트 빌더

 // 주요 export (window 전역)
 const AiAdvisor = {
   setKey(k),         // localStorage 저장
   getKey(),
   isReady(),         // key 있으면 true
   diagnose(state, enumResult),    // ① 후보 0개 진단 → Promise<string>
   adviseCand(state, cand, rank),  // ② 후보 조언     → Promise<string>
   warnBoundary(state, metrics),   // ③ 경계 경고     → Promise<string>
   _call(prompt),     // Gemini API fetch
 };

 수정 파일

 ┌────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────┐   
 │            파일            │                                          변경 내용                                          │   
 ├────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤   
 │ battery_pack_renderer.html │ ① 사이드바 하단에 AI 키 입력 섹션 추가② script 로드 목록에 ai-advisor.js 추가               │   
 ├────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤   
 │ src/app-render.js          │ ③ _renderSVG() 후보 0개 분기: AI 진단 비동기 호출 + 결과 삽입④ Generate 완료 후             │   
 │                            │ warnBoundary() 트리거                                                                       │   
 ├────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤   
 │ src/app-panel.js           │ ⑤ _showCandDetail() 내 adviseCand() 호출 + 결과 삽입                                        │   
 ├────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤   
 │ src/style.css              │ AI 패널 스타일 (로딩 스피너, 조언 카드)                                                     │   
 └────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────┘   

 ---
 구현 순서

 Step 1 — src/ai-advisor.js 생성

 const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

 // 후보 0개 진단 프롬프트 (예시 구조)
 function buildDiagnosisPrompt(state, enumResult) {
   return `배터리 팩 설계 파라미터: S=${state.S}, P=${state.P}, 배열=${state.arrangement},
 홀더=${state.holder_cols}×${state.holder_rows}, ICC①=${state.icc1}, ICC②=${state.icc2},
 max_plates=${state.max_plates}, 총 탐색된 원시 후보=${enumResult?.raw_count ?? 0}

 위 파라미터로 유효 배열 후보가 0개입니다.
 원인을 1~3가지 분석하고, 각 원인에 대한 파라미터 조정 방법을 한국어로 구체적으로 안내하세요.
 결과는 3문장 이내, 불릿 없이 자연스러운 설명으로.`;
 }

 Step 2 — HTML 수정 (AI 키 입력 UI)

 사이드바 최하단(</div><!-- /sidebar-body --> 직전)에 추가:

 <div class="rp-divider"></div>
 <div id="aiKeySection">
   <div class="ctrl-label">AI 설계 조언 <span style="font-size:7px;color:var(--dt3)">Gemini 무료</span></div>
   <input id="aiKeyInput" type="password" placeholder="Gemini API key (선택)" style="...">
   <button onclick="AiAdvisor.setKey(document.getElementById('aiKeyInput').value)">저장</button>
 </div>

 script 로드 목록에 ai-advisor.js 추가 (app-state.js 이전 또는 app.js 이전).

 Step 3 — app-render.js 수정

 후보 0개 분기 (line 177-189) 수정:

 if (effectiveCandidates.length === 0) {
   // ...기존 emptyEl 표시...
   // AI 진단 트리거 (key 없으면 skip)
   if (typeof AiAdvisor !== 'undefined' && AiAdvisor.isReady()) {
     const hint = document.createElement('div');
     hint.className = 'ai-hint-loading';
     hint.textContent = 'AI 분석 중…';
     emptyEl.appendChild(hint);
     AiAdvisor.diagnose(state, _enumResult).then(text => {
       hint.className = 'ai-hint';
       hint.textContent = text;
     }).catch(() => hint.remove());
   }
   return;
 }

 Generate 완료 후 (rerender 끝 부분):

 if (typeof AiAdvisor !== 'undefined' && AiAdvisor.isReady() && allCandidates.length > 0) {
   const metrics = _collectBoundaryMetrics(allCandidates);
   AiAdvisor.warnBoundary(state, metrics).then(w => w && _showBoundaryBanner(w));
 }

 Step 4 — app-panel.js 수정

 _showCandDetail(idx) 함수 하단에 추가:

 if (typeof AiAdvisor !== 'undefined' && AiAdvisor.isReady() && cand) {
   const box = document.getElementById('candDetailBox');
   const aiDiv = document.createElement('div');
   aiDiv.className = 'ai-hint-loading';
   aiDiv.textContent = 'AI 분석 중…';
   box.appendChild(aiDiv);
   AiAdvisor.adviseCand(state, cand, idx + 1).then(t => {
     aiDiv.className = 'ai-hint';
     aiDiv.textContent = t;
   }).catch(() => aiDiv.remove());
 }

 ---
 검증 방법

 1. battery_pack_renderer.html 브라우저 열기
 2. S=13, P=5 → Generate → AI 키 없을 때: 기존 UI 그대로 (regression 없음)
 3. AI Studio에서 무료 Gemini 키 발급 → 사이드바에 입력 → 저장
 4. ICC① 활성화 + max_plates=1 → 후보 0개 유도 → AI 진단 텍스트 노출 확인
 5. 후보 카드 선택 → candDetailBox 하단에 AI 조언 텍스트 노출 확인
 6. 페이지 새로고침 → API 키가 localStorage에 유지되는지 확인