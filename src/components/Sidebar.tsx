import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/useConversations'
import { Plus, Trash2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteConversation } from '@/lib/repo'
import { db, type Conversation } from '@/lib/db'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

interface Props {
  activeId?: number
  onSelect: (id: number) => void
  onNew: () => void
}

type ConvStatus = 'idle' | 'generating' | 'failed'

function useConversationStatuses(items: Conversation[]): Map<number, ConvStatus> {
  const [statuses, setStatuses] = useState<Map<number, ConvStatus>>(new Map())
  useEffect(() => {
    let cancelled = false
    const next = new Map<number, ConvStatus>()
    Promise.all(
      items.map(async (c) => {
        if (c.id == null) return
        const msgs = await db.messages.where('conversationId').equals(c.id).reverse().limit(5).toArray()
        if (msgs.some((m) => m.status === 'generating')) next.set(c.id, 'generating')
        else if (msgs.some((m) => m.status === 'failed')) next.set(c.id, 'failed')
        else next.set(c.id, 'idle')
      }),
    ).then(() => {
      if (!cancelled) setStatuses(next)
    })
    return () => { cancelled = true }
  }, [items])
  return statuses
}

export function Sidebar({ activeId, onSelect, onNew }: Props) {
  const conversations = useConversations()
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const statuses = useConversationStatuses(conversations)

  return (
    <aside className="w-64 border-r border-border flex flex-col h-full bg-card">
      <div className="p-3 border-b border-border space-y-2">
        <button
          data-card="new-chat"
          onClick={onNew}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-primary/30 hover:border-primary hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200"
          style={{ backgroundImage: 'var(--gradient-purple)' }}
        >
          <div
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundImage: 'var(--gradient-purple-icon)' }}
          >
            <Plus className="w-4 h-4" />
          </div>
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="text-sm font-semibold text-foreground">新建对话</span>
            <span className="text-[10px] text-muted-foreground">开启新的创作</span>
          </div>
          <Sparkles className="w-3.5 h-3.5 text-primary opacity-60" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">还没有会话</p>
        ) : (
          conversations.map((c) => {
            const status = c.id != null ? statuses.get(c.id) ?? 'idle' : 'idle'
            const barColor =
              status === 'generating' ? 'var(--status-generating-bar)' :
              status === 'failed' ? 'var(--status-failed-bar)' :
              'transparent'
            return (
              <div
                key={c.id}
                data-conversation={c.id}
                onClick={() => c.id != null && onSelect(c.id)}
                style={{ ['--bar-color' as string]: barColor }}
                className={cn(
                  'group relative flex items-center justify-between px-3 py-3 pl-4 cursor-pointer hover:bg-accent transition-colors',
                  c.id === activeId && 'bg-accent',
                )}
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                  style={{ backgroundImage: 'var(--bar-color)' }}
                />
                <span className="truncate text-sm flex-1 flex items-center gap-1.5">
                  {status === 'generating' && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  )}
                  {status === 'failed' && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                  )}
                  {c.title}
                </span>
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
            )
          })
        )}
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