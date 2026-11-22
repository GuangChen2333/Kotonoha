import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import { Box, Button, Divider, FormControlLabel, IconButton, Popover, Switch } from '@mui/material'
import { useState } from 'react'
import type { Settings } from './settings'

interface Props {
  settings: Settings
  onChange: (settings: Settings) => void
  onOpenLlm: () => void
}

const row = { m: 0, width: '100%', justifyContent: 'space-between', py: 0.25 } as const

export default function SettingsMenu({ settings, onChange, onOpenLlm }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const toggle = (key: 'furigana' | 'romaji' | 'posColors') => () => onChange({ ...settings, [key]: !settings[key] })

  return (
    <>
      <IconButton aria-label="显示设置" onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: 'text.primary' }}>
        <TuneOutlined />
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, p: 2, width: 260, borderRadius: '16px' } } }}
      >
        <Box>
          <FormControlLabel
            labelPlacement="start"
            sx={row}
            label="译文常驻显示"
            control={
              <Switch
                checked={settings.translation === 'always'}
                onChange={() => onChange({ ...settings, translation: settings.translation === 'always' ? 'manual' : 'always' })}
              />
            }
          />
          <FormControlLabel labelPlacement="start" sx={row} label="振假名" control={<Switch checked={settings.furigana} onChange={toggle('furigana')} />} />
          <FormControlLabel labelPlacement="start" sx={row} label="罗马音" control={<Switch checked={settings.romaji} onChange={toggle('romaji')} />} />
          <FormControlLabel labelPlacement="start" sx={row} label="词性着色" control={<Switch checked={settings.posColors} onChange={toggle('posColors')} />} />
        </Box>
        <Divider sx={{ my: 1.5 }} />
        <Button
          fullWidth
          startIcon={<AutoAwesomeOutlined />}
          onClick={() => {
            setAnchor(null)
            onOpenLlm()
          }}
        >
          AI 设置
        </Button>
      </Popover>
    </>
  )
}
