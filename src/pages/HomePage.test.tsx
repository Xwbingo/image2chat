import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
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
  ChatView: ({ onSend }: { onSend: (prompt: string, opts?: { size?: string }) => void }) => (
    <button onClick={() => onSend('hi', { size: '1024x1024' })}>发送</button>
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

it('does not render a retry button on the failed assistant bubble', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  await db.messages.bulkAdd([
    { id: 2, conversationId: 1, role: 'user', kind: 'text_prompt', prompt: 'draw a cat', size: '2048x1152', status: 'success', createdAt: 10 },
    { id: 3, conversationId: 1, role: 'assistant', kind: 'image_result', size: '1024x1024', status: 'failed', errorCode: '500', createdAt: 11 },
  ])

  renderHomePage()

  expect(screen.queryByText('重试')).not.toBeInTheDocument()
  expect(screen.queryByText('去设置')).not.toBeInTheDocument()
})

it('sends a new prompt through the wired ChatView onSend handler', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })

  renderHomePage()
  await userEvent.click(screen.getByText('发送'))

  expect(generate).toHaveBeenCalledWith(1, 'hi', '1024x1024', undefined, undefined)
})