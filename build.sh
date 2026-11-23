#!/bin/sh
# Builds index.html (standalone page for GitHub Pages) from sufler.html (the same code published on claude.ai).
# config.js sets window.SUFLER_API (the Google Apps Script URL); empty = data kept in the browser only.
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>[hidden]{display:none!important}body{margin:0}</style>\n<script src="config.js"></script>\n</head>\n<body>\n'
  cat sufler.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "index.html built"
