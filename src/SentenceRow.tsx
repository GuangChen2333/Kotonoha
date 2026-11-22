import Translate from '@mui/icons-material/Translate'
import { Box, Button, ButtonBase, Collapse, IconButton, Skeleton, Tooltip, Typography } from '@mui/material'
import { memo, useEffect, useMemo, useState } from 'react'
import { groupChunks } from './nlp/chunks'
import { romajiOf } from './nlp/romaji'
import { applyRuby, type RubySpan } from './nlp/ruby'
import type { Analyzer } from './nlp/tokenizer'
import { groupWords, type Word } from './nlp/words'
import { POS_COLOR } from './posStyle'
import type { Settings } from './settings'
import { FadeIn } from './motion'
import { READING_FONT, tint } from './theme'
import { NotConfiguredError, translateSentence } from './llm/client'
import { isLlmConfigured, loadLlmConfig } from './llm/config'
import type { WordClick } from './WordPopover'

const HAS_KANJI = /[㐀-鿿々]/

interface Props {
  /** 这一句在本章所有句子中的序号(插图不算) */
  index: number
  sentence: string
  /** 书中注音,优先于词典读音 */
  ruby: RubySpan[]
  prev?: string
  next?: string
  /** AI 设置保存后递增,用于让已出错的译文重新请求 */
  revision: number
  analyzer: Analyzer
  settings: Settings
  active: boolean
  /** 这一句是否点了翻译按钮。状态放在外面:虚拟列表滚出屏幕会卸载这一行,放在行里会丢 */
  translateRequested: boolean
  onSelect: (index: number) => void
  onToggleTranslate: (index: number) => void
  onOpenLlm: () => void
  onWord: (click: WordClick) => void
}

function wordReading(word: Word): string {
  const withKanji = word.morphemes.filter((m) => HAS_KANJI.test(m.surface))
  if (withKanji.length === 0 || withKanji.some((m) => !m.reading)) return ''
  return word.morphemes.map((m) => m.reading || m.surface).join('')
}

const annotation = { minHeight: '1.3em', lineHeight: 1.3, fontSize: '0.7rem', letterSpacing: '0.02em', color: 'text.secondary' } as const

function WordCell({ word, romaji, settings, onWord }: { word: Word; romaji: string; settings: Settings; onWord: (anchor: HTMLElement) => void }) {
  const isSymbol = word.head.pos === 'symbol'
  const furigana = settings.furigana && !isSymbol ? wordReading(word) : ''

  return (
    <ButtonBase
      disabled={isSymbol}
      onClick={(e) => onWord(e.currentTarget)}
      sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', px: 0.5, py: 0.25, borderRadius: '8px', transition: 'background-color 0.15s', '@media (hover: hover)': { '&:hover': { bgcolor: 'action.hover' } } }}
    >
      {settings.furigana && (
        <Typography component="span" sx={annotation}>
          {furigana}
        </Typography>
      )}
      <Typography
        component="span"
        sx={{
          fontFamily: READING_FONT,
          fontSize: '1.65rem',
          lineHeight: 1.5,
          letterSpacing: '0.02em',
          textDecoration: settings.posColors && !isSymbol ? 'underline' : 'none',
          textDecorationColor: POS_COLOR[word.head.pos],
          textDecorationThickness: '3px',
          textUnderlineOffset: '6px',
          textDecorationSkipInk: 'none',
        }}
      >
        {word.surface}
      </Typography>
      {settings.romaji && (
        <Typography component="span" sx={annotation}>
          {isSymbol ? '' : romaji}
        </Typography>
      )}
    </ButtonBase>
  )
}

type Translation = { key: string; text?: string; error?: string; unconfigured?: boolean }

// 已经拿到的译文留在内存里:虚拟列表滚出再滚回来时,这一行重新挂载,不必再等一次异步读缓存,
// 否则译文会先消失一下(骨架屏)再出现。
const translated = new Map<string, Translation>()

function TranslationBlock({ current }: { current: Translation | undefined }) {
  // 译文已在缓存里时几十毫秒内就到了:加载中的骨架屏晚 0.3 秒再淡入,免得一闪而过。
  // 出现时就已经有结果的,不需要等。这个延迟只在块第一次出现时确定。
  const [delay] = useState(current ? 0 : 0.3)
  return (
    <FadeIn delay={delay} sx={{ mt: 1.5, pl: 1.75, borderLeft: 2, borderColor: (t) => tint(t, 0.35) }}>
      {!current && <Skeleton variant="text" width="55%" />}
      {current?.text && (
        <FadeIn duration={0.4}>
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{current.text}</Typography>
        </FadeIn>
      )}
      {current?.error && (
        <Typography variant="body2" sx={{ color: 'error.main' }}>
          {current.error}
        </Typography>
      )}
    </FadeIn>
  )
}

export default memo(function SentenceRow({
  index, sentence, ruby, prev, next, revision, analyzer, settings, active, translateRequested, onSelect, onToggleTranslate, onOpenLlm, onWord,
}: Props) {
  const key = `${revision}|${sentence}`
  const [result, setResult] = useState<Translation | undefined>(() => translated.get(key))

  // 虚拟列表里这一行只有在屏幕附近才存在,挂载时直接分词,不需要先显示占位文本
  const { chunks, romaji } = useMemo(() => {
    const morphemes = applyRuby(analyzer.analyze(sentence), sentence, ruby)
    return { chunks: groupChunks(morphemes).map(groupWords), romaji: romajiOf(morphemes) }
  }, [analyzer, sentence, ruby])

  // 选中一句只是高亮它(并作为 AI 对话的上下文),不会触发翻译;翻译要点右上角的按钮
  const showTranslation = settings.translation === 'always' || translateRequested
  // 没配置 AI 时,「常驻显示」什么都不出现(页面顶部的提示已经说明了);只有用户亲手点了按钮才提示
  const configured = revision >= 0 && isLlmConfigured(loadLlmConfig())
  const showHint = translateRequested && !configured
  const showBlock = showTranslation && configured
  const current = result?.key === key ? result : undefined
  useEffect(() => {
    if (!showBlock || current) return
    const controller = new AbortController()
    translateSentence(sentence, prev, next, controller.signal).then(
      (text) => {
        const done = { key, text }
        translated.set(key, done)
        setResult(done)
      },
      (e: unknown) => {
        if (controller.signal.aborted) return
        setResult(e instanceof NotConfiguredError ? { key, unconfigured: true } : { key, error: e instanceof Error ? e.message : String(e) })
      },
    )
    return () => controller.abort()
  }, [showBlock, current, key, sentence, prev, next])

  return (
    <Box
      onClick={() => onSelect(index)}
      sx={{
        position: 'relative',
        px: { xs: 2, sm: 3 },
        pr: { xs: 6, sm: 7 },
        py: 2,
        borderRadius: '20px',
        cursor: 'pointer',
        minHeight: 72,
        border: 1,
        borderColor: active ? 'divider' : 'transparent',
        bgcolor: active ? 'background.paper' : 'transparent',
        boxShadow: active ? '0 12px 32px -16px rgba(20, 40, 33, 0.35)' : 'none',
        transition: 'background-color 0.2s, box-shadow 0.2s, border-color 0.2s',
        '@media (hover: hover)': {
          '&:hover': { bgcolor: active ? 'background.paper' : 'action.hover' },
          '&:hover .translate, &:focus-within .translate': { visibility: 'visible' },
        },
      }}
    >
      {settings.translation !== 'always' && (
        <Tooltip title={translateRequested ? '收起译文' : '翻译这一句'}>
          <IconButton
            className="translate"
            size="small"
            aria-label={translateRequested ? '收起译文' : '翻译这一句'}
            aria-pressed={translateRequested}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(index)
              onToggleTranslate(index)
            }}
            // 触屏没有悬停:未选中的句子不显示按钮,免得误触;选中或已翻译时才出现
            sx={{ position: 'absolute', top: 8, right: 8, visibility: active || translateRequested ? 'visible' : 'hidden', color: translateRequested ? 'primary.main' : 'text.secondary' }}
          >
            <Translate fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
        {chunks.map((chunk, i) => (
          <Box key={i} sx={{ display: 'inline-flex' }}>
            {chunk.map((word, j) => {
              const wordRomaji = word.morphemes.map((m) => romaji.get(m) ?? '').join('')
              return (
                <WordCell
                  key={j}
                  word={word}
                  romaji={wordRomaji}
                  settings={settings}
                  onWord={(anchor) =>
                    onWord({ word, anchor, sentence, phrase: chunk.map((w) => w.surface).join(''), reading: wordReading(word), romaji: wordRomaji })
                  }
                />
              )
            })}
          </Box>
        ))}
      </Box>

      {/* 译文展开、收起带高度动画,下面的内容跟着平滑移动,而不是瞬间被推开。已经展开着的行重新挂载时不再播放 */}
      <Collapse in={showHint || (showBlock && !current?.unconfigured)} appear={false} unmountOnExit>
        {showHint ? (
          <Box sx={{ mt: 1.5, pl: 1.75, borderLeft: 2, borderColor: (t) => tint(t, 0.35) }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              配置 AI 之后才能翻译。
            </Typography>
            <Button size="small" onClick={onOpenLlm}>
              AI 设置
            </Button>
          </Box>
        ) : (
          <TranslationBlock current={current} />
        )}
      </Collapse>
    </Box>
  )
})
