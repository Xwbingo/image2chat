import { useState } from 'react'
import { useSession } from '@/stores/useSession'
import { useProviders } from '@/hooks/useProviders'
import { ParamSheet } from './ParamSheet'
import { ProviderSheet } from './ProviderSheet'
import { setConversationProvider } from '@/lib/repo'
import type { ImageSize } from '@/lib/api/providers'

const SIZE_LABELS: Record<ImageSize, string> = {
  '1024x1024': '1:1', '1536x1024': '横向', '1024x1536': '纵向',
  '2048x2048': '2K 正方形', '2048x1152': '2K 横向', '1152x2048': '2K 纵向',
  '3840x2160': '4K 横向', '2160x3840': '4K 纵向',
}

interface Props { activeConversationId?: number }

export function StatusBar({ activeConversationId }: Props) {
  const providers = useProviders()
  const { activeProviderId, defaultSize, setActiveProviderId, setDefaultSize } = useSession()
  const [paramOpen, setParamOpen] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? providers[0]

  async function selectProvider(id: number) {
    setActiveProviderId(id)
    if (activeConversationId != null) await setConversationProvider(activeConversationId, id)
  }

  return (
    <div className="border-t border-border px-3 py-2 flex gap-2 bg-background">
      <button onClick={() => setProviderOpen(true)} className="text-xs px-2 py-1 rounded hover:bg-accent">
        当前：{activeProvider?.name ?? '未配置'}{activeProvider && !activeProvider.apiKey.trim() && ' (未配置)'} ▾
      </button>
      <button onClick={() => setParamOpen(true)} className="text-xs px-2 py-1 rounded hover:bg-accent ml-auto">
        尺寸：{SIZE_LABELS[defaultSize]} ▾
      </button>
      <ParamSheet
        open={paramOpen}
        onOpenChange={setParamOpen}
        providerType={activeProvider?.type}
        current={defaultSize}
        onSelect={setDefaultSize}
      />
      <ProviderSheet
        open={providerOpen}
        onOpenChange={setProviderOpen}
        currentId={activeProvider?.id ?? null}
        onSelect={selectProvider}
      />
    </div>
  )
}
