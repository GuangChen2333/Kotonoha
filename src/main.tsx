import { ThemeProvider } from '@mui/material/styles'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initLlmConfig } from './llm/config.ts'
import { initAppData } from './storage/appData.ts'
import { theme } from './theme.ts'

// 先从 Rust 端读出设置和钥匙串里的 API Key,再渲染,这样界面第一次读设置时就是完整的
void initAppData()
  .then(initLlmConfig)
  .catch((e) => console.error('读取应用数据失败', e))
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ThemeProvider theme={theme} defaultMode="system">
          <App />
        </ThemeProvider>
      </StrictMode>,
    ),
  )
