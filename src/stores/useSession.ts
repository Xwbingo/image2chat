import { create } from 'zustand'
import { DEFAULT_SIZE, isImageSize, type ImageSize } from '@/lib/api/providers'

export type ThemeMode = 'light' | 'dark'

interface SessionState {
  activeProviderId: number | null
  defaultSize: ImageSize
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setActiveProviderId: (id: number | null) => void
  setDefaultSize: (size: ImageSize) => void
  setTheme: (mode: ThemeMode) => void
}

const KEY_PID = 'i2c.activeProviderId'
const KEY_SIZE = 'i2c.defaultSize'
const KEY_THEME = 'i2c.theme'

function readPid(): number | null {
  const v = localStorage.getItem(KEY_PID)
  return v ? Number(v) : null
}

function readSize(): ImageSize {
  const v = localStorage.getItem(KEY_SIZE)
  return v && isImageSize(v) ? v : DEFAULT_SIZE
}

function readTheme(): ThemeMode {
  const v = localStorage.getItem(KEY_THEME)
  if (v === 'light' || v === 'dark') return v
  return 'light'
}

export const useSession = create<SessionState>((set) => ({
  activeProviderId: readPid(),
  defaultSize: readSize(),
  theme: readTheme(),
  resolvedTheme: 'light',
  setActiveProviderId: (id) => {
    if (id == null) localStorage.removeItem(KEY_PID)
    else localStorage.setItem(KEY_PID, String(id))
    set({ activeProviderId: id })
  },
  setDefaultSize: (size) => {
    localStorage.setItem(KEY_SIZE, size)
    set({ defaultSize: size })
  },
  setTheme: (mode) => {
    localStorage.setItem(KEY_THEME, mode)
    set({ theme: mode, resolvedTheme: mode })
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', mode === 'dark')
    }
  },
}))

if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', readTheme() === 'dark')
}