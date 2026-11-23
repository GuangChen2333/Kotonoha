import ChatBubbleOutlined from '@mui/icons-material/ChatBubbleOutlined'
import Close from '@mui/icons-material/Close'
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined'
import SendRounded from '@mui/icons-material/SendRounded'
import StopRounded from '@mui/icons-material/StopRounded'
import { Box, Button, Fab, Grow, IconButton, Paper, Slide, TextField, Tooltip, Typography, Zoom, useMediaQuery } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { loadChat, saveChat } from './library'
import { chatStream, NotConfiguredError, type ChatMessage } from './llm/client'
import { chatContext } from './llm/prompts'
import { READING_FONT, tint, ZH_SERIF } from './theme'
import { useVisualViewport } from './useVisualViewport'
import { useBackHandler } from './useBackHandler'

interface Props {
  /** 书架里这本书的 id;对话按书保存 */
  bookId: string
  /** 当前章节的全部句子,用来取选中句子的前后文 */
  sentences: string[]
  activeIndex: number | undefined
  onOpenLlm: () => void
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user'
  return (
    <Box
      sx={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        px: 1.75,
        py: 1,
        borderRadius: '16px',
        borderBottomRightRadius: mine ? '4px' : '16px',
        borderBottomLeftRadius: mine ? '16px' : '4px',
        bgcolor: mine ? 'primary.main' : 'action.hover',
        color: mine ? 'primary.contrastText' : 'text.primary',
        lineHeight: 1.75,
        wordBreak: 'break-word',
        '& p': { m: 0 },
        '& p + p, & ul, & ol': { mt: 1 },
        '& ul, & ol': { mb: 0, pl: 2.5 },
        '& code': { fontFamily: READING_FONT },
      }}
    >
      {mine ? <Typography sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography> : <Markdown>{message.content}</Markdown>}
    </Box>
  )
}

/** 右下角的悬浮对话:围绕选中的句子及前后各两句向 AI 提问。 */
export default function ChatDock({ bookId, sentences, activeIndex, onOpenLlm }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; unconfigured: boolean }>()
  const controller = useRef<AbortController>(undefined)
  const scroller = useRef<HTMLDivElement>(null)
  // 用户停在底部附近时,新内容才把列表带到底;向上翻看之前的回答时不去抢滚动
  const stickToBottom = useRef(true)
  const mobile = useMediaQuery((t: Theme) => t.breakpoints.down('sm'))
  // 手机上对话占满可见区域,并随软键盘缩放,输入框才不会被键盘盖住
  const viewport = useVisualViewport(mobile && open)
  useBackHandler(open, () => setOpen(false))

  useEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages, error, open])
  useEffect(() => () => controller.current?.abort(), [])

  // 换书时读回这本书的对话;回答写完(不在生成中)后保存。loaded 防止读回之前把空对话写掉旧记录
  const [loaded, setLoaded] = useState<string>()
  useEffect(() => {
    let cancelled = false
    void loadChat(bookId).then((turns) => {
      if (cancelled) return
      setMessages(turns)
      setLoaded(bookId)
    })
    return () => {
      cancelled = true
      setLoaded(undefined)
    }
  }, [bookId])
  useEffect(() => {
    if (loaded === bookId && !busy) void saveChat(bookId, messages)
  }, [bookId, loaded, busy, messages])

  const activeSentence = activeIndex === undefined ? undefined : sentences[activeIndex]

  const send = async () => {
    const question = input.trim()
    if (!question || busy) return
    const history: ChatMessage[] = [...messages, { role: 'user', content: question }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setError(undefined)
    setBusy(true)
    stickToBottom.current = true
    const abort = new AbortController()
    controller.current = abort
    let answer = ''
    try {
      for await (const delta of chatStream(history, chatContext(sentences, activeIndex), abort.signal)) {
        answer += delta
        setMessages([...history, { role: 'assistant', content: answer }])
      }
    } catch (e) {
      if (!abort.signal.aborted) setError({ text: e instanceof Error ? e.message : String(e), unconfigured: e instanceof NotConfiguredError })
    } finally {
      // 对话已被清空(controller 换了)时,不再写回
      if (controller.current === abort) {
        // 出错或被中止时,没有内容的空回答不留在对话里
        setMessages(answer ? [...history, { role: 'assistant', content: answer }] : history)
        setBusy(false)
      }
    }
  }

  const clear = () => {
    controller.current?.abort()
    controller.current = undefined
    setMessages([])
    setError(undefined)
    setBusy(false)
  }

  const Transition = mobile ? Slide : Grow
  const transitionProps = mobile ? { direction: 'up' as const } : { style: { transformOrigin: 'right bottom' } }

  return (
    <>
      {/* 桌面从悬浮按钮的角上长出来,手机从底部滑上来;关闭时反过来 */}
      <Transition in={open} mountOnEnter unmountOnExit {...transitionProps}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            zIndex: (t) => t.zIndex.modal - 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            ...(mobile
              ? { top: viewport.top, left: 0, width: '100%', height: viewport.height, borderRadius: 0, pt: 'env(safe-area-inset-top)' }
              : {
                  right: 24,
                  bottom: 24,
                  width: 400,
                  height: 'min(560px, calc(100dvh - 96px))',
                  borderRadius: '20px',
                  boxShadow: '0 24px 64px -20px rgba(20, 40, 33, 0.5)',
                }),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 2, pr: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography sx={{ flex: 1, fontFamily: ZH_SERIF, fontWeight: 600 }}>问 AI</Typography>
            <Tooltip title="清空对话">
              <span>
                <IconButton size="small" onClick={clear} disabled={messages.length === 0 && !error}>
                  <DeleteSweepOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" aria-label="关闭" onClick={() => setOpen(false)}>
              <Close fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ px: 2, py: 1, bgcolor: (t) => tint(t, 0.08) }}>
            <Typography noWrap variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              {activeSentence ? '当前句' : '还没选句子 · 点一句话,问题会围绕它'}
            </Typography>
            {activeSentence && (
              <Typography noWrap sx={{ fontFamily: READING_FONT, fontSize: '0.95rem' }}>
                {activeSentence}
              </Typography>
            )}
          </Box>

          <Box
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
            }}
            sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}
          >
            {messages.length === 0 && !error && (
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
                可以问词义、语法、语气,或者说话人为什么这么说。回答会参考当前句和它的前后文。
              </Typography>
            )}
            {messages.map((m, i) => (m.content || m.role === 'user' ? <Bubble key={i} message={m} /> : null))}
            {busy && messages.at(-1)?.content === '' && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                思考中…
              </Typography>
            )}
            {error && (
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: (t) => tint(t, 0.08) }}>
                <Typography variant="body2" color={error.unconfigured ? 'text.primary' : 'error'} sx={{ mb: error.unconfigured ? 1 : 0 }}>
                  {error.unconfigured ? '配置 AI 之后才能提问。' : error.text}
                </Typography>
                {error.unconfigured && (
                  <Button size="small" variant="contained" onClick={onOpenLlm}>
                    AI 设置
                  </Button>
                )}
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, p: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom))', borderTop: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              size="small"
              placeholder="问点什么…(Enter 发送)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // 输入法选词时按的 Enter 不是发送
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void send()
                }
              }}
              slotProps={{ input: { sx: { borderRadius: '14px' } } }}
            />
            {busy ? (
              <IconButton color="primary" aria-label="停止" onClick={() => controller.current?.abort()}>
                <StopRounded />
              </IconButton>
            ) : (
              <IconButton color="primary" aria-label="发送" onClick={() => void send()} disabled={!input.trim()}>
                <SendRounded />
              </IconButton>
            )}
          </Box>
        </Paper>
      </Transition>

      <Zoom in={!open} mountOnEnter unmountOnExit>
        <Fab color="primary" aria-label="问 AI" onClick={() => setOpen(true)} sx={{ position: 'fixed', right: { xs: 16, sm: 24 }, bottom: { xs: 'calc(16px + env(safe-area-inset-bottom))', sm: 24 } }}>
          <ChatBubbleOutlined />
        </Fab>
      </Zoom>
    </>
  )
}
