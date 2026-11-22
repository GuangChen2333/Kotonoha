// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { extractItems, extractSentences } from './extract'

const parse = (body: string) => new DOMParser().parseFromString(`<html><body>${body}</body></html>`, 'text/html')

describe('extractSentences', () => {
  it('正文不含 <rt> 的读音,注音按位置记录', () => {
    const [s] = extractSentences(parse('<p><ruby>夢<rt>ゆめ</rt></ruby>の<ruby>場所<rt>ばしょ</rt></ruby>。</p>'))
    expect(s.text).toBe('夢の場所。')
    expect(s.ruby).toEqual([
      { start: 0, end: 1, reading: 'ゆめ' },
      { start: 2, end: 4, reading: 'ばしょ' },
    ])
  })

  it('逐字注音分别记录', () => {
    const [s] = extractSentences(parse('<p><ruby>窓<rt>まど</rt>辺<rt>べ</rt></ruby>。</p>'))
    expect(s.text).toBe('窓辺。')
    expect(s.ruby).toEqual([
      { start: 0, end: 1, reading: 'まど' },
      { start: 1, end: 2, reading: 'べ' },
    ])
  })

  it('支持 <rb> 与 <rp>', () => {
    const [s] = extractSentences(parse('<p><ruby><rb>夢</rb><rp>(</rp><rt>ゆめ</rt><rp>)</rp></ruby>。</p>'))
    expect(s.text).toBe('夢。')
    expect(s.ruby).toEqual([{ start: 0, end: 1, reading: 'ゆめ' }])
  })

  it('着重号等非假名的 <rt> 不作为读音', () => {
    const [s] = extractSentences(parse('<p><ruby>大事<rt>・・</rt></ruby>だ。</p>'))
    expect(s.text).toBe('大事だ。')
    expect(s.ruby).toEqual([])
  })

  it('一个段落切成多句时,注音位置相对各自的句子', () => {
    const sentences = extractSentences(parse('<p>今は朝。<ruby>部屋<rt>へや</rt></ruby>だ。</p>'))
    expect(sentences.map((s) => s.text)).toEqual(['今は朝。', '部屋だ。'])
    expect(sentences[0].ruby).toEqual([])
    expect(sentences[1].ruby).toEqual([{ start: 0, end: 2, reading: 'へや' }])
  })

  it('<br> 分隔段落,嵌套块级元素不重复取文本', () => {
    const sentences = extractSentences(parse('<div><p>一行目。<br/>二行目。</p></div>'))
    expect(sentences.map((s) => s.text)).toEqual(['一行目。', '二行目。'])
  })
})

describe('extractItems', () => {
  it('插图与句子保持书中顺序,<img> 与 <svg><image> 都能识别', () => {
    const items = extractItems(
      parse(
        '<p>一。</p><div><img src="../Images/a.jpg"/></div><p>二。</p>' +
          '<div><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="b.png"/></svg></div>',
      ),
    )
    expect(items.map((i) => (i.type === 'image' ? i.src : i.sentence.text))).toEqual(['一。', '../Images/a.jpg', '二。', 'b.png'])
  })
})

describe('插图宽高比', () => {
  it('从 width/height 读出,百分比或缺失时没有', () => {
    const items = extractItems(
      parse('<img src="a.jpg" width="200" height="400"/><img src="b.jpg" width="100%" height="50"/><img src="c.jpg"/>'),
    )
    expect(items.map((i) => (i.type === 'image' ? i.aspect : 'sentence'))).toEqual([0.5, undefined, undefined])
  })
})
