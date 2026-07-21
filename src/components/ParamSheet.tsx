import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getSupportedSizes, type ImageSize } from '@/lib/api/providers'
import type { ProviderType } from '@/lib/db'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerType: ProviderType | undefined
  current: ImageSize
  onSelect: (size: ImageSize) => void
}

const LABELS: Record<ImageSize, string> = {
  '1024x1024': '1:1', '1536x1024': '横向', '1024x1536': '纵向',
  '2048x2048': '2K 正方形', '2048x1152': '2K 横向',
  '3840x2160': '4K 横向', '2160x3840': '4K 纵向',
}

const RATIO_BOX: Record<ImageSize, { w: number; h: number }> = {
  '1024x1024': { w: 24, h: 24 },
  '1536x1024': { w: 24, h: 16 },
  '1024x1536': { w: 16, h: 24 },
  '2048x2048': { w: 24, h: 24 },
  '2048x1152': { w: 28, h: 16 },
  '3840x2160': { w: 32, h: 18 },
  '2160x3840': { w: 18, h: 32 },
}

const TIERS: Array<{ label: string; sizes: ImageSize[] }> = [
  { label: '常规', sizes: ['1024x1024', '1536x1024', '1024x1536'] },
  { label: '2K', sizes: ['2048x2048', '2048x1152'] },
  { label: '4K', sizes: ['3840x2160', '2160x3840'] },
]

function RatioIcon({ size, active }: { size: ImageSize; active: boolean }) {
  const { w, h } = RATIO_BOX[size]
  return (
    <div
      aria-hidden
      className={cn(
        'border-2 rounded-sm transition-colors',
        active ? 'border-primary' : 'border-muted-foreground/60',
      )}
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  )
}

export function ParamSheet({ open, onOpenChange, providerType, current, onSelect }: Props) {
  const sizes = getSupportedSizes(providerType ?? 'packy')
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 max-h-[90vh] gap-0">
        <div className="overflow-y-auto max-h-[90vh]">
          <SheetHeader><SheetTitle>选择尺寸</SheetTitle></SheetHeader>
          <div className="grid gap-4 p-3 pb-6">
            {TIERS.map((tier) => (
              sizes.includes(tier.sizes[0]) && (
                <div key={tier.label}>
                  <div className="text-xs text-muted-foreground mb-2 sticky top-0 bg-background py-1">{tier.label}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {tier.sizes.filter((s) => sizes.includes(s)).map((s) => {
                      const active = s === current
                      return (
                        <button
                          key={s}
                          data-ratio={s}
                          onClick={() => { onSelect(s); onOpenChange(false) }}
                          className={cn(
                            'flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-lg border transition-colors',
                            active
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50 hover:bg-accent',
                          )}
                        >
                          <RatioIcon size={s} active={active} />
                          <span className="text-xs font-medium">{LABELS[s]}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{s}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}