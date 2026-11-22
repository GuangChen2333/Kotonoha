import { describe, expect, it } from 'vitest'
import { groupChunks } from './chunks'
import type { Morpheme } from './morpheme'
import { morpheme as m } from './testing'
const surfaces = (chunks: Morpheme[][]) => chunks.map((c) => c.map((x) => x.surface).join(''))

describe('groupChunks', () => {
  it('助词、助动词依附于前面的自立词,名词自己起一块', () => {
    const chunks = groupChunks([
      m('見', 'verb'), m('た', 'auxiliary'),
      m('こと', 'noun'), m('が', 'particle'),
      m('ある', 'verb'),
    ])
    expect(surfaces(chunks)).toEqual(['見た', 'ことが', 'ある'])
  })

  it('「て」之后的补助动词并入同一块', () => {
    const chunks = groupChunks([m('鳴っ', 'verb'), m('て', 'particle'), m('いる', 'verb', { auxiliaryLike: true }), m('。', 'symbol')])
    expect(surfaces(chunks)).toEqual(['鳴っている。'])
  })

  it('连用形之后的补助形容词并入同一块(行きたくなかった)', () => {
    const chunks = groupChunks([
      m('行き', 'verb', { conjugationForm: '連用形-一般', auxiliaryLike: true }),
      m('たく', 'auxiliary', { conjugationForm: '連用形-一般' }),
      m('なかっ', 'adjective', { auxiliaryLike: true, conjugationForm: '連用形-促音便' }),
      m('た', 'auxiliary'),
    ])
    expect(surfaces(chunks)).toEqual(['行きたくなかった'])
  })

  it('非自立可能的动词不在「て」之后时仍是独立的块', () => {
    const chunks = groupChunks([m('私', 'pronoun'), m('は', 'particle'), m('見', 'verb', { auxiliaryLike: true }), m('ない', 'auxiliary')])
    expect(surfaces(chunks)).toEqual(['私は', '見ない'])
  })

  it('开括号并入后一个词,闭括号并入前一块', () => {
    const chunks = groupChunks([m('「', 'symbol'), m('起き', 'verb'), m('た', 'auxiliary'), m('」', 'symbol')])
    expect(surfaces(chunks)).toEqual(['「起きた」'])
  })

  it('前缀并入后一个词,接尾辞并入前一个词', () => {
    const chunks = groupChunks([m('お', 'prefix'), m('天気', 'noun'), m('お', 'prefix'), m('姉', 'noun'), m('さん', 'suffix')])
    expect(surfaces(chunks)).toEqual(['お天気', 'お姉さん'])
  })

  it('空输入返回空数组', () => {
    expect(groupChunks([])).toEqual([])
  })
})
