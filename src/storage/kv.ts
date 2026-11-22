import { invoke, isTauri } from '@tauri-apps/api/core'
import { createStore, del, get, keys as idbKeys, set, type UseStore } from 'idb-keyval'

/**
 * 持久化的键值存储。桌面应用里由 Rust 端的 SQLite 负责,数据放在应用数据目录;
 * 网页版没有 Rust,退回浏览器的 IndexedDB。两边接口一致,上层不用关心。
 */
export interface Kv {
  /** 读取 JSON 值 */
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  /** 读写二进制(EPUB、封面),连同类型一起保存 */
  getBlob(key: string): Promise<Blob | undefined>
  setBlob(key: string, blob: Blob): Promise<void>
  del(...keys: string[]): Promise<void>
  /** 以 prefix 开头的全部键 */
  keys(prefix: string): Promise<string[]>
}

export type Namespace = 'library' | 'cache' | 'app'

// ---------- 桌面应用:Rust 命令 ----------

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Blob 在 Rust 端是一段字节:1 字节的类型长度,类型字符串,然后是内容。 */
async function packBlob(blob: Blob): Promise<Uint8Array> {
  const type = encoder.encode(blob.type)
  const packed = new Uint8Array(1 + type.length + blob.size)
  packed[0] = type.length
  packed.set(type, 1)
  packed.set(new Uint8Array(await blob.arrayBuffer()), 1 + type.length)
  return packed
}

// 二进制按块传输,每块是 base64 字符串,走普通的 JSON 命令。
// 不用原始字节请求体:Tauri 在 Android 上不支持读取请求体,那条通道只在桌面可用。
const CHUNK = 1 << 20

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  // 分段转换,避免一次展开太多参数
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function unpackBlob(packed: Uint8Array): Blob {
  const typeLength = packed[0]
  const type = decoder.decode(packed.subarray(1, 1 + typeLength))
  return new Blob([packed.slice(1 + typeLength)], { type })
}

function tauriKv(ns: Namespace): Kv {
  return {
    async get<T>(key: string) {
      const text = await invoke<string | null>('kv_get_text', { ns, key })
      return text === null ? undefined : (JSON.parse(text) as T)
    },
    set: (key, value) => invoke('kv_set_text', { ns, key, value: JSON.stringify(value) }),
    async getBlob(key) {
      const length = await invoke<number | null>('kv_bytes_len', { ns, key })
      if (length === null) return undefined
      const packed = new Uint8Array(length)
      for (let offset = 0; offset < length; offset += CHUNK) {
        const chunk = await invoke<string>('kv_bytes_get', { ns, key, offset, len: Math.min(CHUNK, length - offset) })
        packed.set(fromBase64(chunk), offset)
      }
      return unpackBlob(packed)
    },
    async setBlob(key, blob) {
      const packed = await packBlob(blob)
      // 块必须按顺序到,最后一块到了 Rust 端才会写入数据库
      for (let offset = 0; offset < packed.length; offset += CHUNK) {
        const chunk = toBase64(packed.subarray(offset, offset + CHUNK))
        await invoke('kv_bytes_put', { ns, key, offset, chunk, last: offset + CHUNK >= packed.length })
      }
    },
    del: (...keys) => invoke('kv_del', { ns, keys }),
    keys: (prefix) => invoke<string[]>('kv_keys', { ns, prefix }),
  }
}

// ---------- 网页版:IndexedDB ----------

interface StoredBlob {
  type: string
  data: ArrayBuffer
}

// 库名沿用旧版本的,已经存在浏览器里的数据不用迁移
const WEB_STORES: Record<Namespace, UseStore> = {
  library: createStore('kotonoha', 'library'),
  cache: createStore('keyval-store', 'keyval'),
  app: createStore('kotonoha', 'app'),
}

function webKv(ns: Namespace): Kv {
  const store = WEB_STORES[ns]
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    async getBlob(key) {
      const stored = await get<StoredBlob>(key, store)
      return stored && new Blob([stored.data], { type: stored.type })
    },
    async setBlob(key, blob) {
      await set(key, { type: blob.type, data: await blob.arrayBuffer() } satisfies StoredBlob, store)
    },
    async del(...keys) {
      for (const key of keys) await del(key, store)
    },
    async keys(prefix) {
      return (await idbKeys(store)).filter((k): k is string => typeof k === 'string' && k.startsWith(prefix))
    },
  }
}

export const openKv = (ns: Namespace): Kv => (isTauri() ? tauriKv(ns) : webKv(ns))
