import { invoke, isTauri } from '@tauri-apps/api/core'
import { readAppData, writeAppData } from '../storage/appData'

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'openai-compatible'

export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface LlmConfig {
  provider: ProviderId
  apiKey: string
  model: string
  /** 自定义接口地址。openai-compatible 必填(如 DeepSeek、OpenRouter、本地 Ollama),其余供应商留空即用官方地址 */
  baseURL: string
  /** 译文与解说使用的语言 */
  targetLanguage: string
  /** 日语水平,决定 AI 解说的深浅 */
  level: Level
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  google: 'Google (Gemini)',
  'openai-compatible': 'OpenAI 兼容接口(DeepSeek、OpenRouter、Ollama 等)',
}

/** 是否已填好调用所需的信息。本地模型(openai-compatible,如 Ollama)可以没有 Key,但必须有接口地址。 */
export function isLlmConfigured(c: LlmConfig): boolean {
  const needsBase = c.provider === 'openai-compatible'
  return !!c.model && (!!c.apiKey || needsBase) && (!needsBase || !!c.baseURL)
}

export const DEFAULT_CONFIG: LlmConfig = {
  provider: 'anthropic',
  apiKey: '',
  model: '',
  baseURL: '',
  targetLanguage: '简体中文',
  level: 'N3',
}

const SECRET_NAME = 'llm-api-key'

// 桌面应用里 API Key 存系统钥匙串(macOS 钥匙串、Windows 凭据管理器、Secret Service),
// 其余设置由 Rust 端落盘(见 storage/appData)。钥匙串读取是异步的,所以启动时读进内存,同步的 loadLlmConfig 从这里取。
// 网页版没有钥匙串,Key 仍存在 localStorage 里。
let keychainKey: string | undefined

/** 当前是否用系统钥匙串保存 API Key。 */
export const usesKeychain = () => keychainKey !== undefined

const readStored = (): Partial<LlmConfig> => readAppData<Partial<LlmConfig>>('llm') ?? {}

/**
 * 启动时调用一次(在 initAppData 之后)。桌面应用里读出钥匙串中的 Key;
 * 钥匙串里还没有而设置里有(旧版本存的明文)时,迁移进钥匙串,并把设置里的明文清掉。
 * 钥匙串不可用时(如 Linux 没有 Secret Service)退回设置里的 Key,应用照常能用。
 */
export async function initLlmConfig(): Promise<void> {
  if (!isTauri()) return
  try {
    const stored = readStored()
    let key = (await invoke<string | null>('secret_get', { name: SECRET_NAME })) ?? ''
    if (!key && stored.apiKey) {
      key = stored.apiKey
      await invoke('secret_set', { name: SECRET_NAME, value: key })
    }
    if (stored.apiKey) await writeAppData('llm', { ...stored, apiKey: '' })
    keychainKey = key
  } catch (e) {
    console.error('系统钥匙串不可用,API Key 将保存在应用数据中', e)
  }
}

export function loadLlmConfig(): LlmConfig {
  const stored = { ...DEFAULT_CONFIG, ...readStored() }
  return keychainKey === undefined ? stored : { ...stored, apiKey: keychainKey }
}

/** 保存设置。桌面应用里 Key 写入钥匙串,失败时抛出错误,此时其余设置也不会保存。 */
export async function saveLlmConfig(config: LlmConfig): Promise<void> {
  if (keychainKey === undefined) {
    await writeAppData('llm', config)
    return
  }
  if (config.apiKey) await invoke('secret_set', { name: SECRET_NAME, value: config.apiKey })
  else await invoke('secret_delete', { name: SECRET_NAME })
  keychainKey = config.apiKey
  await writeAppData('llm', { ...config, apiKey: '' })
}
