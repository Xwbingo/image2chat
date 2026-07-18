import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/useConversations'
import { useProviders } from '@/hooks/useProviders'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteConversation } from '@/lib/repo'

interface Props {
  activeId?: number
  onSelect: (id: number) => void
  onNew: () => void
}

export function Sidebar({ activeId, onSelect, onNew }: Props) {
  const conversations = useConversations()
  const providers = useProviders()
  const activeProvider = providers[0]

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
            <button
              key={c.id}
              onClick={() => c.id != null && onSelect(c.id)}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between group',
                c.id === activeId && 'bg-accent',
              )}
            >
              <span className="truncate text-sm">{c.title}</span>
              <Trash2
                className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); if (c.id != null) deleteConversation(c.id) }}
              />
            </button>
          ))
        )}
      </div>
      <div className="p-3 border-t border-border text-xs text-muted-foreground">
        当前：{activeProvider?.name ?? '未配置'}
      </div>
    </aside>
  )
}