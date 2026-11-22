import { describe, expect, it } from 'vitest'
import { userDictionaryCsv } from './userDictionary'

describe('userDictionaryCsv', () => {
  const rows = userDictionaryCsv().split('\n').map((r) => r.split(','))

  it('每行都是 UniDic 完整格式的 21 个字段', () => {
    for (const r of rows) expect(r).toHaveLength(21)
  })

  it('读音、发音位置与词素转换读取的位置一致', () => {
    const doushite = rows.find((r) => r[0] === 'どうして')!
    expect(doushite[4]).toBe('副詞')
    expect(doushite[10]).toBe('ドウシテ') // 语彙素读み
    expect(doushite[13]).toBe('ドーシテ') // 发音形(出现形)
    expect(doushite[14]).toBe('どうして') // 书字形(基本形)
  })

  it('没有长音符号的词,发音与读音相同', () => {
    const itsumo = rows.find((r) => r[0] === 'いつも')!
    expect(itsumo[10]).toBe('イツモ')
    expect(itsumo[13]).toBe('イツモ')
  })
})
