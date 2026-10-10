#!/bin/sh
# Draws the app icon and renders it to PNG:
#   icon-512.png, icon-192.png   the web app (manifest), full bleed
#   desktop/build/icon.png       the desktop app, 1024 px, on the macOS icon
#                                grid (a rounded square with a margin), from
#                                which electron-builder makes the .icns/.ico
# Same rule as the rest of the project: the artwork is drawn, never authored
# in a design tool. Re-run this to change the logo.
set -e
DIR=$(cd "$(dirname "$0")/.." && pwd)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)

# The device as the game now draws it: a dark case with a toon outline, the
# amber clock lit, the red light on, three bays with a key each.
ART='
  <defs>
    <filter id="glow" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="58" y="128" width="396" height="276" rx="42" fill="#2c383e" stroke="#0a0f12" stroke-width="12"/>
  <rect x="96" y="160" width="320" height="90" rx="18" fill="#10181d"/>
  <rect x="110" y="172" width="196" height="66" rx="10" fill="#3b2b0b"/>
  <text x="208" y="226" text-anchor="middle" font-family="Seg" font-size="60" fill="#ffc861" filter="url(#glow)">05:00</text>
  <circle cx="356" cy="205" r="14" fill="#ff6b5c" filter="url(#glow)"/>
  <rect x="86"  y="272" width="104" height="104" rx="16" fill="#3f6577" stroke="#0a0f12" stroke-width="8"/>
  <rect x="204" y="272" width="104" height="104" rx="16" fill="#3f6577" stroke="#0a0f12" stroke-width="8"/>
  <rect x="322" y="272" width="104" height="104" rx="16" fill="#3f6577" stroke="#0a0f12" stroke-width="8"/>
  <circle cx="138" cy="324" r="24" fill="#d0574f" stroke="#0a0f12" stroke-width="6"/>
  <rect x="232" y="300" width="48" height="48" rx="9" fill="#f4f1e8" stroke="#0a0f12" stroke-width="6"/>
  <rect x="350" y="300" width="48" height="48" rx="9" fill="#4f9d5d" stroke="#0a0f12" stroke-width="6"/>'

BG='<radialGradient id="bg" cx="50%" cy="38%" r="70%">
      <stop offset="0" stop-color="#1d3340"/><stop offset="1" stop-color="#081015"/></radialGradient>'

page() {  # $1 = size, $2 = svg body
  cat <<HTML
<style>@font-face{font-family:Seg;src:url("file://$DIR/fonts/seven-segment.ttf")}
html,body{margin:0;padding:0;background:transparent;overflow:hidden}svg{display:block}</style>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="$1" height="$1">$2</svg>
HTML
}

# the web icons: full bleed
WEB="<defs>$BG</defs><rect width=\"1024\" height=\"1024\" fill=\"url(#bg)\"/>
<g transform=\"translate(0 -16) scale(2)\">$ART</g>"
# the desktop icon: Apple's grid — an 824 px rounded square at 100 px in,
# a soft shadow under it, the art inset within it
MAC="<defs>$BG<filter id=\"sh\" x=\"-10%\" y=\"-10%\" width=\"120%\" height=\"130%\">
<feDropShadow dx=\"0\" dy=\"12\" stdDeviation=\"14\" flood-opacity=\".45\"/></filter></defs>
<rect x=\"100\" y=\"100\" width=\"824\" height=\"824\" rx=\"185\" fill=\"url(#bg)\" filter=\"url(#sh)\"/>
<rect x=\"101\" y=\"101\" width=\"822\" height=\"822\" rx=\"184\" fill=\"none\" stroke=\"#ffffff\" stroke-opacity=\".08\" stroke-width=\"2\"/>
<g transform=\"translate(102 86) scale(1.6)\">$ART</g>"

shoot() {  # $1 = size, $2 = body, $3 = output
  page "$1" "$2" > "$TMP/i.html"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --allow-file-access-from-files \
    --window-size=$1,$1 --screenshot="$3" "file://$TMP/i.html" 2>/dev/null
  echo "$3"
}
shoot 512 "$WEB" "$DIR/icon-512.png"
shoot 192 "$WEB" "$DIR/icon-192.png"
shoot 1024 "$MAC" "$DIR/desktop/build/icon.png"
