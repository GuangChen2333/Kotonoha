// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 用内存里的表模拟 Rust 端的命令,约定与 src-tauri/src/kv.rs 一致:
// 文本走 JSON 参数;二进制按块、以 base64 字符串传输,最后一块到了才算写入
const table = new Map<string, Uint8Array>()
const staging = new Map<string, Uint8Array>()
const id = (ns: string, key: string) => `${ns}\u0000${key}`
const calls: string[] = []
const b64 = {
  encode(bytes: Uint8Array) {
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(binary)
  },
  decode: (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0)),
}

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: async (cmd: string, args?: unknown) => {
    calls.push(cmd)
    const a = (args ?? {}) as { ns: string; key: string; value: string; keys: string[]; prefix: string; offset: number; len: number; chunk: string; last: boolean }
    switch (cmd) {
      case 'kv_get_text': {
        const v = table.get(id(a.ns, a.key))
        return v ? new TextDecoder().decode(v) : null
      }
      case 'kv_set_text':
        table.set(id(a.ns, a.key), new TextEncoder().encode(a.value))
        return
      case 'kv_bytes_len':
        return table.get(id(a.ns, a.key))?.length ?? null
      case 'kv_bytes_get':
        return b64.encode(table.get(id(a.ns, a.key))!.slice(a.offset, a.offset + a.len))
      case 'kv_bytes_put': {
        const pending = a.offset === 0 ? new Uint8Array(0) : (staging.get(id(a.ns, a.key)) ?? new Uint8Array(0))
        if (pending.length !== a.offset) throw new Error('分块顺序不对')
        const chunk = b64.decode(a.chunk)
        const joined = new Uint8Array(pending.length + chunk.length)
        joined.set(pending)
        joined.set(chunk, pending.length)
        staging.set(id(a.ns, a.key), joined)
        if (a.last) {
          table.set(id(a.ns, a.key), joined)
          staging.delete(id(a.ns, a.key))
        }
        return
      }
      case 'kv_del':
        for (const k of a.keys) table.delete(id(a.ns, k))
        return
      case 'kv_keys':
        return [...table.keys()].filter((k) => k.startsWith(`${a.ns}\u0000${a.prefix}`)).map((k) => k.split('\u0000')[1])
    }
  },
}))

const { openKv } = await import('./kv')

beforeEach(() => {
  table.clear()
  staging.clear()
  calls.length = 0
})

describe('桌面应用的 kv(经 Rust 命令)', () => {
  it('JSON 值读写,缺失返回 undefined', async () => {
    const kv = openKv('library')
    expect(await kv.get('x')).toBeUndefined()
    await kv.set('x', { a: [1, 2], b: '日本語' })
    expect(await kv.get('x')).toEqual({ a: [1, 2], b: '日本語' })
    expect(calls).toContain('kv_set_text')
  })

  it('Blob 连同类型一起存取,键里的特殊字符经过编码', async () => {
    const kv = openKv('library')
    const bytes = new Uint8Array([0, 1, 2, 250, 255])
    await kv.setBlob('file:一|二', new Blob([bytes], { type: 'application/epub+zip' }))
    const back = await kv.getBlob('file:一|二')
    expect(back?.type).toBe('application/epub+zip')
    expect(new Uint8Array(await back!.arrayBuffer())).toEqual(bytes)
    expect(await kv.getBlob('missing')).toBeUndefined()
  })

  it('大于一块的 Blob 分块上传并完整读回,最后一块到了才写入', async () => {
    const kv = openKv('library')
    const bytes = new Uint8Array(2_500_000).map((_, i) => (i * 7) % 256) // 超过两个 1 MiB 的块
    await kv.setBlob('file:big', new Blob([bytes], { type: 'application/epub+zip' }))
    expect(calls.filter((c) => c === 'kv_bytes_put')).toHaveLength(3)
    const back = await kv.getBlob('file:big')
    expect(back?.type).toBe('application/epub+zip')
    expect(back?.size).toBe(bytes.length)
    expect(new Uint8Array(await back!.arrayBuffer())).toEqual(bytes)
  })

  it('命名空间互不干扰,keys 按前缀,del 可一次删多个', async () => {
    const lib = openKv('library')
    const cache = openKv('cache')
    await lib.set('meta:1', 1)
    await lib.set('meta:2', 2)
    await lib.set('file:1', 3)
    await cache.set('meta:1', 4)
    expect(await lib.keys('meta:')).toEqual(['meta:1', 'meta:2'])
    await lib.del('meta:1', 'file:1')
    expect(await lib.keys('')).toEqual(['meta:2'])
    expect(await cache.get('meta:1')).toBe(4)
  })
})
