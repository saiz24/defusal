#!/bin/sh
# Build manual/manual.pdf — the manual the game itself shows.
#
# The chain is: DEFUSAL.docx -> tools/extract-manual.py -> manual/rules.js
# -> manual/print.html -> headless Chrome -> manual/manual.pdf. Nothing in it
# is retyped, so the document on a second screen and the document on paper
# cannot drift apart. Run it after every edit to the .docx.
#
# macOS paths, like tools/shoot.sh.
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/manual/manual.pdf"

[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME" >&2; exit 1; }
[ -f "$ROOT/manual/rules.js" ] || { echo "manual/rules.js missing — run tools/extract-manual.py" >&2; exit 1; }

"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --allow-file-access-from-files --virtual-time-budget=6000 \
  --print-to-pdf="$OUT" "file://$ROOT/manual/print.html" 2>/dev/null

[ -s "$OUT" ] || { echo "no PDF was written" >&2; exit 1; }
echo "  $OUT  ($(wc -c < "$OUT" | tr -d ' ') bytes)"
