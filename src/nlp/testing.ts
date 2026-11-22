import type { Morpheme, Pos } from './morpheme'

/** 测试用的词素工厂:只需给出表层形与词性,其余字段给出中性默认值。 */
export const morpheme = (surface: string, pos: Pos, extra: Partial<Morpheme> = {}): Morpheme => ({
  surface,
  pos,
  auxiliaryLike: false,
  base: surface,
  lemma: surface,
  baseReading: '',
  conjugationType: '',
  conjugationForm: '',
  reading: '',
  pronunciation: '',
  ...extra,
})
