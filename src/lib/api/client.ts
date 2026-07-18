import type { GenerateRequest, GenerateResponse } from './types'
import { parseApiError, parseNetworkError } from './errors'

const TIMEOUT_MS = 120_000

function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  ctrl.signal.addEventListener('abort', () => clearTimeout(timer))
  signal?.addEventListener('abort', () => ctrl.abort())
  return ctrl.signal
}

export async function generateImage(
  baseUrl: string, apiKey: string, req: GenerateRequest,
): Promise<GenerateResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/images/generations`
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
        user: req.user,
      }),
      signal: withTimeout(TIMEOUT_MS),
    })
    const body = await res.text()
    if (!res.ok) throw parseApiError(res, body)
    return JSON.parse(body) as GenerateResponse
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) throw e
    throw parseNetworkError(e)
  }
}

export async function editImage(
  baseUrl: string, apiKey: string,
  prompt: string, sourceBlob: Blob, size: string,
): Promise<GenerateResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/images/edits`
  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('prompt', prompt)
  form.append('image', sourceBlob, 'source.png')
  form.append('n', '1')
  form.append('size', size)
  form.append('quality', 'high')
  form.append('response_format', 'b64_json')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form,
      signal: withTimeout(TIMEOUT_MS),
    })
    const body = await res.text()
    if (!res.ok) throw parseApiError(res, body)
    return JSON.parse(body) as GenerateResponse
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) throw e
    throw parseNetworkError(e)
  }
}