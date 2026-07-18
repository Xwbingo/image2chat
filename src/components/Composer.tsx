import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Paperclip, Send, X } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const MAX_PROMPT_LEN = 4000

interface Props {
  onSend: (prompt: string, opts?: { editSourceMessageId?: number; uploadBlob?: Blob }) => void
  editSource?: { messageId: number; blobId: number }
  onClearEdit?: () => void
}

export function Composer({ onSend, editSource, onClearEdit }: Props) {
  const [text, setText] = useState('')
  const [upload, setUpload] = useState<{ blob: Blob; preview: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: '图片过大', description: '请选择 10MB 以内的图片' })
      e.target.value = ''
      return
    }
    if (upload) URL.revokeObjectURL(upload.preview)
    const preview = URL.createObjectURL(file)
    setUpload({ blob: file, preview })
    e.target.value = ''
  }

  function clearUpload() {
    if (upload) URL.revokeObjectURL(upload.preview)
    setUpload(null)
  }

  function handleSend() {
    const t = text.trim()
    if (!t) return
    if (t.length > MAX_PROMPT_LEN) {
      toast({ variant: 'destructive', title: '提示词过长', description: `请控制在 ${MAX_PROMPT_LEN} 字以内` })
      return
    }
    onSend(t, { editSourceMessageId: editSource?.messageId, uploadBlob: upload?.blob })
    setText('')
    clearUpload()
  }

  return (
    <div className="border-t border-border p-3 bg-background">
      {editSource && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="bg-accent px-2 py-1 rounded">编辑模式</span>
          <button onClick={onClearEdit} className="hover:text-foreground"><X className="w-3 h-3" /></button>
        </div>
      )}
      {upload && (
        <div className="mb-2 relative inline-block">
          <img src={upload.preview} alt="upload preview" className="h-16 rounded border border-border" />
          <button onClick={clearUpload} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5" aria-label="清除上传图片"><X className="w-3 h-3" /></button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button size="icon" variant="outline" onClick={() => fileRef.current?.click()} aria-label="上传图片">
          <Paperclip className="w-4 h-4" />
        </Button>
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
