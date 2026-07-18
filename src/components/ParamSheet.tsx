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

const TIER: Record<ImageSize, 'std' | '2k' | '4k'> = {
  '1024x1024': 'std', '1536x1024': 'std', '1024x1536': 'std',
  '2048x2048': '2k', '2048x1152': '2k',
  '3840x2160': '4k', '2160x3840': '4k',
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
      <SheetContent side="bottom" className="max-h-[60vh]">
        <SheetHeader><SheetTitle>选择尺寸</SheetTitle></SheetHeader>
        <div className="grid gap-3 p-4">
          {TIERS.map((tier) => (
            sizes.includes(tier.sizes[0]) && (
              <div key={tier.label}>
                <div className="text-xs text-muted-foreground mb-1.5">{tier.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  {tier.sizes.filter((s) => sizes.includes(s)).map((s) => (
                    <Button
                      key={s}
                      variant={s === current ? 'default' : 'outline'}
                      onClick={() => { onSelect(s); onOpenChange(false) }}
                      className="justify-start"
                    >
                      {LABELS[s]}
                      {TIER[s] === '4k' && <span className="ml-2 rounded bg-accent px-1 text-[10px]">4K</span>}
                      <span className="ml-auto text-xs text-muted-foreground">{s}</span>
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
