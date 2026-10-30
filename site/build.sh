#!/usr/bin/env bash
# Assembles the GitHub Pages site in _site/: the page, and the very modules that render the
# video, so the in-browser player runs the same code. Used by the workflow and for local preview.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site/assets _site/captures
cp site/index.html site/style.css site/main.js site/worker.js site/questions.json _site/
cp -r lib compositions fonts _site/
cp -r captures/neptune _site/captures/
cp docs/demo.mp4 docs/logo.svg docs/etats.png _site/assets/
# Each deployment points to its own files: no stale video or script from the cache.
sha=${GITHUB_SHA:-dev}
sed -i "s/?v=dev/?v=${sha:0:7}/g" _site/index.html
echo "_site prêt ($(du -sh _site | cut -f1))"
