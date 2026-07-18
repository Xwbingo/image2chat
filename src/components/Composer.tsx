import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, X } from 'lucide-react'

interface Props {
  onSend: (prompt: string, editSourceMessageId?: number) => void
  editSource?: { messageId: number; blobId: number }
  onClearEdit?: () => void
}

export function Composer({ onSend, editSource, onClearEdit }: Props) {
  const [text, setText] = useState('')

  function handleSend() {
    const t = text.trim()
    if (!t) return
    onSend(t, editSource?.messageId)
    setText('')
  }

  return (
    <div className="border-t border-border p-3 bg-background">
      {editSource && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="bg-accent px-2 py-1 rounded">编辑模式</span>
          <button onClick={onClearEdit} className="hover:text-foreground"><X className="w-3 h-3" /></button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <Textarea
          placeholder="描述你想要的图像…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          rows={2}
          className="resize-none"
        />
        <Button onClick={handleSend} disabled={text.trim().length === 0} aria-label="发送">
          <Send className="w-4 h-4" />
          <span>发送</span>
        </Button>
      </div>
    </div>
  )
}