import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { Box, Button, Chip, Link, Popover, Skeleton, SwipeableDrawer, Typography, useMediaQuery } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { flattenSenses, lookupDictionary, type NumberedSense } from './dict/jmdict'
import { posLabel } from './dict/tags'
import { explainWord, NotConfiguredError, type WordExplanation } from './llm/client'
import { describeInflection, inflectionText, type Inflection } from './nlp/conjugation'
import type { Word } from './nlp/words'
import { POS_LABEL } from './posStyle'
import { FadeIn } from './motion'
import { READING_FONT, tint } from './theme'

export interface WordClick {
  word: Word
  anchor: HTMLElement
  sentence: string
  /** 该词所在的词组(文节) */
  phrase: string
  /** 整个词的平假名读音(含变形部分);词里没有汉字时为空 */
  reading: string
  romaji: string
}

interface Props {
  click: WordClick | null
  /** AI 设置保存后递增,用于让已出错的解说重新请求 */
  revision: number
  onClose: () => void
  onOpenLlm: () => void
}

type AiResult = { key: string; loading?: boolean; data?: WordExplanation; error?: string; unconfigured?: boolean }

const caption = { color: 'text.secondary', fontSize: '0.75rem' } as const

/** 原形、活用类型,以及「湿っ + てる」这样的变形链。 */
function InflectionChain({ inflection }: { inflection: Inflection }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        原形{' '}
        <Box component="span" sx={{ fontFamily: READING_FONT, color: 'text.primary', fontSize: '1rem' }}>
          {inflection.base}
        </Box>
        {inflection.baseReading && inflection.baseReading !== inflection.base ? `(${inflection.baseReading})` : ''}
        {inflection.type ? ` · ${inflection.type}` : ''}
      </Typography>
      <Box sx={{ mt: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 1, rowGap: 1.5 }}>
        {inflection.parts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <Typography sx={{ mt: '0.3rem', color: 'text.secondary' }}>+</Typography>}
            <Box sx={{ textAlign: 'center', maxWidth: 190 }}>
              <Typography sx={{ fontFamily: READING_FONT, fontSize: '1.4rem', lineHeight: 1.3 }}>{p.surface}</Typography>
              <Typography sx={{ ...caption, lineHeight: 1.35 }}>{p.label}</Typography>
            </Box>
          </Fragment>
        ))}
      </Box>
    </Box>
  )
}

function SourceLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} target="_blank" rel="noreferrer" color="inherit" underline="hover" sx={{ textDecorationColor: 'currentColor' }}>
      {children}
    </Link>
  )
}

function DictionarySection({ senses, chosen }: { senses: NumberedSense[]; chosen: number | undefined }) {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography sx={{ ...caption, mb: 0.5 }}>词典</Typography>
      {senses.map(({ n, entry, sense }, i) => {
        const picked = chosen === n
        return (
          <Box key={n}>
            {(i === 0 || senses[i - 1].entry !== entry) && (
              <Typography sx={{ mt: i === 0 ? 0 : 1.5, fontFamily: READING_FONT, fontWeight: 600 }}>
                {entry.kanji[0] ? `${entry.kanji[0]}【${entry.kana[0]}】` : entry.kana[0]}
              </Typography>
            )}
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                mt: 0.5,
                pl: 1.25,
                borderLeft: 2,
                borderColor: picked ? 'primary.main' : 'transparent',
                color: picked ? 'text.primary' : 'text.secondary',
              }}
            >
              <Typography variant="body2" sx={{ minWidth: '1.1em', fontWeight: picked ? 700 : 400 }}>
                {n}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: picked ? 600 : 400 }}>
                <Box component="span" sx={{ ...caption, mr: 0.75 }}>
                  {sense.pos.map(posLabel).join('、')}
                </Box>
                {sense.zh.length > 0 && (
                  <Box component="span" sx={{ display: 'block', fontWeight: 600, color: 'text.primary' }}>
                    {sense.zh.join('、')}
                    {sense.zhNote && <Box component="span" sx={{ ...caption, ml: 0.75, fontWeight: 400 }}>({sense.zhNote})</Box>}
                  </Box>
                )}
                {sense.glosses.join('; ')}
                {sense.tags.length > 0 && ` (${sense.tags.join(', ')})`}
                {sense.notes.length > 0 && ` — ${sense.notes.join('; ')}`}
              </Typography>
            </Box>
          </Box>
        )
      })}
      <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.5, ...caption, fontSize: '0.7rem', lineHeight: 1.6, opacity: 0.85 }}>
        <span>数据</span>
        <span>
          <SourceLink href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project">JMdict</SourceLink> © EDRDG ·{' '}
          <SourceLink href="https://www.edrdg.org/edrdg/licence.html">CC BY-SA 4.0</SourceLink>
        </span>
        {senses.some((s) => s.sense.zh.length > 0) && (
          <>
            <span>中文</span>
            <span>
              来自 <SourceLink href="https://github.com/zzhuxiaojun-glitch/jmdict-cn">jmdict-cn</SourceLink>,由大模型生成,仅供参考
            </span>
          </>
        )}
      </Box>
    </Box>
  )
}

export default function WordPopover({ click, revision, onClose, onOpenLlm }: Props) {
  const word = click?.word
  const mobile = useMediaQuery((t: Theme) => t.breakpoints.down('sm'))
  const key = click ? `${revision}|${click.sentence}|${click.phrase}|${click.word.surface}` : ''
  const inflection = useMemo(() => (word ? describeInflection(word) : undefined), [word])

  const [dictionary, setDictionary] = useState<{ key: string; senses: NumberedSense[] }>()
  const [ai, setAi] = useState<AiResult>()
  const askController = useRef<AbortController>(undefined)
  const dictCurrent = dictionary?.key === key ? dictionary : undefined

  const aiCurrent = ai?.key === key ? ai : undefined

  // 先查词典(本地分片,很快),再带着候选义项请求云端模型
  useEffect(() => {
    if (!click || dictCurrent) return
    let cancelled = false
    const { head } = click.word
    void lookupDictionary(head.base, head.baseReading, head.pos).then((entries) => {
      if (!cancelled) setDictionary({ key, senses: flattenSenses(entries) })
    })
    return () => {
      cancelled = true
    }
  }, [click, dictCurrent, key])

  const askAi = () => {
    if (!click || !dictCurrent) return
    const controller = new AbortController()
    askController.current = controller
    setAi({ key, loading: true })
    explainWord(
      {
        sentence: click.sentence,
        surface: click.word.surface,
        base: click.word.head.base,
        reading: click.reading,
        pos: POS_LABEL[click.word.head.pos],
        phrase: click.phrase,
        inflection: inflection ? inflectionText(inflection) : undefined,
        dictionary: dictCurrent.senses,
      },
      controller.signal,
    ).then(
      (data) => setAi({ key, data }),
      (e: unknown) => {
        if (controller.signal.aborted) return
        setAi(e instanceof NotConfiguredError ? { key, unconfigured: true } : { key, error: e instanceof Error ? e.message : String(e) })
      },
    )
  }

  useEffect(() => {
    if (!mobile || !click) return
    const top = click.anchor.getBoundingClientRect().top
    // 面板占下面约六成,让被点的词停在上面的四成里
    if (top > window.innerHeight * 0.3) window.scrollBy({ top: top - window.innerHeight * 0.2, behavior: 'smooth' })
  }, [mobile, click])

  // 换词或关闭弹窗时,放弃还在进行的请求
  useEffect(() => () => askController.current?.abort(), [key])

  const body = click && word && (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.5 }}>
        <Typography component="h2" sx={{ fontFamily: READING_FONT, fontSize: '2.4rem', lineHeight: 1.3 }}>
          {word.surface}
        </Typography>
        <Chip label={POS_LABEL[word.head.pos]} size="small" sx={{ alignSelf: 'center' }} />
      </Box>
      <Typography sx={{ color: 'primary.main' }}>{[click.reading, click.romaji].filter(Boolean).join(' · ')}</Typography>

      {inflection ? (
        <InflectionChain inflection={inflection} />
      ) : (
        word.head.base !== word.surface && (
          <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
            原形 <Box component="span" sx={{ fontFamily: READING_FONT, color: 'text.primary' }}>{word.head.base}</Box>
          </Typography>
        )
      )}

      <Box sx={{ mt: 3 }}>
        {!aiCurrent && (
          <Button variant="outlined" startIcon={<AutoAwesomeOutlined />} disabled={!dictCurrent} onClick={askAi}>
            问 AI
          </Button>
        )}
        {aiCurrent?.loading && (
          <>
            <Skeleton variant="text" width="40%" height={32} />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="70%" />
          </>
        )}
        {aiCurrent?.unconfigured && (
          <Box sx={{ p: 2, borderRadius: '14px', bgcolor: (t) => tint(t, 0.08) }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              配置 AI 后,这里会显示结合这一句的释义和语法说明。
            </Typography>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                onClose()
                onOpenLlm()
              }}
            >
              AI 设置
            </Button>
          </Box>
        )}
        {aiCurrent?.error && <Typography color="error">{aiCurrent.error}</Typography>}
        {aiCurrent?.data && (
          <FadeIn duration={0.4}>
            <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
              {aiCurrent.data.meaning}
            </Typography>
            <Typography sx={{ mt: 0.75, color: 'text.secondary', lineHeight: 1.75 }}>{aiCurrent.data.explanation}</Typography>
            {aiCurrent.data.grammar && (
              <Typography variant="body2" sx={{ mt: 1.5, p: 1.5, borderRadius: '10px', bgcolor: 'action.hover', lineHeight: 1.7 }}>
                {aiCurrent.data.grammar}
              </Typography>
            )}
          </FadeIn>
        )}
      </Box>

      {dictCurrent && dictCurrent.senses.length > 0 && (
        <DictionarySection senses={dictCurrent.senses} chosen={aiCurrent?.data?.sense || undefined} />
      )}
    </Box>
  )

  // 手机上用底部面板:浮在词下面的卡片会盖住被点的那一句,内容变长时也容易超出屏幕
  if (mobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={!!click}
        onClose={onClose}
        onOpen={() => undefined}
        disableSwipeToOpen
        slotProps={{
          paper: {
            sx: { maxHeight: '62dvh', borderRadius: '20px 20px 0 0', px: 3, pt: 1.5, pb: 'calc(24px + env(safe-area-inset-bottom))' },
          },
        }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mb: 2, flexShrink: 0 }} />
        {body}
      </SwipeableDrawer>
    )
  }

  return (
    <Popover
      open={!!click}
      anchorEl={click?.anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{
        paper: { sx: { mt: 1, p: 3, width: 'min(440px, calc(100vw - 32px))', maxHeight: 'min(78vh, 620px)', overflowY: 'auto', borderRadius: '20px', bgcolor: 'background.paper', boxShadow: '0 24px 64px -20px rgba(20, 40, 33, 0.45)' } },
      }}
    >
      {body}
    </Popover>
  )
}
