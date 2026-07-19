import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from './Composer'

it('calls onSend with trimmed prompt', async () => {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} />)
  const textarea = screen.getByPlaceholderText(/描述你想要的图像/i)
  await userEvent.type(textarea, '  a red apple  ')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalledWith('a red apple', { editSourceMessageId: undefined, uploadBlob: undefined })
})

it('does not call onSend for empty prompt', async () => {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} />)
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).not.toHaveBeenCalled()
})

it('uses mobile-safe composer sizing (pinning is handled by ChatView container)', () => {
  render(<Composer onSend={() => {}} />)
  const textarea = screen.getByPlaceholderText(/描述你想要的图像/i)
  const composer = textarea.parentElement?.parentElement
  const sendButton = screen.getByRole('button', { name: '发送' })
  const uploadButton = screen.getByRole('button', { name: '上传图片' })

  expect(textarea).toHaveAttribute('rows', '1')
  expect(composer).not.toHaveStyle({ position: 'fixed' })
  expect(sendButton).toHaveClass('h-11', 'px-4', 'shrink-0')
  expect(uploadButton).toHaveClass('h-11', 'w-11', 'shrink-0')
  expect(screen.getByText('发送')).toHaveClass('hidden', 'sm:inline')
})

it('does not accept bottomInset (pinning is the parent container\'s job)', () => {
  // @ts-expect-error — bottomInset is intentionally removed; this documents the design
  render(<Composer onSend={() => {}} bottomInset={56} />)
  const textarea = screen.getByPlaceholderText(/描述你想要的图像/i)
  const composer = textarea.parentElement?.parentElement
  expect(composer).not.toHaveStyle({ transform: 'translateY(-56px)' })
})

it('passes editSource when in edit mode', async () => {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} editSource={{ messageId: 7, blobId: 99 }} onClearEdit={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText(/描述你想要的图像/i), 'make blue')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalledWith('make blue', { editSourceMessageId: 7, uploadBlob: undefined })
})

it('passes an uploaded image as an edit source', async () => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn().mockReturnValue('blob:preview'),
    revokeObjectURL: vi.fn(),
  })
  const onSend = vi.fn()
  const { container } = render(<Composer onSend={onSend} />)
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([new Uint8Array([1, 2, 3])], 'source.png', { type: 'image/png' })
  await userEvent.upload(input, file)
  expect(screen.getByAltText('引用图')).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText(/描述你想要的图像/i), 'edit this')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalledWith('edit this', { editSourceMessageId: undefined, uploadBlob: file })
  vi.unstubAllGlobals()
})

it('shows "正在基于本地图片编辑" indicator when upload is set', async () => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn().mockReturnValue('blob:preview'),
    revokeObjectURL: vi.fn(),
  })
  const { container } = render(<Composer onSend={() => {}} />)
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' })
  await userEvent.upload(input, file)
  expect(await screen.findByText('正在基于本地图片编辑')).toBeInTheDocument()
  vi.unstubAllGlobals()
})

it('shows "正在编辑引用图" indicator when editSource provided', () => {
  render(<Composer onSend={() => {}} editSource={{ messageId: 1, blobId: 1, preview: 'blob:src' }} onClearEdit={() => {}} />)
  expect(screen.getByText('正在编辑引用图')).toBeInTheDocument()
})

it('cancel button clears both upload and editSource', async () => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn().mockReturnValue('blob:preview'),
    revokeObjectURL: vi.fn(),
  })
  const onClearEdit = vi.fn()
  const { container } = render(<Composer onSend={() => {}} editSource={{ messageId: 1, blobId: 1, preview: 'blob:src' }} onClearEdit={onClearEdit} />)
  expect(screen.getByText('正在编辑引用图')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '取消编辑' }))
  expect(onClearEdit).toHaveBeenCalled()
  vi.unstubAllGlobals()
})
