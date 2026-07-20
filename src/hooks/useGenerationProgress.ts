import { create } from 'zustand'
import type { ImageSize } from '@/lib/api/providers'

const BASE_SECONDS: Record<string, number> = {
  '1024x1024': 20,
  '1536x1024': 20,
  '1024x1536': 20,
  '2048x2048': 45,
  '2048x1152': 45,
  '3840x2160': 90,
  '2160x3840': 90,
}

function estimateSeconds(size: ImageSize, hasRefImages: boolean): number {
  const base = BASE_SECONDS[size] ?? 30
  return hasRefImages ? Math.round(base * 1.3) : base
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

interface ProgressState {
  percent: number
  isActive: boolean
  start: (size: ImageSize, hasRefImages: boolean) => void
  complete: () => void
  stop: () => void
}

let timer: number | null = null
let startedAt = 0
let totalMs = 0

function clearTimer() {
  if (timer != null) {
    window.clearTimeout(timer)
    timer = null
  }
}

export const useGenerationProgress = create<ProgressState>((set) => ({
  percent: 0,
  isActive: false,
  start: (size, hasRefImages) => {
    clearTimer()
    totalMs = estimateSeconds(size, hasRefImages) * 1000
    startedAt = Date.now()
    set({ percent: 0, isActive: true })
    const tick = () => {
      const elapsed = Date.now() - startedAt
      const raw = Math.min(elapsed / totalMs, 1)
      const eased = easeOutCubic(raw)
      const percent = Math.min(95, Math.floor(eased * 100))
      set({ percent })
      if (percent < 95) {
        timer = window.setTimeout(tick, 100)
      }
    }
    timer = window.setTimeout(tick, 100)
  },
  complete: () => {
    clearTimer()
    set({ percent: 100, isActive: true })
    timer = window.setTimeout(() => {
      set({ percent: 0, isActive: false })
    }, 300)
  },
  stop: () => {
    clearTimer()
    set({ percent: 0, isActive: false })
  },
}))