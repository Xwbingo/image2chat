import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '@/lib/db'
import { useMessages } from './useMessages'

beforeEach(async () => { await db.delete(); await db.open() })

it('returns messages for a conversation reactively', async () => {
  await db.messages.add({ conversationId: 1, role: 'user', kind: 'text_prompt', prompt: 'hi', status: 'success', createdAt: 1 })
  const { result } = renderHook(() => useMessages(1))
  await waitFor(() => { expect(result.current).toHaveLength(1) })
  await db.messages.add({ conversationId: 1, role: 'assistant', kind: 'image_result', status: 'success', createdAt: 2 })
  await waitFor(() => { expect(result.current).toHaveLength(2) })
})

it('returns empty array when conversationId is undefined', () => {
  const { result } = renderHook(() => useMessages(undefined))
  expect(result.current).toEqual([])
})