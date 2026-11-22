// 把 jmdict-simplified 的 jmdict-eng JSON 切成按读音首字分片的小文件,供浏览器按需读取。
// 用法:node scripts/build-jmdict.mjs <jmdict-eng.json> <输出目录> [jmdict-cn 数据目录]
// 给了 jmdict-cn(github.com/zzhuxiaojun-glitch/jmdict-cn,CC BY-SA 4.0,中文释义由大模型生成)时,把中文释义合并进对应义项。
// 数据版权:JMdict © EDRDG,CC BY-SA 4.0;衍生数据同样以该许可分发,见输出目录的 NOTICE.txt。
import fs from 'node:fs'
import path from 'node:path'
import { shardName } from '../src/dict/kana.ts'

const [, , input, outDir, cnDir] = process.argv
if (!input || !outDir) {
  console.error('用法:node scripts/build-jmdict.mjs <jmdict-eng.json> <输出目录>')
  process.exit(1)
}

const dict = JSON.parse(fs.readFileSync(input, 'utf8'))
const shards = new Map()

// 中文释义:按词条 ID 对应,且只在这一义项的英文释义与 JMdict 完全一致时才采用(两边版本不同步、被截断的词条退回只显示英文)。
// 同一词条出现在多个 JLPT 级别文件里时,取先读到的(N5 到 N1,最后是表外)。
const cn = new Map()
if (cnDir) {
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1', 'untagged']) {
    for (const e of JSON.parse(fs.readFileSync(path.join(cnDir, `jmdict-cn-${level}.json`), 'utf8'))) {
      if (!cn.has(e.id)) cn.set(e.id, e)
    }
  }
}
let zhSenses = 0
const sameGlosses = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
const isText = (x) => typeof x === 'string' && x.trim() !== ''

function chinese(word, index) {
  const e = cn.get(word.id)
  const en = e?.senses_en?.[index]
  const zh = e?.senses_zh?.[index]
  if (!en || !zh || !sameGlosses(en.glosses, word.sense[index].gloss.map((g) => g.text))) return {}
  const z = (zh.glosses ?? []).filter(isText)
  if (z.length === 0) return {}
  zhSenses++
  return { z, zc: isText(zh.context) ? zh.context : undefined }
}

const star = (xs) => (xs.length === 1 && xs[0] === '*' ? undefined : xs)
const nonEmpty = (xs) => (xs.length ? xs : undefined)

for (const w of dict.words) {
  const entry = {
    i: w.id,
    k: w.kanji.map((k) => k.text),
    r: w.kana.map((k) => k.text),
    c: w.kanji.some((k) => k.common) || w.kana.some((k) => k.common) ? 1 : 0,
    s: w.sense.map((s, i) => ({
      ...chinese(w, i),
      p: s.partOfSpeech,
      g: s.gloss.map((g) => g.text),
      m: nonEmpty(s.misc),
      d: nonEmpty(s.dialect),
      f: nonEmpty(s.field),
      n: nonEmpty(s.info),
      ak: star(s.appliesToKanji),
      ar: star(s.appliesToKana),
    })),
  }
  // 每个读音首字一片;同一词条的多个读音首字不同时,各片各存一份
  for (const name of new Set(entry.r.map(shardName))) {
    if (!shards.has(name)) shards.set(name, [])
    shards.get(name).push(entry)
  }
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
let total = 0
for (const [name, entries] of shards) {
  const json = JSON.stringify(entries)
  total += json.length
  fs.writeFileSync(path.join(outDir, name), json)
}

fs.writeFileSync(
  path.join(outDir, 'NOTICE.txt'),
  `本目录的词典数据派生自 JMdict(日英词典),版权归 James William BREEN 与 The Electronic Dictionary Research and Development Group (EDRDG) 所有。
数据按 Creative Commons Attribution-ShareAlike Licence (V4.0) 提供,衍生数据同样以该许可分发。

  JMdict 项目:https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
  许可声明:https://www.edrdg.org/edrdg/licence.html
  转换格式:https://github.com/scriptin/jmdict-simplified

词典版本:${dict.version}(${dict.dictDate})
${cnDir ? `\n中文释义来自 jmdict-cn(https://github.com/zzhuxiaojun-glitch/jmdict-cn,CC BY-SA 4.0),由大模型(Claude)生成,未经人工逐条校对。\n` : ''}
本目录由 scripts/build-jmdict.mjs 生成。EDRDG 许可要求定期更新数据,请定期重新运行 scripts/fetch-jmdict.sh。
`,
)
if (cnDir) console.log(`中文释义:${zhSenses} 个义项`)
console.log(`词条 ${dict.words.length},分片 ${shards.size} 个,合计 ${(total / 1048576).toFixed(1)} MB,最大分片 ${(Math.max(...[...shards.values()].map((e) => JSON.stringify(e).length)) / 1048576).toFixed(2)} MB`)
