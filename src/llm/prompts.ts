import { posLabel } from '../dict/tags'
import type { NumberedSense } from '../dict/jmdict'
import type { Level } from './config'

const LEVEL_GUIDE: Record<Level, string> = {
  N5: '学习者是日语初学者(约 N5)。解说只用最基础、最常见的词汇;凡出现汉字词,先给出读音再解释;语法点用最朴素的说法,避免术语。',
  N4: '学习者是初级日语学习者(约 N4)。解说用简单的词汇;较难的汉字词给出读音;语法点用基础说法,术语要有一句话的解释。',
  N3: '学习者是中级日语学习者(约 N3)。解说可使用常见的语法术语;重点说明词义如何随语境确定,以及活用形的构成。',
  N2: '学习者是中高级日语学习者(约 N2)。解说可以直接使用语法术语;重点辨析近义词、书面语与口语的差别、敬语与语气。',
  N1: '学习者是高级日语学习者(约 N1)。解说力求精炼,可直接使用语法与修辞术语;重点放在语感、文体色彩和细微的语义差别上。',
}

/** 句子翻译。输出纯译文。 */
export function translationInstructions(targetLanguage: string): string {
  return `你是一位经验丰富的日语文学翻译。请把用户给出的日语句子翻译成${targetLanguage}。

要求:
1. 忠实、自然,符合${targetLanguage}的表达习惯;保留原文的语气、敬体与常体的差别、说话人的口吻。
2. 日语常省略主语和指代对象。请根据「前文」「后文」补全必要的信息,使译文读起来清楚。
3. 「前文」「后文」只用来消除歧义,不要翻译它们。
4. 拟声词、拟态词按语境意译,不要逐字直译。
5. 句子若只是章节标题、符号或感叹词,直接翻译或原样输出。
6. 只输出译文本身,不要加引号、注释、罗马音、解释或任何前后缀。`
}

export function translationPrompt(sentence: string, prev?: string, next?: string): string {
  return `前文:${prev || '(无)'}
后文:${next || '(无)'}

需要翻译的句子:
${sentence}`
}

/** 点词解说。结构化输出,字段见 client.ts 中的 schema。 */
export function wordInstructions(targetLanguage: string, level: Level): string {
  return `你是一位日语教师,正在帮助学生阅读日语小说。学生点选了句子中的一个词,请你结合这一句的具体语境解释它。

${LEVEL_GUIDE[level]}

请用${targetLanguage}回答。只返回一个 JSON 对象,不要输出其他任何内容。对象的键固定为 meaning、explanation、grammar、sense,含义如下(sense 的值是整数,其余是字符串):
- meaning:这个词在本句中的意思,简短(不超过 12 个字),给出本句真正用到的那一个义项,不要罗列词典里所有的义项。提供了「词典义项」时,它们是英文,请据此翻译并结合语境,不要照抄英文。
- sense:提供了「词典义项」时,填最贴合本句的义项编号(整数);没有贴合的,或没有提供词典义项时,填 0。
- explanation:2 到 4 句话,说明它在这一句里为什么是这个意思(指代什么、语气如何、与前后文怎么衔接)。若是拟声拟态词、惯用语或固定搭配,请点明。
- grammar:该词的变形、助词或助动词的用法等相关语法点,一两句话。有「变形」信息时,据此说明它是怎么由原形变来的、各部分表达什么。没有值得说明的语法点时,填空字符串。

注意:
- 只解释被点选的词及它所在的词组,不要翻译整句。
- 「所在词组」是该词与其后依附的助词、助动词连在一起的整体,用来判断活用与语法。
- 读音、原形与「变形」已由词典分析给出,以给出的为准,不要自行更改。
- 不确定时宁可说明不确定,不要编造词义或例句。`
}

export interface WordPromptInput {
  sentence: string
  /** 被点选的词的表层形 */
  surface: string
  /** 原形(词典形) */
  base: string
  /** 平假名读音 */
  reading: string
  /** 词性(中文) */
  pos: string
  /** 该词所在的词组(文节),如「鳴っている」 */
  phrase: string
  /** 词典分析出的变形说明,如「原形 湿る(五段动词(ラ行));湿っ=连用形(促音便) + てる=…」;没有变形时省略 */
  inflection?: string
  /** JMdict 里查到的候选义项(已编号);查不到时省略 */
  dictionary?: NumberedSense[]
}

function dictionaryLines(senses: NumberedSense[]): string {
  return senses
    .map(({ n, entry, sense }) => {
      const writing = entry.kanji[0] ? `${entry.kanji[0]}【${entry.kana[0]}】` : entry.kana[0]
      const tags = sense.tags.length ? ` (${sense.tags.join(', ')})` : ''
      const notes = sense.notes.length ? ` — ${sense.notes.join('; ')}` : ''
      return `${n}. ${writing} [${sense.pos.map(posLabel).join('、')}] ${sense.glosses.join('; ')}${tags}${notes}`
    })
    .join('\n')
}

export function wordPrompt(w: WordPromptInput): string {
  return `句子:${w.sentence}

被点选的词:${w.surface}
原形:${w.base}
读音:${w.reading || '(未知)'}
词性:${w.pos}
所在词组:${w.phrase}${w.inflection ? `\n变形:${w.inflection}` : ''}${w.dictionary?.length ? `\n\n词典义项(JMdict,英文,编号从 1 起):\n${dictionaryLines(w.dictionary)}` : ''}`
}

/** 自由提问:学生围绕正在读的几句话向 AI 提问。输出可以带简单的 Markdown。 */
export function chatInstructions(targetLanguage: string, level: Level): string {
  return `你是一位日语教师,正在陪学生阅读一本日语小说。学生会就他正在读的几句话向你提问,可能问词义、语法、语气、说话人的意图,也可能问文化背景或剧情。

${LEVEL_GUIDE[level]}

请用${targetLanguage}回答,日语原文与例句保留日语,并给出读音。要求:
- 先结合「正在读的几句话」回答;问题与这几句话无关时,正常回答即可。
- 回答简洁,通常几句话到一小段;确实需要时才分点。可以用简单的 Markdown(粗体、列表)。
- 不确定时说明不确定,不要编造词义、语法或剧情。`
}

/** 每次提问时附上的上下文:选中的句子与前后几句。没有选中句子时为空。 */
export function chatContext(sentences: string[], activeIndex: number | undefined, radius = 2): string {
  if (activeIndex === undefined || !sentences[activeIndex]) return ''
  const from = Math.max(0, activeIndex - radius)
  const lines = sentences
    .slice(from, activeIndex + radius + 1)
    .map((s, i) => (from + i === activeIndex ? `【当前】${s}` : s))
  return `正在读的几句话(标【当前】的是学生选中的那一句):\n${lines.join('\n')}`
}
