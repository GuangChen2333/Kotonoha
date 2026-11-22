import type { Morpheme } from './morpheme'
import type { Word } from './words'

export interface InflectionPart {
  surface: string
  /** 这一段的作用,如「连用形(促音便)」「进行·状态」 */
  label: string
}

export interface Inflection {
  /** 原形与它的读音 */
  base: string
  baseReading: string
  /** 活用类型,如「五段动词(ラ行)」;不活用的词为空 */
  type: string
  parts: InflectionPart[]
}

const FORM: Record<string, string> = {
  未然形: '未然形', 連用形: '连用形', 終止形: '终止形', 連体形: '连体形', 仮定形: '假定形', 命令形: '命令形', 意志推量形: '意志·推量形', 已然形: '已然形',
}
const VARIANT: Record<string, string> = { 促音便: '促音便', 撥音便: '拨音便', イ音便: 'イ音便', ウ音便: 'ウ音便', 一般: '' }

const TYPE_PREFIX: Record<string, string> = { 五段: '五段动词', 上一段: '上一段动词', 下一段: '下一段动词', サ行変格: 'サ变动词', カ行変格: 'カ变动词' }

/** 助动词按语彙素标注作用。 */
const AUXILIARY: Record<string, string> = {
  た: '过去·完了', ない: '否定', ず: '否定(文语「ぬ」)', ぬ: '否定(文语)', ます: '礼貌', です: '礼貌的断定', だ: '断定',
  れる: '被动·可能·自发·尊敬', られる: '被动·可能·自发·尊敬', せる: '使役', させる: '使役', たい: '愿望', たがる: '愿望(第三者)',
  う: '意志·推量', よう: '意志·推量', らしい: '推测', そうだ: '样态·传闻', ようだ: '比喻·推测',
  てる: '进行·状态(「ている」的口语缩约)', ちゃう: '完了·遗憾(「てしまう」的口语缩约)', じゃう: '完了·遗憾(「でしまう」的口语缩约)',
}

/** 补助动词、补助形容词按语彙素标注作用(接在て形或连用形之后)。 */
const AUXILIARY_VERB: Record<string, string> = {
  居る: '进行·状态(~ている)', 有る: '结果状态(~てある)', 仕舞う: '完了·遗憾(~てしまう)', 置く: '预先(~ておく)',
  来る: '趋向·变化(~てくる)', 行く: '趋向·变化(~ていく)', 見る: '尝试(~てみる)', 呉れる: '受惠(~てくれる)',
  上げる: '施惠(~てあげる)', 貰う: '受惠(~てもらう)', 始める: '开始~', 続ける: '继续~', 過ぎる: '过度~', 無い: '否定',
}

export function formLabel(conjugationForm: string): string {
  const [kind, variant] = conjugationForm.split('-')
  const name = FORM[kind] ?? kind
  const detail = variant === undefined ? '' : (VARIANT[variant] ?? variant)
  return detail ? `${name}(${detail})` : name
}

function typeLabel(conjugationType: string): string {
  if (conjugationType === '形容詞') return 'い形容词'
  const [kind, row] = conjugationType.split('-')
  const name = TYPE_PREFIX[kind]
  if (!name) return conjugationType
  return row ? `${name}(${row.replace('ワア', 'ワ')})` : name
}

function partLabel(m: Morpheme, isHead: boolean): string {
  const form = m.conjugationForm && m.conjugationForm !== '終止形-一般' ? formLabel(m.conjugationForm) : ''
  if (isHead) return form || '原形'
  let role: string
  if (m.pos === 'particle') role = m.lemma === 'て' ? 'て形的接续助词' : m.surface === 'ば' ? '假定的接续助词' : '助词'
  else if (m.pos === 'auxiliary') role = AUXILIARY[m.lemma] ?? `助动词「${m.lemma}」`
  else if (m.pos === 'suffix') role = '接尾辞'
  else if (m.pos === 'prefix') role = '接头辞'
  else role = AUXILIARY_VERB[m.lemma] ?? `补助「${m.lemma}」`
  return form && m.pos === 'auxiliary' ? `${role},${form}` : role
}

/**
 * 说明一个词是怎么变形来的:原形、活用类型,以及每个成分的作用。
 * 没有可说的(单个词素、没有变形)时返回 undefined。
 */
export function describeInflection(word: Word): Inflection | undefined {
  const { head, morphemes } = word
  const inflected = head.conjugationForm !== '' && head.conjugationForm !== '終止形-一般' && head.conjugationForm !== '連体形-一般'
  if (morphemes.length === 1 && !inflected) return undefined

  return {
    base: head.base,
    baseReading: head.baseReading,
    type: head.conjugationType ? typeLabel(head.conjugationType) : '',
    parts: morphemes.map((m) => ({ surface: m.surface, label: partLabel(m, m === head) })),
  }
}

/** 给云端模型的一行变形说明,如「原形 湿る(五段动词(ラ行));湿っ=连用形(促音便) + てる=进行·状态(「ている」的口语缩约)」。 */
export function inflectionText(inflection: Inflection): string {
  const base = `原形 ${inflection.base}${inflection.type ? `(${inflection.type})` : ''}`
  return `${base};${inflection.parts.map((p) => `${p.surface}=${p.label}`).join(' + ')}`
}
