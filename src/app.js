/**
 * Battery Pack Renderer — UI Controller (app.js)
 *
 * 역할: 진입점 전용 — 다운로드, 키보드 내비게이션, 초기 렌더 호출.
 * 실제 로직은 분리된 모듈에서 담당:
 *   app-state.js  — 전역 상태 + 공유 헬퍼
 *   app-ui.js     — UI 컨트롤 핸들러
 *   app-render.js — 렌더 파이프라인
 *   app-panel.js  — 배열 후보 패널
 *
 * renderer.js가 전역으로 제공하는 함수 (browser <script> 로드 시):
 *   render, calcCellCenters, drawCell, drawFace, calcNickelPattern,
 *   getCellPolarity, resolveLayout, CELL_SPEC, RENDERER_VERSION
 *
 * M5 (2026-04-17): doRender() 제거, rerender() 유일 진입점.
 *   F14(renderer.renderCustomRows) 완성으로 app.js 내 renderCustomLayout/calcCustomCenters 삭제.
 */

// ── SVG 다운로드 ──────────────────────────────────
function downloadSVG() {
  if (!lastSVG) return;
  const blob = new Blob([lastSVG], { type: 'image/svg+xml' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `${state.S}s${state.P}p_${state.cell_type}_${state.arrangement}.svg`;
  a.click();
}

// F24: PNG 내보내기 — SVG → Canvas(2×) → PNG
function downloadPNG() {
  if (!lastSVG) return;
  const svgEl = document.querySelector('#svgOutput svg');
  const vb    = svgEl ? svgEl.getAttribute('viewBox') : null;
  let vbW = 800, vbH = 600;
  if (vb) { const p = vb.split(' ').map(Number); vbW = p[2] || 800; vbH = p[3] || 600; }
  const scale  = 2;
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(vbW * scale);
  canvas.height = Math.round(vbH * scale);
  const ctx    = canvas.getContext('2d');
  const blob   = new Blob([lastSVG], { type: 'image/svg+xml;charset=utf-8' });
  const url    = URL.createObjectURL(blob);
  const img    = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const a    = document.createElement('a');
    a.download = `${state.S}s${state.P}p_${state.cell_type}_${state.arrangement}.png`;
    a.href     = canvas.toDataURL('image/png');
    a.click();
  };
  img.src = url;
}

// ── 후보 카드 키보드 내비게이션 (↑↓) ────────────────
document.addEventListener('keydown', function(e) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const cards = document.querySelectorAll('.cand-card');
  if (!cards.length) return;
  e.preventDefault();
  const total = cards.length;
  let next = state.selected_ordering + (e.key === 'ArrowDown' ? 1 : -1);
  next = Math.max(0, Math.min(total - 1, next));
  if (next === state.selected_ordering) return;
  selectCandidate(next);
  cards[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

// ── 초기 렌더 ─────────────────────────────────────
rerender();
