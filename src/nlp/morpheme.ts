import { toHiragana } from 'wanakana'

export type Pos =
  | 'noun' | 'pronoun' | 'verb' | 'adjective' | 'adjectival' | 'adverb' | 'particle' | 'auxiliary'
  | 'conjunction' | 'interjection' | 'prenoun' | 'prefix' | 'suffix' | 'symbol' | 'filler' | 'other'

export interface Morpheme {
  surface: string
  pos: Pos
  /** 词典标为「非自立可能」,在「て/で」之后作补助用法(食べて|いる) */
  auxiliaryLike: boolean
  /** 原形(词典形),如 鳴る */
  base: string
  /** 语彙素(词典中的基本词条),如 居る、仕舞う、させる;用来识别补助动词与助动词 */
  lemma: string
  /** 平假名;原形的读音(语彙素读み) */
  baseReading: string
  /** 活用型,如 五段-ラ行;不活用的词为空 */
  conjugationType: string
  /** 活用形,如 連用形-促音便;不活用的词为空 */
  conjugationForm: string
  /** 平假名读音,用于振假名;符号与未登录词为空 */
  reading: string
  /** 平假名发音,助词「は」为 わ,长音符号已展开为元音(きれえ);用于罗马音 */
  pronunciation: string
}

export interface LinderaToken {
  surface: string
  details: string[]
}

const POS_BY_UNIDIC: Record<string, Pos> = {
  名詞: 'noun',
  代名詞: 'pronoun',
  動詞: 'verb',
  形容詞: 'adjective',
  形状詞: 'adjectival',
  副詞: 'adverb',
  助詞: 'particle',
  助動詞: 'auxiliary',
  接続詞: 'conjunction',
  感動詞: 'interjection',
  連体詞: 'prenoun',
  接頭辞: 'prefix',
  接尾辞: 'suffix',
  補助記号: 'symbol',
  記号: 'symbol',
  空白: 'symbol',
  フィラー: 'filler',
}

const field = (details: string[], i: number) => {
  const v = details[i]
  return v && v !== '*' ? v : ''
}

/**
 * 将 UniDic 词典的 Lindera 词素转换为应用内的词素。
 * 字段:0 品词 1 品词细分 4 活用型 5 活用形 6 语彙素读み 7 语彙素 9 发音形(出现形) 10 书字形(基本形)。
 */
export function toMorpheme({ surface, details }: LinderaToken): Morpheme {
  const pos = POS_BY_UNIDIC[field(details, 0)] ?? 'other'
  const appeared = field(details, 9)
  // 默认取发音形。未变形的词在发音形带长音符号(トーキョー)或为助词(は 的发音是 ワ)时,
  // 改用语彙素读み(トウキョウ、ハ),因为读音应保持书写所对应的假名。
  const uninflected = field(details, 10) === surface
  const reading = uninflected && (appeared.includes('ー') || pos === 'particle') ? field(details, 6) : appeared
  return {
    surface,
    pos,
    auxiliaryLike: field(details, 1) === '非自立可能',
    base: field(details, 10) || surface,
    lemma: field(details, 7),
    // 保留长音符号,以便与 JMdict 的写法(コーヒー)一致
    baseReading: toHiragana(field(details, 6), { convertLongVowelMark: false }),
    conjugationType: field(details, 4),
    conjugationForm: field(details, 5),
    reading: toHiragana(reading),
    pronunciation: toHiragana(appeared),
  }
}

/** 动词、形容词的「て形」接续助词(て、で);で 的语彙素也是 て。 */
export const isTeForm = (m: Morpheme | undefined) => m?.pos === 'particle' && m.lemma === 'て'

/** 连用形的动词、形容词、助动词:后面可以接补助动词(行き|たく|なかっ、美しく|ない)。 */
export const isRenyou = (m: Morpheme | undefined) =>
  !!m && (m.pos === 'verb' || m.pos === 'adjective' || m.pos === 'auxiliary') && m.conjugationForm.startsWith('連用形')

/**
 * 把「で+も」合成助词「でも」(学生でも、中でも)。UniDic 把它拆成两个词素,拆开后对学习者没有意义。
 * 动词、形容词后面的「で+も」是「て形+も」(読んでも),で 属于前面的动词,不能合并。
 * 在分词之后合并而不放进用户词典,是因为词典里的词条会压过「ひとりで|もらう」这类正确的切分。
 */
export function mergeDemo(morphemes: Morpheme[]): Morpheme[] {
  const out: Morpheme[] = []
  for (const m of morphemes) {
    const prev = out.at(-1)
    if (prev?.surface === 'で' && !isTeForm(prev) && m.surface === 'も' && m.pos === 'particle') {
      out[out.length - 1] = { ...prev, surface: 'でも', pos: 'particle', base: 'でも', lemma: 'でも', baseReading: 'でも', reading: 'でも', pronunciation: 'でも', conjugationType: '', conjugationForm: '' }
    } else {
      out.push(m)
    }
  }
  return out
}
