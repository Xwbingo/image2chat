import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Trash2, Plus, Zap, ChevronDown } from 'lucide-react'
import { useProviders } from '@/hooks/useProviders'
import { addProvider, updateProvider, deleteProvider } from '@/lib/repo'
import { db, type ProviderPreset } from '@/lib/db'
import { validateApiKey } from '@/lib/api/validate'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { usePillToast } from '@/hooks/usePillToast'
import { useSettings } from '@/stores/useSettings'
import { corsDraftFromValue, corsValueFromDraft, type CorsDraft } from '@/lib/api/corsConfig'

export function SettingsSheet() {
  const providers = useProviders()
  const open = useSettings((s) => s.open)
  const [keyDrafts, setKeyDrafts] = useState<Record<number, string>>({})
  const [corsDrafts, setCorsDrafts] = useState<Record<number, CorsDraft>>({})
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [testingId, setTestingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setKeyDrafts((prev) => {
      if (Object.keys(prev).length > 0) return prev
      const k: Record<number, string> = {}
      for (const p of providers) {
        if (p.id == null) continue
        k[p.id] = p.apiKey
      }
      return k
    })
    setCorsDrafts((prev) => {
      const next: Record<number, CorsDraft> = { ...prev }
      let changed = false
      for (const p of providers) {
        if (p.id == null) continue
        if (next[p.id] == null) {
          next[p.id] = corsDraftFromValue(p.corsProxy)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [providers])

  async function handleSave() {
    setSaving(true)
    try {
      for (const p of providers) {
        if (p.id == null) continue
        const patch: Partial<ProviderPreset> = {}
        if (keyDrafts[p.id] !== p.apiKey) patch.apiKey = keyDrafts[p.id] ?? ''
        const newValue = corsValueFromDraft(corsDrafts[p.id] ?? { mode: 'direct', customValue: '' })
        if (newValue !== (p.corsProxy ?? undefined)) {
          patch.corsProxy = newValue
        }
        if (Object.keys(patch).length > 0) {
          await updateProvider(p.id, patch)
        }
      }
      useSettings.getState().closeSettings()
    } finally {
      setSaving(false)
    }
  }

  async function saveAdd() {
    if (!name.trim() || !url.trim()) return
    const existing = await db.providers.where('baseUrl').equals(url.trim()).first()
    if (existing?.id != null) {
      await updateProvider(existing.id, { apiKey: key.trim(), name: name.trim() })
    } else {
      await addProvider({
        name: name.trim(), baseUrl: url.trim(), apiKey: key.trim(),
        type: 'custom', isBuiltIn: 0, createdAt: Date.now(),
      })
    }
    setAdding(false); setName(''); setUrl(''); setKey('')
  }

  async function handleTest(p: ProviderPreset & { id: number }) {
    const currentKey = keyDrafts[p.id] ?? p.apiKey
    if (!currentKey) {
      usePillToast.getState().show('请先填写密钥再测试', { variant: 'warning' })
      return
    }
    const currentCors = corsValueFromDraft(corsDrafts[p.id] ?? { mode: 'direct', customValue: '' })
    setTestingId(p.id)
    usePillToast.getState().show('正在连接中转站…', { variant: 'info' })
    const result = await validateApiKey(p.baseUrl, currentKey, currentCors)
    setTestingId(null)
    if (result.valid) {
      await updateProvider(p.id, { lastValidatedAt: Date.now(), lastValid: 1 })
      usePillToast.getState().show(`${p.name} 连接正常，可以生成图片`, { variant: 'success' })
    } else {
      await updateProvider(p.id, { lastValidatedAt: Date.now(), lastValid: 0 })
      const msg = result.error?.message ?? '未知错误'
      usePillToast.getState().show(`无法确认密钥有效：${msg}`, { variant: 'error' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) useSettings.getState().closeSettings() }}>
      <SheetContent side="right" showCloseButton={false} className="w-[min(320px,85vw)] sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-3 border-b border-border">
          <SheetTitle>密钥管理(完成后新建对话)</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-2" /> 添加自定义</Button>
          </div>
          <div className="space-y-3">
            {providers.map((p) => {
              if (p.id == null) return null
              const pid = p.id
              const corsDraft = corsDrafts[pid] ?? { mode: 'direct', customValue: '' }
              return (
                <Card key={pid}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{p.baseUrl}</p>
                    </div>
                    <Badge>{p.type}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">SK 密钥</Label>
                        {p.lastValidatedAt != null && (
                          <Badge variant={p.lastValid ? 'default' : 'destructive'}>
                            {p.lastValid ? '✓ 有效' : '✗ 无效'} · {formatDistanceToNow(p.lastValidatedAt, { addSuffix: true, locale: zhCN })}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={keyDrafts[pid] ?? ''}
                          onChange={(e) => setKeyDrafts((prev) => ({ ...prev, [pid]: e.target.value }))}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTest({ ...p, id: pid })}
                          disabled={testingId === pid}
                          aria-label="测试密钥"
                          className="h-11 shrink-0"
                        >
                          <Zap className="w-3 h-3 mr-1" /> 测试
                        </Button>
                      </div>
                    </div>
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none flex items-center gap-1 py-1 list-none [&::-webkit-details-marker]:hidden">
                        <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                        <span>高级配置</span>
                      </summary>
                      <div className="space-y-3 mt-2">
                        <div className="space-y-1">
                          <Label className="text-xs">CORS 代理（可选）</Label>
                          <select
                            aria-label={`CORS 模式 ${p.name}`}
                            value={corsDraft.mode}
                            onChange={(e) => {
                              const mode = e.target.value as CorsDraft['mode']
                              setCorsDrafts((prev) => ({
                                ...prev,
                                [pid]: { mode, customValue: prev[pid]?.customValue ?? '' },
                              }))
                            }}
                            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm"
                          >
                            <option value="direct">直接连接</option>
                            <option value="builtin">/api/cors</option>
                            <option value="custom">自定义</option>
                          </select>
                          {corsDraft.mode === 'custom' && (
                            <Input
                              aria-label={`自定义 CORS ${p.name}`}
                              placeholder="https://corsproxy.io/?"
                              value={corsDraft.customValue}
                              onChange={(e) => setCorsDrafts((prev) => ({
                                ...prev,
                                [pid]: { mode: 'custom', customValue: e.target.value },
                              }))}
                            />
                          )}
                        </div>
                        {p.isBuiltIn === 0 && (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => deleteProvider(pid)}>
                              <Trash2 className="w-3 h-3 mr-1" /> 删除
                            </Button>
                          </div>
                        )}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
        <div className="border-t border-border p-3">
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>

        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogContent showCloseButton={false}>
            <DialogHeader><DialogTitle>添加自定义中转站</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>名称</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>域名</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" /></div>
              <div><Label>SK 密钥</Label><Input type="password" value={key} onChange={(e) => setKey(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAdding(false)}>取消</Button>
              <Button onClick={saveAdd}>添加</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}
