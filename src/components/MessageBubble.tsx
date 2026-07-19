import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import type { Message } from '@/lib/db'
import { createObjectURLSafe, revokeObjectURLSafe } from '@/lib/image'
import { cn } from '@/lib/utils'

interface Props {
  message: Message
  onImageClick: (blobId: number) => void
  onRemoteClick?: (url: string) => void
  onEdit: (msgId: number) => void
}

const GENERATING_LABELS = ['正在创作…', '勾勒中', '渲染中', '精修中']

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

function formatClockShort(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function MessageBubble({ message, onImageClick, onRemoteClick, onEdit }: Props) {
  const isUser = message.role === 'user'
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (message.status !== 'success' || !message.imageBlobId) return
    let cancelled = false
    let currentUrl: string | null = null
    db.images.get(message.imageBlobId).then((img) => {
      if (cancelled || !img) return
      currentUrl = createObjectURLSafe(img.blob)
      setBlobUrl(currentUrl)
    })
    return () => {
      cancelled = true
      if (currentUrl) revokeObjectURLSafe(currentUrl)
    }
  }, [message.imageBlobId, message.status, message.kind])

  useEffect(() => {
    if (message.status !== 'generating') return
    const id = setInterval(() => setTick((t) => t + 1), 4000)
    return () => clearInterval(id)
  }, [message.status])

  useEffect(() => {
    if (message.status !== 'generating' || !message.startedAt) {
      setElapsed(0)
      return
    }
    const tick = () => setElapsed(Date.now() - message.startedAt!)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [message.status, message.startedAt])

  const sourceMsg = useLiveQuery(
    async () => message.editSourceMessageId != null
      ? await db.messages.get(message.editSourceMessageId)
      : undefined,
    [message.editSourceMessageId],
  )

  if (isUser) {
    const isEdit = message.kind === 'image_edit_request' && message.imageBlobId != null
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] flex flex-col items-end gap-2">
          {isEdit && blobUrl && (
            <button
              type="button"
              onClick={() => message.imageBlobId != null && onImageClick(message.imageBlobId)}
              className="flex items-center gap-2 px-2 py-1.5 bg-accent/60 hover:bg-accent rounded-lg max-w-full transition-colors"
            >
              <img
                src={blobUrl}
                alt="引用图"
                className="w-12 h-12 rounded object-cover border border-border shrink-0"
              />
              <div className="text-left min-w-0">
                <div className="text-xs font-medium">
                  {message.editSourceMessageId != null
                    ? `引用了 #${message.editSourceMessageId} 张图`
                    : `本地图片${message.localUploadName ? `：${message.localUploadName}` : ''}`}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {message.editSourceMessageId != null
                    ? (sourceMsg?.createdAt
                        ? `生成于 ${formatClockShort(sourceMsg.createdAt)}`
                        : '点击查看大图')
                    : formatClockShort(message.createdAt)}
                </div>
              </div>
            </button>
          )}
          {isEdit && !blobUrl && (
            <div className="text-xs bg-accent text-accent-foreground rounded-lg px-3 py-1.5">
              {message.editSourceMessageId != null
                ? `引用了 #${message.editSourceMessageId} 张图`
                : `本地图片${message.localUploadName ? `：${message.localUploadName}` : ''}`}
            </div>
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

  const label = GENERATING_LABELS[tick % GENERATING_LABELS.length]
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
            <span className="text-sm">{label}</span>
            {message.startedAt && (
              <span className="text-xs">已耗时 {formatDuration(elapsed)}</span>
            )}
          </div>
        ) : message.status === 'success' ? (
          <>
            {(blobUrl || message.remoteImageUrl) && (
              <img
                src={blobUrl ?? message.remoteImageUrl!}
                alt=""
                className="rounded cursor-zoom-in"
                onClick={() => message.imageBlobId != null ? onImageClick(message.imageBlobId) : message.remoteImageUrl && onRemoteClick?.(message.remoteImageUrl)}
              />
            )}
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => message.imageBlobId != null ? onImageClick(message.imageBlobId) : message.remoteImageUrl && onRemoteClick?.(message.remoteImageUrl)}>查看</Button>
              <Button size="sm" variant="outline" onClick={() => message.id != null && onEdit(message.id)}>编辑</Button>
            </div>
            {(message.size || elapsedMs != null) && (
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                {message.size && <span>{message.size}</span>}
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