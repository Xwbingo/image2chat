import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/stores/useSession'

const ORDER = ['system', 'dark', 'light'] as const

export function ThemeToggle() {
  const theme = useSession((s) => s.theme)
  const setTheme = useSession((s) => s.setTheme)

  function handleClick() {
    const idx = ORDER.indexOf(theme)
    const next = ORDER[(idx + 1) % ORDER.length]
    setTheme(next)
  }

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const label = theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleClick}
      aria-label={`切换主题（当前：${label}）`}
      title={`切换主题（当前：${label}）`}
    >
      <Icon className="w-4 h-4" />
    </Button>
  )
}