import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('db schema', () => {
  it('stores and retrieves a provider', async () => {
    const id = await db.providers.add({
      name: 'Packy', baseUrl: 'https://www.packyapi.com',
      apiKey: 'sk-x', type: 'packy', isBuiltIn: 1, createdAt: Date.now(),
    })
    const p = await db.providers.get(id)
    expect(p?.name).toBe('Packy')
  })

  it('stores and retrieves a conversation', async () => {
    const pid = await db.providers.add({
      name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0,
    })
    const cid = await db.conversations.add({
      title: 't', createdAt: 0, updatedAt: 0, providerPresetId: pid,
    })
    const c = await db.conversations.get(cid)
    expect(c?.title).toBe('t')
  })
})
