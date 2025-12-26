#!/usr/bin/env bash
set -euo pipefail

EXT_NAME="discovery-survey-extension"
DIST_DIR="dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# копируем нужные файлы (исключая мусор)
rsync -a \
  --exclude ".git" \
  --exclude ".github" \
  --exclude "dist" \
  --exclude "node_modules" \
  --exclude "*.psd" \
  --exclude "*.ai" \
  --exclude "*.xcf" \
  ./ "$DIST_DIR/$EXT_NAME"

cd "$DIST_DIR"
zip -r "${EXT_NAME}.zip" "$EXT_NAME" -x "*.DS_Store*"
echo "Built: $DIST_DIR/${EXT_NAME}.zip"
