#!/usr/bin/env bash
#
# Build the Firefox (AMO) package.
#
# The Firefox add-on is the Chrome tree plus an overlay: only the files that
# genuinely differ live in extension-firefox/. Today that is the manifest alone —
# Firefox MV3 has no service_worker, so the background is declared as an event
# page — and the extension code itself is byte-identical between the two
# browsers. Keeping it that way is deliberate: two copies of content.js would
# drift within a release.
#
set -euo pipefail

cd "$(dirname "$0")/.."

./scripts/sync-core.sh >/dev/null

STAGE="dist/firefox"
rm -rf "$STAGE"
mkdir -p "$STAGE"

# 1. Base: everything the Chrome package ships.
cp -R extension-chrome/. "$STAGE"/

# 2. Overlay: only real files, never the directory's README.
cp extension-firefox/manifest.json "$STAGE"/manifest.json
if [ -d extension-firefox/src ]; then
  cp -R extension-firefox/src/. "$STAGE"/src/
fi

VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$STAGE/manifest.json" \
  | head -1 | sed 's/.*"\([0-9][0-9.]*\)".*/\1/')

if [ -z "$VERSION" ]; then
  echo "could not read version from the staged manifest" >&2
  exit 1
fi

OUT="json-beautifier-firefox-${VERSION}.zip"
rm -f "$OUT"

if command -v zip >/dev/null 2>&1; then
  ( cd "$STAGE" && zip -rq "../../$OUT" . -x '*.DS_Store' '*/.*' )
else
  # ops-de has no `zip` binary; python3 is always there.
  python3 - "$OUT" "$STAGE" <<'PY'
import os, sys, zipfile
out, root = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if name.startswith("."):
                continue
            full = os.path.join(dirpath, name)
            z.write(full, os.path.relpath(full, root))
PY
fi

echo "$OUT"
