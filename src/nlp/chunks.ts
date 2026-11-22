import { isRenyou, isTeForm, type Morpheme } from './morpheme'

const OPENERS = '「『（([【〈《'

/**
 * 按文节分组:自立词与其后依附的助词、助动词、接尾辞、标点合成一块;
 * 「て/で」之后、或连用形之后的补助动词和补助形容词(食べて|いる、行き|たく|なかっ)也并入同一块。
 * 前缀(お、ご)与开括号并入其后的词。
 */
export function groupChunks(morphemes: Morpheme[]): Morpheme[][] {
  const chunks: Morpheme[][] = []
  let joinNext = false
  let prev: Morpheme | undefined

  for (const m of morphemes) {
    const isOpener = m.pos === 'symbol' && OPENERS.includes(m.surface)
    const attachesToPrevious =
      m.pos === 'particle' ||
      m.pos === 'auxiliary' ||
      m.pos === 'suffix' ||
      (m.pos === 'symbol' && !isOpener) ||
      (m.auxiliaryLike && (m.pos === 'verb' || m.pos === 'adjective') && (isTeForm(prev) || isRenyou(prev)))

    const last = chunks.at(-1)
    if (last && (joinNext || attachesToPrevious)) {
      last.push(m)
    } else {
      chunks.push([m])
    }
    joinNext = m.pos === 'prefix' || isOpener
    prev = m
  }
  return chunks
}
