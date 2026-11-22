import { toHiragana } from 'wanakana'

/** 词典查询用的假名归一化:片假名转平假名,长音符号「ー」保持原样(JMdict 里写作「コーヒー」)。 */
export const normalizeKana = (s: string) => toHiragana(s, { convertLongVowelMark: false })

/** 分片文件名:归一化后读音的首字。构建脚本与运行时共用。 */
export const shardName = (kana: string) => `${[...normalizeKana(kana)][0]!.codePointAt(0)!.toString(16)}.json`
