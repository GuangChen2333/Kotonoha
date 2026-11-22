import { Box, Dialog, List, ListItemButton, ListItemText, Slide, Typography } from '@mui/material'
import { forwardRef, useEffect, useRef } from 'react'
import type { TransitionProps } from '@mui/material/transitions'
import type { Chapter } from './book/load'
import Header from './Header'
import { READING_FONT, ZH_SERIF } from './theme'

interface Props {
  open: boolean
  bookTitle: string
  author: string
  chapters: Chapter[]
  current: number | undefined
  onSelect: (index: number) => void
  onClose: () => void
}

// 从右侧滑入,像「进入下一页」
const SlideIn = forwardRef(function SlideIn(props: TransitionProps & { children: React.ReactElement }, ref: React.Ref<unknown>) {
  return <Slide direction="left" ref={ref} {...props} />
})

function ChapterList({ author, chapters, current, onSelect }: Pick<Props, 'author' | 'chapters' | 'current' | 'onSelect'>) {
  const currentRef = useRef<HTMLDivElement>(null)
  // 进入时把正在读的那一章滚到中间(滑入动画结束前位置已经定好,不会看到列表跳动)
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <Box sx={{ maxWidth: 680, width: '100%', mx: 'auto', px: { xs: 1, sm: 2 }, pt: 3, pb: 'calc(48px + env(safe-area-inset-bottom))' }}>
      {author && (
        <Typography variant="body2" sx={{ px: 2, mb: 1, color: 'text.secondary' }}>
          {author}
        </Typography>
      )}
      <List disablePadding>
        {chapters.map((c, i) => {
          const selected = c.index === current
          return (
            <ListItemButton
              key={c.index}
              ref={selected ? currentRef : undefined}
              selected={selected}
              onClick={() => onSelect(c.index)}
              sx={{ minHeight: 56, borderRadius: '14px', mb: 0.25, gap: 2 }}
            >
              <Typography sx={{ width: '2ch', minWidth: '2ch', textAlign: 'right', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</Typography>
              <ListItemText
                primary={c.title}
                secondary={selected ? '正在读' : undefined}
                slotProps={{ primary: { sx: { fontFamily: READING_FONT, fontWeight: selected ? 700 : 500, color: selected ? 'primary.main' : 'text.primary' } } }}
              />
            </ListItemButton>
          )
        })}
      </List>
    </Box>
  )
}

/**
 * 目录页:盖在阅读页上面的整页对话框,从右侧滑入。阅读页本身保持原样(滚动位置、已分词的句子都不动),
 * 所以返回时不需要恢复任何东西,也不会重新渲染。
 */
export default function ChaptersPage({ open, bookTitle, onClose, ...list }: Props) {
  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      slots={{ transition: SlideIn }}
      slotProps={{ paper: { sx: { borderRadius: 0, bgcolor: 'background.default' } } }}
    >
      <Header onBack={onClose} title="目录" titleFont={ZH_SERIF} subtitle={bookTitle} />
      <ChapterList {...list} />
    </Dialog>
  )
}
