import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useSession } from '@/stores/useSession'
import { useProviders } from '@/hooks/useProviders'
import { useSettings } from '@/stores/useSettings'
import { setConversationProvider } from '@/lib/repo'
import { getSupportedSizes, type ImageSize } from '@/lib/api/providers'
import { cn } from '@/lib/utils'

const SIZE_LABELS: Record<ImageSize, string> = {
  '1024x1024': '1K 正方形', '1536x1024': '1K 横向', '1024x1536': '1K 纵向',
  '2048x2048': '2K 正方形', '2048x1152': '2K 横向', '1152x2048': '2K 纵向',
  '3840x2160': '4K 横向', '2160x3840': '4K 纵向',
}

const SIZE_BUCKETS: Array<{ label: string; match: (s: ImageSize) => boolean }> = [
  { label: '1K', match: (s) => s.startsWith('1024') || s.startsWith('1536') },
  { label: '2K', match: (s) => s.startsWith('2048') || s.startsWith('1152') },
  { label: '4K', match: (s) => s.startsWith('3840') || s.startsWith('2160') },
]

const SIZE_PREVIEW: Record<ImageSize, { w: number; h: number; shape: 'square' | 'landscape' | 'portrait' }> = {
  '1024x1024': { w: 1024, h: 1024, shape: 'square' },
  '1536x1024': { w: 1536, h: 1024, shape: 'landscape' },
  '1024x1536': { w: 1024, h: 1536, shape: 'portrait' },
  '2048x2048': { w: 2048, h: 2048, shape: 'square' },
  '2048x1152': { w: 2048, h: 1152, shape: 'landscape' },
  '1152x2048': { w: 1152, h: 2048, shape: 'portrait' },
  '3840x2160': { w: 3840, h: 2160, shape: 'landscape' },
  '2160x3840': { w: 2160, h: 3840, shape: 'portrait' },
}

const PREVIEW_BOX = 56

function previewStyle(shape: 'square' | 'landscape' | 'portrait') {
  if (shape === 'square') return { width: PREVIEW_BOX, height: PREVIEW_BOX }
  if (shape === 'landscape') return { width: PREVIEW_BOX, height: Math.round(PREVIEW_BOX * 9 / 16) }
  return { width: Math.round(PREVIEW_BOX * 9 / 16), height: PREVIEW_BOX }
}

interface SizeBucketsProps {
  sizes: ImageSize[]
  defaultSize: ImageSize
  openSection: string | null
  onToggle: (label: string) => void
  onSelect: (size: ImageSize) => void
  currentBucket: string | undefined
}

function SizeBuckets({ sizes, defaultSize, openSection, onToggle, onSelect, currentBucket }: SizeBucketsProps) {
  return (
    <div className="space-y-1">
      {SIZE_BUCKETS.map((bucket) => {
        const items = sizes.filter((s) => bucket.match(s))
        if (items.length === 0) return null
        const open = openSection === bucket.label
        return (
          <div key={bucket.label} className="rounded-xl border border-border bg-background">
            <button
              type="button"
              data-role="size-bucket-toggle"
              aria-expanded={open}
              onClick={() => onToggle(bucket.label)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/60 rounded-xl"
            >
              <span className="flex items-center gap-2">
                <span>{bucket.label}</span>
                {currentBucket === bucket.label && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">当前</span>
                )}
              </span>
              <ChevronDown
                className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
                aria-hidden
              />
            </button>
            <div
              className={cn(
                'overflow-hidden transition-[max-height,opacity] duration-200 ease-out',
                open ? 'max-h-[420px] opacity-100' : 'pointer-events-none max-h-0 opacity-0',
              )}
              aria-hidden={!open}
            >
              <div className="min-h-0">
                <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                  {items.map((s) => {
                    const active = s === defaultSize
                    const preview = SIZE_PREVIEW[s]
                    return (
                      <button
                        key={s}
                        type="button"
                        data-role="size-chip"
                        data-size={s}
                        onClick={() => onSelect(s)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors',
                          active
                            ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                            : 'border-transparent hover:border-border hover:bg-accent',
                        )}
                      >
                        <span className="flex h-14 w-full items-center justify-center">
                          <span
                            aria-hidden
                            className={cn('rounded-sm border', active ? 'border-primary bg-primary/20' : 'border-border bg-muted')}
                            style={previewStyle(preview.shape)}
                          />
                        </span>
                        <span className="font-medium">{SIZE_LABELS[s]}</span>
                        <span className="text-[10px] text-muted-foreground">{preview.w}×{preview.h}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface Props { activeConversationId?: number }

export function StatusBar({ activeConversationId }: Props) {
  const providers = useProviders()
  const { activeProviderId, defaultSize, setActiveProviderId, setDefaultSize } = useSession()
  const [expanded, setExpanded] = useState(false)
  const [openSection, setOpenSection] = useState<'provider' | string | null>(SIZE_BUCKETS.find((b) => b.match(defaultSize))?.label ?? SIZE_BUCKETS[0].label)
  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? providers[0]
  const hasProvider = providers.length > 0

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [expanded])

  function selectProvider(id: number) {
    setActiveProviderId(id)
    if (activeConversationId != null) {
      void setConversationProvider(activeConversationId, id).catch(() => undefined)
    }
  }

  function toggleSection(section: string) {
    setOpenSection((prev) => prev === section ? null : section)
  }

  function openSettings() {
    useSettings.getState().openSettings()
  }

  function toggleExpanded() {
    setExpanded((v) => !v)
  }

  if (!hasProvider) {
    return (
      <div
        data-testid="status-bar-card"
        className="relative border border-border bg-card shadow-sm"
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

  const activeProviderMissingKey = !!activeProvider && !activeProvider.apiKey.trim()
  const currentBucket = SIZE_BUCKETS.find((b) => b.match(defaultSize))?.label
  const sizes = getSupportedSizes(activeProvider?.type ?? 'packy')

  return (
    <div
      data-testid="status-bar-card"
      className="relative border border-border bg-card shadow-sm"
    >
      <button
        type="button"
        aria-label="展开或收起配置"
        aria-expanded={expanded}
        data-testid="status-bar-toggle"
        onClick={toggleExpanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent/60 transition-colors"
      >
        <span className="inline-flex items-center gap-1 min-w-0">
          <span className="text-muted-foreground shrink-0">中转站</span>
          <span data-testid="provider-name" className="truncate font-medium">{activeProvider?.name ?? '未配置'}</span>
          {activeProviderMissingKey && (
            <span data-testid="provider-state" className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">未配置密钥</span>
          )}
        </span>
        <span className="mx-2 h-3 w-px bg-border shrink-0" aria-hidden />
        <span className="inline-flex items-center gap-1 min-w-0">
          <span className="text-muted-foreground shrink-0">尺寸</span>
          <span data-testid="size-name" className="truncate font-medium">{SIZE_LABELS[defaultSize]}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn('ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>

      <div
        data-testid="status-bar-popover"
        role="region"
        aria-hidden={!expanded}
        className={cn(
          'absolute left-0 right-0 bottom-full mb-1 origin-bottom border border-border bg-card shadow-md',
          'transition-all duration-200 ease-out',
          expanded
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-1 opacity-0',
        )}
      >
        <div
          className={cn('overflow-hidden transition-[max-height] duration-200 ease-out', expanded ? 'max-h-[60vh]' : 'max-h-0')}
        >
          <div className="space-y-2 rounded-2xl p-3">
            <div className="rounded-xl border border-border bg-background">
              <button
                type="button"
                data-role="provider-bucket-toggle"
                aria-expanded={openSection === 'provider'}
                onClick={() => toggleSection('provider')}
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/60 rounded-xl"
              >
                <span className="flex items-center gap-2">
                  <span>中转站</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{activeProvider?.name ?? '未配置'}</span>
                </span>
                <ChevronDown
                  className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', openSection === 'provider' && 'rotate-180')}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  'overflow-hidden transition-[max-height,opacity] duration-200 ease-out',
                  openSection === 'provider' ? 'max-h-[320px] opacity-100' : 'pointer-events-none max-h-0 opacity-0',
                )}
                aria-hidden={openSection !== 'provider'}
              >
                <div className="min-h-0">
                  <div className="grid grid-cols-1 gap-1.5 px-2 pb-2">
                    {providers.map((p) => {
                      if (p.id == null) return null
                      const active = p.id === activeProvider?.id
                      const missingKey = !p.apiKey.trim()
                      return (
                        <button
                          key={p.id}
                          type="button"
                          data-role="provider-chip"
                          onClick={() => selectProvider(p.id!)}
                          className={cn(
                            'group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                            active
                              ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                              : 'border-transparent hover:border-border hover:bg-accent',
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">{p.name}</span>
                            {missingKey && (
                              <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">未配置密钥</span>
                            )}
                          </span>
                          {active && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <SizeBuckets
              sizes={sizes}
              defaultSize={defaultSize}
              openSection={openSection}
              onToggle={toggleSection}
              onSelect={setDefaultSize}
              currentBucket={currentBucket}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
