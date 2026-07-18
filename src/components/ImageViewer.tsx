import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { createObjectURLSafe, revokeObjectURLSafe, downloadBlob, copyToClipboard } from '@/lib/image'
import { useToast } from '@/components/ui/use-toast'
import { Download, Copy } from 'lucide-react'

interface Props {
  blobId: number | null
  prompt?: string
  onClose: () => void
}

export function ImageViewer({ blobId, prompt, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [mime, setMime] = useState<string>('image/png')
  const { toast } = useToast()

  useEffect(() => {
    if (blobId == null) return
    let cancelled = false
    let currentUrl: string | null = null
    db.images.get(blobId).then((img) => {
      if (cancelled || !img) return
      currentUrl = createObjectURLSafe(img.blob)
      setMime(img.mimeType)
      setUrl(currentUrl)
    })
    return () => {
      cancelled = true
      if (currentUrl) revokeObjectURLSafe(currentUrl)
    }
  }, [blobId])

  if (blobId == null) return null

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-background p-2">
        {url && <img src={url} alt="result" className="w-full h-auto rounded" />}
        <div className="flex gap-2 p-2">
          <Button onClick={async () => {
            if (!url) return
            const r = await fetch(url)
            const b = await r.blob()
            await downloadBlob(b, `image2chat-${Date.now()}.${mime.split('/')[1] ?? 'png'}`)
            toast({ title: '已保存到下载' })
          }}>
            <Download className="w-4 h-4 mr-2" /> 保存到设备
          </Button>
          {prompt && (
            <Button variant="outline" onClick={async () => {
              await copyToClipboard(prompt)
              toast({ title: '已复制 prompt' })
            }}>
              <Copy className="w-4 h-4 mr-2" /> 复制 prompt
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}