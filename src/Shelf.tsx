import AddRounded from '@mui/icons-material/AddRounded'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { Box, ButtonBase, IconButton, LinearProgress, Skeleton, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { getCover, type BookMeta } from './library'
import { FadeIn } from './motion'
import { READING_FONT, tint, ZH_SERIF } from './theme'

interface Props {
  /** 还在读取时为 undefined,显示骨架而不是空书架 */
  books: BookMeta[] | undefined
  /** 词典还在准备时的提示;undefined 表示不显示 */
  notice?: string
  onOpen: (book: BookMeta) => void
  onRemove: (book: BookMeta) => void
  onFile: (file: File) => void
}

const COVER_RATIO = '2 / 3'

function Cover({ book }: { book: BookMeta }) {
  const [url, setUrl] = useState<string>()
  const [shown, setShown] = useState(false)
  // 封面数据损坏(例如 EPUB 里引用的图片缺失)时退回到书名
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    if (!book.hasCover) return
    let objectUrl: string | undefined
    let cancelled = false
    void getCover(book.id).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [book.id, book.hasCover])

  return (
    <Box
      sx={{
        aspectRatio: COVER_RATIO,
        borderRadius: '8px',
        overflow: 'hidden',
        bgcolor: (t) => tint(t, 0.12),
        boxShadow: '0 1px 2px rgba(0,0,0,.18), 0 6px 16px -6px rgba(0,0,0,.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 1.5,
      }}
    >
      {url && !broken ? (
        <Box component="img" src={url} alt="" onLoad={() => setShown(true)} onError={() => setBroken(true)} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: shown ? 1 : 0, transition: 'opacity 0.4s ease' }} />
      ) : (
        <Typography sx={{ fontFamily: READING_FONT, fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.5, color: 'primary.main', textAlign: 'center', wordBreak: 'break-all' }}>
          {book.title}
        </Typography>
      )}
    </Box>
  )
}

function BookTile({ book, onOpen, onRemove }: { book: BookMeta; onOpen: () => void; onRemove: () => void }) {
  const fraction = book.progress?.fraction ?? 0
  return (
    // 删除按钮:有鼠标时悬停才出现;触屏没有悬停,所以一直显示
    <Box sx={{ position: 'relative', '@media (hover: hover)': { '& .remove': { opacity: 0 }, '&:hover .remove, &:focus-within .remove': { opacity: 1 } } }}>
      <ButtonBase onClick={onOpen} sx={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: '8px', '@media (hover: hover)': { '&:hover .cover': { transform: 'translateY(-3px)' } } }}>
        <Box className="cover" sx={{ position: 'relative', transition: 'transform .15s' }}>
          <Cover book={book} />
        </Box>
        <Typography noWrap sx={{ mt: 1.25, fontFamily: READING_FONT, fontWeight: 600 }}>
          {book.title}
        </Typography>
        <Typography noWrap variant="body2" sx={{ color: 'text.secondary', minHeight: '1.43em' }}>
          {book.author}
        </Typography>
        <LinearProgress variant="determinate" value={fraction * 100} sx={{ mt: 0.75, height: 3, borderRadius: 2, opacity: fraction > 0 ? 1 : 0 }} />
      </ButtonBase>
      <IconButton
        className="remove"
        size="small"
        aria-label={`删除《${book.title}》`}
        onClick={onRemove}
        sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' }, transition: 'opacity .15s' }}
      >
        <DeleteOutlined fontSize="small" />
      </IconButton>
    </Box>
  )
}

function AddTile({ onFile }: { onFile: (file: File) => void }) {
  return (
    <ButtonBase
      component="label"
      sx={{
        aspectRatio: COVER_RATIO,
        width: '100%',
        flexDirection: 'column',
        gap: 1,
        borderRadius: '8px',
        border: '1.5px dashed',
        borderColor: 'divider',
        color: 'text.secondary',
        alignSelf: 'start',
        '@media (hover: hover)': { '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: (t) => tint(t, 0.06) } },
      }}
    >
      <AddRounded />
      <Typography variant="body2">添加 EPUB</Typography>
      <input
        type="file"
        accept=".epub,application/epub+zip"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </ButtonBase>
  )
}

function TileSkeleton() {
  return (
    <Box>
      <Skeleton variant="rounded" sx={{ aspectRatio: COVER_RATIO, height: 'auto', borderRadius: '8px' }} />
      <Skeleton variant="text" width="80%" sx={{ mt: 1.25 }} />
      <Skeleton variant="text" width="50%" />
    </Box>
  )
}

const GRID = { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 2.5, sm: 4 } } as const

export default function Shelf({ books, notice, onOpen, onRemove, onFile }: Props) {
  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', px: { xs: 2, sm: 4 }, pt: { xs: 3, sm: 5 }, pb: 10 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 3 }}>
        <Typography component="h2" sx={{ fontFamily: ZH_SERIF, fontSize: '1.6rem', fontWeight: 600 }}>
          书架
        </Typography>
        {notice && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {notice}
          </Typography>
        )}
      </Box>
      {books === undefined ? (
        // 读出之前先放骨架,不能先显示「空书架」的说明再变成书
        <Box sx={GRID}>
          <TileSkeleton />
          <TileSkeleton />
        </Box>
      ) : (
        <FadeIn duration={0.4}>
          <Box sx={GRID}>
            {books.map((b) => (
              <BookTile key={b.id} book={b} onOpen={() => onOpen(b)} onRemove={() => onRemove(b)} />
            ))}
            <AddTile onFile={onFile} />
          </Box>
          {books.length === 0 && (
            <Typography sx={{ mt: 4, color: 'text.secondary', maxWidth: 420, lineHeight: 1.8 }}>
              添加一本日文 EPUB 开始阅读。点一个词,就能看到它的原形、变形和结合上下文的释义。带 DRM 的文件无法读取。
            </Typography>
          )}
        </FadeIn>
      )}
    </Box>
  )
}
