import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ThemeToggle'
import { addProvider, seedBuiltinProviders, updateProvider } from '@/lib/repo'
import { db } from '@/lib/db'
import { BUILTIN_PROVIDERS } from '@/lib/api/providers'
import type { ProviderType } from '@/lib/db'

interface Props { onDone: () => void }

type Step = 'welcome' | 'choose' | 'key'

export function OnboardingWizard({ onDone }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  const [type, setType] = useState<ProviderType>('packy')
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFinish() {
    setError(null)
    if (key.trim().length === 0) { setError('请填写密钥'); return }
    setBusy(true)
    await seedBuiltinProviders()
    const baseUrl = type === 'custom' ? customUrl.trim() :
      type === 'packy' ? BUILTIN_PROVIDERS.packy.baseUrl :
      type === 'runapi' ? BUILTIN_PROVIDERS.runapi.baseUrl :
      BUILTIN_PROVIDERS.uuapi.baseUrl
    const name = type === 'custom' ? (customName.trim() || '自定义') :
      type === 'packy' ? 'Packy' :
      type === 'runapi' ? 'RunAPI' :
      'uuapi'
    if (type === 'custom') {
      const existing = await db.providers.where('baseUrl').equals(customUrl.trim()).first()
      if (existing?.id != null) {
        await updateProvider(existing.id, { apiKey: key.trim(), name: customName.trim() || '自定义' })
        setBusy(false); onDone(); return
      }
    }
    const existing = await db.providers.where('type').equals(type).first()
    if (existing?.id != null) {
      await updateProvider(existing.id, { apiKey: key.trim(), name, baseUrl })
    } else {
      await addProvider({
        name, baseUrl, apiKey: key.trim(),
        type, isBuiltIn: 0,
        createdAt: Date.now(),
      })
    }
    setBusy(false)
    onDone()
  }

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full relative">
          <div className="absolute top-3 right-3"><ThemeToggle /></div>
          <CardHeader><CardTitle className="text-2xl">欢迎使用 image2chat</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">配置中转站，开始 AI 图像创作。</p>
            <Button className="w-full" onClick={() => setStep('choose')}>开始使用</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>选择中转站</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => { setType('packy'); setStep('key') }}>
              Packy<br /><span className="text-xs text-muted-foreground">{BUILTIN_PROVIDERS.packy.baseUrl}</span>
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => { setType('runapi'); setStep('key') }}>
              RunAPI<br /><span className="text-xs text-muted-foreground">{BUILTIN_PROVIDERS.runapi.baseUrl}</span>
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => { setType('uuapi'); setStep('key') }}>
              uuapi<br /><span className="text-xs text-muted-foreground">{BUILTIN_PROVIDERS.uuapi.baseUrl}</span>
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { setType('custom'); setStep('key') }}>
              自定义添加
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>输入 SK 密钥</CardTitle>
          <p className="text-sm text-muted-foreground">
            {type === 'packy' ? `中转站：${BUILTIN_PROVIDERS.packy.baseUrl}` :
             type === 'runapi' ? `中转站：${BUILTIN_PROVIDERS.runapi.baseUrl}` :
             type === 'uuapi' ? `中转站：${BUILTIN_PROVIDERS.uuapi.baseUrl}` :
             `自定义：${customUrl || '请填写域名'}`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {type === 'custom' && (
            <>
              <div>
                <Label>名称</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="我的中转站" />
              </div>
              <div>
                <Label>域名</Label>
                <Input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://example.com" />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="key">SK 密钥</Label>
            <Input id="key" type="password" value={key} onChange={(e) => setKey(e.target.value)} />
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep('choose')}>返回</Button>
            <Button className="flex-1" disabled={busy} onClick={handleFinish}>完成</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
