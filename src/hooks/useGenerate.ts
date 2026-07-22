import { useCallback } from 'react'
import { db, type ImageRef } from '@/lib/db'
import { getProvider, addMessage, updateMessageStatus, setMessageBlobId, setMessageRemoteUrl, addImage, touchConversation } from '@/lib/repo'
import { generateImage, editImageMulti, type LogContext } from '@/lib/api/client'
import { extractImageFromResponse } from '@/lib/api/normalize'
import { applyCorsProxy } from '@/lib/api/proxy'
import type { ApiError } from '@/lib/api/errors'
import { parseNetworkError } from '@/lib/api/errors'

interface Success { messageId: number }
interface Failure { error: ApiError }
export type GenerateResult = Success | Failure

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'kind' in e && typeof (e as { kind: unknown }).kind === 'string'
}

function base64ToBlob(b64: string, mime = 'image/png'): Blob {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export function useGenerate() {
  return {
    generate: useCallback(async (
      conversationId: number,
      prompt: string,
      size: string,
      imageRefs: ImageRef[] = [],
    ): Promise<GenerateResult> => {
      let assistantId: number | undefined
      let startedAt: number | undefined
      try {
        const conv = await db.conversations.get(conversationId)
        if (!conv) return { error: { kind: 'bad_request', message: '会话不存在' } }
        const provider = await getProvider(conv.providerPresetId)
        if (!provider) return { error: { kind: 'bad_request', message: '中转站未配置' } }

        const now = Date.now()
        await addMessage({
          conversationId, role: 'user',
          kind: imageRefs.length > 0 ? 'image_edit_request' : 'text_prompt',
          prompt, size,
          imageRefs,
          status: 'success', createdAt: now,
        })
        startedAt = now + 1
        assistantId = await addMessage({
          conversationId, role: 'assistant', kind: 'image_result',
          size, status: 'generating', createdAt: startedAt, startedAt,
          providerName: provider.name,
        })
        await touchConversation(conversationId)

        let response: unknown
        const logContext: LogContext = {
          providerId: provider.id ?? null,
          providerName: provider.name,
          providerBaseUrl: provider.baseUrl,
          conversationId,
          messageId: assistantId,
          promptLength: prompt.length,
          refImageCount: imageRefs.length,
        }
        if (imageRefs.length > 0) {
          const blobs: Blob[] = []
          for (const ref of imageRefs) {
            const img = await db.images.get(ref.blobId)
            if (!img) throw { kind: 'bad_request', message: `找不到参考图 blobId=${ref.blobId}` }
            blobs.push(img.blob)
          }
          response = await editImageMulti(provider.baseUrl, provider.apiKey, prompt, blobs, size, provider.corsProxy, logContext)
        } else {
          response = await generateImage(provider.baseUrl, provider.apiKey, { prompt, size }, provider.corsProxy, logContext)
        }

        const extracted = extractImageFromResponse(response)
        if (!extracted) throw { kind: 'content_filtered', message: '返回为空' }

        let blob: Blob
        let remoteUrl: string | null = null
        if (extracted.kind === 'b64' || extracted.kind === 'data_url') {
          const raw = extracted.kind === 'data_url'
            ? extracted.value.slice(extracted.value.indexOf(',') + 1)
            : extracted.value
          blob = base64ToBlob(raw)
        } else {
          const r = await fetch(applyCorsProxy(extracted.value, provider.corsProxy))
          if (!r.ok) throw { kind: 'network', message: `图片 URL 获取失败 (${r.status})` }
          blob = await r.blob()
          remoteUrl = extracted.value
        }

        const bid = await addImage(blob, blob.type || 'image/png')
        await setMessageBlobId(assistantId, bid)
        if (remoteUrl) await setMessageRemoteUrl(assistantId, remoteUrl)
        await db.messages.update(assistantId, { completedAt: Date.now() })
        await updateMessageStatus(assistantId, 'success')
        return { messageId: assistantId }
      } catch (e: unknown) {
        const err: ApiError = isApiError(e) ? e : parseNetworkError(e)
        if (assistantId != null) {
          try {
            await db.messages.update(assistantId, {
              completedAt: Date.now(),
              ...(err.logId != null ? { errorLogId: err.logId } : {}),
            })
            await updateMessageStatus(assistantId, 'failed', err.kind)
          } catch { }
        }
        return { error: err }
      }
    }, []),
  }
}