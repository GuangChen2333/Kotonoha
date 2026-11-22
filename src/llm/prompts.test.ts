import { describe, expect, it } from 'vitest'
import type { NumberedSense } from '../dict/jmdict'
import { wordInstructions, wordPrompt } from './prompts'

const senses: NumberedSense[] = [
  {
    n: 1,
    entry: { id: '1320390', kanji: ['湿る'], kana: ['しめる'], common: true, senses: [] },
    sense: { pos: ['v5r', 'vi'], glosses: ['to become damp', 'to become moist'], tags: [], notes: [], zh: [] },
  },
  {
    n: 2,
    entry: { id: '1320390', kanji: ['湿る'], kana: ['しめる'], common: true, senses: [] },
    sense: { pos: ['v5r', 'vi'], glosses: ['to lack energy'], tags: ['col'], notes: ['often as 湿って or 湿った'], zh: [] },
  },
]

const base = { sentence: 'あ、湿ってる、と', surface: '湿ってる', base: '湿る', reading: 'しめってる', pos: '动词', phrase: '湿ってる、' }

describe('wordPrompt', () => {
  it('没有词典义项与变形时,只有基本信息', () => {
    const text = wordPrompt(base)
    expect(text).toContain('被点选的词:湿ってる')
    expect(text).not.toContain('词典义项')
    expect(text).not.toContain('变形:')
  })

  it('带变形与词典义项时,义项按编号列出,含词性、释义、标签与备注', () => {
    const text = wordPrompt({ ...base, inflection: '原形 湿る(五段动词(ラ行));湿っ=连用形(促音便) + てる=进行·状态', dictionary: senses })
    expect(text).toContain('变形:原形 湿る')
    expect(text).toContain('1. 湿る【しめる】 [五段动词、自动词] to become damp; to become moist')
    expect(text).toContain('2. 湿る【しめる】 [五段动词、自动词] to lack energy (col) — often as 湿って or 湿った')
  })
})

describe('wordInstructions', () => {
  it('要求返回 sense 编号,并说明没有贴合时填 0', () => {
    const text = wordInstructions('简体中文', 'N3')
    expect(text).toContain('sense')
    expect(text).toContain('填 0')
  })
})
