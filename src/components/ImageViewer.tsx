import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { createObjectURLSafe, revokeObjectURLSafe, downloadBlob, copyToClipboard } from '@/lib/image'
import { usePillToast } from '@/hooks/usePillToast'
import { Download, Copy } from 'lucide-react'

interface Props {
  blobId: number | null
  prompt?: string
  onClose: () => void
}

export function ImageViewer({ blobId, prompt, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [mime, setMime] = useState<string>('image/png')
  const pill = usePillToast.getState()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (blobId == null) return
    let cancelled = false
    let currentUrl: string | null = null
    db.images.get(blobId).then((img) => {
      if (cancelled || !img) return
      currentUrl = createObjectURLSafe(img.blob)
      setMime(img.mimeType)
      setUrl(currentUrl)
      requestAnimationFrame(() => {
        const el = containerRef.current
        if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: 0 })
      })
    })
    return () => {
      cancelled = true
      if (currentUrl) revokeObjectURLSafe(currentUrl)
    }
  }, [blobId])

  if (blobId == null) return null

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-background p-2 max-h-[90vh] flex flex-col gap-2">
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex items-start justify-center bg-muted/30 rounded min-h-0 py-4"
          style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
        >
          {url && (
            <img
              src={url}
              alt="result"
              className="max-w-full object-contain select-none"
              draggable={false}
              style={{ cursor: 'grab', touchAction: 'pinch-zoom' }}
            />
          )}
        </div>
        <div className="flex gap-2 p-2 shrink-0">
          <Button onClick={async () => {
            if (!url) return
            const r = await fetch(url)
            const b = await r.blob()
            await downloadBlob(b, `image2chat-${Date.now()}.${mime.split('/')[1] ?? 'png'}`)
            pill.show('已保存到下载', { variant: 'success' })
          }}>
            <Download className="w-4 h-4 mr-2" /> 保存到设备
          </Button>
          {prompt && (
            <Button variant="outline" onClick={async () => {
              await copyToClipboard(prompt)
              pill.show('已复制 prompt', { variant: 'success' })
            }}>
              <Copy className="w-4 h-4 mr-2" /> 复制 prompt
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
