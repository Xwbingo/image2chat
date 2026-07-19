import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/hooks/useMessages'
import { updateMessageStatus } from '@/lib/repo'
import { Composer } from './Composer'
import { MessageBubble } from './MessageBubble'

interface Props {
  conversationId: number
  title?: string
  onBack: () => void
  onSettings: () => void
  onOpenImage: (blobId: number) => void
  onRemoteClick?: (url: string) => void
  onRetry: (msgId: number) => void
  onEdit: (msgId: number) => void
  onSend: (prompt: string, opts?: { editSourceMessageId?: number; uploadBlob?: Blob; size?: string }) => void
  editSource?: { messageId: number; blobId: number; preview?: string; sourceCreatedAt?: number; sourceKind?: 'local' | 'chat' }
  onClearEdit?: () => void
  onPreviewImage?: (blobId: number) => void
  bottomInset?: number
  statusBar?: ReactNode
}

const SIDEBAR_PX = 256
const MD_BREAKPOINT = 768

export function ChatView({
  conversationId,
  title,
  onBack,
  onSettings,
  onOpenImage,
  onRemoteClick,
  onRetry,
  onEdit,
  onSend,
  editSource,
  onClearEdit,
  onPreviewImage,
  bottomInset,
  statusBar,
}: Props) {
  const messages = useMessages(conversationId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [leftOffset, setLeftOffset] = useState(0)

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
      <header className="flex items-center gap-2 p-3 border-b border-border safe-top shrink-0">
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="font-semibold truncate flex-1">{title ?? `会话 #${conversationId}`}</h2>
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
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onImageClick={onOpenImage}
              onRemoteClick={onRemoteClick}
              onRetry={onRetry}
              onEdit={onEdit}
            />
          ))
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
      >
        {statusBar}
        <Composer
          onSend={onSend}
          editSource={editSource}
          onClearEdit={onClearEdit}
          onPreviewImage={onPreviewImage}
        />
      </div>
    </div>
  )
}