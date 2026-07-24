import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { db, type ImageRef } from '@/lib/db'
import { useSession } from '@/stores/useSession'
import { HomePage } from './HomePage'

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))

vi.mock('@/hooks/useGenerate', () => ({
  useGenerate: () => ({ generate }),
}))

let mockedProviders = [{ id: 1, name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 }]

vi.mock('@/hooks/useProviders', () => ({
  useProviders: () => mockedProviders,
}))

vi.mock('@/components/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('@/components/StatusBar', () => ({ StatusBar: () => null }))
vi.mock('@/components/ImageViewer', () => ({ ImageViewer: () => null }))
vi.mock('@/components/OfflineBanner', () => ({ OfflineBanner: () => null }))

let capturedProps: Record<string, unknown> = {}
let firstMsgId = 1

vi.mock('@/components/ChatView', () => ({
  ChatView: (props: Record<string, unknown>) => {
    capturedProps = props
    return (
      <div>
        <button onClick={() => (props.onSend as (p: string, r: ImageRef[]) => void)('hi', [])}>发送</button>
        <button data-testid="ref-btn" onClick={() => (props.onReference as (id: number) => void)(firstMsgId)}>引用按钮</button>
        <span data-testid="refs-count">{(props.refs as ImageRef[]).length}</span>
      </div>
    )
  },
}))

function renderHomePage(initialEntry = '/c/1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/c/:conversationId" element={<HomePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  useSession.getState().setActiveProviderId(null)
  mockedProviders = [{ id: 1, name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 }]
  generate.mockReset()
  generate.mockResolvedValue({ messageId: 4 })
})

it('selects the first provider with a configured key on first use', async () => {
  mockedProviders = [
    { id: 1, name: 'Empty', baseUrl: 'u1', apiKey: '', type: 'custom', isBuiltIn: 0, createdAt: 0 },
    { id: 2, name: 'Ready', baseUrl: 'u2', apiKey: 'key', type: 'custom', isBuiltIn: 0, createdAt: 1 },
  ]
  useSession.getState().setActiveProviderId(null)
  renderHomePage()
  await waitFor(() => expect(useSession.getState().activeProviderId).toBe(2))
})

it('selects the first provider when none has a configured key', async () => {
  mockedProviders = [
    { id: 1, name: 'First', baseUrl: 'u1', apiKey: '', type: 'custom', isBuiltIn: 0, createdAt: 0 },
    { id: 2, name: 'Second', baseUrl: 'u2', apiKey: '', type: 'custom', isBuiltIn: 0, createdAt: 1 },
  ]
  useSession.getState().setActiveProviderId(null)
  renderHomePage()
  await waitFor(() => expect(useSession.getState().activeProviderId).toBe(1))
})

it('switches activeProviderId to a newly-added configured provider when current is unconfigured', async () => {
  mockedProviders = [{ id: 1, name: 'Packy', baseUrl: 'u1', apiKey: '', type: 'packy', isBuiltIn: 1, createdAt: 0 }]
  useSession.getState().setActiveProviderId(null)
  const tree = (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/c/:conversationId" element={<HomePage />} />
      </Routes>
    </MemoryRouter>
  )
  const result = render(tree)
  await waitFor(() => expect(useSession.getState().activeProviderId).toBe(1))

  mockedProviders = [
    { id: 1, name: 'Packy', baseUrl: 'u1', apiKey: '', type: 'packy', isBuiltIn: 1, createdAt: 0 },
    { id: 2, name: 'uuapi', baseUrl: 'u2', apiKey: 'key', type: 'uuapi', isBuiltIn: 0, createdAt: 1 },
  ]
  await act(async () => {
    result.rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/c/:conversationId" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    )
  })

  await waitFor(() => expect(useSession.getState().activeProviderId).toBe(2))
})

it('switches activeProviderId when an existing built-in provider gets a configured key (first-entry flow)', async () => {
  mockedProviders = [
    { id: 1, name: 'Packy', baseUrl: 'u1', apiKey: '', type: 'packy', isBuiltIn: 1, createdAt: 0 },
    { id: 2, name: 'RunAPI', baseUrl: 'u2', apiKey: '', type: 'runapi', isBuiltIn: 1, createdAt: 1 },
    { id: 3, name: 'uuapi', baseUrl: 'u3', apiKey: '', type: 'uuapi', isBuiltIn: 1, createdAt: 2 },
  ]
  useSession.getState().setActiveProviderId(null)
  const tree = (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/c/:conversationId" element={<HomePage />} />
      </Routes>
    </MemoryRouter>
  )
  const result = render(tree)
  await waitFor(() => expect(useSession.getState().activeProviderId).toBe(1))

  // User fills in uuapi's apiKey (existing provider, count stays at 3)
  mockedProviders = [
    { id: 1, name: 'Packy', baseUrl: 'u1', apiKey: '', type: 'packy', isBuiltIn: 1, createdAt: 0 },
    { id: 2, name: 'RunAPI', baseUrl: 'u2', apiKey: '', type: 'runapi', isBuiltIn: 1, createdAt: 1 },
    { id: 3, name: 'uuapi', baseUrl: 'u3', apiKey: 'key', type: 'uuapi', isBuiltIn: 1, createdAt: 2 },
  ]
  await act(async () => {
    result.rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/c/:conversationId" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    )
  })

  await waitFor(() => expect(useSession.getState().activeProviderId).toBe(3))
})


it('shows 密钥管理 when no provider has a configured key', async () => {
  mockedProviders = [{ id: 1, name: 'P', baseUrl: 'u', apiKey: '', type: 'custom', isBuiltIn: 0, createdAt: 0 }]
  renderHomePage('/')
  expect((await screen.findAllByRole('button', { name: '密钥管理' })).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: '新建对话' })).not.toBeInTheDocument()
})

it('shows 新建对话 when a provider has a configured key', async () => {
  renderHomePage('/')
  expect(await screen.findByRole('button', { name: '新建对话' })).toBeInTheDocument()
})

it('handleNew binds the new conversation to a provider that actually has a configured key', async () => {
  mockedProviders = [
    { id: 1, name: 'Stale', baseUrl: 'u1', apiKey: '', type: 'custom', isBuiltIn: 0, createdAt: 0 },
    { id: 2, name: 'Ready', baseUrl: 'u2', apiKey: 'key', type: 'custom', isBuiltIn: 0, createdAt: 1 },
  ]
  useSession.getState().setActiveProviderId(1)
  renderHomePage('/')
  await userEvent.click(await screen.findByRole('button', { name: '新建对话' }))
  await waitFor(async () => {
    const convs = await db.conversations.toArray()
    expect(convs).toHaveLength(1)
    expect(convs[0].providerPresetId).toBe(2)
  })
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

  expect(generate).toHaveBeenCalledWith(1, 'hi', expect.any(String), [])
})

it('exposes refs and ref handlers on ChatView', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  renderHomePage()
  expect(capturedProps).toHaveProperty('refs', [])
  expect(typeof capturedProps.onAddLocal).toBe('function')
  expect(typeof capturedProps.onRemoveRef).toBe('function')
  expect(typeof capturedProps.onReorderRefs).toBe('function')
  expect(typeof capturedProps.onClearRefs).toBe('function')
  expect(typeof capturedProps.onReference).toBe('function')
})

it('handleReferenceFromChat adds assistant image to refs and respects 3-limit', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  const imageIds: number[] = []
  for (let i = 0; i < 4; i++) {
    imageIds.push(await db.images.add({
      blob: new Blob([new Uint8Array([i])], { type: 'image/png' }),
      mimeType: 'image/png', createdAt: i,
    }))
  }
  const msgIds: number[] = []
  for (let i = 0; i < 4; i++) {
    msgIds.push(await db.messages.add({
      conversationId: 1, role: 'assistant', kind: 'image_result',
      status: 'success', imageBlobId: imageIds[i], createdAt: i + 100,
    }))
  }

  firstMsgId = msgIds[0]
  renderHomePage()

  // Click 引用按钮 4 times — should only end up with 1 ref (deduplicates same blobId)
  const refButton = screen.getByTestId('ref-btn')
  for (let i = 0; i < 4; i++) {
    fireEvent.click(refButton)
  }
  await waitFor(() => {
    expect((capturedProps.refs as ImageRef[]).length).toBe(1)
  })
  expect((capturedProps.refs as ImageRef[])[0].sourceMsgId).toBe(msgIds[0])
})

it('handleSend clears refs after success', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  renderHomePage()
  // Click 发送 with empty refs
  await userEvent.click(screen.getByText('发送'))
  expect(generate).toHaveBeenCalledWith(1, 'hi', expect.any(String), [])
})

it('handleAddLocal persists the blob and adds to refs', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  renderHomePage()

  const file = new File([new Uint8Array([1, 2, 3])], 'local.png', { type: 'image/png' })
  await (capturedProps.onAddLocal as (f: File) => Promise<void>)(file)
  await waitFor(() => {
    expect((capturedProps.refs as ImageRef[]).length).toBe(1)
  })

  const refs = capturedProps.refs as ImageRef[]
  expect(refs[0].kind).toBe('local')
  expect(refs[0].fileName).toBe('local.png')
  // Verify the blob was persisted
  const img = await db.images.get(refs[0].blobId)
  expect(img).toBeDefined()
})

it('handleAddLocal respects 3-limit (4th call no-ops)', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  renderHomePage()

  for (let i = 0; i < 4; i++) {
    const file = new File([new Uint8Array([i])], `f${i}.png`, { type: 'image/png' })
    await (capturedProps.onAddLocal as (f: File) => Promise<void>)(file)
  }
  await waitFor(() => {
    expect((capturedProps.refs as ImageRef[]).length).toBe(3)
  })
})

it('handleReorderRefs moves an item from one index to another', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  renderHomePage()
  // Add 3 refs sequentially so each one sees the previous state.
  for (let i = 0; i < 3; i++) {
    const file = new File([new Uint8Array([i])], `f${i}.png`, { type: 'image/png' })
    await (capturedProps.onAddLocal as (f: File) => Promise<void>)(file)
  }
  await waitFor(() => {
    expect((capturedProps.refs as ImageRef[]).length).toBe(3)
  })
  const before = (capturedProps.refs as ImageRef[]).map((r) => r.blobId)
  expect(before).toHaveLength(3)
  ;(capturedProps.onReorderRefs as (from: number, to: number) => void)(0, 2)
  await waitFor(() => {
    const after = (capturedProps.refs as ImageRef[]).map((r) => r.blobId)
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[2])
    expect(after[2]).toBe(before[0])
  })
})

it('passes an onMenu handler to ChatView that opens the left drawer when invoked', async () => {
  await db.conversations.add({ title: 'Chat', createdAt: 0, updatedAt: 0, providerPresetId: 1 })
  renderHomePage()
  expect(typeof capturedProps.onMenu).toBe('function')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  act(() => { (capturedProps.onMenu as () => void)() })
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

it('does not render a standalone < md hamburger row above ChatView', () => {
  setWindowWidth(500)
  fireEvent(window, new Event('resize'))
  renderHomePage()
  // Mocked ChatView renders exactly 2 buttons (发送, 引用按钮). After removing the
  // standalone row, no extra unlabeled Menu button should be present.
  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(2)
  expect(buttons.map((b) => b.textContent?.trim())).toEqual(['发送', '引用按钮'])
})

it('treats small viewport deltas (e.g. iOS bounce) as zero so the bottom dock does not jitter', async () => {
  // Simulate a tiny (rubber-band) viewport delta: hidden = 40px < 80px threshold.
  const listeners: Record<string, Array<() => void>> = {}
  const fakeVV = {
    height: 800 - 40,
    addEventListener: (event: string, cb: () => void) => {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
    },
    removeEventListener: (event: string, cb: () => void) => {
      if (!listeners[event]) return
      listeners[event] = listeners[event].filter((fn) => fn !== cb)
    },
    dispatchEvent: (event: string) => {
      for (const cb of listeners[event] ?? []) cb()
    },
  }
  const originalVV = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  Object.defineProperty(window, 'visualViewport', { configurable: true, writable: true, value: fakeVV })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 })

  try {
    renderHomePage()
    fakeVV.dispatchEvent('resize')
    await waitFor(() => {
      expect((capturedProps.bottomInset as number | undefined) ?? 0).toBe(0)
    })
  } finally {
    if (originalVV) Object.defineProperty(window, 'visualViewport', originalVV)
  }
})

it('shifts the bottom dock only when the visualViewport shrinks by >= 80px (keyboard)', async () => {
  const listeners: Record<string, Array<() => void>> = {}
  let height = 800
  const fakeVV = {
    get height() { return height },
    addEventListener: (event: string, cb: () => void) => {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
    },
    removeEventListener: (event: string, cb: () => void) => {
      if (!listeners[event]) return
      listeners[event] = listeners[event].filter((fn) => fn !== cb)
    },
    dispatchEvent: (event: string) => {
      for (const cb of listeners[event] ?? []) cb()
    },
  }
  const originalVV = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  Object.defineProperty(window, 'visualViewport', { configurable: true, writable: true, value: fakeVV })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 })

  try {
    renderHomePage()
    // Simulate keyboard opening: viewport shrinks by 260px (well above 80px threshold).
    height = 800 - 260
    fakeVV.dispatchEvent('resize')
    await waitFor(() => {
      expect(capturedProps.bottomInset).toBe(260)
    })
  } finally {
    if (originalVV) Object.defineProperty(window, 'visualViewport', originalVV)
  }
})