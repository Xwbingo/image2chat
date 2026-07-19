import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { getSupportedSizes, type ImageSize } from '@/lib/api/providers'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerType: 'packy' | 'runapi' | 'custom' | undefined
  current: ImageSize
  onSelect: (size: ImageSize) => void
}

const LABELS: Record<ImageSize, string> = {
  '1024x1024': '1:1', '1536x1024': '横向', '1024x1536': '纵向',
  '2048x2048': '2K 正方形', '2048x1152': '2K 横向',
  '3840x2160': '4K 横向', '2160x3840': '4K 纵向',
}

const TIERS: Array<{ label: string; sizes: ImageSize[] }> = [
  { label: '常规', sizes: ['1024x1024', '1536x1024', '1024x1536'] },
  { label: '2K', sizes: ['2048x2048', '2048x1152'] },
  { label: '4K', sizes: ['3840x2160', '2160x3840'] },
]

export function ParamSheet({ open, onOpenChange, providerType, current, onSelect }: Props) {
  const sizes = getSupportedSizes(providerType ?? 'packy')
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader><SheetTitle>选择尺寸</SheetTitle></SheetHeader>
        <div className="grid gap-3 p-3">
          {TIERS.map((tier) => (
            sizes.includes(tier.sizes[0]) && (
              <div key={tier.label}>
                <div className="text-xs text-muted-foreground mb-1.5 sticky top-0 bg-background py-1">{tier.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  {tier.sizes.filter((s) => sizes.includes(s)).map((s) => (
                    <Button
                      key={s}
                      variant={s === current ? 'default' : 'outline'}
                      onClick={() => { onSelect(s); onOpenChange(false) }}
                      className="justify-start items-start text-left h-auto py-2"
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-sm">{LABELS[s]}</span>
                        <span className="text-xs text-muted-foreground font-mono">{s}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
