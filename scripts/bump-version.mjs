// 把 tauri.conf.json、Cargo.toml、Cargo.lock 里的应用版本号 patch +1,并把新版本号打印到标准输出。
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const edit = (path, change) => {
  const file = new URL(path, root)
  writeFileSync(file, change(readFileSync(file, 'utf8')))
}

const conf = JSON.parse(readFileSync(new URL('src-tauri/tauri.conf.json', root), 'utf8'))
const [major, minor, patch] = conf.version.split('.').map(Number)
const next = `${major}.${minor}.${patch + 1}`

const replaceOnce = (text, pattern, replacement) => {
  if (!pattern.test(text)) throw new Error(`没有找到要替换的版本号:${pattern}`)
  return text.replace(pattern, replacement)
}
edit('src-tauri/tauri.conf.json', (s) => replaceOnce(s, /("version":\s*")[^"]+(")/, `$1${next}$2`))
edit('src-tauri/Cargo.toml', (s) => replaceOnce(s, /^version = "[^"]+"/m, `version = "${next}"`))
edit('src-tauri/Cargo.lock', (s) => replaceOnce(s, /(name = "kotonoha"\nversion = ")[^"]+(")/, `$1${next}$2`))

console.log(next)
