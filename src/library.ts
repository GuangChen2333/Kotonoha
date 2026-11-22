import { openKv } from './storage/kv'

/** 阅读进度:读到哪一章的哪一句,以及整本书的大致完成度(0 到 1)。 */
export interface Progress {
  chapter: number
  sentence: number
  fraction: number
}

export interface BookMeta {
  id: string
  title: string
  author: string
  fileName: string
  size: number
  addedAt: number
  lastOpenedAt?: number
  progress?: Progress
  hasCover: boolean
}

const kv = openKv('library')
const metaKey = (id: string) => `meta:${id}`
const fileKey = (id: string) => `file:${id}`
const coverKey = (id: string) => `cover:${id}`

/** 书架上的全部书,最近读过的在前。只读元数据,不会把书的内容读出来。 */
export async function listBooks(): Promise<BookMeta[]> {
  const metas = await Promise.all((await kv.keys('meta:')).map((k) => kv.get<BookMeta>(k)))
  return metas.filter((m): m is BookMeta => m !== undefined).sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt))
}

/** 把一本书存入书架。同名同大小的书视为已存在,直接返回原有记录。 */
export async function addBook(file: File, info: { title: string; author: string }, cover: Blob | null): Promise<BookMeta> {
  const existing = (await listBooks()).find((b) => b.fileName === file.name && b.size === file.size)
  if (existing) return existing

  const meta: BookMeta = {
    id: crypto.randomUUID(),
    title: info.title,
    author: info.author,
    fileName: file.name,
    size: file.size,
    addedAt: Date.now(),
    hasCover: cover !== null,
  }
  // 先写文件和封面,最后写元数据:中途失败时书架上不会出现读不出来的书
  await kv.setBlob(fileKey(meta.id), file)
  if (cover) await kv.setBlob(coverKey(meta.id), cover)
  await kv.set(metaKey(meta.id), meta)
  return meta
}

export async function getBookFile(meta: BookMeta): Promise<File | undefined> {
  const blob = await kv.getBlob(fileKey(meta.id))
  return blob && new File([blob], meta.fileName, { type: blob.type || 'application/epub+zip' })
}

export const getCover = (id: string) => kv.getBlob(coverKey(id))

async function update(id: string, patch: (meta: BookMeta) => BookMeta): Promise<void> {
  const meta = await kv.get<BookMeta>(metaKey(id))
  if (meta) await kv.set(metaKey(id), patch(meta))
}

export const saveProgress = (id: string, progress: Progress) => update(id, (m) => ({ ...m, progress, lastOpenedAt: Date.now() }))

export const markOpened = (id: string) => update(id, (m) => ({ ...m, lastOpenedAt: Date.now() }))

/** 一本书的 AI 对话。内容就是展示用的消息列表,按书保存,换章不丢。 */
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

const chatKey = (id: string) => `chat:${id}`

export const loadChat = async (id: string): Promise<ChatTurn[]> => (await kv.get<ChatTurn[]>(chatKey(id))) ?? []

export const saveChat = (id: string, turns: ChatTurn[]) => (turns.length ? kv.set(chatKey(id), turns) : kv.del(chatKey(id)))

export async function removeBook(id: string): Promise<void> {
  await kv.del(metaKey(id), fileKey(id), coverKey(id), chatKey(id))
}
