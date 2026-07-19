import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
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
  expect(screen.getByText('编辑引用图')).toBeInTheDocument()
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
        startedAt: 1000, completedAt: 1000 + 7500,
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