import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (!offline) return null
  return (
    <div className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 px-3 py-1.5 text-xs flex items-center gap-2">
      <WifiOff className="w-3.5 h-3.5" /> 当前离线，仅可查看历史
    </div>
  )
}
