import type { GenerateRequest } from './types'
import { parseApiError, parseNetworkError } from './errors'
import { applyCorsProxy } from './proxy'
import { db, type RequestLog } from '@/lib/db'

const TIMEOUT_MS = 600_000

export interface LogContext {
  providerId?: number | null
  providerName?: string | null
  providerBaseUrl?: string | null
  conversationId?: number | null
  messageId?: number | null
  promptLength?: number | null
  refImageCount?: number | null
}

const REDACTED_HEADERS = { Authorization: 'Bearer ***', 'Content-Type': 'application/json' }

function pickResponseHeaders(headers: Headers): Record<string, string> {
  const wanted = ['x-request-id', 'x-requestid', 'request-id', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after', 'content-type', 'date']
  const out: Record<string, string> = {}
  for (const k of wanted) {
    const v = headers.get(k)
    if (v != null) out[k] = v
  }
  return out
}

async function saveRequestLog(log: Omit<RequestLog, 'id'>): Promise<number | null> {
  try {
    const id = await db.requestLogs.add(log)
    void pruneOldLogs()
    return id
  } catch { return null }
}

async function pruneOldLogs(): Promise<void> {
  try {
    const count = await db.requestLogs.count()
    if (count > 100) {
      const oldest = await db.requestLogs.orderBy('timestamp').limit(count - 100).toArray()
      await db.requestLogs.bulkDelete(oldest.map((l) => l.id!).filter((id) => id != null))
    }
  } catch { }
}

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
  logContext?: LogContext,
): Promise<unknown> {
  const url = applyCorsProxy(
    `${baseUrl.replace(/\/$/, '')}/v1/images/generations`,
    corsProxy,
  )
  const model = req.model ?? 'gpt-image-2'
  const body = JSON.stringify({
    model, prompt: req.prompt, n: req.n ?? 1, size: req.size,
    quality: req.quality ?? 'high', response_format: req.response_format ?? 'b64_json',
    moderation: 'low', user: req.user,
  })
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: withTimeout(TIMEOUT_MS),
    })
    const respBody = await res.text()
    if (!res.ok) {
      const err = parseApiError(res, respBody)
      const logId = await saveRequestLog({
        timestamp: start, durationMs: Date.now() - start,
        endpoint: 'generate',
        providerId: logContext?.providerId ?? null,
        providerName: logContext?.providerName ?? null,
        providerBaseUrl: logContext?.providerBaseUrl ?? baseUrl,
        model, corsProxyApplied: !!corsProxy,
        url, method: 'POST', headers: REDACTED_HEADERS, body,
        promptLength: logContext?.promptLength ?? req.prompt.length,
        refImageCount: logContext?.refImageCount ?? 0,
        conversationId: logContext?.conversationId ?? null,
        messageId: logContext?.messageId ?? null,
        responseStatus: res.status, responseHeaders: pickResponseHeaders(res.headers), responseBody: respBody,
        errorKind: err.kind, errorMessage: err.message,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })
      throw { ...err, logId }
    }
    return JSON.parse(respBody)
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) throw e
    const err = parseNetworkError(e)
    const logId = await saveRequestLog({
      timestamp: start, durationMs: Date.now() - start,
      endpoint: 'generate',
      providerId: logContext?.providerId ?? null,
      providerName: logContext?.providerName ?? null,
      providerBaseUrl: logContext?.providerBaseUrl ?? baseUrl,
      model, corsProxyApplied: !!corsProxy,
      url, method: 'POST', headers: REDACTED_HEADERS, body,
      promptLength: logContext?.promptLength ?? req.prompt.length,
      refImageCount: logContext?.refImageCount ?? 0,
      conversationId: logContext?.conversationId ?? null,
      messageId: logContext?.messageId ?? null,
      responseStatus: null, responseHeaders: null, responseBody: null,
      errorKind: err.kind, errorMessage: err.message,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    throw { ...err, logId }
  }
}

export async function editImageMulti(
  baseUrl: string, apiKey: string,
  prompt: string, sourceBlobs: Blob[], size: string,
  corsProxy?: string,
  logContext?: LogContext,
): Promise<unknown> {
  const url = applyCorsProxy(
    `${baseUrl.replace(/\/$/, '')}/v1/images/edits`,
    corsProxy,
  )
  const model = 'gpt-image-2'
  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  sourceBlobs.forEach((blob, idx) => {
    form.append('image', blob, `source-${idx}.png`)
  })
  form.append('n', '1')
  form.append('size', size)
  form.append('quality', 'high')
  form.append('response_format', 'b64_json')
  form.append('moderation', 'low')
  const bodyObj = {
    model, prompt, n: '1', size,
    quality: 'high', response_format: 'b64_json',
    moderation: 'low',
    images: `${sourceBlobs.length} blob(s) totaling ${sourceBlobs.reduce((s, b) => s + b.size, 0)} bytes`,
  }
  const body = JSON.stringify(bodyObj, null, 2)
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form,
      signal: withTimeout(TIMEOUT_MS),
    })
    const respBody = await res.text()
    if (!res.ok) {
      const err = parseApiError(res, respBody)
      const logId = await saveRequestLog({
        timestamp: start, durationMs: Date.now() - start,
        endpoint: 'edit',
        providerId: logContext?.providerId ?? null,
        providerName: logContext?.providerName ?? null,
        providerBaseUrl: logContext?.providerBaseUrl ?? baseUrl,
        model, corsProxyApplied: !!corsProxy,
        url, method: 'POST', headers: REDACTED_HEADERS, body,
        promptLength: logContext?.promptLength ?? prompt.length,
        refImageCount: logContext?.refImageCount ?? sourceBlobs.length,
        conversationId: logContext?.conversationId ?? null,
        messageId: logContext?.messageId ?? null,
        responseStatus: res.status, responseHeaders: pickResponseHeaders(res.headers), responseBody: respBody,
        errorKind: err.kind, errorMessage: err.message,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })
      throw { ...err, logId }
    }
    return JSON.parse(respBody)
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) throw e
    const err = parseNetworkError(e)
    const logId = await saveRequestLog({
      timestamp: start, durationMs: Date.now() - start,
      endpoint: 'edit',
      providerId: logContext?.providerId ?? null,
      providerName: logContext?.providerName ?? null,
      providerBaseUrl: logContext?.providerBaseUrl ?? baseUrl,
      model, corsProxyApplied: !!corsProxy,
      url, method: 'POST', headers: REDACTED_HEADERS, body,
      promptLength: logContext?.promptLength ?? prompt.length,
      refImageCount: logContext?.refImageCount ?? sourceBlobs.length,
      conversationId: logContext?.conversationId ?? null,
      messageId: logContext?.messageId ?? null,
      responseStatus: null, responseHeaders: null, responseBody: null,
      errorKind: err.kind, errorMessage: err.message,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    throw { ...err, logId }
  }
}

export function editImage(
  baseUrl: string, apiKey: string,
  prompt: string, sourceBlob: Blob, size: string,
  corsProxy?: string,
): Promise<unknown> {
  return editImageMulti(baseUrl, apiKey, prompt, [sourceBlob], size, corsProxy)
}
