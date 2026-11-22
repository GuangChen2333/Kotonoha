import { makeBook } from 'foliate-js/view.js'
import { extractItems, type ChapterItem } from './extract'

interface TocItem {
  label: string
  href: string
  subitems?: TocItem[] | null
}

interface FoliateSection {
  linear?: string
  createDocument(): Promise<Document>
  resolveHref(href: string): unknown
}

type Name = string | Record<string, string> | { name?: Name } | Name[] | null | undefined

interface FoliateBook {
  metadata?: { title?: Name; author?: Name }
  getCover?(): Promise<Blob | null>
  loadBlob(path: string): Promise<Blob>
  sections: FoliateSection[]
  toc?: TocItem[] | null
  resolveHref(href: string): { index: number } | undefined
}

export interface Chapter {
  index: number
  title: string
}

export interface LoadedBook {
  title: string
  /** 作者,多位用「、」连接;没有时为空 */
  author: string
  chapters: Chapter[]
  cover(): Promise<Blob | null>
  /** 章节内容,句子与插图按书中顺序排列;插图的 src 是 EPUB 内的路径,用 image() 取图。 */
  items(chapterIndex: number): Promise<ChapterItem[]>
  image(path: string): Promise<Blob>
}

/** 宽高比小于这个值的图是装饰条 */
export const ORNAMENT_ASPECT = 0.15

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

/** EPUB 元数据里的名字可能是字符串、多语言表、带 name 的对象或它们的数组,统一取成一个字符串。 */
export function nameText(x: Name): string {
  if (!x) return ''
  if (typeof x === 'string') return x
  if (Array.isArray(x)) return x.map(nameText).filter(Boolean).join('、')
  if ('name' in x) return nameText(x.name)
  return Object.values(x).find((v) => typeof v === 'string') ?? ''
}

function flattenToc(items: TocItem[] | null | undefined): TocItem[] {
  return (items ?? []).flatMap((item) => [item, ...flattenToc(item.subitems)])
}

export async function loadBook(file: File): Promise<LoadedBook> {
  const book = (await makeBook(file)) as FoliateBook

  const labels = new Map<number, string>()
  for (const item of flattenToc(book.toc)) {
    const target = book.resolveHref(item.href)
    if (target && !labels.has(target.index)) labels.set(target.index, item.label.trim())
  }

  const chapters = book.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.linear !== 'no')
    .map(({ index }) => ({ index, title: labels.get(index) ?? `Section ${index + 1}` }))

  return {
    title: nameText(book.metadata?.title) || file.name.replace(/\.epub$/i, ''),
    author: nameText(book.metadata?.author),
    chapters,
    cover: async () => (await book.getCover?.()) ?? null,
    async items(chapterIndex) {
      const section = book.sections[chapterIndex]
      const items = extractItems(await section.createDocument())
      // 图片引用相对于章节文件,换成 EPUB 内的路径;解析不出路径的(如 data: 地址)丢弃
      return items.flatMap((item): ChapterItem[] => {
        if (item.type !== 'image') return [item]
        // 细长的竖条是章节标题的装饰图(标题文字已单独显示),缩到手机宽度也看不清,不放进列表
        if (item.aspect !== undefined && item.aspect < ORNAMENT_ASPECT) return []
        const path = section.resolveHref(item.src)
        return typeof path === 'string' ? [{ ...item, src: path }] : []
      })
    },
    async image(path) {
      const blob = await book.loadBlob(path)
      const type = IMAGE_TYPES[path.split('.').pop()?.toLowerCase() ?? ''] ?? blob.type
      return blob.type === type ? blob : new Blob([blob], { type })
    },
  }
}
