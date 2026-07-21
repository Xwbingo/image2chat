import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import type { ImageRef, Message } from '@/lib/db'
import { MessageBubble } from './MessageBubble'

beforeEach(async () => { await db.delete(); await db.open() })

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    conversationId: 1,
    role: 'assistant',
    prompt: 'a red apple',
    status: 'success',
    kind: 'image_generation',
    createdAt: Date.now(),
    imageBlobId: undefined,
    ...overrides,
  }
}

it('renders user text prompt', () => {
  render(
    <MessageBubble
      message={{ id: 1, conversationId: 1, role: 'user', kind: 'text_prompt', prompt: 'hello', status: 'success', createdAt: 0 }}
      onImageClick={() => {}}
      onReference={() => {}}
    />,
  )
  expect(screen.getByText('hello')).toBeInTheDocument()
})

it('user bubble with multi-refs renders one thumb per ref with index badges', async () => {
  const ids: number[] = []
  for (let i = 0; i < 3; i++) {
    ids.push(await db.images.add({
      blob: new Blob([new Uint8Array([i + 1])], { type: 'image/png' }),
      mimeType: 'image/png', createdAt: i,
    }))
  }
  const refs: ImageRef[] = [
    { blobId: ids[0], kind: 'chat', sourceMsgId: 5 },
    { blobId: ids[1], kind: 'local', fileName: 'b.png' },
    { blobId: ids[2], kind: 'chat', sourceMsgId: 7 },
  ]
  render(
    <MessageBubble
      message={{
        id: 8, conversationId: 1, role: 'user', kind: 'image_edit_request',
        prompt: 'combine', imageRefs: refs, status: 'success', createdAt: 0,
      }}
      onImageClick={() => {}}
      onReference={() => {}}
    />,
  )
  expect(await screen.findByTestId('multi-ref-strip')).toBeInTheDocument()
  const thumbs = screen.getAllByTestId('multi-ref-thumb')
  expect(thumbs).toHaveLength(3)
  expect(thumbs[0]).toHaveAttribute('data-ref-index', '0')
  expect(thumbs[2]).toHaveAttribute('data-ref-index', '2')
  expect(screen.getByTestId('ref-count-label')).toHaveTextContent('引用了 3 张图')
})

it('user bubble without refs shows no multi-ref strip', () => {
  render(
    <MessageBubble
      message={{ id: 1, conversationId: 1, role: 'user', kind: 'text_prompt', prompt: 'plain', status: 'success', createdAt: 0 }}
      onImageClick={() => {}}
      onReference={() => {}}
    />,
  )
  expect(screen.queryByTestId('multi-ref-strip')).not.toBeInTheDocument()
})

it('clicking a ref thumb triggers onImageClick with the blobId', async () => {
  const id = await db.images.add({
    blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
    mimeType: 'image/png', createdAt: 0,
  })
  const onImageClick = vi.fn()
  render(
    <MessageBubble
      message={{
        id: 9, conversationId: 1, role: 'user', kind: 'image_edit_request',
        prompt: 'edit', imageRefs: [{ blobId: id, kind: 'chat', sourceMsgId: 4 }],
        status: 'success', createdAt: 0,
      }}
      onImageClick={onImageClick}
      onReference={() => {}}
    />,
  )
  const thumb = await screen.findByTestId('multi-ref-thumb')
  await userEvent.click(thumb)
  expect(onImageClick).toHaveBeenCalledWith(id)
})

it('renders generating placeholder for assistant with status generating', () => {
  render(
    <MessageBubble
      message={{ id: 1, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'generating', createdAt: 0 }}
      onImageClick={() => {}}
      onReference={() => {}}
    />,
  )
  expect(screen.getByText(/正在创作/i)).toBeInTheDocument()
})

it('renders failed state with the friendly error message', () => {
  render(
    <MessageBubble
      message={{ id: 5, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'failed', errorCode: '500', createdAt: 0 }}
      onImageClick={() => {}}
      onReference={() => {}}
    />,
  )
  expect(screen.getByText(/服务异常/i)).toBeInTheDocument()
})

it('does not render any retry button on a failed message', () => {
  render(
    <MessageBubble
      message={{ id: 5, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'failed', errorCode: 'network', createdAt: 0 }}
      onImageClick={() => {}}
      onReference={() => {}}
    />,
  )
  expect(screen.queryByText('重试')).not.toBeInTheDocument()
})

it('uses remote fallback for image actions when blob is missing', async () => {
  const onRemoteClick = vi.fn()
  const { container } = render(
    <MessageBubble
      message={{ id: 6, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'success', remoteImageUrl: 'https://cdn/image.png', createdAt: 0 }}
      onImageClick={() => {}}
      onRemoteClick={onRemoteClick}
      onReference={() => {}}
    />,
  )
  await userEvent.click(container.querySelector('img')!)
  await userEvent.click(screen.getByText('查看'))
  expect(onRemoteClick).toHaveBeenCalledTimes(2)
})

it('renders a hint to update the API key for 401', () => {
  render(
    <MessageBubble
      message={{ id: 5, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'failed', errorCode: '401', createdAt: 0 }}
      onImageClick={() => {}}
      onReference={() => {}}
    />,
  )
  expect(screen.getByText(/密钥管理/)).toBeInTheDocument()
  expect(screen.queryByText('去设置')).not.toBeInTheDocument()
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
      onReference={() => {}}
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
      onReference={() => {}}
    />,
  )
  expect(screen.getByText('09:05')).toBeInTheDocument()
})

it('successful assistant renders "引用" button that triggers onReference', async () => {
  const blobId = await db.images.add({
    blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
    mimeType: 'image/png', createdAt: 0,
  })
  const onReference = vi.fn()
  render(
    <MessageBubble
      message={{ id: 20, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'success', imageBlobId: blobId, createdAt: 0 }}
      onImageClick={() => {}}
      onReference={onReference}
    />,
  )
  expect(screen.queryByText('编辑')).not.toBeInTheDocument()
  await userEvent.click(screen.getByText('引用'))
  expect(onReference).toHaveBeenCalledWith(20)
})

it('renders success bubble with action pills (round, full radius)', () => {
  render(
    <MessageBubble
      message={makeMsg({ status: 'success' })}
      onImageClick={() => {}}
      onReference={() => {}}
    />,
  )
  const viewBtn = screen.getByText('查看')
  const refBtn = screen.getByText('引用')
  expect(viewBtn.closest('button')).toHaveClass('rounded-full')
  expect(refBtn.closest('button')).toHaveClass('rounded-full')
})

it('renders copy-prompt pill when prompt exists', () => {
  render(
    <MessageBubble
      message={makeMsg({ status: 'success', prompt: 'a red apple' })}
      onImageClick={() => {}}
      onReference={() => {}}
    />,
  )
  expect(screen.getByText('复制 prompt')).toBeInTheDocument()
})