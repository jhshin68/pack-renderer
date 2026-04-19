#!/usr/bin/env python3
"""
principle-guard.py — PreToolUse 원칙 감시 훅
Edit / Write / MultiEdit 실행 전 자동 호출.

Exit 0  → 허용 (도구 실행 계속)
Exit 2  → 차단 (stdout 내용을 Claude에게 사유로 전달)
"""
import sys, json, re, subprocess, os, io
from pathlib import Path

# Windows cp949 환경에서 이모지 출력을 위해 stdout/stderr를 UTF-8로 재설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

PROJECT_DIR = Path(os.environ.get('CLAUDE_PROJECT_DIR', '.')).resolve()
PRINCIPLES  = PROJECT_DIR / '.claude' / 'principles.md'
TIMEOUT_SEC = 15   # claude -p 타임아웃


# ── stdin 파싱 ──────────────────────────────────────────────────────────────
def read_input():
    try:
        raw = sys.stdin.buffer.read()
        return json.loads(raw.decode('utf-8', errors='replace'))
    except Exception:
        return {}


# ── 대상 파일 필터 ──────────────────────────────────────────────────────────
def should_check(file_path: str) -> bool:
    """src/*.js 만 검사. tests/, tmp/ 는 제외."""
    norm = file_path.replace('\\', '/')
    if '/tests/' in norm or '/tmp/' in norm:
        return False
    return '/src/' in norm and norm.endswith('.js')


# ── 변경 내용 추출 ───────────────────────────────────────────────────────────
def get_change(tool_name: str, tool_input: dict) -> tuple[str, str]:
    """(old_text, new_text)"""
    if tool_name == 'Edit':
        return tool_input.get('old_string', ''), tool_input.get('new_string', '')
    if tool_name == 'Write':
        return '', tool_input.get('content', '')
    if tool_name == 'MultiEdit':
        # edits: [{old_string, new_string}, ...]
        parts_old, parts_new = [], []
        for e in tool_input.get('edits', []):
            parts_old.append(e.get('old_string', ''))
            parts_new.append(e.get('new_string', ''))
        return '\n'.join(parts_old), '\n'.join(parts_new)
    return '', ''


# ── Stage 1: 정적 검사 ──────────────────────────────────────────────────────
STATIC_RULES = [
    {
        'id': 'P29-VIOLATION',
        'files': ['renderer.js'],
        # snake.map 블록 안에서 Math.floor(i / cellsPerGroup) 사용
        'pattern': re.compile(
            r'snake\.map\s*\(\s*\(pt\s*,\s*i\)\s*=>\s*\{[\s\S]{0,400}'
            r'Math\.floor\s*\(\s*i\s*/\s*cellsPerGroup\s*\)',
        ),
        # 오류 표시 전용 분기(p9ViolationIdx >= 0)이면 허용
        'custom_check': lambda m, text: (
            'p9ViolationIdx' not in text[max(0, m.start() - 300):m.start() + 50]
        ),
        'reason': (
            '[원칙 29/1 위반] renderer.js: snake.map + Math.floor(i/cellsPerGroup)로 그룹 인덱스 결정.\n'
            '→ 동일 그룹 P개 셀이 서로 다른 극성 표시 → 단락 위험.\n'
            '→ 수정: cellGrpIdx Map(groupCells 기반) + pts.map() 패턴 사용'
        ),
    },
    {
        'id': 'P9-LOW-THRESHOLD',
        'files': ['generator.js'],
        # pitchPx * pitchPx * N 에서 N < 1.21 이면 위반
        'pattern': re.compile(r'pitchPx\s*\*\s*pitchPx\s*\*\s*([\d.]+)'),
        'custom_check': lambda m, text: float(m.group(1)) < 1.21,
        'reason': (
            '[원칙 9 ③ 위반] generator.js: 커스텀 인접 임계값이 너무 작음.\n'
            '→ pitch×1.1 이상 필요 (대각선 인접 √2≈1.414 허용하려면 pitch×1.5 권장).\n'
            '→ 수정: pitchPx * pitchPx * 2.25 (= pitch×1.5)'
        ),
    },
]


def static_check(fname: str, new_text: str) -> str | None:
    """위반 시 사유 문자열 반환. 통과 시 None."""
    for rule in STATIC_RULES:
        if fname not in rule['files']:
            continue
        m = rule['pattern'].search(new_text)
        if not m:
            continue
        # custom_check: (match, full_text) → True이면 위반
        if 'custom_check' in rule and not rule['custom_check'](m, new_text):
            continue
        return rule['reason']
    return None


# ── Stage 2: 의미론적 검사 (claude -p) ────────────────────────────────────
SEMANTIC_TRIGGERS = {
    'renderer.js': ['getCellPolarity', 'groupCells', 'cell_groups', 'cellGrpIdx', 'buildNickel'],
    'generator.js': ['buildAdjacency', 'isAdj', 'pitchPx', 'enumerateGroupAssignments'],
    'app.js':       ['cell_groups', 'populateCandidatePanel', '_renderSVG'],
}


def needs_semantic(fname: str, new_text: str) -> bool:
    triggers = SEMANTIC_TRIGGERS.get(fname, [])
    return any(t in new_text for t in triggers)


def semantic_check(fname: str, old_text: str, new_text: str) -> str | None:
    """claude -p 판정. 위반 시 사유 반환. 통과 또는 판정 불가 시 None."""
    try:
        principles_text = PRINCIPLES.read_text(encoding='utf-8') if PRINCIPLES.exists() else ''
    except Exception:
        return None

    snippet_old = old_text[:600] if old_text else '(신규 작성)'
    snippet_new = new_text[:600]

    prompt = f"""당신은 배터리팩 니켈 플레이트 설계 원칙 감시자입니다.
아래 원칙과 코드 변경을 보고, 원칙 위반 여부를 판정하세요.

## 원칙 문서 요약
{principles_text[:2500]}

## 변경된 파일: {fname}
### 변경 전 (일부):
```javascript
{snippet_old}
```
### 변경 후 (일부):
```javascript
{snippet_new}
```

위 변경이 원칙을 위반하는지 판정하세요.
반드시 다음 JSON 한 줄로만 응답하세요:
{{"verdict": "pass", "reason": ""}}
또는
{{"verdict": "block", "reason": "위반 원칙 번호와 이유 (1줄)"}}"""

    try:
        result = subprocess.run(
            ['claude', '-p', prompt, '--output-format', 'text'],
            input=prompt.encode('utf-8'),
            capture_output=True,
            timeout=TIMEOUT_SEC,
        )
        output = result.stdout.decode('utf-8', errors='replace').strip()
        m = re.search(r'\{[^}]+\}', output)
        if m:
            verdict = json.loads(m.group())
            if verdict.get('verdict') == 'block':
                return f"[AI 판정 — 원칙 위반]\n{verdict.get('reason', '(사유 없음)')}"
    except Exception:
        pass  # 판정 실패 → 허용
    return None


# ── 메인 ────────────────────────────────────────────────────────────────────
def main():
    data = read_input()
    tool_name  = data.get('tool_name', '')
    tool_input = data.get('tool_input', {})

    if tool_name not in ('Edit', 'Write', 'MultiEdit'):
        sys.exit(0)

    file_path = (
        tool_input.get('file_path') or
        tool_input.get('filePath') or ''
    )
    if not file_path or not should_check(file_path):
        sys.exit(0)

    fname = Path(file_path).name
    old_text, new_text = get_change(tool_name, tool_input)

    # Stage 1: 정적 검사
    reason = static_check(fname, new_text)
    if reason:
        print(f'\n🚨 원칙 위반 차단 ({fname})\n{reason}\n')
        sys.exit(2)

    # Stage 2: 의미론적 검사 (트리거 키워드 있을 때만)
    if needs_semantic(fname, new_text):
        reason = semantic_check(fname, old_text, new_text)
        if reason:
            print(f'\n🚨 원칙 위반 차단 ({fname})\n{reason}\n')
            sys.exit(2)

    sys.exit(0)


if __name__ == '__main__':
    main()
