#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8000}"

echo "[preview] Starting local server..."
echo "[preview] Open in browser: http://localhost:${PORT}/"
echo "[preview] Main page:       http://localhost:${PORT}/index.html"
echo "[preview] Redesign doc:    http://localhost:${PORT}/GAME_UI_REDESIGN.md"
echo "[preview] GitHub guide:    http://localhost:${PORT}/GITHUB_SETUP_GUIDE.md"

echo "[preview] Stop with Ctrl + C"
python3 -m http.server "${PORT}"
