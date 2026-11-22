import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { addBook, getBookFile, getCover, listBooks, loadChat, markOpened, removeBook, saveChat, saveProgress } from './library'

const epub = (name: string, content = 'x') => new File([content], name, { type: 'application/epub+zip' })

beforeEach(async () => {
  for (const b of await listBooks()) await removeBook(b.id)
})

describe('library', () => {
  it('存入后能列出,并能取回原文件与封面', async () => {
    const meta = await addBook(epub('a.epub', 'hello'), { title: '书 A', author: '作者' }, new Blob(['img'], { type: 'image/jpeg' }))
    expect(meta).toMatchObject({ title: '书 A', author: '作者', fileName: 'a.epub', hasCover: true })

    expect((await listBooks()).map((b) => b.id)).toEqual([meta.id])
    const file = await getBookFile(meta)
    expect(file?.name).toBe('a.epub')
    expect(await file?.text()).toBe('hello')
    expect((await getCover(meta.id))?.type).toBe('image/jpeg')
  })

  it('没有封面时 hasCover 为 false', async () => {
    const meta = await addBook(epub('b.epub'), { title: 'B', author: '' }, null)
    expect(meta.hasCover).toBe(false)
    expect(await getCover(meta.id)).toBeUndefined()
  })

  it('同名同大小的书不会重复存入', async () => {
    const first = await addBook(epub('c.epub', 'same'), { title: 'C', author: '' }, null)
    const second = await addBook(epub('c.epub', 'same'), { title: 'C', author: '' }, null)
    expect(second.id).toBe(first.id)
    expect(await listBooks()).toHaveLength(1)
  })

  it('保存阅读进度并按最近阅读排序', async () => {
    const a = await addBook(epub('d1.epub', '1'), { title: 'D1', author: '' }, null)
    const b = await addBook(epub('d2.epub', '22'), { title: 'D2', author: '' }, null)
    await markOpened(a.id)
    await new Promise((r) => setTimeout(r, 5)) // 时间戳精度是毫秒,避免同一毫秒内排序不确定
    await saveProgress(b.id, { chapter: 3, sentence: 10, fraction: 0.25 })
    const list = await listBooks()
    expect(list[0].id).toBe(b.id)
    expect(list[0].progress).toEqual({ chapter: 3, sentence: 10, fraction: 0.25 })
  })

  it('删除后书与封面都没有了', async () => {
    const meta = await addBook(epub('e.epub'), { title: 'E', author: '' }, new Blob(['i'], { type: 'image/png' }))
    await removeBook(meta.id)
    expect(await listBooks()).toEqual([])
    expect(await getBookFile(meta)).toBeUndefined()
    expect(await getCover(meta.id)).toBeUndefined()
  })
})

describe('chat', () => {
  it('按书保存对话,清空即删除,删书时一并删除', async () => {
    const meta = await addBook(epub('f.epub', 'chat'), { title: 'F', author: '' }, null)
    expect(await loadChat(meta.id)).toEqual([])

    const turns = [
      { role: 'user' as const, content: 'この「は」は?' },
      { role: 'assistant' as const, content: '主題を表します。' },
    ]
    await saveChat(meta.id, turns)
    expect(await loadChat(meta.id)).toEqual(turns)

    await saveChat(meta.id, [])
    expect(await loadChat(meta.id)).toEqual([])

    await saveChat(meta.id, turns)
    await removeBook(meta.id)
    expect(await loadChat(meta.id)).toEqual([])
  })
})
