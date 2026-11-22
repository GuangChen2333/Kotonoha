import { describe, expect, it } from 'vitest'
import { mergeDemo, toMorpheme, type Morpheme } from './morpheme'
import { morpheme } from './testing'

const rest = ['和', '*', '*', '*', '*']

describe('toMorpheme', () => {
  it('未变形的词用语彙素读み作读音,发音取发音形(长音符号展开为元音)', () => {
    const m = toMorpheme({
      surface: 'きれい',
      details: ['形状詞', '一般', '*', '*', '*', '*', 'キレイ', '奇麗', 'きれい', 'キレー', 'きれい', 'キレー', ...rest],
    })
    expect(m).toMatchObject({ pos: 'adjectival', reading: 'きれい', pronunciation: 'きれえ', base: 'きれい' })
  })

  it('变形后的词用发音形作读音,并还原原形', () => {
    const m = toMorpheme({
      surface: '食べ',
      details: ['動詞', '一般', '*', '*', '下一段-バ行', '連用形-一般', 'タベル', '食べる', '食べ', 'タベ', '食べる', 'タベル', ...rest],
    })
    expect(m).toMatchObject({
      pos: 'verb', reading: 'たべ', base: '食べる', auxiliaryLike: false,
      lemma: '食べる', baseReading: 'たべる', conjugationType: '下一段-バ行', conjugationForm: '連用形-一般',
    })
  })

  it('助词「は」的发音为 わ', () => {
    const m = toMorpheme({
      surface: 'は',
      details: ['助詞', '係助詞', '*', '*', '*', '*', 'ハ', 'は', 'は', 'ワ', 'は', 'ワ', ...rest],
    })
    expect(m).toMatchObject({ pos: 'particle', reading: 'は', pronunciation: 'わ' })
  })

  it('识别接尾辞与「非自立可能」', () => {
    const san = toMorpheme({ surface: 'さん', details: ['接尾辞', '名詞的', '一般', '*', '*', '*', 'サン', 'さん', 'さん', 'サン', 'さん', 'サン', ...rest] })
    expect(san.pos).toBe('suffix')
    const mi = toMorpheme({ surface: '見', details: ['動詞', '非自立可能', '*', '*', '上一段-マ行', '未然形-一般', 'ミル', '見る', '見', 'ミ', '見る', 'ミル', ...rest] })
    expect(mi.auxiliaryLike).toBe(true)
  })

  it('符号没有读音;未登录词缺少字段时回退为表层形', () => {
    expect(toMorpheme({ surface: '。', details: ['補助記号', '句点', '*', '*', '*', '*', '', '。', '。', '', '。', ''] })).toMatchObject({ pos: 'symbol', reading: '' })
    expect(toMorpheme({ surface: 'ﾎﾞｲ', details: ['UNK'] })).toMatchObject({ pos: 'other', base: 'ﾎﾞｲ', reading: '' })
  })
})

describe('mergeDemo', () => {
  const m = (surface: string, pos: Morpheme['pos'], lemma = surface) => morpheme(surface, pos, { lemma })

  it('名词、格助词之后的「で+も」合成「でも」', () => {
    const merged = mergeDemo([m('中', 'noun'), m('で', 'particle'), m('も', 'particle'), m('、', 'symbol')])
    expect(merged.map((x) => x.surface)).toEqual(['中', 'でも', '、'])
    expect(merged[1]).toMatchObject({ pos: 'particle', base: 'でも', reading: 'でも' })
  })

  it('て形的「で」后面的「も」不合并(読んでも)', () => {
    const merged = mergeDemo([m('読ん', 'verb'), m('で', 'particle', 'て'), m('も', 'particle')])
    expect(merged.map((x) => x.surface)).toEqual(['読ん', 'で', 'も'])
  })

  it('「で」后面不是助词「も」时不动(ひとりで|もらった)', () => {
    const merged = mergeDemo([m('で', 'particle'), m('もらっ', 'verb'), m('た', 'auxiliary')])
    expect(merged.map((x) => x.surface)).toEqual(['で', 'もらっ', 'た'])
  })
})
