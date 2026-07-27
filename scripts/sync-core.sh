#!/usr/bin/env bash
#
# core/core.js is the single source of truth for the JSON engine.
#
# An extension package has to contain it physically — a manifest cannot
# reference files outside the package root — so extension-chrome/ carries a
# generated copy, which is what keeps "load unpacked" working with no build
# step at all. This script refreshes that copy; test/sync.test.mjs fails if the
# copy and the source ever drift apart, so the duplication cannot rot silently.
#
# The Firefox package is assembled by scripts/build-firefox.sh from the Chrome
# tree plus a manifest overlay, so it needs no copy of its own.
#
set -euo pipefail

cd "$(dirname "$0")/.."

HEADER='/* GENERATED FILE — do not edit. Source of truth: core/core.js (refresh with scripts/sync-core.sh). */'

for target in extension-chrome; do
  mkdir -p "$target/src"
  { printf '%s\n' "$HEADER"; cat core/core.js; } > "$target/src/core.js"
  echo "synced core/core.js → $target/src/core.js"
done
