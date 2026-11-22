#!/bin/sh
# 下载 Lindera 的 UniDic 词典包到 public/dict/。版本需与 package.json 中的 lindera-wasm 一致。
set -eu
VERSION=6.2.0
DEST="$(dirname "$0")/../public/dict"
mkdir -p "$DEST"
curl -fL -o "$DEST/lindera-unidic-$VERSION.zip" \
  "https://github.com/lindera/lindera/releases/download/v$VERSION/lindera-unidic-$VERSION.zip"
