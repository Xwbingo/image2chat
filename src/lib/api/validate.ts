import type { ApiError } from './errors'
import { parseApiError, parseNetworkError } from './errors'

export interface KeyValidationResult {
  valid: boolean
  error?: ApiError
}

function withTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), ms)
  return ctrl.signal
}

export async function validateApiKey(
  baseUrl: string,
  apiKey: string,
): Promise<KeyValidationResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/images/generations`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: '',
        n: 1,
        size: '1024x1024',
        quality: 'high',
        response_format: 'url',
      }),
      signal: withTimeout(15_000),
    })
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: parseApiError(res) }
    }
    return { valid: true }
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) {
      return { valid: false, error: e as ApiError }
    }
    return { valid: false, error: parseNetworkError(e) }
  }
}
