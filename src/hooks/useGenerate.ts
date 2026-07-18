import { useCallback } from 'react'
import { db } from '@/lib/db'
import { getProvider, addMessage, updateMessageStatus, setMessageBlobId, setMessageRemoteUrl, addImage, touchConversation, setMessagePrompt } from '@/lib/repo'
import { generateImage, editImage } from '@/lib/api/client'
import type { ApiError } from '@/lib/api/errors'
import { parseNetworkError } from '@/lib/api/errors'

interface Success { messageId: number }
interface Failure { error: ApiError }
export type GenerateResult = Success | Failure

export function useGenerate() {
  return {
    generate: useCallback(async (
      conversationId: number,
      prompt: string,
      size: string,
      editSourceMessageId?: number,
    ): Promise<GenerateResult> => {
      let assistantId: number | undefined
      try {
        const conv = await db.conversations.get(conversationId)
        if (!conv) return { error: { kind: 'bad_request', message: '会话不存在' } }
        const provider = await getProvider(conv.providerPresetId)
        if (!provider) return { error: { kind: 'bad_request', message: '中转站未配置' } }

        const now = Date.now()
        const userMsgId = await addMessage({
          conversationId, role: 'user',
          kind: editSourceMessageId != null ? 'image_edit_request' : 'text_prompt',
          prompt, size, status: 'success', createdAt: now,
        })
        if (editSourceMessageId != null) await setMessagePrompt(userMsgId, prompt)
        assistantId = await addMessage({
          conversationId, role: 'assistant', kind: 'image_result',
          size, status: 'generating', createdAt: now + 1,
        })
        await touchConversation(conversationId)

        const url = await fetchImageUrl(provider.baseUrl, provider.apiKey, prompt, size, editSourceMessageId)
        await setMessageRemoteUrl(assistantId, url)
        try {
          const r = await fetch(url)
          if (r.ok) {
            const blob = await r.blob()
            const bid = await addImage(blob, blob.type || 'image/png')
            await setMessageBlobId(assistantId, bid)
          }
        } catch { /* keep remoteUrl as fallback */ }
        await updateMessageStatus(assistantId, 'success')
        return { messageId: assistantId }
      } catch (e: any) {
        const err: ApiError = e?.kind ? e : parseNetworkError(e)
        if (assistantId != null) {
          try { await updateMessageStatus(assistantId, 'failed', String((err as any).kind ?? 'unknown')) } catch { /* best-effort */ }
        }
        return { error: err }
      }
    }, []),
  }
}

async function fetchImageUrl(
  baseUrl: string,
  apiKey: string,
  prompt: string,
  size: string,
  editSourceMessageId: number | undefined,
): Promise<string> {
  let res
  if (editSourceMessageId != null) {
    const srcMsg = await db.messages.get(editSourceMessageId)
    if (!srcMsg?.imageBlobId) throw { kind: 'bad_request', message: '找不到参考图' }
    const img = await db.images.get(srcMsg.imageBlobId)
    if (!img) throw { kind: 'bad_request', message: '参考图丢失' }
    res = await editImage(baseUrl, apiKey, prompt, img.blob, size)
  } else {
    res = await generateImage(baseUrl, apiKey, { prompt, size })
  }
  const url = res.data[0]?.url
  if (!url) throw { kind: 'content_filtered', message: '返回为空' }
  return url
}
