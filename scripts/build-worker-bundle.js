/**
 * build-worker-bundle.js
 *
 * gen-math.js + gen-layout.js + gen-enum.js + enum-worker.js 를 하나의 파일로 묶어
 * src/enum-worker-bundle.js 를 생성한다.
 *
 * 목적: file:// 프로토콜에서 importScripts()가 Chrome 보안 정책에 막히는 문제 우회.
 *       번들 파일은 importScripts 없이 모든 의존성을 포함하므로 항상 동작한다.
 *
 * 사용: node scripts/build-worker-bundle.js
 *       (gen-*.js 또는 enum-worker.js 수정 후 반드시 재실행)
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');

const deps   = ['gen-math.js', 'gen-layout.js', 'gen-enum.js'];
const worker = path.join(src, 'enum-worker.js');
const out    = path.join(src, 'enum-worker-bundle.js');

let bundle = '';
bundle += '// AUTO-GENERATED — do not edit. Regenerate: node scripts/build-worker-bundle.js\n';
bundle += '// Source: ' + deps.join(' + ') + ' + enum-worker.js\n';
bundle += "'use strict';\n\n";

for (const dep of deps) {
  bundle += `// ${'─'.repeat(60)}\n// ${dep}\n// ${'─'.repeat(60)}\n`;
  bundle += fs.readFileSync(path.join(src, dep), 'utf8').trimEnd() + '\n\n';
}

// enum-worker.js — 'use strict' 와 importScripts 줄 제거
let workerSrc = fs.readFileSync(worker, 'utf8');
workerSrc = workerSrc
  .replace(/^\s*'use strict';\s*\n/, '')
  .replace(/^importScripts\([^)]+\);\s*\n/m, '');

bundle += `// ${'─'.repeat(60)}\n// enum-worker.js\n// ${'─'.repeat(60)}\n`;
bundle += workerSrc.trimEnd() + '\n';

fs.writeFileSync(out, bundle, 'utf8');
console.log(`✓ ${path.relative(process.cwd(), out)} 생성 완료 (${(bundle.length / 1024).toFixed(1)} KB)`);
