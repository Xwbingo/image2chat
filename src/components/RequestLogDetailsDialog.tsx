import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { db, type RequestLog } from '@/lib/db'
import { Clipboard } from 'lucide-react'

interface Props { logId: number }

export function RequestLogDetailsDialog({ logId }: Props) {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<RequestLog | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoaded(false)
    db.requestLogs.get(logId).then((row) => {
      setLog(row ?? null)
      setLoaded(true)
    }).catch(() => {
      setLog(null)
      setLoaded(true)
    })
  }, [open, logId])

  return (
    <>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}>
        <Clipboard className="w-3 h-3 mr-1" /> 查看请求详情
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-2">
          <DialogHeader>
            <DialogTitle>请求详情</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3">
            {!loaded ? null : log == null ? (
              <p className="text-sm text-muted-foreground">日志不存在或已过期（仅保留最近 100 条）</p>
            ) : (
              <>
                <Section label="时间">
                  {new Date(log.timestamp).toLocaleString('zh-CN')}
                  {log.durationMs != null && ` · 耗时 ${log.durationMs} ms`}
                </Section>
                <Section label="中转站" copyValue={log.providerBaseUrl ?? ''}>
                  <span>{log.providerName ?? '?'} <span className="text-muted-foreground text-xs">({log.providerBaseUrl ?? '?'})</span></span>
                </Section>
                {log.model && <Section label="模型">{log.model}</Section>}
                {log.corsProxyApplied && (
                  <Section label="CORS 代理"><Badge variant="outline">已启用</Badge></Section>
                )}
                <Section label="请求 URL" copyValue={log.url}>
                  <code className="text-xs break-all">{log.url}</code>
                </Section>
                <Section label="请求方法">{log.method}</Section>
                <Section label="请求 Headers" copyValue={JSON.stringify(log.headers, null, 2)}>
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(log.headers, null, 2)}</pre>
                </Section>
                <Section label="请求 Body" copyValue={log.body}>
                  <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-muted/30 p-2 rounded">{log.body}</pre>
                </Section>
                <Section label="HTTP 状态">
                  {log.responseStatus != null ? log.responseStatus : <span className="text-muted-foreground">网络异常（无响应）</span>}
                </Section>
                {log.responseHeaders && Object.keys(log.responseHeaders).length > 0 && (
                  <Section label="响应 Headers" copyValue={JSON.stringify(log.responseHeaders, null, 2)}>
                    <pre className="text-xs whitespace-pre-wrap bg-muted/30 p-2 rounded">{JSON.stringify(log.responseHeaders, null, 2)}</pre>
                  </Section>
                )}
                {log.responseBody != null && (
                  <Section label="响应 Body" copyValue={log.responseBody}>
                    <pre className="text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-muted/30 p-2 rounded">{log.responseBody}</pre>
                  </Section>
                )}
                <Section label="错误类型" copyValue={log.errorKind}><code>{log.errorKind}</code></Section>
                <Section label="错误信息" copyValue={log.errorMessage}><span className="text-xs">{log.errorMessage}</span></Section>
                {log.conversationId != null && (
                  <Section label="会话 / 消息">#{log.conversationId} / msg #{log.messageId ?? '?'}</Section>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Section({ label, children, copyValue }: { label: string; children: React.ReactNode; copyValue?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
        {copyValue != null && copyValue !== '' && (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => navigator.clipboard.writeText(copyValue)}
          >
            复制
          </button>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
