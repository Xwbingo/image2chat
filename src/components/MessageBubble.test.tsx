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