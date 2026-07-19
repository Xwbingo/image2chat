import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, vi } from 'vitest'
import { db } from '@/lib/db'
import { ChatView } from './ChatView'

vi.mock('./MessageBubble', () => ({
  MessageBubble: () => <div data-testid="msg-bubble" />,
}))
vi.mock('@/hooks/useMessages', () => ({
  useMessages: () => [],
}))

beforeAll(() => {
  if (!('scrollTo' in HTMLElement.prototype)) {
    HTMLElement.prototype.scrollTo = function () {}
  }
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

function renderChatView(props: Partial<React.ComponentProps<typeof ChatView>> = {}) {
  return render(
    <ChatView
      conversationId={1}
      onBack={() => {}}
      onSettings={() => {}}
      onOpenImage={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
      onSend={() => {}}
      statusBar={<div data-testid="status-bar-stub">status</div>}
      {...props}
    />,
  )
}

it('pins statusBar and Composer in a single fixed container at viewport bottom', () => {
  renderChatView()
  const status = screen.getByTestId('status-bar-stub')
  const composerOuter = screen
    .getByPlaceholderText(/描述你想要的图像/i)
    .parentElement?.parentElement!
  const container = composerOuter.parentElement
  expect(container).toBe(status.parentElement)
  expect(container).toHaveStyle({
    position: 'fixed',
    right: '0px',
    bottom: '0px',
  })
})

it('uses inline left offset (px) on the fixed container so the desktop sidebar stays visible', () => {
  // jsdom defaults window.innerWidth to 1024 → ≥768 → expect 256px sidebar inset
  renderChatView()
  const container = screen.getByTestId('status-bar-stub').parentElement
  expect(container).toHaveStyle({ left: '256px' })
  expect(container).not.toHaveClass('md:left-64')
})

it('applies the bottomInset translateY on the shared bottom container', () => {
  renderChatView({ bottomInset: 56 })
  const container = screen.getByTestId('status-bar-stub').parentElement
  expect(container).toHaveStyle({ transform: 'translateY(-56px)' })
})

it('places StatusBar above the Composer in source order so the Composer never covers it', () => {
  renderChatView()
  const shared = screen.getByTestId('status-bar-stub').parentElement as HTMLElement
  const kids = Array.from(shared.children)
  const statusIdx = kids.indexOf(screen.getByTestId('status-bar-stub'))
  const composerOuter = screen
    .getByPlaceholderText(/描述你想要的图像/i)
    .parentElement?.parentElement!
  const composerIdx = kids.indexOf(composerOuter)
  expect(statusIdx).toBeLessThan(composerIdx)
  expect(statusIdx).toBeGreaterThanOrEqual(0)
  expect(composerIdx).toBeGreaterThanOrEqual(0)
})

it('renders a settings icon button in the header that triggers onSettings', async () => {
  const onSettings = vi.fn()
  renderChatView({ onSettings })
  await userEvent.click(screen.getByRole('button', { name: '密钥管理' }))
  expect(onSettings).toHaveBeenCalledTimes(1)
})
