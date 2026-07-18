import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from './Composer'

it('calls onSend with trimmed prompt', async () => {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} />)
  const textarea = screen.getByPlaceholderText(/描述你想要的图像/i)
  await userEvent.type(textarea, '  a red apple  ')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalledWith('a red apple', undefined)
})

it('does not call onSend for empty prompt', async () => {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} />)
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).not.toHaveBeenCalled()
})

it('passes editSource when in edit mode', async () => {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} editSource={{ messageId: 7, blobId: 99 }} onClearEdit={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText(/描述你想要的图像/i), 'make blue')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalledWith('make blue', 7)
})