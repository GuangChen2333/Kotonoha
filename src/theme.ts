import { createTheme, type Theme } from '@mui/material/styles'

/** 日文正文用明朝体,像一本书;系统自带,不增加体积。 */
export const READING_FONT = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Noto Serif CJK JP",serif'
/**
 * 中文标题用的宋体。不能借日文明朝体的栈:「书」「录」这类简体字日文明朝体里没有,
 * 会回退到宋体,而同一个标题里的「架」「目」又是明朝体自己的字形,两款字体基线和字面大小不同,看起来一高一低。
 * 整个标题统一用中文字体,就不会混用。
 */
export const ZH_SERIF = '"Songti SC","Noto Serif SC","Source Han Serif SC","STSong","SimSun",serif'
const UI_FONT = '"Hiragino Sans","PingFang SC","Yu Gothic UI","Noto Sans JP","Noto Sans CJK SC",system-ui,sans-serif'

/** 主色的半透明版本,随亮暗模式变化。 */
export const tint = (theme: Theme, alpha: number) => `rgba(${theme.vars?.palette.primary.mainChannel ?? '45 108 95'} / ${alpha})`

// 系统要求减少动效时,MUI 自带的过渡(弹窗、菜单、折叠)一并关掉。读取一次,系统设置改了需要刷新
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const theme = createTheme({
  ...(reduceMotion && { transitions: { create: () => 'none' } }),
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#2D6C5F' },
        background: { default: '#EDF1EB', paper: '#F8FAF5' },
        text: { primary: '#1D2925', secondary: '#5A6A63' },
        divider: 'rgba(29, 41, 37, 0.12)',
      },
    },
    dark: {
      palette: {
        primary: { main: '#78C2AF' },
        background: { default: '#121816', paper: '#1A2220' },
        text: { primary: '#E4ECE7', secondary: '#9AA9A2' },
        divider: 'rgba(228, 236, 231, 0.14)',
      },
    },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: UI_FONT,
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    // 到顶、到底后不让整个页面(连同吸顶的顶栏)被拉出去再弹回来:macOS 的 WebView 默认有橡皮筋回弹。
    // 章末、章首继续滑动翻章由我们自己的进度卡片反馈,不需要系统的回弹
    MuiCssBaseline: { styleOverrides: { 'html, body': { overscrollBehavior: 'none' } } },
    // 暗色模式下 MUI 会给 Paper 叠一层提亮的渐变,和墨绿黑底色不搭
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 12 } } },
    // 触屏上的点按目标至少 44px;鼠标下保持紧凑
    MuiIconButton: { styleOverrides: { root: { '@media (pointer: coarse)': { minWidth: 44, minHeight: 44 } } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 24 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
  },
})
