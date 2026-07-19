import 'fake-indexeddb/auto'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from './Composer'
import { db, type ImageRef } from '@/lib/db'
import { beforeEach } from 'vitest'

beforeEach(async () => { await db.delete(); await db.open() })

function setup(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onSend = vi.fn()
  const onAddLocal = vi.fn()
  const onRemoveRef = vi.fn()
  const onReorderRefs = vi.fn()
  const onClearRefs = vi.fn()
  const utils = render(
    <Composer
      refs={[]}
      onAddLocal={onAddLocal}
      onRemoveRef={onRemoveRef}
      onReorderRefs={onReorderRefs}
      onClearRefs={onClearRefs}
      onSend={onSend}
      {...props}
    />,
  )
  return { onSend, onAddLocal, onRemoveRef, onReorderRefs, onClearRefs, ...utils }
}

it('calls onSend with trimmed prompt and current refs array', async () => {
  const refs: ImageRef[] = [{ blobId: 1, kind: 'chat', sourceMsgId: 5 }]
  const { onSend } = setup({ refs })
  await userEvent.type(screen.getByPlaceholderText(/基于 1 张参考图/), '  a red apple  ')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalledWith('a red apple', refs)
})

it('does not call onSend for empty prompt', async () => {
  const { onSend } = setup()
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).not.toHaveBeenCalled()
})

it('uses mobile-safe composer sizing (pinning is handled by ChatView container)', () => {
  const { container } = setup()
  const composerOuter = container.firstChild as HTMLElement
  expect(composerOuter).not.toHaveStyle({ position: 'fixed' })
  expect(screen.getByText('发送')).toHaveClass('hidden', 'sm:inline')
})

it('does not accept bottomInset (pinning is the parent container\'s job)', () => {
  const { container } = setup({
    // @ts-expect-error - bottomInset was removed; ChatView owns keyboard avoidance now.
    bottomInset: 56,
  })
  const composerOuter = container.firstChild as HTMLElement
  expect(composerOuter.style.transform).toBe('')
})

it('renders the empty hint when no refs', () => {
  setup()
  expect(screen.getByTestId('empty-hint')).toBeInTheDocument()
  expect(screen.getByTestId('empty-hint')).toHaveTextContent(/1-3 张参考图/)
})

it('renders no refs-strip when refs is empty', () => {
  setup()
  expect(screen.queryByTestId('refs-strip')).not.toBeInTheDocument()
})

it('renders one ref thumb per ref with index badge and kind label', async () => {
  const blobIds: number[] = []
  for (let i = 0; i < 2; i++) {
    blobIds.push(await db.images.add({
      blob: new Blob([new Uint8Array([i + 1])], { type: 'image/png' }),
      mimeType: 'image/png', createdAt: i,
    }))
  }
  const refs: ImageRef[] = [
    { blobId: blobIds[0], kind: 'chat', sourceMsgId: 7 },
    { blobId: blobIds[1], kind: 'local', fileName: 'cat.png' },
  ]
  setup({ refs })
  const thumbs = screen.getAllByTestId('ref-thumb')
  expect(thumbs).toHaveLength(2)
  expect(thumbs[0]).toHaveAttribute('data-ref-index', '0')
  expect(thumbs[0]).toHaveAttribute('data-ref-kind', 'chat')
  expect(thumbs[1]).toHaveAttribute('data-ref-index', '1')
  expect(thumbs[1]).toHaveAttribute('data-ref-kind', 'local')
  expect(thumbs[0]).toHaveTextContent('1')
  expect(thumbs[1]).toHaveTextContent('2')
})

it('hides the plus-button when 3 refs already added', async () => {
  const blobIds: number[] = []
  for (let i = 0; i < 3; i++) {
    blobIds.push(await db.images.add({
      blob: new Blob([new Uint8Array([i])], { type: 'image/png' }),
      mimeType: 'image/png', createdAt: i,
    }))
  }
  const refs: ImageRef[] = blobIds.map((id, i) => ({ blobId: id, kind: 'local', fileName: `f${i}.png` }))
  setup({ refs })
  expect(screen.queryByTestId('add-ref-empty-slot')).not.toBeInTheDocument()
  expect(screen.getAllByTestId('ref-thumb')).toHaveLength(3)
})

it('shows placeholder text mentioning ref count', () => {
  const refs: ImageRef[] = [
    { blobId: 1, kind: 'local', fileName: 'a.png' },
    { blobId: 2, kind: 'chat', sourceMsgId: 9 },
  ]
  setup({ refs })
  expect(screen.getByPlaceholderText(/基于 2 张参考图/)).toBeInTheDocument()
})

it('clicking the remove button calls onRemoveRef with that blobId', async () => {
  const id = await db.images.add({ blob: new Blob([new Uint8Array([1])], { type: 'image/png' }), mimeType: 'image/png', createdAt: 0 })
  const refs: ImageRef[] = [{ blobId: id, kind: 'local', fileName: 'x.png' }]
  const { onRemoveRef } = setup({ refs })
  await userEvent.click(screen.getByTestId('remove-ref'))
  expect(onRemoveRef).toHaveBeenCalledWith(id)
})

it('upload via file input calls onAddLocal with the File', async () => {
  const { onAddLocal } = setup()
  const input = screen.getByTestId('file-input') as HTMLInputElement
  const file = new File([new Uint8Array([1, 2, 3])], 'kitten.png', { type: 'image/png' })
  await userEvent.upload(input, file)
  expect(onAddLocal).toHaveBeenCalledWith(file)
})

it('clicking the upload button triggers .click() on the hidden file input', async () => {
  setup()
  const input = screen.getByTestId('file-input') as HTMLInputElement
  const clickSpy = vi.spyOn(input, 'click')
  await userEvent.click(screen.getByTestId('upload-button'))
  expect(clickSpy).toHaveBeenCalledTimes(1)
})

it('upload button is disabled and not clickable when at MAX_REFS', async () => {
  const blobIds: number[] = []
  for (let i = 0; i < 3; i++) {
    blobIds.push(await db.images.add({
      blob: new Blob([new Uint8Array([i])], { type: 'image/png' }),
      mimeType: 'image/png', createdAt: i,
    }))
  }
  const refs: ImageRef[] = blobIds.map((id, i) => ({ blobId: id, kind: 'local', fileName: `f${i}.png` }))
  setup({ refs })
  const btn = screen.getByTestId('upload-button') as HTMLButtonElement
  expect(btn).toBeDisabled()
})

it('multi-file upload: passing 2 files calls onAddLocal for each within MAX_REFS', async () => {
  const { onAddLocal } = setup()
  const input = screen.getByTestId('file-input') as HTMLInputElement
  const file1 = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
  const file2 = new File([new Uint8Array([2])], 'b.png', { type: 'image/png' })
  await userEvent.upload(input, [file1, file2])
  expect(onAddLocal).toHaveBeenCalledTimes(2)
  expect(onAddLocal).toHaveBeenNthCalledWith(1, file1)
  expect(onAddLocal).toHaveBeenNthCalledWith(2, file2)
})

it('empty-slot button in refs strip also triggers .click() on the hidden file input', async () => {
  const id = await db.images.add({
    blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
    mimeType: 'image/png', createdAt: 0,
  })
  setup({ refs: [{ blobId: id, kind: 'local', fileName: 'one.png' }] })
  const input = screen.getByTestId('file-input') as HTMLInputElement
  const clickSpy = vi.spyOn(input, 'click')
  await userEvent.click(screen.getByTestId('add-ref-empty-slot'))
  expect(clickSpy).toHaveBeenCalledTimes(1)
})

it('rejects file larger than 10MB with a toast (does not call onAddLocal)', async () => {
  const { onAddLocal } = setup()
  const input = screen.getByTestId('file-input') as HTMLInputElement
  const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', { type: 'image/png' })
  await userEvent.upload(input, big)
  expect(onAddLocal).not.toHaveBeenCalled()
})

it('blocks 4th add: shows toast when file is dropped while already at 3 refs', async () => {
  const blobIds: number[] = []
  for (let i = 0; i < 3; i++) {
    blobIds.push(await db.images.add({
      blob: new Blob([new Uint8Array([i])], { type: 'image/png' }),
      mimeType: 'image/png', createdAt: i,
    }))
  }
  const refs: ImageRef[] = blobIds.map((id, i) => ({ blobId: id, kind: 'local', fileName: `f${i}.png` }))
  const { onAddLocal } = setup({ refs })
  const input = screen.getByTestId('file-input') as HTMLInputElement
  const extra = new File([new Uint8Array([99])], 'extra.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [extra] } })
  expect(onAddLocal).not.toHaveBeenCalled()
})

it('drag-to-reorder: drop on another thumb calls onReorderRefs(from, to)', async () => {
  const blobIds: number[] = []
  for (let i = 0; i < 3; i++) {
    blobIds.push(await db.images.add({
      blob: new Blob([new Uint8Array([i])], { type: 'image/png' }),
      mimeType: 'image/png', createdAt: i,
    }))
  }
  const refs: ImageRef[] = blobIds.map((id) => ({ blobId: id, kind: 'local', fileName: `${id}.png` }))
  const { onReorderRefs } = setup({ refs })
  const thumbs = screen.getAllByTestId('ref-thumb')
  // jsdom lacks DataTransfer; pass a minimal stub.
  const dataTransfer = { getData: () => '0', setData: () => {}, effectAllowed: '', dropEffect: '' }
  fireEvent.dragStart(thumbs[0], { dataTransfer })
  fireEvent.dragOver(thumbs[2], { dataTransfer })
  fireEvent.drop(thumbs[2], { dataTransfer })
  expect(onReorderRefs).toHaveBeenCalledWith(0, 2)
})

it('onSend calls onClearRefs after sending', async () => {
  const refs: ImageRef[] = [{ blobId: 1, kind: 'chat', sourceMsgId: 5 }]
  const { onClearRefs, onSend } = setup({ refs })
  await userEvent.type(screen.getByPlaceholderText(/基于 1 张参考图/), 'hello')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalled()
  expect(onClearRefs).toHaveBeenCalledTimes(1)
})

it('handles very long prompts by toasting and not sending', async () => {
  const { onSend } = setup()
  const long = 'x'.repeat(4001)
  const textarea = screen.getByPlaceholderText(/描述你想要的图像/) as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: long } })
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).not.toHaveBeenCalled()
})