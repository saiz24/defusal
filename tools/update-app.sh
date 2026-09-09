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

echo "before: $(grep -o 'style\.css?v=[0-9]*' "$DEST/index.html" | head -1)"

cp "$SRC/index.html" "$SRC/style.css" "$SRC/manifest.json" \
   "$SRC/icon-192.png" "$SRC/icon-512.png" "$DEST/"
rsync -a --delete "$SRC/js/" "$DEST/js/"

echo "after : $(grep -o 'style\.css?v=[0-9]*' "$DEST/index.html" | head -1)"
echo "updated $DEST — relaunch the app to see it"
