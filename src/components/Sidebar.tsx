import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/useConversations'
import { Plus, Trash2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteConversation } from '@/lib/repo'
import { db, type Conversation } from '@/lib/db'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

interface Props {
  activeId?: number
  onSelect: (id: number) => void
  onNew: () => void
  hasConfiguredKey: boolean
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

const SWIPE_THRESHOLD = 72
const MD_BREAKPOINT = 768

export function Sidebar({ activeId, onSelect, onNew, hasConfiguredKey }: Props) {
  const conversations = useConversations()
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [swipedId, setSwipedId] = useState<number | null>(null)
  const [swipe, setSwipe] = useState<{ id: number; startX: number; startY: number; deltaX: number } | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const swipeRef = useRef<HTMLDivElement | null>(null)
  const pendingSwipeOpenRef = useRef<number | null>(null)
  const statuses = useConversationStatuses(conversations)
  const { toast } = useToast()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => {
      const mobile = window.innerWidth < MD_BREAKPOINT
      setIsMobile(mobile)
      if (!mobile) {
        setSwipedId(null)
        setSwipe(null)
        pendingSwipeOpenRef.current = null
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (swipedId == null) return
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (swipeRef.current && swipeRef.current.contains(target)) return
      setSwipedId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => { document.removeEventListener('pointerdown', handlePointerDown) }
  }, [swipedId])

  async function handleMobileDelete(id: number) {
    if (deletingId != null) return
    setDeletingId(id)
    setSwipedId(null)
    try {
      await deleteConversation(id)
    } catch (e) {
      toast({ variant: 'destructive', title: '删除失败', description: e instanceof Error ? e.message : String(e) })
    } finally {
      setDeletingId(null)
    }
  }

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
            <span className="text-sm font-semibold text-foreground">{hasConfiguredKey ? '新建对话' : '密钥管理'}</span>
            <span className="text-[10px] text-muted-foreground">开启新的创作</span>
          </div>
          <Sparkles className="w-3.5 h-3.5 text-primary opacity-60" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">还没有会话</p>
        ) : (
          <div ref={swipeRef}>
            {conversations.map((c) => {
              const status = c.id != null ? statuses.get(c.id) ?? 'idle' : 'idle'
              const barColor =
                status === 'generating' ? 'var(--status-generating-bar)' :
                status === 'failed' ? 'var(--status-failed-bar)' :
                'transparent'
              const isSwiping = isMobile && swipe?.id === c.id
              const isOpen = isMobile && swipedId === c.id
              const translateX = isSwiping
                ? Math.min(0, swipe!.deltaX)
                : isOpen
                  ? -SWIPE_THRESHOLD
                  : 0
              return (
                <div
                  key={c.id}
                  data-conversation={c.id}
                  style={{ ['--bar-color' as string]: barColor }}
                  className="relative overflow-hidden md:overflow-visible"
                  onClick={() => {
                    if (pendingSwipeOpenRef.current === c.id) {
                      pendingSwipeOpenRef.current = null
                      return
                    }
                    if (swipedId === c.id) {
                      setSwipedId(null)
                      return
                    }
                    if (c.id != null) onSelect(c.id)
                  }}
                  onPointerDown={(e) => {
                    if (!isMobile || c.id == null) return
                    if (swipedId != null && swipedId !== c.id) setSwipedId(null)
                    setSwipe({ id: c.id, startX: e.clientX, startY: e.clientY, deltaX: 0 })
                  }}
                  onPointerMove={(e) => {
                    if (!isMobile) return
                    const current = swipe
                    if (!current || current.id !== c.id) return
                    const deltaX = e.clientX - current.startX
                    const deltaY = e.clientY - current.startY
                    if (Math.abs(deltaX) <= Math.abs(deltaY)) return
                    setSwipe({ id: c.id, startX: current.startX, startY: current.startY, deltaX })
                  }}
                  onPointerUp={() => {
                    if (!isMobile) { setSwipe(null); return }
                    const current = swipe
                    if (!current || current.id !== c.id) {
                      setSwipe(null)
                      return
                    }
                    if (current.deltaX <= -SWIPE_THRESHOLD) {
                      setSwipedId(c.id ?? null)
                      pendingSwipeOpenRef.current = c.id ?? null
                    } else if (swipedId === c.id) {
                      setSwipedId(null)
                      pendingSwipeOpenRef.current = c.id ?? null
                    }
                    setSwipe(null)
                  }}
                  onPointerCancel={() => {
                    if (!isMobile) return
                    if (swipe?.id === c.id) setSwipe(null)
                  }}
                >
                  {isOpen && (
                    <button
                      type="button"
                      data-testid={`mobile-delete-${c.id}`}
                      aria-label="滑动删除"
                      className="md:hidden absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-destructive text-destructive-foreground active:opacity-80"
                      disabled={deletingId != null}
                      onPointerDown={(e) => { e.stopPropagation() }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (c.id != null) void handleMobileDelete(c.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div
                    style={{
                      transform: `translateX(${translateX}px)`,
                      transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
                      ...(isMobile ? { touchAction: 'pan-y' as const } : {}),
                    }}
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
                      data-testid={c.id != null ? `delete-${c.id}` : undefined}
                      aria-label="删除"
                      className="hidden md:inline-flex p-1.5 -m-1.5 opacity-40 hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (c.id != null) setConfirmDeleteId(c.id)
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
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