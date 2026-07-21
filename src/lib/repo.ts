import { db } from './db'
import type { ProviderPreset, Message, MessageStatus } from './db'
import { BUILTIN_PROVIDERS } from './api/providers'

export async function addProvider(p: Omit<ProviderPreset, 'id'>): Promise<number> {
  return db.providers.add(p)
}

export async function updateProvider(id: number, patch: Partial<ProviderPreset>): Promise<void> {
  await db.providers.update(id, patch)
}

export async function deleteProvider(id: number): Promise<void> {
  await db.providers.delete(id)
}

export async function getProvider(id: number): Promise<ProviderPreset | undefined> {
  return db.providers.get(id)
}

export async function countProviders(): Promise<number> {
  return db.providers.count()
}

export async function seedBuiltinProviders(): Promise<void> {
  await db.transaction('rw', db.providers, async () => {
    const existing = await db.providers.toArray()
    const have = new Set(existing.map((p) => p.type))
    const now = Date.now()
    if (!have.has('packy')) {
      await db.providers.add({
        name: BUILTIN_PROVIDERS.packy.name,
        baseUrl: BUILTIN_PROVIDERS.packy.baseUrl,
        apiKey: '', type: 'packy', isBuiltIn: 1, createdAt: now,
      })
    }
    if (!have.has('runapi')) {
      await db.providers.add({
        name: BUILTIN_PROVIDERS.runapi.name,
        baseUrl: BUILTIN_PROVIDERS.runapi.baseUrl,
        apiKey: '', type: 'runapi', isBuiltIn: 1, createdAt: now + 1,
      })
    }
    if (!have.has('uuapi')) {
      await db.providers.add({
        name: BUILTIN_PROVIDERS.uuapi.name,
        baseUrl: BUILTIN_PROVIDERS.uuapi.baseUrl,
        apiKey: '', type: 'uuapi', isBuiltIn: 1, createdAt: now + 2,
      })
    }
  })
}

export async function dedupeProviders(): Promise<number> {
  return db.transaction('rw', db.providers, async () => {
    const all = await db.providers.toArray()
    const seen = new Map<string, ProviderPreset>()
    const toDelete: number[] = []
    all.sort((a, b) => {
      const ak = a.apiKey.length > 0 ? 0 : 1
      const bk = b.apiKey.length > 0 ? 0 : 1
      if (ak !== bk) return ak - bk
      return (a.id ?? 0) - (b.id ?? 0)
    })
    for (const p of all) {
      const key = (p.type === 'packy' || p.type === 'runapi' || p.type === 'uuapi')
        ? `builtin:${p.type}`
        : `custom:${p.baseUrl}`
      if (seen.has(key)) {
        toDelete.push(p.id!)
      } else {
        seen.set(key, p)
      }
    }
    if (toDelete.length > 0) await db.providers.bulkDelete(toDelete)
    return toDelete.length
  })
}

export async function addConversation(providerPresetId: number, title = '新对话'): Promise<number> {
  const now = Date.now()
  return db.conversations.add({ title, createdAt: now, updatedAt: now, providerPresetId })
}

export async function renameConversation(id: number, title: string): Promise<void> {
  await db.conversations.update(id, { title, updatedAt: Date.now() })
}

export async function touchConversation(id: number): Promise<void> {
  await db.conversations.update(id, { updatedAt: Date.now() })
}

export async function deleteConversation(id: number): Promise<void> {
  const msgs = await db.messages.where('conversationId').equals(id).toArray()
  const blobIds = msgs.map((m) => m.imageBlobId).filter((x): x is number => x != null)
  if (blobIds.length > 0) await db.images.bulkDelete(blobIds)
  await db.messages.where('conversationId').equals(id).delete()
  await db.conversations.delete(id)
}

export async function setConversationProvider(id: number, providerPresetId: number): Promise<void> {
  await db.conversations.update(id, { providerPresetId, updatedAt: Date.now() })
}

export async function addMessage(m: Omit<Message, 'id'>): Promise<number> {
  const id = await db.messages.add(m)
  // Auto-name conversation from first user prompt
  if (m.role === 'user' && (m.kind === 'text_prompt' || m.kind === 'image_edit_request') && m.prompt) {
    const conv = await db.conversations.get(m.conversationId)
    if (conv?.title === '新对话') {
      await db.conversations.update(m.conversationId, {
        title: m.prompt.trim().slice(0, 20),
        updatedAt: Date.now(),
      })
    } else {
      await db.conversations.update(m.conversationId, { updatedAt: Date.now() })
    }
  }
  return id
}

export async function updateMessageStatus(id: number, status: MessageStatus, errorCode?: string): Promise<void> {
  await db.messages.update(id, { status, errorCode })
}

export async function setMessageBlobId(id: number, blobId: number): Promise<void> {
  await db.messages.update(id, { imageBlobId: blobId })
}

export async function setMessageRemoteUrl(id: number, url: string): Promise<void> {
  await db.messages.update(id, { remoteImageUrl: url })
}

export async function setMessagePrompt(id: number, prompt: string): Promise<void> {
  await db.messages.update(id, { prompt })
}

export async function getMessage(id: number): Promise<Message | undefined> {
  return db.messages.get(id)
}

export async function addImage(blob: Blob, mimeType: string): Promise<number> {
  return db.images.add({ blob, mimeType, createdAt: Date.now() })
}

/**
 * Sweep all `generating` messages that are older than `staleMs` and mark
 * them `failed/timeout`. Scoped globally (not per-conversation) so that
 * a tab which was closed mid-request on conversation A still gets
 * cleaned up the next time the user opens the app at all.
 *
 * Used by HomePage on mount. The per-conversation check inside
 * ChatView (5-min stale sweep on messages-change) is kept as a fast
 * path while you're actively browsing a conversation.
 */
export async function markStaleGeneratingAsFailed(staleMs: number): Promise<number> {
  const cutoff = Date.now() - staleMs
  const stale = await db.messages
    .where('status').equals('generating')
    .and((m) => m.createdAt < cutoff)
    .toArray()
  for (const m of stale) {
    if (m.id != null) {
      await db.messages.update(m.id, {
        status: 'failed',
        errorCode: 'timeout',
        completedAt: Date.now(),
      })
    }
  }
  return stale.length
}