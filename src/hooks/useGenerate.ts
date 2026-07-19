import { useCallback } from 'react'
import { db } from '@/lib/db'
import { getProvider, addMessage, updateMessageStatus, setMessageBlobId, addImage, touchConversation } from '@/lib/repo'
import { generateImage, editImage } from '@/lib/api/client'
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

async function setMessageTiming(id: number, startedAt?: number, completedAt?: number) {
  await db.messages.update(id, { startedAt, completedAt })
}

export function useGenerate() {
  return {
    generate: useCallback(async (
      conversationId: number,
      prompt: string,
      size: string,
      editSourceMessageId?: number,
      uploadBlob?: Blob,
    ): Promise<GenerateResult> => {
      let assistantId: number | undefined
      let startedAt: number | undefined
      try {
        const conv = await db.conversations.get(conversationId)
        if (!conv) return { error: { kind: 'bad_request', message: '会话不存在' } }
        const provider = await getProvider(conv.providerPresetId)
        if (!provider) return { error: { kind: 'bad_request', message: '中转站未配置' } }

        const now = Date.now()
        let userImageBlobId: number | undefined
        if (editSourceMessageId != null) {
          const srcMsg = await db.messages.get(editSourceMessageId)
          userImageBlobId = srcMsg?.imageBlobId
        } else if (uploadBlob) {
          userImageBlobId = await addImage(uploadBlob, uploadBlob.type || 'image/png')
        }
        await addMessage({
          conversationId, role: 'user',
          kind: editSourceMessageId != null || uploadBlob ? 'image_edit_request' : 'text_prompt',
          prompt, size,
          imageBlobId: userImageBlobId,
          status: 'success', createdAt: now,
        })
        startedAt = now + 1
        assistantId = await addMessage({
          conversationId, role: 'assistant', kind: 'image_result',
          size, status: 'generating', createdAt: startedAt, startedAt,
        })
        await touchConversation(conversationId)

        let response
        if (uploadBlob) {
          response = await editImage(provider.baseUrl, provider.apiKey, prompt, uploadBlob, size, provider.corsProxy)
        } else if (editSourceMessageId != null) {
          const srcMsg = await db.messages.get(editSourceMessageId)
          if (!srcMsg?.imageBlobId) throw { kind: 'bad_request', message: '找不到参考图' }
          const img = await db.images.get(srcMsg.imageBlobId)
          if (!img) throw { kind: 'bad_request', message: '参考图丢失' }
          response = await editImage(provider.baseUrl, provider.apiKey, prompt, img.blob, size, provider.corsProxy)
        } else {
          response = await generateImage(provider.baseUrl, provider.apiKey, { prompt, size }, provider.corsProxy)
        }
        const b64 = response.data[0]?.b64_json
        if (!b64) throw { kind: 'content_filtered', message: '返回为空' }
        const blob = base64ToBlob(b64)
        const bid = await addImage(blob, 'image/png')
        await setMessageBlobId(assistantId, bid)
        await setMessageTiming(assistantId, startedAt, Date.now())
        await updateMessageStatus(assistantId, 'success')
        return { messageId: assistantId }
      } catch (e: unknown) {
        const err: ApiError = isApiError(e) ? e : parseNetworkError(e)
        if (assistantId != null) {
          try {
            await setMessageTiming(assistantId, startedAt, Date.now())
            await updateMessageStatus(assistantId, 'failed', err.kind)
          } catch { }
        }
        return { error: err }
      }
    }, []),
  }
}
