import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, X } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const MAX_PROMPT_LEN = 4000

interface Props {
  onSend: (prompt: string, opts?: { editSourceMessageId?: number; uploadBlob?: Blob }) => void
  editSource?: { messageId: number; blobId: number; preview?: string }
  onClearEdit?: () => void
  bottomInset?: number
}

export function Composer({ onSend, editSource, onClearEdit, bottomInset = 0 }: Props) {
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

  const showIndicator = editSource != null || upload != null
  const previewUrl = upload?.preview ?? editSource?.preview ?? null
  const indicatorLabel = upload != null
    ? '正在基于本地图片编辑'
    : editSource != null
      ? '正在编辑引用图'
      : ''

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        transform: `translateY(-${bottomInset}px)`,
        backgroundColor: 'hsl(var(--background))',
        borderTop: '1px solid hsl(var(--border))',
        padding: '0.75rem 0.75rem',
        paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))`,
        zIndex: 50,
      }}
    >
      {showIndicator && (
        <div className="flex items-center gap-3 mb-2 p-2 bg-accent rounded-lg">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="引用图"
              className="w-14 h-14 rounded object-cover border border-border shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{indicatorLabel}</div>
            <div className="text-xs text-muted-foreground">点击 × 取消</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (upload) URL.revokeObjectURL(upload.preview)
              setUpload(null)
              onClearEdit?.()
            }}
            aria-label="取消编辑"
            className="h-11 w-11 shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
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
