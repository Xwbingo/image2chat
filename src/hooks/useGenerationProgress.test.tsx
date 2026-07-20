import { renderHook, act } from '@testing-library/react'
import { useGenerationProgress } from './useGenerationProgress'
import type { ImageSize } from '@/lib/api/providers'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('starts hidden (percent=0, isActive=false)', () => {
  const { result } = renderHook(() => useGenerationProgress())
  expect(result.current.percent).toBe(0)
  expect(result.current.isActive).toBe(false)
})

it('after start, isActive=true and percent grows over time', () => {
  const { result } = renderHook(() => useGenerationProgress())
  act(() => {
    result.current.start('1024x1024' as ImageSize, false)
  })
  expect(result.current.isActive).toBe(true)
  // 20s total time, 5s elapsed, should reach easeOutCubic(0.25) ~= 0.578 = 58% but capped at 95%
  act(() => {
    vi.advanceTimersByTime(5000)
  })
  expect(result.current.percent).toBeGreaterThan(40)
  expect(result.current.percent).toBeLessThanOrEqual(95)
})

it('caps at 95% until complete()', () => {
  const { result } = renderHook(() => useGenerationProgress())
  act(() => {
    result.current.start('1024x1024' as ImageSize, false)
  })
  act(() => {
    vi.advanceTimersByTime(30000) // far beyond 20s
  })
  expect(result.current.percent).toBe(95)
})

it('complete() jumps to 100 then clears after 300ms', () => {
  const { result } = renderHook(() => useGenerationProgress())
  act(() => {
    result.current.start('1024x1024' as ImageSize, false)
  })
  act(() => {
    result.current.complete()
  })
  expect(result.current.percent).toBe(100)
  act(() => {
    vi.advanceTimersByTime(300)
  })
  expect(result.current.isActive).toBe(false)
  expect(result.current.percent).toBe(0)
})

it('stop() clears without going to 100', () => {
  const { result } = renderHook(() => useGenerationProgress())
  act(() => {
    result.current.start('1024x1024' as ImageSize, false)
  })
  act(() => {
    result.current.stop()
  })
  expect(result.current.isActive).toBe(false)
  expect(result.current.percent).toBe(0)
})

it('hasRefImages adds 30% to estimated time', () => {
  const { result: r1 } = renderHook(() => useGenerationProgress())
  act(() => { r1.current.start('1024x1024' as ImageSize, false) })
  act(() => { vi.advanceTimersByTime(10000) }) // 10s out of 20s
  const noRefPercent = r1.current.percent

  const { result: r2 } = renderHook(() => useGenerationProgress())
  act(() => { r2.current.start('1024x1024' as ImageSize, true) })
  act(() => { vi.advanceTimersByTime(10000) }) // 10s out of 26s
  const withRefPercent = r2.current.percent

  expect(withRefPercent).toBeLessThan(noRefPercent)
})