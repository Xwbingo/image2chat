import { useEffect, useState } from 'react'
import { Loader2, Copy } from 'lucide-react'
import { db } from '@/lib/db'
import type { Message, ImageRef } from '@/lib/db'
import { createObjectURLSafe, revokeObjectURLSafe, copyToClipboard } from '@/lib/image'
import { usePillToast } from '@/hooks/usePillToast'
import { cn } from '@/lib/utils'

interface Props {
  message: Message
  onImageClick: (blobId: number) => void
  onRemoteClick?: (url: string) => void
  onReference: (msgId: number) => void
  progressPercent?: number
}

const ERROR_DISPLAY: Record<string, string> = {
  'unauthorized': '密钥无效或已过期',
  'insufficient': '余额不足',
  'rate_limited': '请求过快，请稍后再试',
  'content_filtered': '内容未通过审核',
  'bad_request': '请求参数错误',
  'server_error': '服务异常，请稍后再试',
  'network': '网络异常',
  '500': '服务异常，请稍后再试',
  '429': '请求过快，请稍后再试',
  'timeout': '请求超时，请稍后再试',
}

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return `${sec} 秒`
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  return `${min} 分 ${remSec} 秒`
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`
  }
  const mb = bytes / (1024 * 1024)
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`
}

function MultiRefStrip({ refs, onPreview }: { refs: ImageRef[]; onPreview: (blobId: number) => void }) {
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    const next = new Map<number, string>()
    Promise.all(
      refs.map(async (r) => {
        const img = await db.images.get(r.blobId)
        if (img && !cancelled) next.set(r.blobId, URL.createObjectURL(img.blob))
      }),
    ).then(() => {
      if (cancelled) return
      setThumbs((prev) => {
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
    return () => { cancelled = true }
  }, [refs])

  useEffect(() => {
    return () => {
      for (const url of thumbs.values()) URL.revokeObjectURL(url)
    }
  }, [thumbs])

  return (
    <div className="flex gap-1.5 flex-wrap justify-end items-center" data-testid="multi-ref-strip">
      {refs.map((ref, idx) => {
        const url = thumbs.get(ref.blobId)
        return (
          <button
            key={ref.blobId}
            type="button"
            onClick={() => onPreview(ref.blobId)}
            data-testid="multi-ref-thumb"
            data-ref-index={idx}
            data-ref-kind={ref.kind}
            className="relative w-14 h-14 rounded-lg overflow-hidden border border-border hover:border-primary"
          >
            {url && <img src={url} alt="" className="w-full h-full object-cover" />}
            <span className="absolute top-0 left-0 bg-primary text-primary-foreground text-[9px] px-1 rounded-br">
              {idx + 1}
            </span>
            {ref.kind === 'chat' && ref.sourceMsgId != null && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] truncate px-1">
                #{ref.sourceMsgId}
              </span>
            )}
            {ref.kind === 'local' && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] truncate px-1">
                本地
              </span>
            )}
          </button>
        )
      })}
      <span className="text-xs text-muted-foreground self-center" data-testid="ref-count-label">
        引用了 {refs.length} 张图
      </span>
    </div>
  )
}

function PillButton({
  variant,
  onClick,
  children,
}: {
  variant: 'primary' | 'outline'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border border-border text-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}

export function MessageBubble({ message, onImageClick, onRemoteClick, onReference, progressPercent }: Props) {
  const isUser = message.role === 'user'
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [blobSize, setBlobSize] = useState<number | null>(null)
  const pill = usePillToast.getState()

  useEffect(() => {
    if (message.status !== 'success' || !message.imageBlobId) return
    let cancelled = false
    let currentUrl: string | null = null
    setBlobSize(null)
    db.images.get(message.imageBlobId).then((img) => {
      if (cancelled || !img) return
      currentUrl = createObjectURLSafe(img.blob)
      setBlobUrl(currentUrl)
      setBlobSize(img.blob.size)
    })
    return () => {
      cancelled = true
      if (currentUrl) revokeObjectURLSafe(currentUrl)
    }
  }, [message.imageBlobId, message.status, message.kind])

  if (isUser) {
    const isEdit = message.kind === 'image_edit_request'
    const refs = message.imageRefs ?? []
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] flex flex-col items-end gap-2">
          {isEdit && refs.length > 0 && (
            <MultiRefStrip refs={refs} onPreview={onImageClick} />
          )}
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-full">
            {message.prompt && <p className="whitespace-pre-wrap break-words">{message.prompt}</p>}
            {message.imageBlobId && message.kind !== 'image_edit_request' && blobUrl && (
              <img src={blobUrl} alt="" className="mt-2 rounded max-w-full" />
            )}
          </div>
          {message.createdAt ? (
            <span className="text-[10px] text-muted-foreground">
              {formatClock(message.createdAt)}
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  const elapsedMs =
    message.startedAt != null && message.completedAt != null
      ? Math.max(0, message.completedAt - message.startedAt)
      : null

  return (
    <div className="flex justify-start mb-3">
      <div className={cn(
        'max-w-[70%] rounded-2xl rounded-bl-sm px-3 py-2',
        message.status === 'failed' ? 'border border-destructive' : 'border border-border',
      )}>
        {message.status === 'pending' || message.status === 'generating' ? (
          <div className="h-48 w-full max-w-xs sm:w-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">正在创作…</span>
            {progressPercent != null && (
              <span className="text-xs tabular-nums">{progressPercent}%</span>
            )}
          </div>
        ) : message.status === 'success' ? (
          <>
            {(blobUrl || message.remoteImageUrl) && (
              <img
                src={blobUrl ?? message.remoteImageUrl!}
                alt=""
                className="rounded-lg cursor-zoom-in"
                onClick={() => message.imageBlobId != null ? onImageClick(message.imageBlobId) : message.remoteImageUrl && onRemoteClick?.(message.remoteImageUrl)}
              />
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              <PillButton
                variant="primary"
                onClick={() => message.imageBlobId != null ? onImageClick(message.imageBlobId) : message.remoteImageUrl && onRemoteClick?.(message.remoteImageUrl)}
              >
                查看
              </PillButton>
              <PillButton
                variant="outline"
                onClick={() => message.id != null && onReference(message.id)}
              >
                引用
              </PillButton>
              {message.prompt && (
                <PillButton
                  variant="outline"
                  onClick={async () => {
                    await copyToClipboard(message.prompt!)
                    pill.show('已复制 prompt', { variant: 'success' })
                  }}
                >
                  <Copy className="w-3 h-3" /> 复制 prompt
                </PillButton>
              )}
            </div>
            {(message.size || elapsedMs != null || blobSize != null) && (
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                {message.size && <span>{message.size}</span>}
                {blobSize != null && <span data-testid="image-size">{formatBytes(blobSize)}</span>}
                {elapsedMs != null && <span>耗时 {formatDuration(elapsedMs)}</span>}
              </div>
            )}
          </>
        ) : (
          <div className="p-2">
            <p className="text-sm text-destructive">
              {ERROR_DISPLAY[message.errorCode ?? ''] ?? message.errorCode ?? '生成失败'}
            </p>
            {message.errorCode === '401' && (
              <p className="text-xs text-muted-foreground mt-1">
                请到「密钥管理」更新密钥后重新发送
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
