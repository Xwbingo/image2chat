import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/hooks/useMessages'
import { updateMessageStatus } from '@/lib/repo'
import { cn } from '@/lib/utils'
import { Composer } from './Composer'
import { MessageBubble } from './MessageBubble'
import { ThemeToggle } from './ThemeToggle'
import type { ImageRef } from '@/lib/db'

interface Props {
  conversationId: number
  title?: string
  onBack: () => void
  onSettings: () => void
  onOpenImage: (blobId: number) => void
  onRemoteClick?: (url: string) => void
  onReference: (msgId: number) => void
  onSend: (prompt: string, refs: ImageRef[]) => void
  refs: ImageRef[]
  onAddLocal: (file: File) => void
  onRemoveRef: (blobId: number) => void
  onReorderRefs: (fromIndex: number, toIndex: number) => void
  onClearRefs: () => void
  bottomInset?: number
  statusBar?: ReactNode
}

const SIDEBAR_PX = 256
const MD_BREAKPOINT = 768

function formatDateLabel(timestamp: number): string {
  const d = new Date(timestamp)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return '今天'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return '昨天'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ChatView({
  conversationId,
  title,
  onBack,
  onSettings,
  onOpenImage,
  onRemoteClick,
  onReference,
  onSend,
  refs,
  onAddLocal,
  onRemoveRef,
  onReorderRefs,
  onClearRefs,
  bottomInset,
  statusBar,
}: Props) {
  const messages = useMessages(conversationId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [leftOffset, setLeftOffset] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const hasGenerating = messages.some((m) => m.status === 'generating')

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrollY(el.scrollTop)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setLeftOffset(window.innerWidth >= MD_BREAKPOINT ? SIDEBAR_PX : 0)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const STALE = 5 * 60 * 1000
    const now = Date.now()
    messages.forEach((m) => {
      if (m.status === 'generating' && now - m.createdAt > STALE && m.id != null) {
        void updateMessageStatus(m.id, 'failed', 'timeout')
      }
    })
  }, [messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex flex-col h-full">
      <header
        className={cn(
          'flex items-center gap-2 p-3 border-b border-border shrink-0 sticky top-0 z-30 backdrop-blur-md transition-colors',
          scrollY < 10 ? 'bg-background/60' : 'bg-background/85',
        )}
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="font-semibold truncate flex-1">{title ?? `会话 #${conversationId}`}</h2>
        <ThemeToggle />
        <Button size="icon" variant="ghost" onClick={onSettings} aria-label="密钥管理">
          <Settings className="w-4 h-4" />
        </Button>
      </header>
      <div
        ref={scrollRef}
        style={{ paddingBottom: `calc(9rem + env(safe-area-inset-bottom, 0px))` }}
        className="flex-1 overflow-y-auto p-3 sm:p-4"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">还没有消息，开始创作吧</p>
        ) : (
          (() => {
            const groups: Array<{ date: string; items: typeof messages }> = []
            for (const m of messages) {
              const label = formatDateLabel(m.createdAt)
              const last = groups[groups.length - 1]
              if (last && last.date === label) {
                last.items.push(m)
              } else {
                groups.push({ date: label, items: [m] })
              }
            }
            return groups.map((g) => (
              <div key={g.date}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-muted-foreground bg-card px-3 py-1 rounded-full border border-border">
                    {g.date}
                  </span>
                </div>
                {g.items.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onImageClick={onOpenImage}
                    onRemoteClick={onRemoteClick}
                    onReference={onReference}
                  />
                ))}
              </div>
            ))
          })()
        )}
      </div>
      <div
        style={{
          position: 'fixed',
          left: leftOffset,
          right: 0,
          bottom: 0,
          transform: `translateY(-${bottomInset ?? 0}px)`,
          zIndex: 40,
        }}
        className="flex flex-col bg-background border-t border-border"
      >
        {statusBar}
        <Composer
          refs={refs}
          onAddLocal={onAddLocal}
          onRemoveRef={onRemoveRef}
          onReorderRefs={onReorderRefs}
          onClearRefs={onClearRefs}
          onSend={onSend}
          disabled={hasGenerating}
        />
      </div>
    </div>
  )
}