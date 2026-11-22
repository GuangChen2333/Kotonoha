import { toHiragana } from 'wanakana'
import type { Morpheme } from './morpheme'

/** 书中注音:句子文本中 [start, end) 的汉字,读音为 reading。 */
export interface RubySpan {
  start: number
  end: number
  reading: string
}

const HAS_KANJI = /[㐀-鿿々]/

function readingFromRuby(surface: string, start: number, end: number, ruby: RubySpan[]): string | undefined {
  let reading = ''
  let used = false
  for (let i = start; i < end; ) {
    const span = ruby.find((s) => s.start <= i && i < s.end)
    if (span) {
      // 注音跨过词素边界时无法拆分读音,交给词典
      if (span.start < start || span.end > end) return undefined
      reading += span.reading
      used = true
      i = span.end
    } else {
      const ch = surface[i - start]
      // 词素里有书中没有标注的汉字时,读音不完整,交给词典
      if (HAS_KANJI.test(ch)) return undefined
      reading += ch
      i++
    }
  }
  return used ? toHiragana(reading) : undefined
}

/**
 * 书中带注音时优先使用书里的读音:被注音完整覆盖的词素,读音与发音都改用书中的;
 * 其余词素保持词典读音。分词结果与原句对不上时不做任何改动。
 */
export function applyRuby(morphemes: Morpheme[], text: string, ruby: RubySpan[]): Morpheme[] {
  if (ruby.length === 0 || morphemes.map((m) => m.surface).join('') !== text) return morphemes
  let offset = 0
  return morphemes.map((m) => {
    const start = offset
    offset += m.surface.length
    const reading = readingFromRuby(m.surface, start, offset, ruby)
    return reading ? { ...m, reading, pronunciation: reading } : m
  })
}
