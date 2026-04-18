#!/usr/bin/env bash
# graphify PostToolUse hook
# Triggered after Write/Edit. Reads stdin JSON from Claude Code.
# Behavior:
#   - Code file (.js .ts .py .go .rs .java .cpp .c etc): rebuild AST in background (free, no LLM)
#   - Doc/image (.md .pdf .png .jpg .docx .svg etc): touch graphify-out/.needs_update flag
#   - Other: ignore
# Always exits 0 — never blocks the user's tool call.

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0

# Skip silently if graphify graph never built
[ -f graphify-out/graph.json ] || exit 0

# Read stdin JSON, extract file path via Python (jq may not be installed on Windows)
INPUT_JSON="$(cat)"
FILE_PATH="$(printf '%s' "$INPUT_JSON" | python -c "import sys, json
try:
    d = json.load(sys.stdin)
    p = (d.get('tool_response') or {}).get('filePath') or (d.get('tool_input') or {}).get('file_path') or ''
    print(p)
except Exception:
    pass" 2>/dev/null)"
[ -z "$FILE_PATH" ] && exit 0

# Skip files inside graphify-out itself (avoid feedback loop)
case "$FILE_PATH" in
    *graphify-out*) exit 0 ;;
esac

# Skip files clearly outside this project (do simple substring check, Windows-safe)
PROJECT_BASENAME="$(basename "$PROJECT_DIR")"
case "$FILE_PATH" in
    *"$PROJECT_BASENAME"*) ;;
    *) exit 0 ;;
esac

# Lowercase extension
EXT="${FILE_PATH##*.}"
EXT="$(printf '%s' "$EXT" | tr '[:upper:]' '[:lower:]')"

CODE_EXTS="js ts jsx tsx mjs cjs py go rs java cpp c rb swift kt cs scala php cc cxx hpp h kts lua"
DOC_EXTS="md txt rst pdf docx png jpg jpeg webp gif svg"

is_in_list() {
    local needle="$1"
    local list="$2"
    for x in $list; do [ "$x" = "$needle" ] && return 0; done
    return 1
}

if is_in_list "$EXT" "$CODE_EXTS"; then
    # Code change: rebuild AST in background (no LLM, fast)
    nohup python -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))" >/dev/null 2>&1 &
elif is_in_list "$EXT" "$DOC_EXTS"; then
    # Doc/image change: flag for manual /graphify --update (LLM cost)
    mkdir -p graphify-out
    {
        printf 'changed: %s\n' "$FILE_PATH"
        printf 'at: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    } >> graphify-out/.needs_update
fi

exit 0
