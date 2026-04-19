#!/usr/bin/env node
/**
 * check-principles.js — 원칙 위반 감시기
 * Claude Code PostToolUse 훅으로 호출됨 (Edit/Write 후)
 * stdin: JSON { tool_input: { file_path }, tool_response: { filePath } }
 * 항상 exit 0 — 절대 도구 호출을 차단하지 않음
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── stdin에서 파일 경로 추출 ───────────────────────────
let filePath = '';
try {
  const raw = fs.readFileSync('/dev/stdin', 'utf8');
  const parsed = JSON.parse(raw);
  filePath =
    (parsed.tool_input && parsed.tool_input.file_path) ||
    (parsed.tool_response && parsed.tool_response.filePath) ||
    '';
} catch (_) {
  // stdin 없거나 JSON 파싱 실패 → 종료
  process.exit(0);
}

if (!filePath) process.exit(0);

// src/*.js 파일만 검사
const norm = filePath.replace(/\\/g, '/');
if (!norm.includes('/src/') || !norm.endsWith('.js')) process.exit(0);

// ── 검사 규칙 ──────────────────────────────────────────
const RULES = [
  // 원칙 29 / 원칙 1 위반: renderCustomRows에서 snake 순번으로 그룹 인덱스 결정
  {
    id: 'P29-P1',
    severity: 'VIOLATION',
    pattern: /snake\.map\s*\(\s*\(pt,\s*i\)\s*=>\s*\{[\s\S]{0,80}Math\.floor\(i\s*\/\s*cellsPerGroup\)/,
    files: ['renderer.js'],
    message: '원칙 29/1 위반: snake.map + Math.floor(i/cellsPerGroup)로 그룹 인덱스 결정 — cellGrpIdx(groupCells 기반) 사용 필수',
    hint: '수정: cellGrpIdx Map을 groupCells에서 생성 후 pts.map(pt => cellGrpIdx.get(`${pt.row},${pt.col}`) ?? 0) 패턴 사용',
  },
  // 원칙 29: cellGrpIdx 패턴이 renderCustomRows에 없으면 위반 의심
  {
    id: 'P29-MISSING',
    severity: 'WARNING',
    pattern: null, // 부재 감지 — 별도 처리
    files: ['renderer.js'],
    message: '원칙 29 경고: renderer.js에 cellGrpIdx 패턴이 없음 — groupCells 기반 극성 결정이 누락되었을 수 있음',
    hint: 'const cellGrpIdx = new Map(); groupCells.forEach(...) 패턴이 renderCustomRows 안에 있는지 확인',
  },
  // 원칙 26: 그룹 순서가 분기·루프 없는 단순 체인인지
  {
    id: 'P26',
    severity: 'WARNING',
    pattern: /G\d+\s*→\s*G\d+\s*→\s*G\d+.*branch|loop/i,
    files: ['generator.js', 'renderer.js'],
    message: '원칙 26 경고: 직렬 경로에 branch/loop 언급 — 단순 체인(G0→G1→…→G_{S-1}) 위반 가능성',
    hint: '직렬 연결은 단순 경로(simple path)여야 함. 분기/루프는 금지',
  },
  // 원칙 8: S×P 하드코딩 금지
  {
    id: 'P8-HARDCODE',
    severity: 'WARNING',
    pattern: /10\s*\*\s*[345]|13\s*\*\s*[45]|const\s+N\s*=\s*\d{2,}/,
    files: ['generator.js', 'renderer.js', 'app.js'],
    message: '원칙 8 경고: S×P 하드코딩 의심 — N은 항상 state.S × state.P 또는 params.S × params.P로 계산',
    hint: '특정 S/P 조합 하드코딩 금지. 범용(generic) S×P 설계 필수',
  },
];

// ── 파일 읽기 ──────────────────────────────────────────
const fname = path.basename(filePath);
let content = '';
try {
  content = fs.readFileSync(filePath, 'utf8');
} catch (_) {
  process.exit(0);
}

const violations = [];
const warnings = [];

for (const rule of RULES) {
  if (!rule.files.includes(fname)) continue;

  if (rule.id === 'P29-MISSING') {
    // renderer.js에 cellGrpIdx가 없으면 경고
    if (!content.includes('cellGrpIdx')) {
      warnings.push(rule);
    }
    continue;
  }

  if (rule.pattern && rule.pattern.test(content)) {
    if (rule.severity === 'VIOLATION') violations.push(rule);
    else warnings.push(rule);
  }
}

// ── 출력 ───────────────────────────────────────────────
if (violations.length === 0 && warnings.length === 0) {
  process.exit(0); // 조용히 통과
}

const RESET = '\x1b[0m';
const RED   = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD  = '\x1b[1m';

if (violations.length > 0) {
  process.stderr.write(`\n${RED}${BOLD}🚨 원칙 위반 감지 — ${fname}${RESET}\n`);
  violations.forEach(r => {
    process.stderr.write(`  [${r.id}] ${r.message}\n`);
    process.stderr.write(`  → ${r.hint}\n\n`);
  });
}

if (warnings.length > 0) {
  process.stderr.write(`\n${YELLOW}⚠️  원칙 경고 — ${fname}${RESET}\n`);
  warnings.forEach(r => {
    process.stderr.write(`  [${r.id}] ${r.message}\n`);
    process.stderr.write(`  → ${r.hint}\n\n`);
  });
}

// 위반이 있어도 exit 0 — 훅은 절대 도구 실행을 차단하지 않음
process.exit(0);
