import { describe, expect, it } from 'vitest'
import { describeInflection, formLabel, inflectionText } from './conjugation'
import { morpheme as m } from './testing'
import { groupWords } from './words'

// 以下词素字段均取自 UniDic 的真实输出
const shimetteru = () =>
  groupWords([
    m('湿っ', 'verb', { base: '湿る', baseReading: 'しめる', lemma: '湿る', conjugationType: '五段-ラ行', conjugationForm: '連用形-促音便' }),
    m('てる', 'auxiliary', { lemma: 'てる', conjugationType: '下一段-タ行', conjugationForm: '終止形-一般' }),
  ])[0]

describe('describeInflection', () => {
  it('湿ってる:原形、活用类型与各成分的作用', () => {
    expect(describeInflection(shimetteru())).toEqual({
      base: '湿る',
      baseReading: 'しめる',
      type: '五段动词(ラ行)',
      parts: [
        { surface: '湿っ', label: '连用形(促音便)' },
        { surface: 'てる', label: '进行·状态(「ている」的口语缩约)' },
      ],
    })
  })

  it('鳴っている:て 与补助动词「いる」', () => {
    const [word] = groupWords([
      m('鳴っ', 'verb', { base: '鳴る', conjugationType: '五段-ラ行', conjugationForm: '連用形-促音便' }),
      m('て', 'particle', { lemma: 'て' }),
      m('いる', 'verb', { auxiliaryLike: true, lemma: '居る', conjugationForm: '終止形-一般' }),
    ])
    expect(describeInflection(word)!.parts.map((p) => p.label)).toEqual(['连用形(促音便)', 'て形的接续助词', '进行·状态(~ている)'])
  })

  it('食べさせられなかった:助动词链依次标注,助动词的活用形一并给出', () => {
    const [word] = groupWords([
      m('食べ', 'verb', { base: '食べる', conjugationType: '下一段-バ行', conjugationForm: '連用形-一般' }),
      m('させ', 'auxiliary', { lemma: 'させる', conjugationForm: '未然形-一般' }),
      m('られ', 'auxiliary', { lemma: 'られる', conjugationForm: '未然形-一般' }),
      m('なかっ', 'auxiliary', { lemma: 'ない', conjugationForm: '連用形-促音便' }),
      m('た', 'auxiliary', { lemma: 'た', conjugationForm: '終止形-一般' }),
    ])
    const info = describeInflection(word)!
    expect(info.type).toBe('下一段动词(バ行)')
    expect(info.parts.map((p) => p.label)).toEqual([
      '连用形', '使役,未然形', '被动·可能·自发·尊敬,未然形', '否定,连用形(促音便)', '过去·完了',
    ])
  })

  it('单个词素的命令形、意志形也要说明', () => {
    const [word] = groupWords([m('行こう', 'verb', { base: '行く', conjugationType: '五段-カ行', conjugationForm: '意志推量形' })])
    expect(describeInflection(word)!.parts).toEqual([{ surface: '行こう', label: '意志·推量形' }])
  })

  it('没有变形的词不说明', () => {
    expect(describeInflection(groupWords([m('夢', 'noun')])[0])).toBeUndefined()
    expect(describeInflection(groupWords([m('食べる', 'verb', { conjugationForm: '終止形-一般' })])[0])).toBeUndefined()
  })
})

describe('formLabel', () => {
  it('活用形的中文名称', () => {
    expect(formLabel('連用形-一般')).toBe('连用形')
    expect(formLabel('連用形-撥音便')).toBe('连用形(拨音便)')
    expect(formLabel('仮定形-一般')).toBe('假定形')
    expect(formLabel('命令形')).toBe('命令形')
  })
})

describe('inflectionText', () => {
  it('给云端模型的一行说明', () => {
    expect(inflectionText(describeInflection(shimetteru())!)).toBe(
      '原形 湿る(五段动词(ラ行));湿っ=连用形(促音便) + てる=进行·状态(「ている」的口语缩约)',
    )
  })
})
