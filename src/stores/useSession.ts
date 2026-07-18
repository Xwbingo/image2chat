import { create } from 'zustand'
import { DEFAULT_SIZE, isImageSize, type ImageSize } from '@/lib/api/providers'

interface SessionState {
  activeProviderId: number | null
  defaultSize: ImageSize
  setActiveProviderId: (id: number | null) => void
  setDefaultSize: (size: ImageSize) => void
}

const KEY_PID = 'i2c.activeProviderId'
const KEY_SIZE = 'i2c.defaultSize'

function readPid(): number | null {
  const v = localStorage.getItem(KEY_PID)
  return v ? Number(v) : null
}

function readSize(): ImageSize {
  const v = localStorage.getItem(KEY_SIZE)
  return v && isImageSize(v) ? v : DEFAULT_SIZE
}

export const useSession = create<SessionState>((set) => ({
  activeProviderId: readPid(),
  defaultSize: readSize(),
  setActiveProviderId: (id) => {
    if (id == null) localStorage.removeItem(KEY_PID)
    else localStorage.setItem(KEY_PID, String(id))
    set({ activeProviderId: id })
  },
  setDefaultSize: (size) => {
    localStorage.setItem(KEY_SIZE, size)
    set({ defaultSize: size })
  },
}))