#!/bin/bash

set -e

VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')
OUTPUT="dist/version-chrome-ext-v${VERSION}.zip"

mkdir -p dist
rm -f "$OUTPUT"

zip -r "$OUTPUT" \
  manifest.json \
  content.js \
  popup.html \
  popup.js \
  options.html \
  options.js \
  icons/

echo "Created $OUTPUT"
