import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogle } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText, Output, streamText, type LanguageModel, type ModelMessage } from 'ai'
import pLimit from 'p-limit'
import { z } from 'zod'
import { openKv } from '../storage/kv'
import { isLlmConfigured, loadLlmConfig, type LlmConfig } from './config'
import {
  chatInstructions,
  translationInstructions,
  translationPrompt,
  wordInstructions,
  wordPrompt,
  type WordPromptInput,
} from './prompts'

export class NotConfiguredError extends Error {
  constructor() {
    super('尚未配置 AI。请点击右上角齿轮 → AI 设置,填写 API Key 与模型。')
  }
}

export const WordExplanation = z.object({
  meaning: z.string().describe('该词在本句中的简短释义'),
  explanation: z.string().describe('结合本句语境的解说'),
  grammar: z.string().describe('相关语法点;没有则为空字符串'),
  sense: z.number().int().describe('最贴合本句的词典义项编号;没有贴合的或没有词典义项时为 0'),
})
export type WordExplanation = z.infer<typeof WordExplanation>

function createModel(c: LlmConfig): LanguageModel {
  switch (c.provider) {
    case 'anthropic':
      // 浏览器直连 Anthropic 必须带这个请求头,否则会被拒绝
      return createAnthropic({
        apiKey: c.apiKey,
        baseURL: c.baseURL || undefined,
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })(c.model)
    case 'openai':
      return createOpenAI({ apiKey: c.apiKey, baseURL: c.baseURL || undefined })(c.model)
    case 'google':
      return createGoogle({ apiKey: c.apiKey, baseURL: c.baseURL || undefined })(c.model)
    case 'openai-compatible':
      return createOpenAICompatible({ name: 'custom', apiKey: c.apiKey, baseURL: c.baseURL }).languageModel(c.model)
  }
}

function requireConfig(): LlmConfig {
  const c = loadLlmConfig()
  if (!isLlmConfigured(c)) throw new NotConfiguredError()
  return c
}

// 一屏句子同时可见时会并发请求,限制并发以免触发供应商的速率限制。
// 点词是用户主动触发的,单独一条队列,不能排在后台预翻译的句子之后。
const translateLimit = pLimit(3)
const explainLimit = pLimit(2)

// 译文和点词解说花的是用户的 API 额度,缓存要持久保存
const cache = openKv('cache')

async function cached<T>(key: string, limit: ReturnType<typeof pLimit>, produce: () => Promise<T>): Promise<T> {
  const hit = await cache.get<T>(key)
  if (hit !== undefined) return hit
  const value = await limit(produce)
  await cache.set(key, value)
  return value
}

export async function translateSentence(sentence: string, prev?: string, next?: string, signal?: AbortSignal): Promise<string> {
  const c = requireConfig()
  return cached(`tr|${c.provider}|${c.model}|${c.targetLanguage}|${sentence}`, translateLimit, async () => {
    const { text } = await generateText({
      model: createModel(c),
      instructions: translationInstructions(c.targetLanguage),
      prompt: translationPrompt(sentence, prev, next),
      abortSignal: signal,
    })
    return text.trim()
  })
}

export async function explainWord(input: WordPromptInput, signal?: AbortSignal): Promise<WordExplanation> {
  const c = requireConfig()
  return cached(`wd|${c.provider}|${c.model}|${c.targetLanguage}|${c.level}|${input.sentence}|${input.phrase}|${input.surface}|${input.dictionary?.map((d) => `${d.entry.id}.${d.n}`).join(',') ?? ''}`, explainLimit, async () => {
    const { output } = await generateText({
      model: createModel(c),
      instructions: wordInstructions(c.targetLanguage, c.level),
      prompt: wordPrompt(input),
      output: Output.object({ schema: WordExplanation }),
      abortSignal: signal,
    })
    return output
  })
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** 自由提问,逐段返回回答。context 是附在对话最前面的阅读上下文,不缓存。 */
export async function* chatStream(history: ChatMessage[], context: string, signal?: AbortSignal): AsyncGenerator<string> {
  const c = requireConfig()
  const messages: ModelMessage[] = history.map((m) => ({ role: m.role, content: m.content }))
  const result = streamText({
    model: createModel(c),
    instructions: context ? `${chatInstructions(c.targetLanguage, c.level)}\n\n${context}` : chatInstructions(c.targetLanguage, c.level),
    messages,
    abortSignal: signal,
  })
  // textStream 会吞掉接口报错(默认只在控制台打印),所以读完整事件流,把错误抛给界面
  for await (const part of result.fullStream) {
    if (part.type === 'error') throw part.error instanceof Error ? part.error : new Error(String(part.error))
    if (part.type === 'text-delta') yield part.text
  }
}
