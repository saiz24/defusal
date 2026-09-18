#!/bin/sh
# Screenshots of the real page through headless Chrome. macOS paths.
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/tools/shots"
mkdir -p "$OUT"
shot() { # shot <name> <w> <h> <query>
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files --window-size="$2,$3" \
    --virtual-time-budget=3600 \
    --screenshot="$OUT/$1.png" "file://$ROOT/index.html$4" 2>/dev/null
  echo "  $OUT/$1.png"
}
shot menu    1440 900 "?intro=0&mode=printed"
shot modes   1440 900 "?intro=0&modes=1&mode=solo"
shot intro   1440 900 "?intro=1&scene=1"
shot solo    1440 900 "?intro=0&mode=solo&start=hard&seed=99"
shot reader  1280 860 "?intro=0&mode=twodevice&role=manual"
shot seedpg  1440 900 "?intro=0&mode=printed&page=6"
shot phone   844  390 "?intro=0&mode=solo&start=medium&seed=4242"
shot easy720 1280 720 "?start=easy&seed=99"
shot medium  1440 900 "?start=medium&seed=1234"
shot insane  1440 900 "?start=insane&seed=4242"
shot debug   1440 900 "?start=insane&seed=4242&debug=1"
shot focus   1440 900 "?start=insane&seed=4242&focus=0"
shot back    1440 900 "?start=insane&seed=4242&face=back"
shot arming  1440 900 "?start=insane&seed=4242" # see note on virtual-time-budget
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --allow-file-access-from-files --window-size=1300,940 --virtual-time-budget=2500 \
  --screenshot="$OUT/sheet.png" "file://$ROOT/tools/sheet.html?seed=7" 2>/dev/null
echo "  $OUT/sheet.png"
