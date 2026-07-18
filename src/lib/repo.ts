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
  await db.messages.where('conversationId').equals(id).delete()
  await db.conversations.delete(id)
}

export async function setConversationProvider(id: number, providerPresetId: number): Promise<void> {
  await db.conversations.update(id, { providerPresetId, updatedAt: Date.now() })
}

export async function addMessage(m: Omit<Message, 'id'>): Promise<number> {
  return db.messages.add(m)
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