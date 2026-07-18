import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addProvider, countProviders, seedBuiltinProviders,
  addConversation, addMessage, updateMessageStatus, getMessage,
  addImage, setMessageBlobId, deleteConversation,
} from './repo'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('seedBuiltinProviders', () => {
  it('adds packy and runapi when empty', async () => {
    await seedBuiltinProviders()
    expect(await countProviders()).toBe(2)
  })

  it('does not duplicate when already seeded', async () => {
    await seedBuiltinProviders()
    await seedBuiltinProviders()
    expect(await countProviders()).toBe(2)
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