import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { getSupportedSizes, type ImageSize } from '@/lib/api/providers'
import { cn } from '@/lib/utils'

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

export function ParamSheet({ open, onOpenChange, providerType, current, onSelect }: Props) {
  const sizes = getSupportedSizes(providerType ?? 'packy')
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[60vh]">
        <SheetHeader><SheetTitle>选择尺寸</SheetTitle></SheetHeader>
        <div className="grid grid-cols-2 gap-2 p-4">
          {sizes.map((s) => (
            <Button
              key={s}
              variant={s === current ? 'default' : 'outline'}
              onClick={() => { onSelect(s); onOpenChange(false) }}
              className={cn('justify-start')}
            >
              {LABELS[s]}
              <span className="ml-auto text-xs text-muted-foreground">{s}</span>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
