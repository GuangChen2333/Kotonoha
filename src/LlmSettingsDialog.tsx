import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography, useMediaQuery,
} from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { useState } from 'react'
import { loadLlmConfig, PROVIDER_LABEL, saveLlmConfig, usesKeychain, type Level, type ProviderId } from './llm/config'

const MODEL_HINT: Record<ProviderId, string> = {
  anthropic: '例如 claude-haiku-5-5(翻译量大,建议用较小的模型)',
  openai: '填写你的账号可用的模型 ID',
  google: '填写你的账号可用的模型 ID',
  'openai-compatible': '填写该服务提供的模型 ID',
}

const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1']

function Form({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState(loadLlmConfig)
  const patch = (p: Partial<typeof c>) => setC({ ...c, ...p })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const save = async () => {
    setSaving(true)
    setError(undefined)
    try {
      await saveLlmConfig({ ...c, apiKey: c.apiKey.trim(), model: c.model.trim(), baseURL: c.baseURL.trim() })
      onSaved()
      onClose()
    } catch (e) {
      setError(`保存失败:${e instanceof Error ? e.message : String(e)}`)
      setSaving(false)
    }
  }

  return (
    <>
      <DialogTitle>AI 设置</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 2 }}>
          <TextField select label="供应商" value={c.provider} onChange={(e) => patch({ provider: e.target.value as ProviderId })}>
            {Object.entries(PROVIDER_LABEL).map(([id, label]) => (
              <MenuItem key={id} value={id}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="API Key"
            type="password"
            autoComplete="off"
            value={c.apiKey}
            onChange={(e) => patch({ apiKey: e.target.value })}
            helperText={
              usesKeychain()
                ? '保存在系统钥匙串中,不会发送给除所选供应商以外的任何服务。'
                : '只保存在本机浏览器的本地存储中,不会发送给除所选供应商以外的任何服务。'
            }
          />
          <TextField label="模型" value={c.model} onChange={(e) => patch({ model: e.target.value })} helperText={MODEL_HINT[c.provider]} />
          <TextField
            label={c.provider === 'openai-compatible' ? '接口地址(必填)' : '接口地址(可选)'}
            value={c.baseURL}
            onChange={(e) => patch({ baseURL: e.target.value })}
            placeholder={c.provider === 'openai-compatible' ? 'https://api.deepseek.com/v1' : '留空使用官方地址'}
          />
          <TextField label="译文与解说的语言" value={c.targetLanguage} onChange={(e) => patch({ targetLanguage: e.target.value })} />
          <TextField select label="日语水平" value={c.level} onChange={(e) => patch({ level: e.target.value as Level })} helperText="决定 AI 解说的深浅">
            {LEVELS.map((l) => (
              <MenuItem key={l} value={l}>{l}</MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="text.secondary">
            书中的句子会发送给所选供应商用于翻译与解说。
          </Typography>
          {error && <Typography color="error" variant="body2">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>保存</Button>
      </DialogActions>
    </>
  )
}

export default function LlmSettingsDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  // 手机上整屏显示,表单多,留出足够的空间
  const fullScreen = useMediaQuery((t: Theme) => t.breakpoints.down('sm'))
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <Form onClose={onClose} onSaved={onSaved} />
    </Dialog>
  )
}
