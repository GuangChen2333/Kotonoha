import { describe, expect, it } from 'vitest'
import { splitSentences } from './sentences'

describe('splitSentences', () => {
  it('在句末标点处切分', () => {
    expect(splitSentences('今は朝で、自分の部屋。布団の上で、私は秒で理解する。')).toEqual([
      '今は朝で、自分の部屋。',
      '布団の上で、私は秒で理解する。',
    ])
  })

  it('引号内的句末标点不切分,引语后接「と」时仍属同一句', () => {
    expect(splitSentences('「起きたー？」と大声を返す。さっきまで夢だった。')).toEqual([
      '「起きたー？」と大声を返す。',
      'さっきまで夢だった。',
    ])
  })

  it('引语单独成句时在右引号后切分', () => {
    expect(splitSentences('『今日は晴れるでしょう！』テレビの人が喋っている。')).toEqual([
      '『今日は晴れるでしょう！』',
      'テレビの人が喋っている。',
    ])
  })

  it('引号内含多个句子时保持为一句', () => {
    expect(splitSentences('彼は言った。「そうか。わかった。」そして去った。')).toEqual([
      '彼は言った。',
      '「そうか。わかった。」',
      'そして去った。',
    ])
  })

  it('没有句末标点的段落整体作为一句', () => {
    expect(splitSentences('「いただきまーす」')).toEqual(['「いただきまーす」'])
    expect(splitSentences('一日目')).toEqual(['一日目'])
  })

  it('空白段落返回空数组', () => {
    expect(splitSentences('  ')).toEqual([])
  })
})
