import 'fake-indexeddb/auto'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { MessageBubble } from './MessageBubble'

beforeEach(async () => { await db.delete(); await db.open() })

it('renders user text prompt', () => {
  render(
    <MessageBubble
      message={{ id: 1, conversationId: 1, role: 'user', kind: 'text_prompt', prompt: 'hello', status: 'success', createdAt: 0 }}
      onImageClick={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )
  expect(screen.getByText('hello')).toBeInTheDocument()
})

it('shows the referenced image in an edit request bubble', async () => {
  const blobId = await db.images.add({
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    mimeType: 'image/png',
    createdAt: 0,
  })
  render(
    <MessageBubble
      message={{ id: 7, conversationId: 1, role: 'user', kind: 'image_edit_request', prompt: 'make it blue', imageBlobId: blobId, status: 'success', createdAt: 0 }}
      onImageClick={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )

  expect(await screen.findByAltText('引用图')).toBeInTheDocument()
  expect(screen.getByText('本地图片')).toBeInTheDocument()
})

it('renders generating placeholder for assistant with status generating', () => {
  render(
    <MessageBubble
      message={{ id: 1, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'generating', createdAt: 0 }}
      onImageClick={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )
  expect(screen.getByText(/正在创作/i)).toBeInTheDocument()
})

it('renders failed state with retry button', async () => {
  const onRetry = vi.fn()
  render(
    <MessageBubble
      message={{ id: 5, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'failed', errorCode: '500', createdAt: 0 }}
      onImageClick={() => {}}
      onRetry={onRetry}
      onEdit={() => {}}
    />,
  )
  expect(screen.getByText(/服务异常/i)).toBeInTheDocument()
  await userEvent.click(screen.getByText('重试'))
  expect(onRetry).toHaveBeenCalledWith(5)
})

it('uses remote fallback for image actions when blob is missing', async () => {
  const onRemoteClick = vi.fn()
  const { container } = render(
    <MessageBubble
      message={{ id: 6, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'success', remoteImageUrl: 'https://cdn/image.png', createdAt: 0 }}
      onImageClick={() => {}}
      onRemoteClick={onRemoteClick}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )
  await userEvent.click(container.querySelector('img')!)
  await userEvent.click(screen.getByText('查看'))
  expect(onRemoteClick).toHaveBeenCalledTimes(2)
})

it('renders 去设置 button for 401', () => {
  render(
    <MessageBubble
      message={{ id: 5, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'failed', errorCode: '401', createdAt: 0 }}
      onImageClick={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )
  expect(screen.getByText('去设置')).toBeInTheDocument()
})

it('shows assistant timing metadata when startedAt + completedAt are set', () => {
  render(
    <MessageBubble
      message={{
        id: 9, conversationId: 1, role: 'assistant', kind: 'image_result',
        size: '1024x1024', status: 'success', createdAt: 1000,
        startedAt: 1000, completedAt: 1000 + 8000,
      }}
      onImageClick={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )
  expect(screen.getByText('1024x1024')).toBeInTheDocument()
  expect(screen.getByText('耗时 8 秒')).toBeInTheDocument()
})

it('shows user message clock timestamp', () => {
  render(
    <MessageBubble
      message={{
        id: 10, conversationId: 1, role: 'user', kind: 'text_prompt',
        prompt: 'hi', status: 'success',
        createdAt: new Date(2026, 6, 19, 9, 5).getTime(),
      }}
      onImageClick={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )
  expect(screen.getByText('09:05')).toBeInTheDocument()
})

it('shows live "已耗时" counter while assistant is generating', () => {
  vi.useFakeTimers()
  try {
    const startedAt = Date.now()
    render(
      <MessageBubble
        message={{
          id: 11, conversationId: 1, role: 'assistant', kind: 'image_result',
          status: 'generating', createdAt: startedAt, startedAt,
        }}
        onImageClick={() => {}}
        onRetry={() => {}}
        onEdit={() => {}}
      />,
    )
    // Initial tick + first interval tick
    act(() => { vi.advanceTimersByTime(3500) })
    expect(screen.getByText(/已耗时/)).toBeInTheDocument()
    expect(screen.getByText(/已耗时 3 秒/)).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

it('shows "引用了 #N 张图" with source timestamp for chat-source edit', async () => {
  const sourceBlobId = await db.images.add({
    blob: new Blob([new Uint8Array([10])], { type: 'image/png' }),
    mimeType: 'image/png',
    createdAt: 0,
  })
  const sourceMsgId = await db.messages.add({
    conversationId: 1, role: 'assistant', kind: 'image_result',
    status: 'success', imageBlobId: sourceBlobId,
    createdAt: new Date(2026, 6, 19, 10, 30).getTime(),
  })
  render(
    <MessageBubble
      message={{
        id: 12, conversationId: 1, role: 'user', kind: 'image_edit_request',
        prompt: 'make it red', imageBlobId: sourceBlobId,
        editSourceMessageId: sourceMsgId, status: 'success',
        createdAt: new Date(2026, 6, 19, 10, 35).getTime(),
      }}
      onImageClick={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )
  // Wait for the card to render (img inside the button)
  expect(await screen.findByAltText('引用图')).toBeInTheDocument()
  expect(screen.getByText(/引用了 #/)).toBeInTheDocument()
  expect(await screen.findByText(/生成于/)).toBeInTheDocument()
})

it('shows local upload filename when edit request has no source message id', async () => {
  const blobId = await db.images.add({
    blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
    mimeType: 'image/png',
    createdAt: 0,
  })
  render(
    <MessageBubble
      message={{
        id: 13, conversationId: 1, role: 'user', kind: 'image_edit_request',
        prompt: 'edit local', imageBlobId: blobId, localUploadName: 'kitten.png',
        status: 'success', createdAt: new Date(2026, 6, 19, 12, 0).getTime(),
      }}
      onImageClick={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )
  expect(await screen.findByAltText('引用图')).toBeInTheDocument()
  expect(screen.getByText('本地图片：kitten.png')).toBeInTheDocument()
})

it('edit source card thumbnail click triggers onImageClick', async () => {
  const onImageClick = vi.fn()
  const blobId = await db.images.add({
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    mimeType: 'image/png',
    createdAt: 0,
  })
  render(
    <MessageBubble
      message={{ id: 14, conversationId: 1, role: 'user', kind: 'image_edit_request', prompt: 'x', imageBlobId: blobId, status: 'success', createdAt: 0 }}
      onImageClick={onImageClick}
      onRetry={() => {}}
      onEdit={() => {}}
    />,
  )
  const btn = await screen.findByRole('button')
  await userEvent.click(btn)
  expect(onImageClick).toHaveBeenCalledWith(blobId)
})