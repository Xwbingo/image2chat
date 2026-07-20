import { render, screen, act } from '@testing-library/react'
import { PillToast } from './PillToast'
import { usePillToast } from '@/hooks/usePillToast'
import { useSession } from '@/stores/useSession'

beforeEach(() => {
  vi.useFakeTimers()
  document.documentElement.classList.remove('dark')
  useSession.setState({ theme: 'light', resolvedTheme: 'light' })
})

afterEach(() => {
  vi.useRealTimers()
})

it('renders nothing initially', () => {
  render(<PillToast />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('shows success variant with green background', () => {
  render(<PillToast />)
  act(() => {
    usePillToast.getState().show('已复制', { variant: 'success' })
  })
  const el = screen.getByRole('status')
  expect(el).toHaveTextContent('已复制')
  expect(el).toHaveStyle({ backgroundColor: 'rgb(30, 142, 62)' })
})

it('auto-dismisses after 2000ms by default', () => {
  render(<PillToast />)
  act(() => {
    usePillToast.getState().show('已保存')
  })
  expect(screen.getByRole('status')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('replaces previous message when new one arrives', () => {
  render(<PillToast />)
  act(() => {
    usePillToast.getState().show('第一条')
  })
  expect(screen.getByRole('status')).toHaveTextContent('第一条')
  act(() => {
    usePillToast.getState().show('第二条')
  })
  expect(screen.getByRole('status')).toHaveTextContent('第二条')
  expect(screen.queryByText('第一条')).not.toBeInTheDocument()
})
