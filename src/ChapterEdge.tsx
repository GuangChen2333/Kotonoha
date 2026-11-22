import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import { Box, ButtonBase, Typography } from '@mui/material'
import { READING_FONT } from './theme'

interface Props {
  /** next:章末的「下一章」;prev:章首的「上一章」 */
  direction: 'next' | 'prev'
  /** 目标章节的标题;没有(第一章之前、最后一章之后)时为 undefined */
  title: string | undefined
  /** 0 到 1,继续滑动的进度 */
  progress: number
  onClick: () => void
}

/** 章首、章末的提示:继续朝外滑,进度条填满就翻章;也可以直接点。 */
export default function ChapterEdge({ direction, title, progress, onClick }: Props) {
  const next = direction === 'next'
  if (title === undefined) {
    // 第一章之前什么都不显示;最后一章之后显示「完」
    return next ? (
      <Typography sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontFamily: READING_FONT, letterSpacing: '0.2em' }}>── 完 ──</Typography>
    ) : null
  }
  const Arrow = next ? KeyboardArrowDown : KeyboardArrowUp
  return (
    <ButtonBase
      onClick={onClick}
      sx={{ display: 'block', width: '100%', my: next ? 6 : 3, px: 3, py: next ? 3 : 2, borderRadius: '20px', textAlign: 'center', position: 'relative', overflow: 'hidden', border: 1, borderColor: 'divider' }}
    >
      {/* 进度铺满整张卡片的底色,随滑动平滑填充;往上翻时从右向左填,和手势方向一致 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: (t) => `rgba(${t.vars?.palette.primary.mainChannel ?? '45 108 95'} / 0.18)`,
          transformOrigin: next ? 'left' : 'right',
          transform: `scaleX(${progress})`,
          transition: progress === 0 ? 'transform 0.4s ease' : 'transform 0.12s linear',
        }}
      />
      <Box sx={{ position: 'relative' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {next ? '下一章' : '上一章'}
        </Typography>
        <Typography sx={{ fontFamily: READING_FONT, fontSize: next ? '1.25rem' : '1.05rem', fontWeight: 600, lineHeight: 1.5 }}>{title}</Typography>
        <Box sx={{ color: 'text.secondary', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Arrow fontSize="small" />
          <Typography variant="caption">{next ? '继续往下滑' : '继续往上滑'}</Typography>
        </Box>
      </Box>
    </ButtonBase>
  )
}
