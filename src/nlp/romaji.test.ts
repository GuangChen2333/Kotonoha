import { describe, expect, it } from 'vitest'
import type { Morpheme } from './morpheme'
import { romajiOf } from './romaji'
import { morpheme } from './testing'

const m = (surface: string, pronunciation: string) => morpheme(surface, 'verb', { reading: pronunciation, pronunciation })
const romaji = (ms: Morpheme[]) => ms.map((x) => romajiOf(ms).get(x))

describe('romajiOf', () => {
  it('词尾促音重复下一个词素的首辅音', () => {
    expect(romaji([m('鳴っ', 'なっ'), m('て', 'て'), m('いる', 'いる')])).toEqual(['nat', 'te', 'iru'])
  })

  it('下一个词素以 ch 开头时,促音写作 t', () => {
    expect(romaji([m('待っ', 'まっ'), m('ち', 'ち')])).toEqual(['mat', 'chi'])
  })

  it('没有促音的词素不受影响', () => {
    expect(romaji([m('夢', 'ゆめ'), m('の', 'の')])).toEqual(['yume', 'no'])
  })

  it('下一个词素没有假名读音时不处理促音,也不报错', () => {
    const result = romaji([m('言っ', 'いっ'), m('行', '')])
    expect(result).toHaveLength(2)
  })

  it('词素内部的促音由 wanakana 正常处理', () => {
    expect(romaji([m('ちょっと', 'ちょっと')])).toEqual(['chotto'])
  })
})
