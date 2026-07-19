import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, X } from 'lucide-react'
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
  const { toast } = useToast()

  function handleSend() {
    const t = text.trim()
    if (!t) return
    if (t.length > MAX_PROMPT_LEN) {
      toast({ variant: 'destructive', title: '提示词过长', description: `请控制在 ${MAX_PROMPT_LEN} 字以内` })
      return
    }
    onSend(t, { editSourceMessageId: editSource?.messageId, uploadBlob: upload?.blob })
    setText('')
    if (upload) URL.revokeObjectURL(upload.preview)
    setUpload(null)
  }

  return (
    <div
      className="border-t border-border bg-background px-3 pt-3"
      style={{
        // Reliable safe-area + browser-chrome fallback (Android Chrome bottom nav = ~48dp)
        paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))',
      }}
    >
      {editSource && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="bg-accent px-2 py-1 rounded">编辑模式</span>
          <button onClick={onClearEdit} aria-label="取消编辑" className="hover:text-foreground p-1 -m-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {upload && (
        <div className="mb-2 relative inline-block">
          <img src={upload.preview} alt="upload preview" className="h-16 rounded border border-border" />
          <button
            onClick={() => { URL.revokeObjectURL(upload.preview); setUpload(null) }}
            aria-label="移除图片"
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <input
          id="composer-file-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (file.size > 10 * 1024 * 1024) {
              toast({ variant: 'destructive', title: '图片过大', description: '请选择 10MB 以内的图片' })
              return
            }
            const preview = URL.createObjectURL(file)
            setUpload({ blob: file, preview })
            e.target.value = ''
          }}
        />
        <Button
          size="icon"
          variant="outline"
          onClick={() => document.getElementById('composer-file-input')?.click()}
          aria-label="上传图片"
          className="h-11 w-11 shrink-0"
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <Textarea
          placeholder="描述你想要的图像…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          rows={1}
          className="resize-none min-h-[44px] max-h-32 text-base flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={text.trim().length === 0}
          aria-label="发送"
          className="h-11 px-4 shrink-0"
        >
          <Send className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">发送</span>
        </Button>
      </div>
    </div>
  )
}
