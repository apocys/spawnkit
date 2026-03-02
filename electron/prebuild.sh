#!/bin/bash
# Pre-build: Copy all app content into electron/ for packaging
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔧 Pre-build: Copying app content for packaging..."

# Clean previous copies (preserve fleet-*.js and spawnkit-panels.js in src/)
rm -rf "$SCRIPT_DIR/office-executive" "$SCRIPT_DIR/office-gameboy-color" "$SCRIPT_DIR/office-sims" "$SCRIPT_DIR/office-simcity" "$SCRIPT_DIR/dashboard.html" "$SCRIPT_DIR/lib"
# Backup fleet files before src/ cleanup
mkdir -p /tmp/spawnkit-src-backup
cp "$SCRIPT_DIR/src/fleet-client.js" "$SCRIPT_DIR/src/fleet-bootstrap.js" "$SCRIPT_DIR/src/spawnkit-panels.js" /tmp/spawnkit-src-backup/ 2>/dev/null || true
rm -rf "$SCRIPT_DIR/src"

# Copy office themes
for theme in executive gameboy-color sims simcity green-iso; do
  if [ -d "$ROOT_DIR/office-$theme" ]; then
    cp -R "$ROOT_DIR/office-$theme" "$SCRIPT_DIR/office-$theme"
    echo "  ✅ office-$theme"
  fi
done

# Copy shared src modules
cp -R "$ROOT_DIR/src" "$SCRIPT_DIR/src"
echo "  ✅ src/"

# Copy dashboard
if [ -f "$ROOT_DIR/dashboard.html" ]; then
  cp "$ROOT_DIR/dashboard.html" "$SCRIPT_DIR/dashboard.html"
  echo "  ✅ dashboard.html"
fi

# Copy lib if exists
if [ -d "$ROOT_DIR/lib" ]; then
  cp -R "$ROOT_DIR/lib" "$SCRIPT_DIR/lib"
  echo "  ✅ lib/"
fi

# Copy sprites if referenced
if [ -d "$ROOT_DIR/sprites" ]; then
  cp -R "$ROOT_DIR/sprites" "$SCRIPT_DIR/sprites"
  echo "  ✅ sprites/"
fi

# Restore fleet files
cp /tmp/spawnkit-src-backup/fleet-client.js /tmp/spawnkit-src-backup/fleet-bootstrap.js /tmp/spawnkit-src-backup/spawnkit-panels.js "$SCRIPT_DIR/src/" 2>/dev/null || true

echo "✅ Pre-build complete!"
