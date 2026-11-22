import { isTauri } from '@tauri-apps/api/core'
import { openKv } from './kv'

/**
 * 应用设置(显示设置、AI 设置)。界面要同步读取它们,而 Rust 端的读取是异步的,
 * 所以桌面应用里启动时一次性读进内存,之后同步读内存、写入时同时落盘。
 * 网页版直接读写 localStorage。
 */
export type AppDataName = 'settings' | 'llm'

const NAMES: AppDataName[] = ['settings', 'llm']
const legacyKey = (name: AppDataName) => `kotonoha.${name}`
const memory = new Map<AppDataName, unknown>()

/**
 * 启动时调用一次。桌面应用里从 Rust 端读出设置;
 * Rust 端还没有、而 localStorage 里有的(旧版本存的),迁移过去并删掉 localStorage 里的副本。
 */
export async function initAppData(): Promise<void> {
  if (!isTauri()) return
  const kv = openKv('app')
  for (const name of NAMES) {
    let value = await kv.get<unknown>(name)
    const legacy = localStorage.getItem(legacyKey(name))
    if (value === undefined && legacy !== null) {
      value = JSON.parse(legacy)
      await kv.set(name, value)
    }
    if (legacy !== null) localStorage.removeItem(legacyKey(name))
    if (value !== undefined) memory.set(name, value)
  }
}

export function readAppData<T>(name: AppDataName): T | undefined {
  if (isTauri()) return memory.get(name) as T | undefined
  try {
    const raw = localStorage.getItem(legacyKey(name))
    return raw === null ? undefined : (JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

export async function writeAppData(name: AppDataName, value: unknown): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(legacyKey(name), JSON.stringify(value))
    return
  }
  await openKv('app').set(name, value)
  memory.set(name, value)
}
