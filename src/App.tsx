import InfoOutlined from '@mui/icons-material/InfoOutlined'
import { Alert, Box, Button, CssBaseline, Typography, useMediaQuery } from '@mui/material'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import type { ChapterItem } from './book/extract'
import { loadBook, type LoadedBook } from './book/load'
import ChaptersPage from './ChaptersPage'
import ChatDock from './ChatDock'
import Header from './Header'
import { FadeIn } from './motion'
import Illustration from './Illustration'
import ChapterEdge from './ChapterEdge'
import { useOverscroll } from './useOverscroll'
import LlmSettingsDialog from './LlmSettingsDialog'
import { addBook, getBookFile, listBooks, markOpened, removeBook, saveProgress, type BookMeta } from './library'
import Shelf from './Shelf'
import { isLlmConfigured, loadLlmConfig } from './llm/config'
import { loadAnalyzer, type Analyzer } from './nlp/tokenizer'
import SentenceRow from './SentenceRow'
import SettingsMenu from './SettingsMenu'
import { useSettings } from './settings'
import { READING_FONT, tint } from './theme'
import WordPopover, { type WordClick } from './WordPopover'

const NO_ITEMS: ChapterItem[] = []

// 换章:旧内容先淡出,新内容读出来、画好之后再淡入
const FADE_OUT_MS = 150
const FADE_IN_MS = 400
/** 每一项对应的句子序号;插图是 -1 */
function sentenceIndexes(items: ChapterItem[]): number[] {
  let count = 0
  return items.map((item) => (item.type === 'sentence' ? count++ : -1))
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export default function App() {
  const [settings, setSettings] = useSettings()
  const [analyzer, setAnalyzer] = useState<Analyzer>()
  const [dictProgress, setDictProgress] = useState<number>()
  const [book, setBook] = useState<LoadedBook>()
  const [meta, setMeta] = useState<BookMeta>()
  // undefined 表示还在读取,书架先显示骨架而不是空状态
  const [shelf, setShelf] = useState<BookMeta[]>()
  const [chapter, setChapter] = useState<number>()
  // 页面上显示的章节内容。换章时旧内容保留到新内容读出来,再一次性替换(同时换标题),中间没有空白或错位
  const [content, setContent] = useState<{ chapter: number; items: ChapterItem[]; land: 'start' | 'end' }>()
  const [activeIndex, setActiveIndex] = useState<number>()
  const [word, setWord] = useState<WordClick | null>(null)
  const [chaptersOpen, setChaptersOpen] = useState(false)
  // 点了翻译按钮的句子(按句子序号)。放在这里而不是行里:虚拟列表滚出屏幕会卸载行
  const [translated, setTranslated] = useState<ReadonlySet<number>>(new Set())
  // 阅读区是否可见。换章时先置为 false 让旧内容淡出,新内容就绪后再置回 true
  const [visible, setVisible] = useState(true)
  const fadedOut = useRef<Promise<void>>(Promise.resolve())
  // 往上翻到上一章时落在它的末尾,其余情况落在开头
  const landAt = useRef<'start' | 'end'>('start')
  const revealPending = useRef(false)
  const reveal = useCallback(() => {
    if (!revealPending.current) return
    revealPending.current = false
    requestAnimationFrame(() => setVisible(true))
  }, [])
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [llmOpen, setLlmOpen] = useState(false)
  const [llmRevision, setLlmRevision] = useState(0)
  const [error, setError] = useState<string>()

  useEffect(() => {
    loadAnalyzer(setDictProgress).then(setAnalyzer, (e) => setError(`分词器加载失败:${e}`))
  }, [])

  const refreshShelf = useCallback(() => void listBooks().then(setShelf), [])
  useEffect(refreshShelf, [refreshShelf])

  useEffect(() => {
    if (!book || !meta || chapter === undefined) return
    const position = book.chapters.findIndex((c) => c.index === chapter)
    void saveProgress(meta.id, { chapter, sentence: activeIndex ?? 0, fraction: position / book.chapters.length })
  }, [book, meta, chapter, activeIndex])

  useEffect(() => {
    if (!book || chapter === undefined) return
    let cancelled = false
    book.items(chapter).then(
      async (loaded) => {
        await fadedOut.current
        if (cancelled) return
        setContent({ chapter, items: loaded, land: landAt.current })
        // 此时新内容刚挂载、还是透明的:等虚拟列表把第一批句子渲染出来(分词、排版都在这一步)再淡入,
        // 这样同步计算造成的卡顿发生在看不见的时候,淡入本身是顺滑的。没有句子可渲染(空章节)或迟迟没有回报时,不能一直透明
        revealPending.current = true
        setTimeout(reveal, loaded.length ? 1500 : 0)
      },
      (e) => !cancelled && setError(`章节读取失败:${e}`),
    )
    return () => {
      cancelled = true
    }
  }, [book, chapter, reveal])

  // 新章节内容换上(此时还是透明的)的同时回到顶部;落在末尾时由虚拟列表定位到最后一句
  useLayoutEffect(() => {
    if (content?.land !== 'end') window.scrollTo(0, 0)
  }, [content])

  const selectChapter = (index: number | undefined, land: 'start' | 'end' = 'start') => {
    setChaptersOpen(false)
    if (index === chapter) return // 还是这一章,什么都不用换
    landAt.current = land
    setActiveIndex(undefined)
    setTranslated(new Set())
    setChapter(index)
    if (index === undefined) return setVisible(true)
    // 已有内容在显示时,先让它淡出;还没有内容(刚打开书)就不用等
    fadedOut.current = content ? wait(FADE_OUT_MS) : Promise.resolve()
    setVisible(false)
  }

  const openBook = async (file: File, existing?: BookMeta) => {
    setError(undefined)
    try {
      const loaded = await loadBook(file)
      const saved = existing ?? (await addBook(file, loaded, await loaded.cover()))
      await markOpened(saved.id)
      setBook(loaded)
      setMeta(saved)
      if (saved.progress && loaded.chapters.some((c) => c.index === saved.progress?.chapter)) {
        selectChapter(saved.progress.chapter)
        return
      }
      // 默认选中第一个有正文的章节,跳过封面等只有图片的页面
      let first = loaded.chapters[0]?.index
      for (const c of loaded.chapters) {
        if ((await loaded.items(c.index)).some((item) => item.type === 'sentence')) {
          first = c.index
          break
        }
      }
      selectChapter(first)
    } catch (e) {
      setError(`无法打开 EPUB:${e}`)
    }
  }

  const openFromShelf = async (saved: BookMeta) => {
    const file = await getBookFile(saved)
    if (file) await openBook(file, saved)
    else setError('书架里找不到这本书的文件')
  }

  const closeBook = () => {
    setBook(undefined)
    setMeta(undefined)
    setChaptersOpen(false)
    setContent(undefined)
    setChapter(undefined)
    setActiveIndex(undefined)
    setTranslated(new Set())
    setVisible(true)
    setWord(null)
    refreshShelf()
  }

  const items = content?.items ?? NO_ITEMS
  const sentences = useMemo(() => items.flatMap((item) => (item.type === 'sentence' ? [item.sentence] : [])), [items])
  const sentenceTexts = useMemo(() => sentences.map((s) => s.text), [sentences])
  // 每一项对应的句子序号;插图不占序号,翻译的上下文也只取相邻的句子
  const sentenceAt = useMemo(() => sentenceIndexes(items), [items])
  const openLlm = useCallback(() => setLlmOpen(true), [])
  const onWord = useCallback((click: WordClick) => setWord(click), [])
  const onSelect = useCallback((i: number) => setActiveIndex(i), [])
  const onToggleTranslate = useCallback(
    (i: number) =>
      setTranslated((prev) => {
        const next = new Set(prev)
        if (!next.delete(i)) next.add(i)
        return next
      }),
    [],
  )
  const chapterTitle = book?.chapters.find((c) => c.index === content?.chapter)?.title
  const position = book?.chapters.findIndex((c) => c.index === content?.chapter) ?? -1
  const nextChapter = position >= 0 ? book?.chapters[position + 1] : undefined
  // 章末继续往下滑翻到下一章。正在换章(淡出淡入)、目录页打开时不响应
  const prevChapter = position > 0 ? book?.chapters[position - 1] : undefined
  const goNext = () => nextChapter && selectChapter(nextChapter.index)
  const goPrev = () => prevChapter && selectChapter(prevChapter.index, 'end')
  const idle = visible && !chaptersOpen && !word
  const overscrollDown = useOverscroll('bottom', !!nextChapter && idle, goNext)
  const overscrollUp = useOverscroll('top', !!prevChapter && idle, goPrev)
  // llmRevision 在 AI 设置保存后变化,借它重新读取配置
  const llmConfigured = llmRevision >= 0 && isLlmConfigured(loadLlmConfig())

  // 虚拟列表:只渲染屏幕附近的句子。高度由它测量并在滚动时保持位置,没渲染的句子不会因为后来撑开而把内容推走
  const renderItem = (n: number, item: ChapterItem) => {
    if (item.type === 'image') {
      return (
        <Box sx={{ py: 3 }}>
          <Illustration path={item.src} aspect={item.aspect} load={book!.image} />
        </Box>
      )
    }
    const i = sentenceAt[n]
    return (
      <Box sx={{ py: 0.5 }}>
        <SentenceRow
          index={i}
          sentence={item.sentence.text}
          ruby={item.sentence.ruby}
          prev={sentences[i - 1]?.text}
          next={sentences[i + 1]?.text}
          revision={llmRevision}
          analyzer={analyzer!}
          settings={settings}
          active={activeIndex === i}
          translateRequested={translated.has(i)}
          onSelect={onSelect}
          onToggleTranslate={onToggleTranslate}
          onOpenLlm={openLlm}
          onWord={onWord}
        />
      </Box>
    )
  }

  return (
    // 整页滚动而不是内部容器滚动:手机浏览器的地址栏收起、下拉手势都依赖页面自身滚动
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <CssBaseline />
      <Header
        onBack={book ? closeBook : undefined}
        title={book?.title}
        subtitle={book ? chapterTitle : undefined}
        onSubtitle={book && chapterTitle ? () => setChaptersOpen(true) : undefined}
        actions={<SettingsMenu settings={settings} onChange={setSettings} onOpenLlm={openLlm} />}
        loading={!analyzer && !error ? { fraction: dictProgress } : undefined}
      />
      {error && <Alert severity="error" sx={{ mx: { xs: 1.5, sm: 3 }, mt: 1.5 }}>{error}</Alert>}

      <Box component="main">
        {/* 书架与阅读页之间淡入切换,不是直接替换 */}
        <FadeIn key={book ? 'reader' : 'shelf'} duration={0.3}>
          {!book ? (
            <Shelf
              books={shelf}
              notice={!analyzer && !error ? '正在准备分词词典,首次启动需要几秒钟' : undefined}
              onOpen={(b) => void openFromShelf(b)}
              onRemove={(b) => void removeBook(b.id).then(refreshShelf)}
              onFile={(f) => void openBook(f)}
            />
          ) : (
            <Box
              sx={{
                maxWidth: 780,
                mx: 'auto',
                px: { xs: 1, sm: 2 },
                pt: 5,
                pb: 'calc(96px + env(safe-area-inset-bottom))',
                opacity: visible ? 1 : 0,
                transition: reduceMotion ? 'none' : `opacity ${visible ? FADE_IN_MS : FADE_OUT_MS}ms ease`,
              }}
            >
              {!llmConfigured && (
                <Alert
                  severity="info"
                  icon={<InfoOutlined />}
                  sx={{ mx: 1, mb: 3, color: 'text.primary', bgcolor: (t) => tint(t, 0.1), '& .MuiAlert-icon': { color: 'primary.main' } }}
                  action={
                    <Button color="inherit" size="small" onClick={openLlm}>
                      AI 设置
                    </Button>
                  }
                >
                  还没有配置 AI。译文和点词后的释义需要它;原形、变形和词典义项不受影响。
                </Alert>
              )}
              {analyzer && content && <ChapterEdge direction="prev" title={prevChapter?.title} progress={overscrollUp} onClick={goPrev} />}
              {chapterTitle && (
                <Typography component="h2" sx={{ fontFamily: READING_FONT, fontSize: { xs: '1.7rem', sm: '2.2rem' }, fontWeight: 600, lineHeight: 1.4, px: { xs: 2, sm: 3 }, mb: 3 }}>
                  {chapterTitle}
                </Typography>
              )}
              {analyzer && content && (
                <Virtuoso
                  key={content.chapter}
                  useWindowScroll
                  initialTopMostItemIndex={content.land === 'end' && items.length > 0 ? { index: items.length - 1, align: 'end' } : undefined}
                  data={items}
                  increaseViewportBy={{ top: 800, bottom: 800 }}
                  computeItemKey={(n) => `${content.chapter}-${n}`}
                  itemContent={renderItem}
                  itemsRendered={(rendered) => rendered.length > 0 && reveal()}
                />
              )}
              {analyzer && content && <ChapterEdge direction="next" title={nextChapter?.title} progress={overscrollDown} onClick={goNext} />}
            </Box>
          )}
        </FadeIn>
      </Box>

      {book && (
        <ChaptersPage
          open={chaptersOpen}
          bookTitle={book.title}
          author={book.author}
          chapters={book.chapters}
          current={chapter}
          onSelect={selectChapter}
          onClose={() => setChaptersOpen(false)}
        />
      )}
      {book && meta && <ChatDock bookId={meta.id} sentences={sentenceTexts} activeIndex={activeIndex} onOpenLlm={openLlm} />}
      <WordPopover click={word} revision={llmRevision} onClose={() => setWord(null)} onOpenLlm={openLlm} />
      <LlmSettingsDialog open={llmOpen} onClose={() => setLlmOpen(false)} onSaved={() => setLlmRevision((r) => r + 1)} />
    </Box>
  )
}
