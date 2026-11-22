import { describe, expect, it } from 'vitest'
import { filterByPos, flattenSenses, matchEntries, type RawEntry } from './jmdict'
import { shardName } from './kana'

const shimeru: RawEntry = {
  i: '1320390', k: ['湿る'], r: ['しめる', 'しとる'], c: 1,
  s: [
    { p: ['v5r', 'vi'], g: ['to become damp', 'to become moist'] },
    { p: ['v5r', 'vi'], g: ['to lack energy'], ar: ['しめる'], n: ['often as 湿って or 湿った'] },
    { p: ['v5r', 'vi'], g: ['only for the other reading'], ar: ['しとる'] },
  ],
}
const shimeruTighten: RawEntry = { i: '1', k: ['締める'], r: ['しめる'], c: 1, s: [{ p: ['v1', 'vt'], g: ['to tie'] }] }
const itsumo: RawEntry = { i: '2', k: ['何時も'], r: ['いつも'], c: 1, s: [{ p: ['adv'], g: ['always'] }] }
const kohi: RawEntry = { i: '3', k: [], r: ['コーヒー'], c: 1, s: [{ p: ['n'], g: ['coffee'] }] }

describe('matchEntries', () => {
  it('按汉字写法与读音匹配,同音异义的词条不混入', () => {
    const result = matchEntries([shimeru, shimeruTighten], '湿る', 'しめる')
    expect(result.map((e) => e.id)).toEqual(['1320390'])
  })

  it('按 JMdict 对读音的限制过滤义项', () => {
    const [entry] = matchEntries([shimeru], '湿る', 'しめる')
    expect(entry.senses.map((s) => s.glosses[0])).toEqual(['to become damp', 'to lack energy'])
    expect(entry.senses[1].notes).toEqual(['often as 湿って or 湿った'])
  })

  it('原形是假名时,只按读音匹配,也能命中带汉字写法的词条', () => {
    expect(matchEntries([itsumo], 'いつも', 'いつも')).toHaveLength(1)
  })

  it('片假名词条:长音符号保持,片假名与平假名等价', () => {
    expect(matchEntries([kohi], 'コーヒー', 'こーひー')).toHaveLength(1)
  })

  it('常用词排在前面', () => {
    const rare = { ...shimeruTighten, i: '9', c: 0 as const }
    expect(matchEntries([rare, { ...shimeruTighten, i: '8' }], '締める', 'しめる').map((e) => e.id)).toEqual(['8', '9'])
  })
})

describe('filterByPos', () => {
  const noun: RawEntry = { i: '5', k: ['湿る'], r: ['しめる'], c: 0, s: [{ p: ['n'], g: ['a noun reading'] }] }

  it('按词性保留义项', () => {
    const entries = matchEntries([shimeru, noun], '湿る', 'しめる')
    const verbs = filterByPos(entries, 'verb')
    expect(verbs.map((e) => e.id)).toEqual(['1320390'])
  })

  it('过滤后一个都不剩时保留全部', () => {
    const entries = matchEntries([noun], '湿る', 'しめる')
    expect(filterByPos(entries, 'verb')).toEqual(entries)
  })

  it('没有对应规则的词性不过滤', () => {
    const entries = matchEntries([shimeru], '湿る', 'しめる')
    expect(filterByPos(entries, 'symbol')).toEqual(entries)
  })
})

describe('flattenSenses', () => {
  it('依次编号,并受数量上限限制', () => {
    const entries = matchEntries([shimeru], '湿る', 'しめる')
    expect(flattenSenses(entries).map((s) => s.n)).toEqual([1, 2])
    expect(flattenSenses(entries, 1)).toHaveLength(1)
  })
})

describe('shardName', () => {
  it('按读音首字分片,片假名与平假名同片', () => {
    expect(shardName('しめる')).toBe('3057.json')
    expect(shardName('シメル')).toBe('3057.json')
  })
})
