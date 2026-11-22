import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 160 // 到边缘后继续滑多少像素算「翻章」
const ARM_MS = 600 // 到边缘之后要停留这么久才开始计数,免得惯性滚动一冲到边缘就直接翻章
const IDLE_MS = 450 // 停止滑动这么久,进度回落

export type Edge = 'top' | 'bottom'

const atEdge = (edge: Edge) =>
  edge === 'bottom' ? window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2 : window.scrollY <= 2

/**
 * 滑到页面边缘后继续朝外滑(底部:滚轮向下或手指上拉;顶部:滚轮向上或手指下拉),
 * 累计到阈值就触发 onTrigger。返回 0 到 1 的进度,界面用它画「再滑一点就翻章」的提示。
 */
export function useOverscroll(edge: Edge, enabled: boolean, onTrigger: () => void): number {
  const [progress, setProgress] = useState(0)
  const trigger = useRef(onTrigger)
  useEffect(() => {
    trigger.current = onTrigger
  })

  useEffect(() => {
    if (!enabled) return
    // 朝外为正:底部是向下,顶部是向上
    const sign = edge === 'bottom' ? 1 : -1
    let amount = 0
    let edgeSince: number | undefined
    let touchStart: number | undefined
    let idle: ReturnType<typeof setTimeout> | undefined
    let fired = false

    const set = (next: number) => {
      amount = Math.max(0, Math.min(next, THRESHOLD))
      setProgress(amount / THRESHOLD)
      clearTimeout(idle)
      if (amount > 0 && amount < THRESHOLD) idle = setTimeout(() => set(0), IDLE_MS)
      if (amount >= THRESHOLD && !fired) {
        fired = true
        trigger.current()
      }
    }
    const armed = () => {
      if (!atEdge(edge)) {
        edgeSince = undefined
        return false
      }
      edgeSince ??= performance.now()
      return performance.now() - edgeSince > ARM_MS
    }

    const onWheel = (e: WheelEvent) => {
      if (fired) return
      if (e.deltaY * sign > 0 && armed()) set(amount + Math.abs(e.deltaY))
      else if (e.deltaY * sign < 0) set(0)
    }
    const onTouchStart = (e: TouchEvent) => {
      touchStart = armed() ? e.touches[0].clientY : undefined
    }
    const onTouchMove = (e: TouchEvent) => {
      if (fired || touchStart === undefined) return
      set((touchStart - e.touches[0].clientY) * sign)
    }
    const onTouchEnd = () => {
      touchStart = undefined
      if (!fired) set(0)
    }
    const onScroll = () => {
      if (!atEdge(edge)) edgeSince = undefined
      else edgeSince ??= performance.now()
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('scroll', onScroll)
      clearTimeout(idle)
      setProgress(0)
    }
  }, [edge, enabled])

  return progress
}
