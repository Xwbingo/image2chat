import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/hooks/useMessages'
import { updateMessageStatus } from '@/lib/repo'
import { MessageBubble } from './MessageBubble'

interface Props {
  conversationId: number
  title?: string
  onBack: () => void
  onOpenImage: (blobId: number) => void
  onRetry: (msgId: number) => void
  onEdit: (msgId: number) => void
}

export function ChatView({ conversationId, title, onBack, onOpenImage, onRetry, onEdit }: Props) {
  const messages = useMessages(conversationId)
  const scrollRef = useRef<HTMLDivElement>(null)

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
      <header className="flex items-center gap-2 p-3 border-b border-border">
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="font-semibold truncate">{title ?? `会话 #${conversationId}`}</h2>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">还没有消息，开始创作吧</p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onImageClick={onOpenImage}
              onRetry={onRetry}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  )
}