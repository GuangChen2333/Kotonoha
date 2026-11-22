import type { Pos } from './nlp/morpheme'

export const POS_LABEL: Record<Pos, string> = {
  noun: '名词',
  pronoun: '代词',
  verb: '动词',
  adjective: '形容词',
  adjectival: '形状词',
  adverb: '副词',
  particle: '助词',
  auxiliary: '助动词',
  conjunction: '接续词',
  interjection: '感叹词',
  prenoun: '连体词',
  prefix: '接头词',
  suffix: '接尾词',
  symbol: '符号',
  filler: '填充词',
  other: '其他',
}

/** 词性下划线颜色,取自传统色:山吹、若草、撫子、浅葱、藤 等,饱和度压低,不抢正文。 */
export const POS_COLOR: Record<Pos, string> = {
  noun: '#E0B650',
  pronoun: '#E0B650',
  verb: '#86B968',
  adjective: '#D98FAE',
  adjectival: '#D98FAE',
  adverb: '#E29A5C',
  particle: '#6AB4B6',
  auxiliary: '#B6CE8E',
  conjunction: '#A99CD2',
  interjection: '#E08F88',
  prenoun: '#E29A5C',
  prefix: '#B4BFB8',
  suffix: '#B4BFB8',
  symbol: 'transparent',
  filler: '#B4BFB8',
  other: '#B4BFB8',
}
