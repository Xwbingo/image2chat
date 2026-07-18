import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Plus } from 'lucide-react'
import { useProviders } from '@/hooks/useProviders'
import { addProvider, updateProvider, deleteProvider } from '@/lib/repo'

export function SettingsPage() {
  const providers = useProviders()
  const [editing, setEditing] = useState<{ id: number; key: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')

  async function saveAdd() {
    if (!name.trim() || !url.trim()) return
    await addProvider({
      name: name.trim(), baseUrl: url.trim(), apiKey: key.trim(),
      type: 'custom', isBuiltIn: 0, createdAt: Date.now(),
    })
    setAdding(false); setName(''); setUrl(''); setKey('')
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">设置</h1>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-2" /> 添加自定义</Button>
      </div>
      <div className="space-y-3">
        {providers.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{p.baseUrl}</p>
              </div>
              <Badge>{p.type}</Badge>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing({ id: p.id!, key: p.apiKey })}>
                <Edit className="w-3 h-3 mr-1" /> 编辑 Key
              </Button>
              {p.isBuiltIn === 0 && (
                <Button size="sm" variant="outline" onClick={() => p.id != null && deleteProvider(p.id)}>
                  <Trash2 className="w-3 h-3 mr-1" /> 删除
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑密钥</DialogTitle></DialogHeader>
          <Label>SK 密钥</Label>
          <Input type="password" value={editing?.key ?? ''} onChange={(e) => editing && setEditing({ ...editing, key: e.target.value })} />
          <DialogFooter>
            <Button onClick={async () => {
              if (editing) await updateProvider(editing.id, { apiKey: editing.key }); setEditing(null)
            }}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
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
    </div>
  )
}