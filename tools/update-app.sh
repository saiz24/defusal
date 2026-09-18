#!/bin/sh
# Copy the current game into the installed desktop app.
#
# The desktop build bundles the game inside itself and loads
# Contents/Resources/app/index.html straight off the disk, so `git push`
# updates the website but never this. Run this after any change you want to
# see in the app, then relaunch it.
#
#   ./tools/update-app.sh                       # /Applications/MATHEMATICKS.app
#   ./tools/update-app.sh /path/to/Other.app
set -e
SRC=$(cd "$(dirname "$0")/.." && pwd)
APP=${1:-/Applications/MATHEMATICKS.app}
DEST="$APP/Contents/Resources/app"

if [ ! -d "$DEST" ]; then
  echo "No bundled game at: $DEST" >&2
  echo "Is $APP really the desktop build?" >&2
  exit 1
fi

stamp() { grep -o 'style\.css?v=[0-9A-Za-z]*' "$1" 2>/dev/null | head -1; }

echo "before: $(stamp "$DEST/index.html")"

cp "$SRC/index.html" "$SRC/style.css" "$SRC/manifest.json" \
   "$SRC/icon-192.png" "$SRC/icon-512.png" "$DEST/"
rsync -a --delete "$SRC/js/" "$DEST/js/"

# The manual is part of the game now: rules.js and render.js are what the
# on-screen manual is built from, and without them a Solo split and a
# two-device manual screen both come up empty. manual.pdf rides along because
# PRINTED mode needs something to print.
mkdir -p "$DEST/manual" "$DEST/fonts"
rsync -a --delete --exclude '*.stale' "$SRC/manual/" "$DEST/manual/"

# The display face is bundled, not asked for by name: a font installed on the
# machine this was built on is not on the machine it is shown on.
rsync -a --delete "$SRC/fonts/" "$DEST/fonts/"

echo "after : $(stamp "$DEST/index.html")"
echo "updated $DEST — relaunch the app to see it"
ls "$DEST" | sed 's/^/  /'
