import { useEffect, useState } from 'react'
import { readAppData, writeAppData } from './storage/appData'

export interface Settings {
  /** always: 每句都显示译文;manual: 点句子右上角的翻译按钮才翻译那一句 */
  translation: 'always' | 'manual'
  furigana: boolean
  romaji: boolean
  posColors: boolean
}

const DEFAULTS: Settings = { translation: 'always', furigana: true, romaji: false, posColors: true }

function read(): Settings {
  try {
    const stored = { ...DEFAULTS, ...readAppData<Partial<Settings>>('settings') }
    // 旧版本存的是 'active'(选中即显示),现在已改成点按钮,统一当作 manual
    return { ...stored, translation: stored.translation === 'always' ? 'always' : 'manual' }
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(read)
  useEffect(() => {
    writeAppData('settings', settings).catch((e) => console.error('设置保存失败', e))
  }, [settings])
  return [settings, setSettings] as const
}
