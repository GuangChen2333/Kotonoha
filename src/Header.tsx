import ArrowBack from '@mui/icons-material/ArrowBack'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { Box, ButtonBase, IconButton, LinearProgress, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { FadeIn } from './motion'
import { READING_FONT } from './theme'

interface Props {
  /** 有返回目标时左边显示返回图标;没有时显示应用名 */
  onBack?: () => void
  title?: string
  /** 标题的字体。书名是日文,默认用日文明朝体;中文标题(如「目录」)要传中文字体 */
  titleFont?: string
  /** 标题下的小字。给了 onSubtitle 就可以点击 */
  subtitle?: string
  onSubtitle?: () => void
  /** 右侧的操作 */
  actions?: ReactNode
  /** 分词器词典还在准备时显示进度条;undefined 表示不显示 */
  loading?: { fraction?: number }
}

export default function Header({ onBack, title, titleFont = READING_FONT, subtitle, onSubtitle, actions, loading }: Props) {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: (t) => t.zIndex.appBar,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        // 刘海、状态栏在内容之上时,把它们让出来
        pt: 'env(safe-area-inset-top)',
        pl: 'max(env(safe-area-inset-left), 8px)',
        pr: 'max(env(safe-area-inset-right), 8px)',
        minHeight: 'calc(60px + env(safe-area-inset-top))',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {onBack ? (
        <IconButton aria-label="返回" onClick={onBack} sx={{ color: 'text.primary' }}>
          <ArrowBack />
        </IconButton>
      ) : (
        <Typography component="h1" sx={{ pl: 1.5, fontFamily: READING_FONT, fontSize: '1.3rem', fontWeight: 600, letterSpacing: '0.08em', color: 'primary.main' }}>
          言の葉
        </Typography>
      )}

      {/* 标题和章节名换了就淡入新的,而不是直接换字 */}
      <FadeIn key={`${title}|${subtitle}`} duration={0.3} sx={{ flex: 1, minWidth: 0 }}>
        {title && (
          <Typography noWrap sx={{ fontFamily: titleFont, fontWeight: 600, lineHeight: 1.35 }}>
            {title}
          </Typography>
        )}
        {subtitle &&
          (onSubtitle ? (
            <ButtonBase
              onClick={onSubtitle}
              aria-label={`${subtitle},选择章节`}
              sx={{ display: 'flex', maxWidth: '100%', justifyContent: 'flex-start', gap: 0.25, py: 0.25, borderRadius: 1, color: 'text.secondary' }}
            >
              <Typography noWrap variant="body2" sx={{ minWidth: 0 }}>
                {subtitle}
              </Typography>
              <ChevronRight fontSize="small" />
            </ButtonBase>
          ) : (
            <Typography noWrap variant="body2" sx={{ color: 'text.secondary' }}>
              {subtitle}
            </Typography>
          ))}
      </FadeIn>

      {actions}

      {loading && (
        <LinearProgress
          variant={loading.fraction === undefined ? 'indeterminate' : 'determinate'}
          value={(loading.fraction ?? 0) * 100}
          sx={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2 }}
        />
      )}
    </Box>
  )
}
