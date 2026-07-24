import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { Sidebar } from './Sidebar'

const { deleteConversationMock, toastMock } = vi.hoisted(() => ({
  deleteConversationMock: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock('@/lib/repo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repo')>()
  return {
    ...actual,
    deleteConversation: deleteConversationMock,
  }
})

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
}))

beforeAll(() => {
  if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      public pointerId: number
      public pointerType: string
      public isPrimary: boolean
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
        this.pointerType = init.pointerType ?? 'mouse'
        this.isPrimary = init.isPrimary ?? true
      }
    }
    ;(window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill
  }
})

function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

function swipe(row: HTMLElement, fromX: number, fromY: number, toX: number, toY: number) {
  fireEvent.pointerDown(row, { clientX: fromX, clientY: fromY, pointerId: 1 })
  fireEvent.pointerMove(row, { clientX: toX, clientY: toY, pointerId: 1 })
  fireEvent.pointerUp(row, { clientX: toX, clientY: toY, pointerId: 1 })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  deleteConversationMock.mockReset()
  deleteConversationMock.mockImplementation(async (id: number) => {
    await db.conversations.delete(id)
  })
  toastMock.mockReset()
})

it('renders empty state', () => {
  render(<Sidebar onSelect={() => {}} onNew={() => {}} hasConfiguredKey />)
  expect(screen.getByText('新建对话')).toBeInTheDocument()
})

it('lists conversations and calls onSelect on click', async () => {
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })
  await db.conversations.add({ title: 'Beta', createdAt: 0, updatedAt: 2, providerPresetId: pid })
  const onSelect = vi.fn()
  render(<Sidebar onSelect={onSelect} onNew={() => {}} />)
  expect(await screen.findByText('Alpha')).toBeInTheDocument()
  expect(screen.getByText('Beta')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Alpha'))
  expect(onSelect).toHaveBeenCalledWith(expect.any(Number))
})

it('renders new-chat as theme card with purple gradient', () => {
  const { container } = render(<Sidebar onSelect={() => {}} onNew={() => {}} hasConfiguredKey />)
  const card = screen.getByText('新建对话').closest('[data-card]')
  expect(card).toBeInTheDocument()
  expect(card).toHaveStyle({ backgroundImage: 'var(--gradient-purple)' })
})

it('shows amber left bar for conversations with generating messages', async () => {
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  await db.messages.add({
    conversationId: cid, role: 'assistant', prompt: 'x',
    status: 'generating', kind: 'image_generation', createdAt: Date.now(),
  })
  render(<Sidebar onSelect={() => {}} onNew={() => {}} activeId={cid} />)
  await vi.waitFor(() => {
    const item = screen.getByText('Alpha').closest('[data-conversation]')
    expect(item).toHaveStyle({ '--bar-color': 'var(--status-generating-bar)' })
  })
})

it('shows red left bar for conversations with failed messages', async () => {
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Fail', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  await db.messages.add({
    conversationId: cid, role: 'assistant', prompt: 'x',
    status: 'failed', kind: 'image_generation', createdAt: Date.now(),
  })
  render(<Sidebar onSelect={() => {}} onNew={() => {}} activeId={cid} />)
  await vi.waitFor(() => {
    const item = screen.getByText('Fail').closest('[data-conversation]')
    expect(item).toHaveStyle({ '--bar-color': 'var(--status-failed-bar)' })
  })
  const css = readFileSync(resolve(__dirname, '../styles/globals.css'), 'utf8')
  expect(css).toMatch(/--status-failed-bar:\s*linear-gradient/)
})

it('reveals the mobile delete action after a left swipe past the threshold', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  const row = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  expect(row).not.toBeNull()
  expect(screen.queryByTestId(`mobile-delete-${cid}`)).not.toBeInTheDocument()
  swipe(row, 220, 20, 140, 20)
  expect(screen.getByTestId(`mobile-delete-${cid}`)).toBeVisible()
})

it('keeps the mobile delete action hidden when the swipe is below the threshold', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  const row = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(row, 220, 20, 200, 20)
  expect(screen.queryByTestId(`mobile-delete-${cid}`)).not.toBeInTheDocument()
})

it('keeps the row closed when a vertical-dominant gesture is below the horizontal threshold', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  const row = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(row, 220, 20, 210, 80)
  expect(screen.queryByTestId(`mobile-delete-${cid}`)).not.toBeInTheDocument()
})

it('swiping a second row closes the first row', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid1 = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  const cid2 = (await db.conversations.add({ title: 'Beta', createdAt: 0, updatedAt: 2, providerPresetId: pid })) as number
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  const rowA = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(rowA, 220, 20, 140, 20)
  expect(screen.getByTestId(`mobile-delete-${cid1}`)).toBeVisible()

  const rowB = (await screen.findByText('Beta')).closest('[data-conversation]') as HTMLElement
  swipe(rowB, 220, 20, 140, 20)

  expect(screen.queryByTestId(`mobile-delete-${cid1}`)).not.toBeInTheDocument()
  expect(screen.getByTestId(`mobile-delete-${cid2}`)).toBeVisible()
})

it('synthesized click after a successful swipe does not immediately close the row', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  const row = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(row, 220, 20, 140, 20)
  fireEvent.click(row)
  expect(screen.getByTestId(`mobile-delete-${cid}`)).toBeVisible()
})

it('tapping an already-open row closes it without selecting the conversation', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  const onSelect = vi.fn()
  render(<Sidebar onSelect={onSelect} onNew={() => {}} />)
  const row = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(row, 220, 20, 140, 20)
  fireEvent.click(row)
  expect(screen.getByTestId(`mobile-delete-${cid}`)).toBeVisible()

  fireEvent.pointerDown(row, { clientX: 200, clientY: 20, pointerId: 3 })
  fireEvent.pointerUp(row, { clientX: 200, clientY: 20, pointerId: 3 })
  fireEvent.click(row)

  expect(screen.queryByTestId(`mobile-delete-${cid}`)).not.toBeInTheDocument()
  expect(onSelect).not.toHaveBeenCalled()
})

it('pointerdown outside the list closes an open row', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  const row = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(row, 220, 20, 140, 20)
  expect(screen.getByTestId(`mobile-delete-${cid}`)).toBeVisible()

  fireEvent.pointerDown(document.body, { clientX: 10, clientY: 400, pointerId: 7 })

  expect(screen.queryByTestId(`mobile-delete-${cid}`)).not.toBeInTheDocument()
})

it('mobile delete action deletes the conversation directly without a confirmation dialog', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  const row = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(row, 220, 20, 140, 20)

  await userEvent.click(screen.getByTestId(`mobile-delete-${cid}`))
  await vi.waitFor(async () => {
    expect(await db.conversations.get(cid)).toBeUndefined()
  })
  expect(screen.queryByText('删除对话？')).not.toBeInTheDocument()
})

it('surfaces a destructive toast when mobile delete fails', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  deleteConversationMock.mockRejectedValueOnce(new Error('boom'))
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  const row = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(row, 220, 20, 140, 20)

  await userEvent.click(screen.getByTestId(`mobile-delete-${cid}`))
  await vi.waitFor(() => {
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      title: '删除失败',
    }))
  })
  expect(await db.conversations.get(cid)).toBeDefined()
})

it('disables other mobile delete buttons while a deletion is in flight', async () => {
  setWindowWidth(500)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid1 = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  const cid2 = (await db.conversations.add({ title: 'Beta', createdAt: 0, updatedAt: 2, providerPresetId: pid })) as number

  let resolveFirst!: () => void
  const pending = new Promise<void>((resolve) => { resolveFirst = resolve })
  deleteConversationMock.mockImplementationOnce(() => pending)

  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)

  const rowA = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(rowA, 220, 20, 140, 20)
  await userEvent.click(screen.getByTestId(`mobile-delete-${cid1}`))

  const rowB = (await screen.findByText('Beta')).closest('[data-conversation]') as HTMLElement
  swipe(rowB, 220, 20, 140, 20)

  const secondDeleteButton = screen.getByTestId(`mobile-delete-${cid2}`)
  expect(secondDeleteButton).toBeDisabled()

  resolveFirst()
  await vi.waitFor(() => {
    expect(screen.getByTestId(`mobile-delete-${cid2}`)).not.toBeDisabled()
  })
})

it('does not respond to swipe gestures on desktop viewports', async () => {
  setWindowWidth(1024)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  const onSelect = vi.fn()
  render(<Sidebar onSelect={onSelect} onNew={() => {}} />)
  const row = (await screen.findByText('Alpha')).closest('[data-conversation]') as HTMLElement
  swipe(row, 220, 20, 140, 20)
  expect(screen.queryByTestId(`mobile-delete-${cid}`)).not.toBeInTheDocument()
  fireEvent.click(row)
  expect(onSelect).toHaveBeenCalledWith(cid)
})

it('PC delete button still opens the confirmation dialog', async () => {
  setWindowWidth(1024)
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  const cid = (await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })) as number
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  await screen.findByText('Alpha')

  await userEvent.click(screen.getByTestId(`delete-${cid}`))
  expect(await screen.findByText('删除对话？')).toBeInTheDocument()
  expect(await db.conversations.get(cid)).toBeDefined()
})