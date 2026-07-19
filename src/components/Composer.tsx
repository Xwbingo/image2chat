import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, X, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
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
}

export function Composer({
  refs,
  onAddLocal,
  onRemoveRef,
  onReorderRefs,
  onClearRefs,
  onSend,
}: Props) {
  const [text, setText] = useState('')
  const [thumbUrls, setThumbUrls] = useState<Map<number, string>>(new Map())
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

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
    const files = e.target.files
    if (!files || files.length === 0) return
    e.target.value = ''
    const remaining = MAX_REFS - refs.length
    if (remaining <= 0) {
      toast({ variant: 'destructive', title: '已达上限', description: `最多 ${MAX_REFS} 张参考图` })
      return
    }
    const fileArr = Array.from(files)
    const toAdd = fileArr.slice(0, remaining)
    const skipped = fileArr.length - toAdd.length
    if (skipped > 0) {
      toast({ title: `已添加 ${toAdd.length} 张`, description: `跳过 ${skipped} 张（最多 ${MAX_REFS} 张）` })
    }
    toAdd.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast({ variant: 'destructive', title: '图片过大', description: `${file.name} 超过 10MB` })
        return
      }
      onAddLocal(file)
    })
  }

  function handleSend() {
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

  function handleDragStart(idx: number, e: React.DragEvent) {
    setDraggingIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(targetIdx: number, e: React.DragEvent) {
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
                className={`relative shrink-0 w-16 h-16 rounded border-2 cursor-move ${isDragging ? 'border-primary opacity-50' : 'border-border'}`}
              >
                {url && <img src={url} alt="" className="w-full h-full object-cover rounded" />}
                <span className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] px-1 rounded-br">
                  {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveRef(ref.blobId, e)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  aria-label="移除参考图"
                  data-testid="remove-ref"
                >
                  <X className="w-3 h-3" />
                </button>
                {ref.kind === 'local' && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] truncate px-1">
                    {ref.fileName ?? '本地'}
                  </span>
                )}
                {ref.kind === 'chat' && ref.sourceMsgId != null && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] truncate px-1">
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
              className="shrink-0 w-16 h-16 rounded border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary"
              aria-label="添加参考图"
              data-testid="add-ref-empty-slot"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
      {refs.length === 0 && (
        <div className="mb-2 text-xs text-muted-foreground" data-testid="empty-hint">
          编辑模式：添加 1-{MAX_REFS} 张参考图
        </div>
      )}
      <input
        ref={fileInputRef}
        id="composer-file-input"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleFile}
      />
      <div className="flex gap-2 items-end">
        <Button
          size="icon"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          aria-label="上传参考图（可多选）"
          className="h-11 w-11 shrink-0"
          disabled={refs.length >= MAX_REFS}
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <Textarea
          placeholder={refs.length > 0 ? `基于 ${refs.length} 张参考图生成...` : '描述你想要的图像…'}
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