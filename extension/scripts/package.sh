#!/usr/bin/env bash
# Builds the store upload, dist/unsceneit-<version>.zip, without dev-only files
# (config.dev.js, tests, scripts). Refuses to build if a secret key would end
# up in the package.
set -euo pipefail

cd "$(dirname "$0")/.." # extension/
VERSION="$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')"
OUT_DIR="../dist"
OUT="$OUT_DIR/unsceneit-$VERSION.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT"
zip -qr "$OUT" . -x "config.dev.js" "scripts/*" "tests/*" ".*" "*/.*"

# Safety net: no secret keys in a store build, ever.
if unzip -Z1 "$OUT" | grep -qx "config.dev.js" || unzip -p "$OUT" | grep -qE "sb_secret_|const DEV_SECRET_KEY"; then
  rm -f "$OUT"
  echo "✗ A secret key ended up in the package; aborted." >&2
  exit 1
fi

echo "✓ $(cd "$OUT_DIR" && pwd)/$(basename "$OUT")"
unzip -Z1 "$OUT" | sed 's/^/  /'
