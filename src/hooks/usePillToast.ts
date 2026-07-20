import { create } from 'zustand'

export type PillToastVariant = 'default' | 'success' | 'warning' | 'info'

interface PillToastState {
  message: string | null
  variant: PillToastVariant
  duration: number
  timerId: number | null
  show: (message: string, options?: { variant?: PillToastVariant; duration?: number }) => void
  clear: () => void
}

export const usePillToast = create<PillToastState>((set, get) => ({
  message: null,
  variant: 'default',
  duration: 2000,
  timerId: null,
  show: (message, options = {}) => {
    const { timerId } = get()
    if (timerId != null) {
      window.clearTimeout(timerId)
    }
    const duration = options.duration ?? 2000
    const newId = window.setTimeout(() => {
      set({ message: null, timerId: null })
    }, duration)
    set({
      message,
      variant: options.variant ?? 'default',
      duration,
      timerId: newId,
    })
  },
  clear: () => {
    const { timerId } = get()
    if (timerId != null) window.clearTimeout(timerId)
    set({ message: null, timerId: null })
  },
}))
