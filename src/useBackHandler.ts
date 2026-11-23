import { isTauri } from '@tauri-apps/api/core'
import { exit, onBackButtonPress } from '@tauri-apps/api/app'
import { useEffect, useRef } from 'react'

// 界面层级(书、目录、词义面板……)是 React 状态而不是历史记录,Android 的返回键要我们自己按层级处理
const stack: Array<{ current: () => void }> = []
let listening = false

// 注册监听后默认行为(退出应用)由我们接管:没有层级可退时自己退出。第一次有层级打开时才注册,书架上保持原样
function listen() {
  if (listening || !isTauri()) return
  listening = true
  onBackButtonPress(() => {
    const top = stack.at(-1)
    if (top) top.current()
    else void exit(0)
  }).catch(() => (listening = false))
}

/** active 期间,系统返回键(Android)先交给它处理;多层同时打开时,最后打开的先处理。 */
export function useBackHandler(active: boolean, onBack: () => void) {
  const handler = useRef(onBack)
  useEffect(() => {
    handler.current = onBack
  })
  useEffect(() => {
    if (!active) return
    listen()
    stack.push(handler)
    return () => {
      stack.splice(stack.indexOf(handler), 1)
    }
  }, [active])
}
