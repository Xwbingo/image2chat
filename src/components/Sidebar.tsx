import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/useConversations'
import { useProviders } from '@/hooks/useProviders'
import { Plus, Trash2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteConversation } from '@/lib/repo'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

interface Props {
  activeId?: number
  onSelect: (id: number) => void
  onNew: () => void
}

export function Sidebar({ activeId, onSelect, onNew }: Props) {
  const conversations = useConversations()
  const providers = useProviders()
  const activeProvider = providers[0]
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  return (
    <aside className="w-64 border-r border-border flex flex-col h-full bg-card">
      <div className="p-3 border-b border-border">
        <Button className="w-full" onClick={onNew}>
          <Plus className="w-4 h-4 mr-2" /> 新建对话
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">还没有会话</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                'group flex items-center justify-between px-3 py-3 hover:bg-accent cursor-pointer',
                c.id === activeId && 'bg-accent',
              )}
              onClick={() => c.id != null && onSelect(c.id)}
            >
              <span className="truncate text-sm flex-1">{c.title}</span>
              <button
                type="button"
                aria-label="删除"
                className="p-1.5 -m-1.5 opacity-40 hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  if (c.id != null) setConfirmDeleteId(c.id)
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-border space-y-2 safe-bottom">
        <Button variant="ghost" className="w-full justify-start" onClick={() => location.assign('/settings')}>
          <Settings className="w-4 h-4 mr-2" /> 管理密钥
        </Button>
        <p className="text-sm text-muted-foreground">当前：{activeProvider?.name ?? '未配置'}</p>
      </div>
      <Dialog open={confirmDeleteId != null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>删除对话？</DialogTitle>
            <DialogDescription>此操作不可撤销，所有消息和图片都将被删除。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (confirmDeleteId != null) await deleteConversation(confirmDeleteId)
                setConfirmDeleteId(null)
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
