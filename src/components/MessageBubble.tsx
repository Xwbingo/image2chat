import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import type { Message } from '@/lib/db'
import { createObjectURLSafe, revokeObjectURLSafe } from '@/lib/image'
import { cn } from '@/lib/utils'

interface Props {
  message: Message
  onImageClick: (blobId: number) => void
  onRetry: (msgId: number) => void
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

function isRetryable(errorCode?: string): boolean {
  if (!errorCode) return true
  return ['rate_limited', 'server_error', 'network', '500', '429'].includes(errorCode)
}

export function MessageBubble({ message, onImageClick, onRetry, onEdit }: Props) {
  const isUser = message.role === 'user'
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

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
  }, [message.imageBlobId, message.status])

  useEffect(() => {
    if (message.status !== 'generating') return
    const id = setInterval(() => setTick((t) => t + 1), 4000)
    return () => clearInterval(id)
  }, [message.status])

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[70%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2">
          {message.prompt && <p className="whitespace-pre-wrap break-words">{message.prompt}</p>}
          {message.imageBlobId && blobUrl && <img src={blobUrl} alt="" className="mt-2 rounded max-w-full" />}
        </div>
      </div>
    )
  }

  const label = GENERATING_LABELS[tick % GENERATING_LABELS.length]

  return (
    <div className="flex justify-start mb-3">
      <div className={cn(
        'max-w-[70%] rounded-2xl rounded-bl-sm px-3 py-2',
        message.status === 'failed' ? 'border border-destructive' : 'border border-border',
      )}>
        {message.status === 'pending' || message.status === 'generating' ? (
          <div className="h-48 w-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">{label}</span>
          </div>
        ) : message.status === 'success' ? (
          <>
            {(blobUrl || message.remoteImageUrl) && (
              <img
                src={blobUrl ?? message.remoteImageUrl!}
                alt=""
                className="rounded cursor-zoom-in"
                onClick={() => message.imageBlobId != null && onImageClick(message.imageBlobId)}
              />
            )}
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => message.imageBlobId != null && onImageClick(message.imageBlobId)}>查看</Button>
              <Button size="sm" variant="outline" onClick={() => message.id != null && onEdit(message.id)}>编辑</Button>
            </div>
          </>
        ) : (
          <div className="p-2">
            <p className="text-sm text-destructive mb-2">
              {ERROR_DISPLAY[message.errorCode ?? ''] ?? message.errorCode ?? '生成失败'}
            </p>
            {isRetryable(message.errorCode) ? (
              <Button size="sm" variant="outline" onClick={() => message.id != null && onRetry(message.id)}>
                <RefreshCw className="w-3 h-3 mr-1" /> 重试
              </Button>
            ) : message.errorCode === '401' ? (
              <Button size="sm" variant="outline" onClick={() => location.assign('/settings')}>
                <SettingsIcon className="w-3 h-3 mr-1" /> 去设置
              </Button>
            ) : (
              <Button size="sm" variant="ghost">我知道了</Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}