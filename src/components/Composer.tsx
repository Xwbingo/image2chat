import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, X } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const MAX_PROMPT_LEN = 4000

interface Props {
  onSend: (prompt: string, editSourceMessageId?: number) => void
  editSource?: { messageId: number; blobId: number }
  onClearEdit?: () => void
}

export function Composer({ onSend, editSource, onClearEdit }: Props) {
  const [text, setText] = useState('')
  const { toast } = useToast()

  function handleSend() {
    const t = text.trim()
    if (!t) return
    if (t.length > MAX_PROMPT_LEN) {
      toast({ variant: 'destructive', title: '提示词过长', description: `请控制在 ${MAX_PROMPT_LEN} 字以内` })
      return
    }
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