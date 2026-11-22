import { useEffect, useState } from 'react'

/**
 * 当前真正可见的区域(visualViewport)。手机上软键盘弹出时它会变矮,
 * 而 position: fixed 的元素仍按布局视口排版,会被键盘盖住,所以需要按它重新定位。
 */
export function useVisualViewport(enabled: boolean) {
  const [box, setBox] = useState({ top: 0, height: window.innerHeight })

  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) return
    const update = () => setBox({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])

  return box
}
