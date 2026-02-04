#!/usr/bin/env bash
set -euo pipefail

EXT_NAME="chrome-extension"
DIST_DIR="dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# копируем нужные файлы для основного релиза (берём из папки `chrome-extension`, исключая мусор)
rsync -a \
  --exclude ".git" \
  --exclude ".github" \
  --exclude "dist" \
  --exclude "node_modules" \
  --exclude "*.psd" \
  --exclude "*.ai" \
  --exclude "*.xcf" \
  chrome-extension/ "$DIST_DIR/$EXT_NAME"

cd "$DIST_DIR"
zip -r "${EXT_NAME}.zip" "$EXT_NAME" -x "*.DS_Store*"
echo "Built: $DIST_DIR/${EXT_NAME}.zip"

cd ..
if [ -d "themes/admin" ]; then
  built=false
  for d in themes/admin/*; do
    if [ -d "$d" ]; then
      name=$(basename "$d")
      (cd themes && zip -r "../$DIST_DIR/admin_theme_${name}.zip" "admin/${name}")
      echo "Built: $DIST_DIR/admin_theme_${name}.zip"
      built=true
    fi
  done
  if [ "$built" = false ]; then
    echo "Skipping: no subdirectories found in themes/admin/"
  fi
else
  echo "Skipping: themes/admin/ not found"
fi
