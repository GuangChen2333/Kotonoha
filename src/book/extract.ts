import { splitSentences } from '../nlp/sentences'
import type { RubySpan } from '../nlp/ruby'

export interface Sentence {
  text: string
  ruby: RubySpan[]
}

interface Paragraph {
  text: string
  ruby: RubySpan[]
}

const BLOCK = 'p, h1, h2, h3, h4, h5, h6, li, dt, dd, td, blockquote, div'
// 只接受假名注音;着重号(・、﹅)等不是读音
const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/

/** 读出一个叶子块级元素:拼接正文,同时记录每个 <ruby> 注音对应的正文位置。<br> 视为段落分隔。 */
function readBlock(block: Element): Paragraph[] {
  const paragraphs: Paragraph[] = []
  let text = ''
  let ruby: RubySpan[] = []

  const flush = () => {
    const trimmed = text.trim()
    if (trimmed) {
      const lead = text.length - text.trimStart().length
      paragraphs.push({
        text: trimmed,
        ruby: ruby
          .map((s) => ({ ...s, start: s.start - lead, end: s.end - lead }))
          .filter((s) => s.start >= 0 && s.end <= trimmed.length),
      })
    }
    text = ''
    ruby = []
  }

  const addRuby = (baseStart: number, reading: string) => {
    let start = baseStart
    let end = text.length
    while (text[start] === ' ') start++
    while (end > start && text[end - 1] === ' ') end--
    if (end > start && KANA_ONLY.test(reading)) ruby.push({ start, end, reading })
  }

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent ?? '').replace(/\s+/g, ' ')
      return
    }
    if (!(node instanceof Element)) return
    switch (node.localName) {
      case 'br':
        flush()
        return
      case 'rt':
      case 'rp':
        return // 注音在 ruby 分支中处理,不进入正文
      case 'ruby': {
        let baseStart = text.length
        for (const child of node.childNodes) {
          if (child instanceof Element && child.localName === 'rt') {
            addRuby(baseStart, (child.textContent ?? '').trim())
            baseStart = text.length
          } else {
            walk(child)
          }
        }
        return
      }
      default:
        node.childNodes.forEach(walk)
    }
  }

  walk(block)
  flush()
  return paragraphs
}

function sentencesOf(paragraph: Paragraph): Sentence[] {
  let cursor = 0
  return splitSentences(paragraph.text).map((text) => {
    const start = paragraph.text.indexOf(text, cursor)
    if (start < 0) return { text, ruby: [] }
    cursor = start + text.length
    return {
      text,
      ruby: paragraph.ruby
        .filter((s) => s.start >= start && s.end <= cursor)
        .map((s) => ({ ...s, start: s.start - start, end: s.end - start })),
    }
  })
}

/** 章节里按书中顺序排列的内容:句子,或插图(src 是图片在 EPUB 中的原始引用,尚未解析成路径)。 */
/** aspect 是宽高比,从标签上的 width/height 读出;读不出来时没有。显示前就知道比例,才能提前留出位置,图片出现时不推开正文。 */
export type ChapterItem = { type: 'sentence'; sentence: Sentence } | { type: 'image'; src: string; aspect?: number }

// <img> 是 HTML 的图片;<svg><image> 是封面页和整页插图常见的写法,地址在 xlink:href 里
const IMAGE = 'img, image'

const pixels = (value: string | null) => {
  const n = value && !value.endsWith('%') ? Number.parseFloat(value) : Number.NaN
  return n > 0 ? n : undefined
}

function aspectOf(el: Element): number | undefined {
  const width = pixels(el.getAttribute('width'))
  const height = pixels(el.getAttribute('height'))
  return width && height ? width / height : undefined
}

/** 取出章节中的句子与插图,保持原有顺序。句子带上句内的书中注音。 */
export function extractItems(doc: Document): ChapterItem[] {
  return [...doc.querySelectorAll(`${BLOCK}, ${IMAGE}`)]
    .filter((el) => !el.querySelector(BLOCK))
    .flatMap((el): ChapterItem[] => {
      if (el.matches(IMAGE)) {
        const src = el.getAttribute('src') ?? el.getAttribute('xlink:href') ?? el.getAttribute('href')
        return src ? [{ type: 'image', src, aspect: aspectOf(el) }] : []
      }
      return readBlock(el)
        .flatMap(sentencesOf)
        .map((sentence) => ({ type: 'sentence', sentence }))
    })
}

/** 只取章节中的句子。 */
export function extractSentences(doc: Document): Sentence[] {
  return extractItems(doc).flatMap((item) => (item.type === 'sentence' ? [item.sentence] : []))
}
