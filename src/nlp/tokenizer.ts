import __wbg_init, { TokenizerBuilder, loadDictionaryFromBytes, loadUserDictionaryFromBytes } from 'lindera-wasm'
import type { Tokenizer } from 'lindera-wasm'
import { downloadDictionary, hasDictionary, loadDictionaryFiles, removeDictionary } from 'lindera-wasm/opfs'
import { mergeDemo, toMorpheme, type LinderaToken, type Morpheme } from './morpheme'
import { userDictionaryCsv } from './userDictionary'

const DICTIONARY = 'unidic'
const DICTIONARY_URL = '/dict/lindera-unidic-6.2.0.zip'

export interface Analyzer {
  analyze(text: string): Morpheme[]
}

/** 读取 OPFS 里缓存的词典;没有,或缓存不完整(比如解压到一半关掉了页面)时,清掉并重新下载。 */
async function loadDictionaryFilesOrDownload(onProgress?: (fraction: number) => void) {
  if (await hasDictionary(DICTIONARY)) {
    try {
      return await loadDictionaryFiles(DICTIONARY)
    } catch {
      await removeDictionary(DICTIONARY)
    }
  }
  await downloadDictionary(DICTIONARY_URL, DICTIONARY, {
    onProgress: ({ phase, loaded, total }) => {
      if (phase === 'downloading' && loaded && total) onProgress?.(loaded / total)
    },
  })
  return loadDictionaryFiles(DICTIONARY)
}

let loading: Promise<Analyzer> | undefined

/** 初始化分词器(只执行一次)。首次运行会把词典下载并缓存到 OPFS。 */
export function loadAnalyzer(onProgress?: (fraction: number) => void): Promise<Analyzer> {
  loading ??= (async () => {
    await __wbg_init()
    const f = await loadDictionaryFilesOrDownload(onProgress)
    const dictionary = loadDictionaryFromBytes(
      f.metadata, f.dictTrie, f.dictValsIdx, f.dictVals, f.dictWordsIdx, f.dictWords, f.matrixMtx, f.charDef, f.unk,
    )
    // 必须在交给 builder 之前取 metadata:builder 会消耗词典对象
    const userDictionary = loadUserDictionaryFromBytes(new TextEncoder().encode(userDictionaryCsv()), dictionary.metadata)
    const tokenizer: Tokenizer = new TokenizerBuilder()
      .setDictionaryInstance(dictionary)
      .setUserDictionaryInstance(userDictionary)
      .setMode('normal')
      .build()
    return { analyze: (text) => mergeDemo((tokenizer.tokenize(text) as LinderaToken[]).map(toMorpheme)) }
  })()
  return loading
}
