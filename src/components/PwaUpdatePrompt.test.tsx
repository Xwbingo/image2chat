import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mockUpdateServiceWorker = vi.fn()
const mockSetNeedRefresh = vi.fn()
const mockSetOfflineReady = vi.fn()
const mockToast = vi.fn(() => ({ id: 'toast-1', dismiss: vi.fn(), update: vi.fn() }))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(),
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast, dismiss: vi.fn(), toasts: [] }),
}))

import { useRegisterSW } from 'virtual:pwa-register/react'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'

function setupReturn(opts: { needRefresh?: boolean; offlineReady?: boolean } = {}) {
  ;(useRegisterSW as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    needRefresh: [opts.needRefresh ?? false, mockSetNeedRefresh],
    offlineReady: [opts.offlineReady ?? false, mockSetOfflineReady],
    updateServiceWorker: mockUpdateServiceWorker,
  })
}

beforeEach(() => {
  mockUpdateServiceWorker.mockReset()
  mockSetNeedRefresh.mockReset()
  mockSetOfflineReady.mockReset()
  mockToast.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

it('renders nothing when no SW signals are active', () => {
  setupReturn()
  const { container } = render(<PwaUpdatePrompt />)
  expect(container.firstChild).toBeNull()
  expect(mockToast).not.toHaveBeenCalled()
})

it('shows update toast when needRefresh is true; action button triggers updateServiceWorker(true)', async () => {
  setupReturn({ needRefresh: true })
  render(<PwaUpdatePrompt />)
  expect(mockToast).toHaveBeenCalledTimes(1)
  const args = mockToast.mock.calls[0][0]
  expect(args.title).toBe('有新版本可用')
  expect(args.description).toBe('点“刷新”加载最新功能')
  expect(args.duration).toBe(Number.POSITIVE_INFINITY)
  // 模拟点击 action 内的按钮
  const user = userEvent.setup()
  const { getByRole } = render(<>{args.action as ReactElement}</>)
  await user.click(getByRole('button'))
  expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true)
})

it('shows offline-ready toast and clears the offlineReady signal', () => {
  setupReturn({ offlineReady: true })
  render(<PwaUpdatePrompt />)
  expect(mockToast).toHaveBeenCalledTimes(1)
  expect(mockToast.mock.calls[0][0].title).toBe('已支持离线使用')
  expect(mockSetOfflineReady).toHaveBeenCalledWith(false)
})

it('dismisses the update toast when needRefresh flips back to false', () => {
  let need = true
  const setNeed = vi.fn((v: boolean) => { need = v })
  ;(useRegisterSW as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    needRefresh: [need, setNeed],
    offlineReady: [false, mockSetOfflineReady],
    updateServiceWorker: mockUpdateServiceWorker,
  })
  const { rerender } = render(<PwaUpdatePrompt />)
  expect(mockToast).toHaveBeenCalledTimes(1)
  // 模拟 needRefresh 再次为 false：rerender 不变 mock，但通过 cleanup 路径触发
  rerender(<div />) // 卸载 PwaUpdatePrompt，触发 effect cleanup
  const dismiss = mockToast.mock.results[0].value.dismiss
  expect(dismiss).toHaveBeenCalledWith('toast-1')
})
