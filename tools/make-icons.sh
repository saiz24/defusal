#!/bin/sh
# Draws the app icon and renders it to PNG at the two sizes a manifest needs.
# Same rule as the rest of the project: the artwork is drawn, never authored
# in a design tool. Re-run this to change the logo.
set -e
DIR=$(cd "$(dirname "$0")/.." && pwd)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)

for N in 512 192; do
  cat > "$TMP/icon-$N.html" <<HTML
<style>html,body{margin:0;padding:0;background:#0d161b;overflow:hidden}
svg{display:block}</style>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="$N" height="$N">
  <rect width="512" height="512" fill="#0d161b"/>
  <!-- the case -->
  <rect x="76" y="116" width="360" height="280" rx="42"
        fill="#16242c" stroke="#6fd7e8" stroke-width="11"/>
  <!-- the clock -->
  <rect x="146" y="156" width="220" height="66" rx="16" fill="#6fd7e8"/>
  <!-- three bays -->
  <rect x="106" y="258" width="84" height="84" rx="18" fill="#2b414b"/>
  <rect x="214" y="258" width="84" height="84" rx="18" fill="#2b414b"/>
  <rect x="322" y="258" width="84" height="84" rx="18" fill="#2b414b"/>
</svg>
HTML
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=$N,$N --screenshot="$DIR/icon-$N.png" "file://$TMP/icon-$N.html" 2>/dev/null
  echo "icon-$N.png"
done
rm -rf "$TMP"
