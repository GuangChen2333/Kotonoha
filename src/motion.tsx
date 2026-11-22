import { Box, type BoxProps } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { useState } from 'react'

const fadeInFrames = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

/**
 * 内容晚一点才到(换章、分词、译文)时淡入出现,而不是直接跳出来。宁可慢一点,也不要闪。
 * 只在这块内容第一次出现时播放一次,播完就去掉动画:否则它所在的区域被隐藏(如进目录页)
 * 再显示时,浏览器会重新播放动画,内容先消失再淡入,反而成了闪烁。
 * 系统要求减少动效时不做动画。
 */
export function FadeIn({ duration = 0.35, delay = 0, sx, ...props }: BoxProps & { duration?: number; delay?: number }) {
  const [playing, setPlaying] = useState(true)
  return (
    <Box
      {...props}
      sx={[
        playing && {
          animation: `${fadeInFrames} ${duration}s ease-out ${delay}s both`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      // 子元素自己的动画结束时事件也会冒泡上来,只认自己的
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setPlaying(false)
      }}
    />
  )
}
