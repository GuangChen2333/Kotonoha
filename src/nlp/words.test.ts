import { describe, expect, it } from 'vitest'
import { morpheme as m } from './testing'
import { groupWords } from './words'

const surfaces = (words: ReturnType<typeof groupWords>) => words.map((w) => w.surface)

describe('groupWords', () => {
  it('湿ってる:动词连用形加「てる」是一个词', () => {
    const words = groupWords([m('湿っ', 'verb', { conjugationForm: '連用形-促音便' }), m('てる', 'auxiliary', { lemma: 'てる' })])
    expect(surfaces(words)).toEqual(['湿ってる'])
    expect(words[0].head.surface).toBe('湿っ')
  })

  it('鳴っている:て 与补助动词「いる」并入同一个词', () => {
    const words = groupWords([
      m('鳴っ', 'verb', { conjugationForm: '連用形-促音便' }),
      m('て', 'particle', { lemma: 'て' }),
      m('いる', 'verb', { auxiliaryLike: true, lemma: '居る' }),
    ])
    expect(surfaces(words)).toEqual(['鳴っている'])
  })

  it('食べさせられなかった:助动词链是一个词', () => {
    const words = groupWords([
      m('食べ', 'verb', { conjugationForm: '連用形-一般' }),
      m('させ', 'auxiliary'), m('られ', 'auxiliary'), m('なかっ', 'auxiliary'), m('た', 'auxiliary'),
    ])
    expect(surfaces(words)).toEqual(['食べさせられなかった'])
  })

  it('行きたくなかった:连用形后的补助形容词并入', () => {
    const words = groupWords([
      m('行き', 'verb', { auxiliaryLike: true, conjugationForm: '連用形-一般' }),
      m('たく', 'auxiliary', { conjugationForm: '連用形-一般' }),
      m('なかっ', 'adjective', { auxiliaryLike: true, conjugationForm: '連用形-促音便' }),
      m('た', 'auxiliary'),
    ])
    expect(surfaces(words)).toEqual(['行きたくなかった'])
  })

  it('食べ始める:连用形后的补助动词并入', () => {
    const words = groupWords([m('食べ', 'verb', { conjugationForm: '連用形-一般' }), m('始める', 'verb', { auxiliaryLike: true })])
    expect(surfaces(words)).toEqual(['食べ始める'])
  })

  it('读んでいます、食べれば:て形与假定形的「ば」并入', () => {
    expect(
      surfaces(groupWords([
        m('読ん', 'verb', { conjugationForm: '連用形-撥音便' }), m('で', 'particle', { lemma: 'て' }),
        m('い', 'verb', { auxiliaryLike: true, conjugationForm: '連用形-一般' }), m('ます', 'auxiliary'),
      ])),
    ).toEqual(['読んでいます'])
    expect(surfaces(groupWords([m('食べれ', 'verb', { conjugationForm: '仮定形-一般' }), m('ば', 'particle')]))).toEqual(['食べれば'])
  })

  it('静かだった:形状词后的「だ」链并入', () => {
    expect(surfaces(groupWords([m('静か', 'adjectival'), m('だっ', 'auxiliary'), m('た', 'auxiliary')]))).toEqual(['静かだった'])
  })

  it('名词后的「です」不并入,但「でし|た」自成一个词', () => {
    expect(surfaces(groupWords([m('学生', 'noun'), m('でし', 'auxiliary'), m('た', 'auxiliary')]))).toEqual(['学生', 'でした'])
  })

  it('助词各自成词;格助词「で」不是て形', () => {
    expect(surfaces(groupWords([m('朝', 'noun'), m('で', 'particle', { lemma: 'で' }), m('は', 'particle')]))).toEqual(['朝', 'で', 'は'])
  })

  it('前缀并入后面的词,接尾辞并入前面的词', () => {
    expect(surfaces(groupWords([m('お', 'prefix'), m('姉', 'noun'), m('さん', 'suffix')]))).toEqual(['お姉さん'])
  })

  it('符号不并入动词', () => {
    expect(surfaces(groupWords([m('鳴っ', 'verb'), m('た', 'auxiliary'), m('。', 'symbol')]))).toEqual(['鳴った', '。'])
  })
})
