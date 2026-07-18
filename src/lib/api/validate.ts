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
 * Probe a relay API key cheaply by hitting the OpenAI-compatible
 * `GET /v1/models` metadata endpoint. No generation quota consumed,
 * fast (~hundreds of ms).
 *
 * Returns:
 *  - { valid: true } when the relay responds 200 with a list of models
 *  - { valid: false, error: unauthorized } for 401/403
 *  - { valid: false, error: { kind: 'bad_request', message: '...' } } when the
 *    endpoint isn't supported (404/405) or other non-auth failure
 */
export async function validateApiKey(
  baseUrl: string,
  apiKey: string,
): Promise<KeyValidationResult> {
  // Pre-check URL format
  try {
    const u = new URL(baseUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return {
        valid: false,
        error: { kind: 'bad_request', message: '域名格式无效（需 http:// 或 https://）' },
      }
    }
  } catch {
    return { valid: false, error: { kind: 'bad_request', message: '域名格式无效' } }
  }

  if (!apiKey.trim()) {
    return { valid: false, error: { kind: 'bad_request', message: '密钥不能为空' } }
  }

  const url = `${baseUrl.replace(/\/$/, '')}/v1/models`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: withTimeout(10_000),
    })

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: parseApiError(res, await safeReadBody(res)) }
    }

    if (res.ok) {
      return { valid: true }
    }

    // 404 / 405 / 5xx — endpoint not available or server issue; can't auto-verify
    const code = res.status
    const message =
      code === 404 || code === 405
        ? '该中转站不支持 /v1/models，无法自动验证。请直接生成图片测试。'
        : `验证失败 (HTTP ${code})，请稍后重试或直接生成图片测试。`
    return { valid: false, error: { kind: 'bad_request', message } }
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