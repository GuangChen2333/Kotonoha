// 不使用 Intl.Segmenter:它会在引号处误切,例如把「彼は言った。「」的左引号单独切出,
// 也会把「起きたー？」と大声を返す。拆成两句。这里按括号深度判断句子边界。
const OPEN = '「『（([【〈《'
const CLOSE = '」』）)]】〉》'
const TERMINATORS = '。！？!?'
// 引号结束后紧跟这些字符时,说明引语仍属于同一句(「…」と言った)。
const QUOTE_CONTINUATION = 'とっ'

export function splitSentences(paragraph: string): string[] {
  const chars = [...paragraph.trim()]
  const sentences: string[] = []
  let current = ''
  let depth = 0

  const flush = () => {
    const sentence = current.trim()
    if (sentence) sentences.push(sentence)
    current = ''
  }

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    current += ch

    if (OPEN.includes(ch)) {
      depth++
    } else if (CLOSE.includes(ch)) {
      depth = Math.max(0, depth - 1)
      const closesQuote = depth === 0 && TERMINATORS.includes(chars[i - 1] ?? '')
      if (closesQuote && !QUOTE_CONTINUATION.includes(chars[i + 1] ?? '')) flush()
    } else if (depth === 0 && TERMINATORS.includes(ch)) {
      while (i + 1 < chars.length && (TERMINATORS.includes(chars[i + 1]) || CLOSE.includes(chars[i + 1]))) {
        current += chars[++i]
      }
      flush()
    }
  }
  flush()
  return sentences
}
