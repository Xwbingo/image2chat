import { describe, expect, it } from 'vitest'
import { extractImageFromResponse } from './normalize'

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg=='
const LONG_B64 = PNG_B64 + PNG_B64 + PNG_B64

describe('extractImageFromResponse', () => {
  it('reads b64_json from standard OpenAI shape', () => {
    const r = extractImageFromResponse({ created: 1, data: [{ b64_json: PNG_B64 }] })
    expect(r).toEqual({ kind: 'b64', value: PNG_B64 })
  })

  it('reads url from uuapi-shaped response', () => {
    const body = {
      created: 1784556537,
      data: [{ revised_prompt: '生成一只猫咪', url: 'https://chatimage2-img3.shyfai.cn/abc.png' }],
      request_id: 'req-1',
      stage: 'completed',
      status: 'completed',
    }
    const r = extractImageFromResponse(body)
    expect(r).toEqual({ kind: 'url', value: 'https://chatimage2-img3.shyfai.cn/abc.png' })
  })

  it('reads data URL from data[0].image', () => {
    const dataUrl = `data:image/png;base64,${PNG_B64}`
    const r = extractImageFromResponse({ data: [{ image: dataUrl }] })
    expect(r).toEqual({ kind: 'data_url', value: dataUrl })
  })

  it('reads plain base64 string at root', () => {
    const r = extractImageFromResponse(LONG_B64)
    expect(r).toEqual({ kind: 'b64', value: LONG_B64 })
  })

  it('walks nested tree to find a URL with image extension', () => {
    const r = extractImageFromResponse({ images: { result: { url: 'https://cdn.example.com/x.webp' } } })
    expect(r).toEqual({ kind: 'url', value: 'https://cdn.example.com/x.webp' })
  })

  it('returns null for empty data array', () => {
    expect(extractImageFromResponse({ data: [] })).toBeNull()
  })

  it('returns null for URL without image extension', () => {
    expect(extractImageFromResponse({ data: [{ url: 'https://example.com' }] })).toBeNull()
  })

  it('returns null for non-image payload', () => {
    expect(extractImageFromResponse({ status: 'completed' })).toBeNull()
  })

  it('reads b64 alias when b64_json is absent', () => {
    const r = extractImageFromResponse({ data: [{ b64: PNG_B64 }] })
    expect(r).toEqual({ kind: 'b64', value: PNG_B64 })
  })
})