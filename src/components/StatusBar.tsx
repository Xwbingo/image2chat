import { useState } from 'react'
import { Check } from 'lucide-react'
import { useSession } from '@/stores/useSession'
import { useProviders } from '@/hooks/useProviders'
import { useSettings } from '@/stores/useSettings'
import { setConversationProvider } from '@/lib/repo'
import { getSupportedSizes, type ImageSize } from '@/lib/api/providers'
import { cn } from '@/lib/utils'

const SIZE_LABELS: Record<ImageSize, string> = {
  '1024x1024': '1:1', '1536x1024': '横向', '1024x1536': '纵向',
  '2048x2048': '2K 正方形', '2048x1152': '2K 横向', '1152x2048': '2K 纵向',
  '3840x2160': '4K 横向', '2160x3840': '4K 纵向',
}

interface Props { activeConversationId?: number }

export function StatusBar({ activeConversationId }: Props) {
  const providers = useProviders()
  const { activeProviderId, defaultSize, setActiveProviderId, setDefaultSize } = useSession()
  const [expanded, setExpanded] = useState(false)
  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? providers[0]
  const hasProvider = providers.length > 0

  async function selectProvider(id: number) {
    setActiveProviderId(id)
    if (activeConversationId != null) await setConversationProvider(activeConversationId, id)
  }

  function openSettings() {
    useSettings.getState().openSettings()
  }

  if (!hasProvider) {
    return (
      <div
        data-testid="status-bar-card"
        className="relative rounded-2xl border border-border bg-card shadow-sm"
      >
        <button
          type="button"
          onClick={openSettings}
          className="w-full text-left px-3 py-2 text-xs"
        >
          未配置
        </button>
      </div>
    )
  }

  const sizes = getSupportedSizes(activeProvider?.type ?? 'packy')

  return (
    <div
      data-testid="status-bar-card"
      className="relative rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs px-2 py-1 rounded hover:bg-accent"
        >
          当前：{activeProvider?.name ?? '未配置'} ▾
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs px-2 py-1 rounded hover:bg-accent ml-auto"
        >
          尺寸：{SIZE_LABELS[defaultSize]} ▾
        </button>
      </div>
      {expanded && (
        <div
          data-testid="status-bar-popover"
          className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-border bg-card shadow-sm p-3 space-y-3 z-50"
        >
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">中转站</div>
            <div className="flex flex-col gap-1.5">
              {providers.map((p) => {
                if (p.id == null) return null
                const active = p.id === activeProvider?.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-role="provider-chip"
                    onClick={() => selectProvider(p.id!)}
                    className={cn(
                      'text-xs px-2 py-1.5 rounded border text-left flex items-center justify-between',
                      active ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
                    )}
                  >
                    <span>{p.name}</span>
                    {active && <Check className="w-3 h-3" aria-hidden />}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">尺寸</div>
            <div className="flex flex-col gap-1.5">
              {sizes.map((s) => {
                const active = s === defaultSize
                return (
                  <button
                    key={s}
                    type="button"
                    data-role="size-chip"
                    onClick={() => setDefaultSize(s)}
                    className={cn(
                      'text-xs px-2 py-1.5 rounded border text-left flex items-center justify-between',
                      active ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
                    )}
                  >
                    <span>{SIZE_LABELS[s]}</span>
                    {active && <Check className="w-3 h-3" aria-hidden />}
                  </button>
                )
              })}
            </div>
          </div>
          <p data-role="helper-text" className="text-xs text-muted-foreground">
            点击芯片切换；完成后收起。
          </p>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="w-full text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
          >
            完成
          </button>
        </div>
      )}
    </div>
  )
}