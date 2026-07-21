export type ApiError =
  | { kind: 'unauthorized'; message: string; logId?: number }
  | { kind: 'insufficient'; message: string; logId?: number }
  | { kind: 'rate_limited'; message: string; logId?: number }
  | { kind: 'content_filtered'; message: string; logId?: number }
  | { kind: 'bad_request'; message: string; logId?: number }
  | { kind: 'server_error'; message: string; logId?: number }
  | { kind: 'network'; message: string; logId?: number }

interface OpenAiErrorBody { error?: { message?: string; type?: string; code?: string } }

function extractMessage(body: string | undefined): string | undefined {
  if (!body) return undefined
  try {
    const parsed = JSON.parse(body) as OpenAiErrorBody
    return parsed.error?.message
  } catch { return undefined }
}

export function parseApiError(response: Response, body?: string): ApiError {
  const msg = extractMessage(body)
  switch (response.status) {
    case 401: return { kind: 'unauthorized', message: msg ?? '密钥无效或已过期' }
    case 402: return { kind: 'insufficient', message: msg ?? '余额不足' }
    case 429: return { kind: 'rate_limited', message: msg ?? '请求过快，请稍后再试' }
    case 400: return { kind: 'bad_request', message: msg ?? '请求参数错误' }
    default:
      if (response.status >= 500) return { kind: 'server_error', message: msg ?? '服务异常，请稍后再试' }
      return { kind: 'bad_request', message: msg ?? `未知错误 (${response.status})` }
  }
}

export function parseNetworkError(e: unknown): ApiError {
  const msg = e instanceof Error ? e.message : String(e)
  return { kind: 'network', message: `网络异常：${msg}` }
}
