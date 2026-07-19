import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
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
    left: '0px',
    right: '0px',
    bottom: '0px',
  })
})

it('uses md:left-64 on the fixed container so the desktop sidebar stays visible', () => {
  renderChatView()
  const container = screen.getByTestId('status-bar-stub').parentElement
  expect(container).toHaveClass('md:left-64')
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
