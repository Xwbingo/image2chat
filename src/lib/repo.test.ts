import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addProvider, countProviders, seedBuiltinProviders, dedupeProviders,
  addConversation, addMessage, updateMessageStatus, getMessage,
  addImage, setMessageBlobId, deleteConversation,
  markStaleGeneratingAsFailed,
} from './repo'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('dedupeProviders', () => {
  it('removes duplicate rows sharing the same baseUrl and name, keeping the one with the apiKey', async () => {
    await db.providers.bulkAdd([
      { name: 'Packy', baseUrl: 'https://www.packyapi.com', apiKey: '',     type: 'packy', isBuiltIn: 1, createdAt: 1 },
      { name: 'Packy', baseUrl: 'https://www.packyapi.com', apiKey: 'sk-1', type: 'packy', isBuiltIn: 1, createdAt: 2 },
      { name: 'Packy', baseUrl: 'https://www.packyapi.com', apiKey: 'sk-2', type: 'packy', isBuiltIn: 1, createdAt: 3 },
    ])
    const removed = await dedupeProviders()
    expect(removed).toBe(2)
    const remaining = await db.providers.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].apiKey).toBe('sk-1')
  })

  it('keeps both providers when baseUrl+name differ', async () => {
    await db.providers.bulkAdd([
      { name: 'Packy',  baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy',  isBuiltIn: 1, createdAt: 1 },
      { name: 'RunAPI', baseUrl: 'https://runapi.co',        apiKey: 'k', type: 'runapi', isBuiltIn: 1, createdAt: 2 },
    ])
    const removed = await dedupeProviders()
    expect(removed).toBe(0)
    expect(await countProviders()).toBe(2)
  })
})

describe('seedBuiltinProviders', () => {
  it('adds packy, runapi, and uuapi when empty', async () => {
    await seedBuiltinProviders()
    expect(await countProviders()).toBe(3)
  })

  it('does not duplicate when already seeded', async () => {
    await seedBuiltinProviders()
    await seedBuiltinProviders()
    expect(await countProviders()).toBe(3)
  })
})

describe('messages', () => {
  it('updates status and errorCode', async () => {
    const pid = await addProvider({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
    const cid = await addConversation(pid)
    const mid = await addMessage({ conversationId: cid, role: 'assistant', kind: 'image_result', size: '2048x1152', status: 'generating', createdAt: 0 })
    await updateMessageStatus(mid, 'failed', '401')
    const m = await getMessage(mid)
    expect(m?.status).toBe('failed')
    expect(m?.errorCode).toBe('401')
  })

  it('names a new conversation from its first user prompt', async () => {
    const pid = await addProvider({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
    const cid = await addConversation(pid)
    await addMessage({ conversationId: cid, role: 'user', kind: 'text_prompt', prompt: '  a prompt that is longer than twenty chars  ', status: 'success', createdAt: 0 })
    const conversation = await db.conversations.get(cid)
    expect(conversation?.title).toBe('a prompt that is lon')
    await addMessage({ conversationId: cid, role: 'user', kind: 'text_prompt', prompt: 'second prompt', status: 'success', createdAt: 1 })
    expect((await db.conversations.get(cid))?.title).toBe('a prompt that is lon')
  })

  it('names a new conversation from its first image edit request', async () => {
    const pid = await addProvider({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
    const cid = await addConversation(pid)
    await addMessage({ conversationId: cid, role: 'user', kind: 'image_edit_request', prompt: '  make this image warmer  ', status: 'success', createdAt: 0 })
    expect((await db.conversations.get(cid))?.title).toBe('make this image warm')
  })

  it('binds image blob', async () => {
    const pid = await addProvider({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
    const cid = await addConversation(pid)
    const mid = await addMessage({ conversationId: cid, role: 'assistant', kind: 'image_result', size: '2048x1152', status: 'success', createdAt: 0 })
    const bid = await addImage(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'image/png')
    await setMessageBlobId(mid, bid)
    const m = await getMessage(mid)
    expect(m?.imageBlobId).toBe(bid)
  })
})

describe('deleteConversation', () => {
  it('cascades to messages', async () => {
    const pid = await addProvider({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
    const cid = await addConversation(pid)
    await addMessage({ conversationId: cid, role: 'user', kind: 'text_prompt', prompt: 'x', status: 'success', createdAt: 0 })
    await deleteConversation(cid)
    const remaining = await db.messages.where('conversationId').equals(cid).toArray()
    expect(remaining).toEqual([])
  })
})

describe('markStaleGeneratingAsFailed', () => {
  it('marks stale generating messages as failed across all conversations', async () => {
    const pid = await addProvider({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
    const cidA = await addConversation(pid)
    const cidB = await addConversation(pid)
    const now = Date.now()
    const staleA = await addMessage({ conversationId: cidA, role: 'assistant', kind: 'image_result', size: '2048x1152', status: 'generating', createdAt: now - 10 * 60 * 1000, startedAt: now - 10 * 60 * 1000 })
    const freshA = await addMessage({ conversationId: cidA, role: 'assistant', kind: 'image_result', size: '2048x1152', status: 'generating', createdAt: now, startedAt: now })
    const staleB = await addMessage({ conversationId: cidB, role: 'assistant', kind: 'image_result', size: '1024x1024', status: 'generating', createdAt: now - 10 * 60 * 1000, startedAt: now - 10 * 60 * 1000 })
    const succeeded = await addMessage({ conversationId: cidA, role: 'assistant', kind: 'image_result', size: '1024x1024', status: 'success', createdAt: now - 10 * 60 * 1000, completedAt: now - 9 * 60 * 1000 })

    const swept = await markStaleGeneratingAsFailed(5 * 60 * 1000)
    expect(swept).toBe(2)

    const afterStale = await getMessage(staleA)
    expect(afterStale?.status).toBe('failed')
    expect(afterStale?.errorCode).toBe('timeout')
    expect(afterStale?.completedAt).toBeGreaterThan(0)

    const afterFresh = await getMessage(freshA)
    expect(afterFresh?.status).toBe('generating')

    const afterStaleB = await getMessage(staleB)
    expect(afterStaleB?.status).toBe('failed')

    const afterSucceeded = await getMessage(succeeded)
    expect(afterSucceeded?.status).toBe('success')
  })

  it('returns 0 when there is nothing to sweep', async () => {
    const swept = await markStaleGeneratingAsFailed(5 * 60 * 1000)
    expect(swept).toBe(0)
  })
})