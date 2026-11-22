import type { Pos } from '../nlp/morpheme'
import { normalizeKana, shardName } from './kana'

interface RawSense {
  p: string[]
  g: string[]
  m?: string[]
  d?: string[]
  f?: string[]
  n?: string[]
  ak?: string[]
  ar?: string[]
  /** 中文释义(jmdict-cn)与它的语境说明;没有对应时缺省 */
  z?: string[]
  zc?: string
}

export interface RawEntry {
  i: string
  k: string[]
  r: string[]
  c: 0 | 1
  s: RawSense[]
}

export interface DictSense {
  pos: string[]
  glosses: string[]
  /** 用法标签:口语、谦让语、方言、专业领域等 */
  tags: string[]
  notes: string[]
  /** 中文释义;没有时为空 */
  zh: string[]
  zhNote?: string
}

export interface DictEntry {
  id: string
  kanji: string[]
  kana: string[]
  common: boolean
  senses: DictSense[]
}

export interface NumberedSense {
  n: number
  entry: DictEntry
  sense: DictSense
}

/** 按「原形 + 读音」匹配词条,并按 JMdict 对义项的汉字/读音限制过滤义项。常用词排在前面。 */
export function matchEntries(raw: RawEntry[], base: string, reading: string): DictEntry[] {
  const key = normalizeKana(reading || base)
  const baseIsKana = normalizeKana(base) === key
  const matched: DictEntry[] = []

  for (const e of raw) {
    const kana = e.r.find((r) => normalizeKana(r) === key)
    if (kana === undefined) continue
    if (!baseIsKana && !e.k.includes(base)) continue

    const senses = e.s
      .filter((s) => (!s.ak || baseIsKana || s.ak.includes(base)) && (!s.ar || s.ar.includes(kana)))
      .map((s) => ({ pos: s.p, glosses: s.g, tags: [...(s.m ?? []), ...(s.d ?? []), ...(s.f ?? [])], notes: s.n ?? [], zh: s.z ?? [], zhNote: s.zc }))
    if (senses.length > 0) matched.push({ id: e.i, kanji: e.k, kana: e.r, common: e.c === 1, senses })
  }
  return matched.sort((a, b) => Number(b.common) - Number(a.common))
}

const POS_MATCH: Partial<Record<Pos, (code: string) => boolean>> = {
  verb: (c) => c.startsWith('v') && c !== 'vs',
  adjective: (c) => c.startsWith('adj-i'),
  adjectival: (c) => c === 'adj-na' || c === 'adj-no' || c === 'adj-t' || c === 'adj-f' || c === 'n',
  noun: (c) => c === 'n' || c.startsWith('n-') || c === 'pn' || c === 'ctr' || c === 'num' || c === 'vs' || c === 'adj-no',
  pronoun: (c) => c === 'pn' || c === 'n',
  adverb: (c) => c === 'adv' || c === 'adv-to' || c === 'n-adv',
  conjunction: (c) => c === 'conj',
  interjection: (c) => c === 'int' || c === 'exp',
  particle: (c) => c === 'prt',
  prenoun: (c) => c === 'adj-pn',
  auxiliary: (c) => c.startsWith('aux') || c === 'cop',
  prefix: (c) => c === 'pref' || c === 'n-pref',
  suffix: (c) => c === 'suf' || c === 'n-suf',
}

/** 按词典分析出的词性过滤义项;过滤后一个都不剩时保留原样,宁可多给也不给空。 */
export function filterByPos(entries: DictEntry[], pos: Pos): DictEntry[] {
  const accepts = POS_MATCH[pos]
  if (!accepts) return entries
  const filtered = entries
    .map((e) => ({ ...e, senses: e.senses.filter((s) => s.pos.some(accepts)) }))
    .filter((e) => e.senses.length > 0)
  return filtered.length > 0 ? filtered : entries
}

/** 把义项依次编号,供界面与提示词共用同一套编号。 */
export function flattenSenses(entries: DictEntry[], limit = 10): NumberedSense[] {
  const out: NumberedSense[] = []
  for (const entry of entries) {
    for (const sense of entry.senses) {
      if (out.length >= limit) return out
      out.push({ n: out.length + 1, entry, sense })
    }
  }
  return out
}

const shards = new Map<string, Promise<RawEntry[]>>()

function loadShard(kana: string): Promise<RawEntry[]> {
  const name = shardName(kana)
  let shard = shards.get(name)
  if (!shard) {
    shard = fetch(`/dict/jmdict/${name}`).then((res) => (res.ok ? (res.json() as Promise<RawEntry[]>) : []))
    shards.set(name, shard)
  }
  return shard
}

/** 查词典。分片读不到(没有下载词典、网络出错)时返回空数组,不影响其余功能。 */
export async function lookupDictionary(base: string, reading: string, pos: Pos): Promise<DictEntry[]> {
  const key = reading || base
  if (!key) return []
  try {
    return filterByPos(matchEntries(await loadShard(key), base, reading), pos)
  } catch {
    return []
  }
}
