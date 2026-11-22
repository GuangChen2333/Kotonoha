import { isRenyou, isTeForm, type Morpheme, type Pos } from './morpheme'

/** 一个「词」:实词加上它的变形成分(湿っ+てる、鳴っ+て+いる、食べ+させ+られ+なかっ+た)。 */
export interface Word {
  morphemes: Morpheme[]
  /** 第一个实词(跳过前缀) */
  head: Morpheme
  surface: string
}

const INFLECTING = new Set<Pos>(['verb', 'adjective', 'adjectival', 'auxiliary'])

const headOf = (morphemes: Morpheme[]) => morphemes.find((m) => m.pos !== 'prefix') ?? morphemes[0]

/** m 是否是前面那个词的变形成分。名词后面的「です」不并入,只有动词、形容词、形状词及它们的变形链才接。 */
function continuesInflection(m: Morpheme, tail: Morpheme | undefined): boolean {
  if (m.pos === 'auxiliary') return true
  if (m.pos === 'particle' && (isTeForm(m) || m.surface === 'ば')) return true
  // 补助动词、补助形容词:て形之后(見て|いる),或连用形之后(行き|たく|なかっ、食べ|始める)
  return m.auxiliaryLike && (m.pos === 'verb' || m.pos === 'adjective') && (isTeForm(tail) || isRenyou(tail))
}

/**
 * 在一个文节内部把词素合成词:前缀并入后面的词,接尾辞并入前面的词,
 * 动词、形容词、形状词后面的变形成分并入同一个词;助词、名词、符号各自成词。
 */
export function groupWords(chunk: Morpheme[]): Word[] {
  const groups: Morpheme[][] = []
  let joinNext = false

  for (const m of chunk) {
    const last = groups.at(-1)
    const head = last && headOf(last)
    const attaches =
      !!last && (joinNext || m.pos === 'suffix' || (!!head && INFLECTING.has(head.pos) && continuesInflection(m, last.at(-1))))
    if (last && attaches) last.push(m)
    else groups.push([m])
    joinNext = m.pos === 'prefix'
  }

  return groups.map((morphemes) => ({ morphemes, head: headOf(morphemes), surface: morphemes.map((m) => m.surface).join('') }))
}
