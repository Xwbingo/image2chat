import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { useSession } from '@/stores/useSession'
import { HomePage } from './HomePage'

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))

vi.mock('@/hooks/useGenerate', () => ({
  useGenerate: () => ({ generate }),
}))

vi.mock('@/hooks/useProviders', () => ({
  useProviders: () => [{ id: 1, name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 }],
}))

vi.mock('@/components/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('@/components/StatusBar', () => ({ StatusBar: () => null }))
vi.mock('@/components/ImageViewer', () => ({ ImageViewer: () => null }))
vi.mock('@/components/OfflineBanner', () => ({ OfflineBanner: () => null }))
vi.mock('@/components/ChatView', () => ({
  ChatView: ({ onRetry }: { onRetry: (msgId: number) => void }) => (
    <button onClick={() => onRetry(3)}>重试消息</button>
  ),
}))

function renderHomePage() {
  return render(
    <MemoryRouter initialEntries={['/c/1']}>
      <Routes>
        <Route path="/c/:conversationId" element={<HomePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  useSession.getState().setActiveProviderId(null)
  generate.mockReset()
  generate.mockResolvedValue({ messageId: 4 })
})

it('retries with the preceding user prompt when the assistant has no prompt', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  await db.messages.bulkAdd([
    { id: 2, conversationId: 1, role: 'user', kind: 'text_prompt', prompt: 'draw a cat', size: '2048x1152', status: 'success', createdAt: 10 },
    { id: 3, conversationId: 1, role: 'assistant', kind: 'image_result', size: '1024x1024', status: 'failed', createdAt: 11 },
  ])

  renderHomePage()
  await userEvent.click(screen.getByText('重试消息'))

  await waitFor(() => expect(generate).toHaveBeenCalledWith(1, 'draw a cat', '1024x1024', undefined, undefined))
})

it('retries an edit request with the preceding assistant image', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  await db.messages.bulkAdd([
    { id: 1, conversationId: 1, role: 'assistant', kind: 'image_result', imageBlobId: 77, status: 'success', createdAt: 10 },
    { id: 2, conversationId: 1, role: 'user', kind: 'image_edit_request', prompt: 'make it blue', size: '2048x2048', status: 'success', createdAt: 11 },
    { id: 3, conversationId: 1, role: 'assistant', kind: 'image_result', size: '2048x2048', status: 'failed', createdAt: 12 },
  ])

  renderHomePage()
  await userEvent.click(screen.getByText('重试消息'))

  await waitFor(() => expect(generate).toHaveBeenCalledWith(1, 'make it blue', '2048x2048', 1, undefined))
})
