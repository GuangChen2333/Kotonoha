interface Entry {
  surface: string
  /** UniDic 的品词大类 */
  pos: string
  /** 片假名读音 */
  reading: string
  /** 片假名发音,与读音不同时(长音符号)才需要给出 */
  pronunciation?: string
}

// UniDic 把这些固定表达拆开了,而它们整体才是一个词条,拆开后各部分对学习者没有意义。
// 只收整体几乎总是一个词的:「だから」在「雨だから」里是「だ+から」,不能合并,所以不在此列。
const ENTRIES: Entry[] = [
  { surface: 'いつも', pos: '副詞', reading: 'イツモ' },
  { surface: 'いつか', pos: '副詞', reading: 'イツカ' },
  { surface: 'いつまでも', pos: '副詞', reading: 'イツマデモ' },
  { surface: 'どうして', pos: '副詞', reading: 'ドウシテ', pronunciation: 'ドーシテ' },
  { surface: 'どうしても', pos: '副詞', reading: 'ドウシテモ', pronunciation: 'ドーシテモ' },
  { surface: 'ごめんなさい', pos: '感動詞', reading: 'ゴメンナサイ' },
  { surface: 'すみません', pos: '感動詞', reading: 'スミマセン' },
  { surface: 'いただきます', pos: '感動詞', reading: 'イタダキマス' },
]

/**
 * UniDic 完整格式(21 字段)的用户词典 CSV。字段顺序与 `toMorpheme` 读取的位置一致。
 * 上下文编号 0 与代价 -10000 是该词典对用户词条的默认值,保证它们在分词时优先。
 */
export function userDictionaryCsv(): string {
  return ENTRIES.map((e) => {
    const pron = e.pronunciation ?? e.reading
    return [e.surface, 0, 0, -10000, e.pos, '*', '*', '*', '*', '*', e.reading, e.surface, e.surface, pron, e.surface, pron, '和', '*', '*', '*', '*'].join(',')
  }).join('\n')
}
