#!/bin/sh
# 下载最新的 JMdict(jmdict-simplified 的英文版)切分后放到 public/dict/jmdict/。
# EDRDG 许可要求定期更新词典数据,请定期重新运行本脚本。
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

URL="$(curl -fsSL https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest | node -e '
let s = ""
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const asset = JSON.parse(s).assets.find((a) => /^jmdict-eng-\d.*\.json\.tgz$/.test(a.name))
  console.log(asset.browser_download_url)
})')"

curl -fL -o "$TMP/jmdict.tgz" "$URL"
tar xzf "$TMP/jmdict.tgz" -C "$TMP"
# 中文释义(jmdict-cn,CC BY-SA 4.0)。各级别文件放在各自的发布里
CN="$TMP/cn"
mkdir -p "$CN"
BASE=https://github.com/zzhuxiaojun-glitch/jmdict-cn/releases/download
for f in v0.1.0-N5/jmdict-cn-N5 v0.2.0-N4/jmdict-cn-N4 v0.3.0-N3/jmdict-cn-N3 v0.4.0-N2/jmdict-cn-N2 v0.5.0-N1/jmdict-cn-N1 v0.6.0-untagged/jmdict-cn-untagged; do
  curl -fL -o "$CN/$(basename "$f").json" "$BASE/$f.json"
done
node "$ROOT/scripts/build-jmdict.mjs" "$TMP"/jmdict-eng-*.json "$ROOT/public/dict/jmdict" "$CN"
