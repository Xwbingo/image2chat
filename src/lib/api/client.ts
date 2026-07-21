import type { GenerateRequest } from './types'
import { parseApiError, parseNetworkError } from './errors'
import { applyCorsProxy } from './proxy'

const TIMEOUT_MS = 600_000   // 10 minutes — for large 4K images

function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  ctrl.signal.addEventListener('abort', () => clearTimeout(timer))
  signal?.addEventListener('abort', () => ctrl.abort())
  return ctrl.signal
}

export async function generateImage(
  baseUrl: string, apiKey: string, req: GenerateRequest,
  corsProxy?: string,
): Promise<unknown> {
  const url = applyCorsProxy(
    `${baseUrl.replace(/\/$/, '')}/v1/images/generations`,
    corsProxy,
  )
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model ?? 'gpt-image-2',
        prompt: req.prompt,
        n: req.n ?? 1,
        size: req.size,
        quality: req.quality ?? 'high',
        response_format: req.response_format ?? 'b64_json',
        moderation: 'low',
        user: req.user,
      }),
      signal: withTimeout(TIMEOUT_MS),
    })
    const body = await res.text()
    if (!res.ok) throw parseApiError(res, body)
    return JSON.parse(body)
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) throw e
    throw parseNetworkError(e)
  }
}

export async function editImageMulti(
  baseUrl: string, apiKey: string,
  prompt: string, sourceBlobs: Blob[], size: string,
  corsProxy?: string,
): Promise<unknown> {
  const url = applyCorsProxy(
    `${baseUrl.replace(/\/$/, '')}/v1/images/edits`,
    corsProxy,
  )
  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('prompt', prompt)
  sourceBlobs.forEach((blob, idx) => {
    form.append('image', blob, `source-${idx}.png`)
  })
  form.append('n', '1')
  form.append('size', size)
  form.append('quality', 'high')
  form.append('response_format', 'b64_json')
  form.append('moderation', 'low')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form,
      signal: withTimeout(TIMEOUT_MS),
    })
    const body = await res.text()
    if (!res.ok) throw parseApiError(res, body)
    return JSON.parse(body)
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) throw e
    throw parseNetworkError(e)
  }
}

export function editImage(
  baseUrl: string, apiKey: string,
  prompt: string, sourceBlob: Blob, size: string,
  corsProxy?: string,
): Promise<unknown> {
  return editImageMulti(baseUrl, apiKey, prompt, [sourceBlob], size, corsProxy)
}