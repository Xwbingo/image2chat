import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, X, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { usePillToast } from '@/hooks/usePillToast'
import { db, type ImageRef } from '@/lib/db'

const MAX_PROMPT_LEN = 4000
const MAX_REFS = 3
const MAX_FILE_SIZE = 10 * 1024 * 1024

interface Props {
  refs: ImageRef[]
  onAddLocal: (file: File) => void
  onRemoveRef: (blobId: number) => void
  onReorderRefs: (fromIndex: number, toIndex: number) => void
  onClearRefs: () => void
  onSend: (prompt: string, refs: ImageRef[]) => void
  /**
   * Disables the Send button independently of the prompt-empty guard.
   * Parent (ChatView) sets this true while a generation is in flight
   * in the current conversation, so accidental double-sends don't
   * spawn phantom `generating` messages on top of each other.
   */
  disabled?: boolean
}

export function Composer({
  refs,
  onAddLocal,
  onRemoveRef,
  onReorderRefs,
  onClearRefs,
  onSend,
  disabled = false,
}: Props) {
  const [text, setText] = useState('')
  const [thumbUrls, setThumbUrls] = useState<Map<number, string>>(new Map())
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [focused, setFocused] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const pill = usePillToast.getState()

  useEffect(() => {
    let cancelled = false
    const next = new Map<number, string>()
    Promise.all(
      refs.map(async (ref) => {
        const img = await db.images.get(ref.blobId)
        if (img && !cancelled) next.set(ref.blobId, URL.createObjectURL(img.blob))
      }),
    ).then(() => {
      if (cancelled) return
      setThumbUrls((prev) => {
        const out = new Map(prev)
        for (const [id, url] of out) {
          if (!next.has(id)) {
            URL.revokeObjectURL(url)
            out.delete(id)
          }
        }
        for (const [id, url] of next) out.set(id, url)
        return out
      })
    })
    return () => {
      cancelled = true
    }
  }, [refs])

  useEffect(() => {
    const urls = thumbUrls
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
    }
  }, [thumbUrls])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    const remaining = MAX_REFS - refs.length
    if (remaining <= 0) {
      toast({ variant: 'destructive', title: '已达上限', description: `最多 ${MAX_REFS} 张参考图` })
      return
    }
    const accepted: File[] = []
    const oversized: File[] = []
    const droppedByLimit: string[] = []
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        oversized.push(f)
        continue
      }
      if (accepted.length < remaining) {
        accepted.push(f)
      } else {
        droppedByLimit.push(f.name)
      }
    }
    for (const f of accepted) onAddLocal(f)
    if (accepted.length > 0) {
      pill.show('已添加参考图', { variant: 'success' })
    }
    if (oversized.length > 0 && droppedByLimit.length > 0) {
      toast({
        variant: 'destructive',
        title: '部分文件未添加',
        description: `${oversized.map((f) => f.name).join('、')} 超过 10MB；${droppedByLimit.join('、')} 已达上限`,
      })
    } else if (oversized.length > 0) {
      toast({
        variant: 'destructive',
        title: oversized.length === 1 ? '图片过大' : '部分图片过大',
        description: `${oversized.map((f) => f.name).join('、')} 超过 10MB`,
      })
    } else if (droppedByLimit.length > 0) {
      toast({
        variant: 'destructive',
        title: '已达上限',
        description: `${droppedByLimit.join('、')} 未添加，最多 ${MAX_REFS} 张参考图`,
      })
    }
  }

  function handleSend() {
    if (disabled) return
    const t = text.trim()
    if (!t) return
    if (t.length > MAX_PROMPT_LEN) {
      toast({ variant: 'destructive', title: '提示词过长', description: `请控制在 ${MAX_PROMPT_LEN} 字以内` })
      return
    }
    onSend(t, refs)
    setText('')
    onClearRefs()
  }

  function handleDragStart(idx: number, e: DragEvent) {
    setDraggingIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(targetIdx: number, e: DragEvent) {
    e.preventDefault()
    const from = draggingIdx ?? Number(e.dataTransfer.getData('text/plain'))
    setDraggingIdx(null)
    if (Number.isNaN(from) || from === targetIdx) return
    onReorderRefs(from, targetIdx)
  }

  function handleRemoveRef(blobId: number, e: React.MouseEvent) {
    e.stopPropagation()
    onRemoveRef(blobId)
  }

  function handlePillDragOver(e: DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handlePillDragLeave(e: DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOver(false)
  }

  function handlePillDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      const fake = { target: { files: [file], value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFile(fake)
    }
  }

  const showIndicator = refs.length > 0

  return (
    <div
      style={{
        backgroundColor: 'hsl(var(--background))',
        borderTop: '1px solid hsl(var(--border))',
        padding: '0.75rem 0.75rem',
        paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))`,
      }}
      className="md:left-64"
    >
      {showIndicator && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2" data-testid="refs-strip">
          {refs.map((ref, idx) => {
            const url = thumbUrls.get(ref.blobId)
            const isDragging = draggingIdx === idx
            return (
              <div
                key={ref.blobId}
                draggable
                onDragStart={(e) => handleDragStart(idx, e)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(idx, e)}
                onDragEnd={() => setDraggingIdx(null)}
                data-testid="ref-thumb"
                data-ref-index={idx}
                data-ref-kind={ref.kind}
                className={`relative shrink-0 w-16 h-16 rounded-lg border cursor-move ${isDragging ? 'border-primary opacity-50' : 'border-border'}`}
              >
                {url && <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />}
                <span className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] px-1 rounded-br">
                  {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveRef(ref.blobId, e)}
                  className="absolute -top-1.5 -right-1.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                  aria-label="移除参考图"
                  data-testid="remove-ref"
                >
                  <X className="w-3 h-3" />
                </button>
                {ref.kind === 'local' && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] truncate px-1 rounded-b-lg">
                    {ref.fileName ?? '本地'}
                  </span>
                )}
                {ref.kind === 'chat' && ref.sourceMsgId != null && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] truncate px-1 rounded-b-lg">
                    #{ref.sourceMsgId}
                  </span>
                )}
              </div>
            )
          })}
          {refs.length < MAX_REFS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary"
              aria-label="添加参考图"
              data-testid="add-ref-empty-slot"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFile}
        data-testid="file-input"
      />
      <div
        data-pill
        onDragOver={handlePillDragOver}
        onDragLeave={handlePillDragLeave}
        onDrop={handlePillDrop}
        className={[
          'flex gap-2 items-end px-3 py-2.5 shadow-pill transition-all duration-200',
          focused ? 'bg-background shadow-pill-focus' : 'bg-muted',
          dragOver ? 'border-2 border-primary bg-primary/5 shadow-pill-drag' : 'border-2 border-transparent',
        ].join(' ')}
        style={{ borderRadius: '24px' }}
      >
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          aria-label="上传参考图（可多选）"
          className="h-10 w-10 rounded-full shrink-0"
          disabled={refs.length >= MAX_REFS}
          data-testid="upload-button"
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <Textarea
          placeholder={refs.length > 0 ? `基于 ${refs.length} 张参考图生成...` : '描述你想要的图像…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          rows={1}
          className="resize-none min-h-[40px] max-h-32 text-base flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-1"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || text.trim().length === 0}
          aria-label="发送"
          className="h-10 w-10 rounded-full shrink-0 p-0"
          data-testid="send-button"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}