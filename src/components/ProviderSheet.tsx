import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProviders } from '@/hooks/useProviders'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentId: number | null
  onSelect: (id: number) => void
}

export function ProviderSheet({ open, onOpenChange, currentId, onSelect }: Props) {
  const providers = useProviders()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[60vh]">
        <SheetHeader><SheetTitle>切换中转站</SheetTitle></SheetHeader>
        <div className="space-y-2 p-4">
          {providers.map((p) => (
            <Button
              key={p.id}
              variant={p.id === currentId ? 'default' : 'outline'}
              className="w-full justify-between"
              onClick={() => { if (p.id != null) { onSelect(p.id); onOpenChange(false) } }}
            >
              <span>{p.name}</span>
              <Badge variant="secondary">{p.type}</Badge>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
