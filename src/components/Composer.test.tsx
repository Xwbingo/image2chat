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

it('uses mobile-safe composer sizing and bottom padding', () => {
  render(<Composer onSend={() => {}} />)
  const textarea = screen.getByPlaceholderText(/描述你想要的图像/i)
  const composer = textarea.parentElement?.parentElement
  const sendButton = screen.getByRole('button', { name: '发送' })
  const uploadButton = screen.getByRole('button', { name: '上传图片' })

  expect(textarea).toHaveAttribute('rows', '1')
  expect(composer).toHaveStyle({ paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))' })
  expect(sendButton).toHaveClass('h-11', 'px-4', 'shrink-0')
  expect(uploadButton).toHaveClass('h-11', 'w-11', 'shrink-0')
  expect(screen.getByText('发送')).toHaveClass('hidden', 'sm:inline')
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
  expect(screen.getByAltText('upload preview')).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText(/描述你想要的图像/i), 'edit this')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalledWith('edit this', { editSourceMessageId: undefined, uploadBlob: file })
  vi.unstubAllGlobals()
})
