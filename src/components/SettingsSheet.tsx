import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Trash2, Plus, Zap, ChevronDown } from 'lucide-react'
import { useProviders } from '@/hooks/useProviders'
import { db, type ProviderPreset } from '@/lib/db'
import { validateApiKey } from '@/lib/api/validate'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { usePillToast } from '@/hooks/usePillToast'
import { useSettings } from '@/stores/useSettings'
import { corsDraftFromValue } from '@/lib/api/corsConfig'
import { cn } from '@/lib/utils'

type ProviderDraft = ProviderPreset & { draftKey: string }

const editableFields = [
  'name',
  'baseUrl',
  'apiKey',
  'type',
  'isBuiltIn',
  'createdAt',
  'corsProxy',
  'lastValidatedAt',
  'lastValid',
] as const

export function SettingsSheet() {
  const providers = useProviders()
  const open = useSettings((s) => s.open)
  const [drafts, setDrafts] = useState<ProviderDraft[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const initializedRef = useRef(false)
  const originalRef = useRef<ProviderPreset[]>([])
  const nextDraftIdRef = useRef(0)

  useEffect(() => {
    if (!open) {
      initializedRef.current = false
      originalRef.current = []
      setDrafts([])
      setAdding(false)
      setName('')
      setUrl('')
      setKey('')
      return
    }
    if (initializedRef.current || providers.length === 0) return

    const snapshot = providers.map((provider) => ({ ...provider }))
    originalRef.current = snapshot
    setDrafts(snapshot.map((provider) => ({
      ...provider,
      draftKey: `persisted-${provider.id}`,
    })))
    initializedRef.current = true
  }, [open, providers])

  function updateDraft(draftKey: string, patch: Partial<ProviderPreset>) {
    setDrafts((prev) => prev.map((draft) => (
      draft.draftKey === draftKey ? { ...draft, ...patch } : draft
    )))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const original = originalRef.current
      await db.transaction('rw', db.providers, async () => {
        const originalById = new Map(
          original.filter((provider) => provider.id != null).map((provider) => [provider.id!, provider]),
        )
        const keptIds = new Set<number>()

        for (const draft of drafts) {
          if (draft.id == null) {
            const { draftKey: _, id: __, ...provider } = draft
            await db.providers.add(provider)
            continue
          }

          keptIds.add(draft.id)
          const stored = originalById.get(draft.id)
          if (!stored) continue
          const patch: Partial<ProviderPreset> = {}
          for (const field of editableFields) {
            if (draft[field] !== stored[field]) {
              Object.assign(patch, { [field]: draft[field] })
            }
          }
          if (Object.keys(patch).length > 0) {
            await db.providers.update(draft.id, patch)
          }
        }

        for (const provider of original) {
          if (provider.id != null && provider.isBuiltIn === 0 && !keptIds.has(provider.id)) {
            await db.providers.delete(provider.id)
          }
        }
      })
      useSettings.getState().closeSettings()
    } catch {
      usePillToast.getState().show('保存失败，请重试', { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function saveAdd() {
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()
    if (!trimmedName || !trimmedUrl) return

    setDrafts((prev) => {
      const existing = prev.find((provider) => provider.baseUrl === trimmedUrl)
      if (existing) {
        return prev.map((provider) => provider.draftKey === existing.draftKey
          ? { ...provider, name: trimmedName, apiKey: key.trim() }
          : provider)
      }

      return [...prev, {
        draftKey: `temporary-${nextDraftIdRef.current++}`,
        name: trimmedName,
        baseUrl: trimmedUrl,
        apiKey: key.trim(),
        type: 'custom',
        isBuiltIn: 0,
        createdAt: Date.now(),
      }]
    })
    setAdding(false)
    setName('')
    setUrl('')
    setKey('')
  }

  async function handleTest(p: ProviderDraft) {
    if (!p.apiKey) {
      usePillToast.getState().show('请先填写密钥再测试', { variant: 'warning' })
      return
    }
    setTestingId(p.draftKey)
    usePillToast.getState().show('正在连接中转站…', { variant: 'info' })
    const result = await validateApiKey(p.baseUrl, p.apiKey, p.corsProxy)
    setTestingId(null)
    updateDraft(p.draftKey, { lastValidatedAt: Date.now(), lastValid: result.valid ? 1 : 0 })
    if (result.valid) {
      usePillToast.getState().show(`${p.name} 连接正常，可以生成图片`, { variant: 'success' })
    } else {
      const msg = result.error?.message ?? '未知错误'
      usePillToast.getState().show(`无法确认密钥有效：${msg}`, { variant: 'error' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) useSettings.getState().closeSettings() }}>
      <SheetContent side="right" showCloseButton={false} className="w-[min(320px,85vw)] sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-3 border-b border-border">
          <SheetTitle>密钥管理</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setAdding((value) => !value)}>
              <Plus className="w-4 h-4 mr-2" /> {adding ? '取消添加' : '添加自定义'}
            </Button>
          </div>
          {adding && (
            <div className="mb-3 space-y-3 rounded-lg border border-border p-3">
              <div><Label htmlFor="custom-provider-name">名称</Label><Input id="custom-provider-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div><Label htmlFor="custom-provider-url">域名</Label><Input id="custom-provider-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" required /></div>
              <div><Label htmlFor="custom-provider-key">SK 密钥</Label><Input id="custom-provider-key" type="password" value={key} onChange={(e) => setKey(e.target.value)} /></div>
              <Button className="w-full" onClick={saveAdd} disabled={!name.trim() || !url.trim()}>添加</Button>
            </div>
          )}
          <div className="space-y-3">
            {drafts.map((p) => {
              const corsDraft = corsDraftFromValue(p.corsProxy)
              return (
                <Card key={p.draftKey}>
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
                          value={p.apiKey}
                          onChange={(e) => updateDraft(p.draftKey, { apiKey: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTest(p)}
                          disabled={testingId === p.draftKey}
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
                        <div className="space-y-2">
                          <Label className="text-xs">CORS 代理（可选）</Label>
                          <div
                            role="radiogroup"
                            aria-label={`CORS 模式 ${p.name}`}
                            data-testid={`cors-mode-group-${p.draftKey}`}
                            className="flex flex-wrap gap-1.5"
                          >
                            {([
                              { value: 'direct', label: '直接连接' },
                              { value: 'builtin', label: '/api/cors' },
                            ] as const).map((opt) => {
                              const active = corsDraft.mode === opt.value
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  data-role="cors-mode-chip"
                                  data-mode={opt.value}
                                  onClick={() => updateDraft(p.draftKey, { corsProxy: opt.value === 'builtin' ? '/api/cors' : undefined })}
                                  className={cn(
                                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                                    active
                                      ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                                      : 'border-border bg-background text-muted-foreground hover:bg-accent',
                                  )}
                                >
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        {p.isBuiltIn === 0 && (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setDrafts((prev) => prev.filter((draft) => draft.draftKey !== p.draftKey))}>
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
      </SheetContent>
    </Sheet>
  )
}
