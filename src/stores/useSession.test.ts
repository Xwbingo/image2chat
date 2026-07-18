import { renderHook, act } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'

beforeEach(async () => {
  localStorage.clear()
  vi.resetModules()
})

describe('useSession', () => {
  it('starts with default size and no active provider', async () => {
    const { useSession } = await import('./useSession')
    const { result } = renderHook(() => useSession())
    expect(result.current.defaultSize).toBe('2048x1152')
    expect(result.current.activeProviderId).toBeNull()
  })

  it('persists defaultSize to localStorage', async () => {
    const { useSession } = await import('./useSession')
    const { result } = renderHook(() => useSession())
    act(() => result.current.setDefaultSize('1024x1024'))
    expect(localStorage.getItem('i2c.defaultSize')).toBe('1024x1024')
  })

  it('persists activeProviderId to localStorage', async () => {
    const { useSession } = await import('./useSession')
    const { result } = renderHook(() => useSession())
    act(() => result.current.setActiveProviderId(7))
    expect(localStorage.getItem('i2c.activeProviderId')).toBe('7')
  })

  it('restores persisted values on init', async () => {
    localStorage.setItem('i2c.defaultSize', '3840x2160')
    localStorage.setItem('i2c.activeProviderId', '42')
    const { useSession } = await import('./useSession')
    const { result } = renderHook(() => useSession())
    expect(result.current.defaultSize).toBe('3840x2160')
    expect(result.current.activeProviderId).toBe(42)
  })
})