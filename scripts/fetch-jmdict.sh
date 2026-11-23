#!/bin/sh
# 下载 JMdict(jmdict-simplified 的英文版)切分后放到 public/dict/jmdict/。
# 版本固定为 dict-version.meta.json 里的 jmdictSimplified;每两周由 .github/workflows/dict-update.yml
# 检查新版本并更新它(EDRDG 许可要求定期更新词典数据)。手动更新词典时,改这个文件里的版本号再运行本脚本。
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# CI 里匿名调用 GitHub API 容易被限流,有 GITHUB_TOKEN 时带上
github_api() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" "$1"
  else
    curl -fsSL "$1"
  fi
}

TAG="$(node -p 'require(process.argv[1]).jmdictSimplified' "$ROOT/dict-version.meta.json")"
# 版本号里的 + 在 URL 路径里要转义
URL="$(github_api "https://api.github.com/repos/scriptin/jmdict-simplified/releases/tags/$(printf %s "$TAG" | sed 's/+/%2B/g')" | node -e '
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
