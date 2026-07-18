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

/**
 * Probe a relay API key by sending a fully valid minimal generation request.
 *
 * Strictness layers:
 *  1. URL format pre-check — invalid format = invalid (no network call)
 *  2. Empty key pre-check — empty = invalid
 *  3. Send valid probe (prompt='a', size=1024x1024, quality=low)
 *  4. 401/403 → definitively invalid
 *  5. 2xx with non-empty data → definitively valid
 *  6. 2xx with empty data or malformed → invalid (catches permissive relays
 *     that return 200 OK regardless of auth)
 *  7. 4xx (other), 5xx, network → invalid with error
 *
 * Costs 1 generation quota on success. Users invoke manually.
 */
export async function validateApiKey(
  baseUrl: string,
  apiKey: string,
): Promise<KeyValidationResult> {
  // Pre-check 1: URL format
  try {
    const u = new URL(baseUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return {
        valid: false,
        error: { kind: 'bad_request', message: '域名格式无效（需 http:// 或 https://）' },
      }
    }
  } catch {
    return {
      valid: false,
      error: { kind: 'bad_request', message: '域名格式无效' },
    }
  }

  // Pre-check 2: non-empty key
  if (!apiKey.trim()) {
    return {
      valid: false,
      error: { kind: 'bad_request', message: '密钥不能为空' },
    }
  }

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
        prompt: 'a',
        n: 1,
        size: '1024x1024',
        quality: 'low',
        response_format: 'url',
      }),
      signal: withTimeout(30_000),
    })

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: parseApiError(res, await safeReadBody(res)) }
    }

    if (res.ok) {
      // Auth passed. Verify response actually has image data — defends against
      // permissive relays that return 200 OK with empty data for any auth.
      try {
        const body = await res.json()
        const data = body?.data
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0]
          if (first && (typeof first.url === 'string' && first.url.length > 0 || typeof first.b64_json === 'string' && first.b64_json.length > 0)) {
            return { valid: true }
          }
        }
      } catch {
        // JSON parse failed — response wasn't a valid OpenAI image response
      }
      return {
        valid: false,
        error: { kind: 'content_filtered', message: 'API 返回空数据，无法确认密钥有效（可能是空响应/容错中转站）' },
      }
    }

    // 4xx other / 5xx
    return { valid: false, error: parseApiError(res, await safeReadBody(res)) }
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) {
      return { valid: false, error: e as ApiError }
    }
    return { valid: false, error: parseNetworkError(e) }
  }
}

async function safeReadBody(res: Response): Promise<string | undefined> {
  try { return await res.text() } catch { return undefined }
}
