import { describe, expect, it } from 'vitest'
import type { Morpheme, Pos } from './morpheme'
import { applyRuby } from './ruby'
import { morpheme } from './testing'

const m = (surface: string, pos: Pos = 'noun', reading = 'dict') => morpheme(surface, pos, { reading, pronunciation: reading })
const readings = (ms: Morpheme[]) => ms.map((x) => x.reading)

describe('applyRuby', () => {
  it('被注音完整覆盖的词素改用书中读音,其余保持词典读音', () => {
    const text = '私は夢'
    const result = applyRuby([m('私'), m('は', 'particle', 'は'), m('夢')], text, [
      { start: 0, end: 1, reading: 'わたし' },
    ])
    expect(readings(result)).toEqual(['わたし', 'は', 'dict'])
    expect(result[0].pronunciation).toBe('わたし')
  })

  it('送假名在注音之外时,读音由注音加送假名拼成', () => {
    const result = applyRuby([m('行く', 'verb')], '行く', [{ start: 0, end: 1, reading: 'い' }])
    expect(readings(result)).toEqual(['いく'])
  })

  it('片假名注音转为平假名', () => {
    const result = applyRuby([m('夢')], '夢', [{ start: 0, end: 1, reading: 'ユメ' }])
    expect(readings(result)).toEqual(['ゆめ'])
  })

  it('注音跨过词素边界时回退到词典', () => {
    const result = applyRuby([m('窓'), m('辺')], '窓辺', [{ start: 0, end: 2, reading: 'まどべ' }])
    expect(readings(result)).toEqual(['dict', 'dict'])
  })

  it('词素里有未标注的汉字时回退到词典', () => {
    const result = applyRuby([m('風鈴')], '風鈴', [{ start: 0, end: 1, reading: 'ふう' }])
    expect(readings(result)).toEqual(['dict'])
  })

  it('分词结果与原句对不上时不做改动', () => {
    const morphemes = [m('夢')]
    expect(applyRuby(morphemes, '別の文', [{ start: 0, end: 1, reading: 'ゆめ' }])).toBe(morphemes)
  })

  it('没有注音时原样返回', () => {
    const morphemes = [m('夢')]
    expect(applyRuby(morphemes, '夢', [])).toBe(morphemes)
  })
})
