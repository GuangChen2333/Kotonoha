import { toRomaji } from 'wanakana'
import type { Morpheme } from './morpheme'

const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/

const kanaOf = (m: Morpheme) => m.pronunciation || m.reading || m.surface

/**
 * 逐词素的罗马音。词尾的促音「っ」要重复下一个词素的首辅音(鳴っ|て → nat|te),
 * 而 wanakana 单独转换时会把它丢掉,所以拼上下一个词素一起转换,再取出本词素的部分。
 */
export function romajiOf(morphemes: Morpheme[]): Map<Morpheme, string> {
  const result = new Map<Morpheme, string>()
  morphemes.forEach((m, i) => {
    const kana = kanaOf(m)
    let romaji = toRomaji(kana)
    const next = morphemes[i + 1]
    if (next && kana.endsWith('っ') && KANA_ONLY.test(kanaOf(next))) {
      const nextKana = kanaOf(next)
      const joint = toRomaji(kana + nextKana)
      const nextRomaji = toRomaji(nextKana)
      if (joint.endsWith(nextRomaji)) romaji = joint.slice(0, joint.length - nextRomaji.length)
    }
    result.set(m, romaji)
  })
  return result
}
