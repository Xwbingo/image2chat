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
  const validProviders = providers.filter((p) => p.lastValid !== 0)

  if (validProviders.length === 0) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="p-0 max-h-[60vh] gap-0">
          <div className="overflow-y-auto max-h-[60vh] p-4">
            <SheetHeader><SheetTitle>切换中转站</SheetTitle></SheetHeader>
            <p className="text-sm text-muted-foreground text-center">
              没有可用的中转站。请到「密钥管理」验证密钥。
            </p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 max-h-[60vh] gap-0">
        <div className="overflow-y-auto max-h-[60vh]">
          <SheetHeader><SheetTitle>切换中转站</SheetTitle></SheetHeader>
          <div className="space-y-2 p-4 pb-6">
            {validProviders.map((p) => (
              <Button
                key={p.id}
                variant={p.id === currentId ? 'default' : 'outline'}
                className="w-full justify-between"
                onClick={() => { if (p.id != null) { onSelect(p.id); onOpenChange(false) } }}
              >
                <span className="flex items-center gap-2">
                  <span className={p.apiKey.trim() ? 'h-2 w-2 rounded-full bg-green-500' : 'h-2 w-2 rounded-full bg-red-500'} />
                  {p.name}
                  {!p.apiKey.trim() && <span className="text-destructive">(未配置)</span>}
                </span>
                <Badge variant="secondary">{p.type}</Badge>
              </Button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}