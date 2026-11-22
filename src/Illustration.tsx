import { Box, Dialog } from '@mui/material'
import { useEffect, useState } from 'react'
import { ORNAMENT_ASPECT } from './book/load'
import { tint } from './theme'

interface Props {
  path: string
  /** 宽高比,已知时先按它留出位置,图片读出来再淡入,正文不会被推开 */
  aspect?: number
  load: (path: string) => Promise<Blob>
}

const MAX_HEIGHT = '80dvh'

/** 书中的插图。点击放大,再点关闭;图片读不出来时不占位。 */
export default function Illustration({ path, aspect, load }: Props) {
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  // 标签上没有尺寸时,图片解码后才知道;此时才判断是不是装饰条
  const [measured, setMeasured] = useState<number>()
  const ratio = aspect ?? measured

  useEffect(() => {
    let objectUrl: string | undefined
    let cancelled = false
    load(path).then(
      (blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      },
      () => setFailed(true),
    )
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path, load])

  if (failed || (ratio !== undefined && ratio < ORNAMENT_ASPECT)) return null
  return (
    <>
      {/* 外框先占好位置(有比例时),图片读出来后淡入 */}
      <Box
        sx={{
          mx: 'auto',
          width: aspect ? `min(100%, calc(${MAX_HEIGHT} * ${aspect}))` : 'fit-content',
          maxWidth: '100%',
          aspectRatio: aspect ? `${aspect}` : undefined,
          minHeight: aspect ? undefined : 160,
          borderRadius: '8px',
          overflow: 'hidden',
          bgcolor: (t) => tint(t, 0.08),
        }}
      >
        {url && (
          <Box
            component="img"
            src={url}
            alt=""
            onClick={() => setOpen(true)}
            onError={() => setFailed(true)}
            onLoad={(e) => {
              setLoaded(true)
              setMeasured(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
            }}
            sx={{
              display: 'block',
              width: '100%',
              height: aspect ? '100%' : 'auto',
              maxHeight: MAX_HEIGHT,
              cursor: 'zoom-in',
              objectFit: 'contain',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}
          />
        )}
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth={false} slotProps={{ paper: { sx: { bgcolor: 'transparent', boxShadow: 'none', m: 1 } } }}>
        <Box component="img" src={url} alt="" onClick={() => setOpen(false)} sx={{ display: 'block', maxWidth: '96vw', maxHeight: '94dvh', objectFit: 'contain', cursor: 'zoom-out' }} />
      </Dialog>
    </>
  )
}
