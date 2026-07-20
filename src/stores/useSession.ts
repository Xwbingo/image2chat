import { create } from 'zustand'
import { DEFAULT_SIZE, isImageSize, type ImageSize } from '@/lib/api/providers'

export type ThemeMode = 'light' | 'dark' | 'system'

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
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return 'system'
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light'
  }
  return mode
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
    const resolved = resolveTheme(mode)
    set({ theme: mode, resolvedTheme: resolved })
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', resolved === 'dark')
    }
  },
}))

if (typeof window !== 'undefined') {
  const initial = resolveTheme(useSession.getState().theme)
  useSession.setState({ resolvedTheme: initial })
  document.documentElement.classList.toggle('dark', initial === 'dark')

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const cur = useSession.getState()
    if (cur.theme === 'system') {
      const r = resolveTheme('system')
      useSession.setState({ resolvedTheme: r })
      document.documentElement.classList.toggle('dark', r === 'dark')
    }
  })
}