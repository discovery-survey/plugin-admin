#!/usr/bin/env bash
set -euo pipefail

EXT_NAME="chrome-extension"
THEME_NAME="theme-admin"
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
  # заходим в `themes`, создаём архив и записываем его в проектную папку `dist` (../dist из `themes`)
  (cd themes && zip -r "../$DIST_DIR/${THEME_NAME}.zip" admin)
  echo "Built: $DIST_DIR/${THEME_NAME}.zip"
else
  echo "Skipping: themes/admin/ not found"
fi
