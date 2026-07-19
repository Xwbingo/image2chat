import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { ChatView } from '@/components/ChatView'
import { StatusBar } from '@/components/StatusBar'
import { ImageViewer } from '@/components/ImageViewer'
import { OfflineBanner } from '@/components/OfflineBanner'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useProviders } from '@/hooks/useProviders'
import { useSession } from '@/stores/useSession'
import { addConversation } from '@/lib/repo'
import { db } from '@/lib/db'
import { useGenerate } from '@/hooks/useGenerate'
import { useToast } from '@/components/ui/use-toast'

export function HomePage() {
  const navigate = useNavigate()
  const params = useParams<{ conversationId?: string }>()
  const conversationId = params.conversationId ? Number(params.conversationId) : undefined
  const providers = useProviders()
  const { setActiveProviderId } = useSession()
  const { generate } = useGenerate()
  const { toast } = useToast()
  const [editSource, setEditSource] = useState<{ messageId: number; blobId: number; preview?: string; sourceCreatedAt?: number; sourceKind?: 'local' | 'chat' } | undefined>()
  const [viewerBlobId, setViewerBlobId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [bottomInset, setBottomInset] = useState(0)

  useEffect(() => {
    if (providers.length > 0) {
      const current = useSession.getState().activeProviderId
      if (current == null) setActiveProviderId(providers[0].id!)
    }
  }, [providers.length])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const hidden = window.innerHeight - vv.height
      setBottomInset(Math.max(0, hidden))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  function clearEdit() {
    if (editSource?.preview) URL.revokeObjectURL(editSource.preview)
    setEditSource(undefined)
  }

  async function loadEditSource(msgId: number, blobId: number, sourceCreatedAt?: number, sourceKind: 'chat' | 'local' = 'chat') {
    const img = await db.images.get(blobId)
    if (!img) return
    if (editSource?.preview) URL.revokeObjectURL(editSource.preview)
    const preview = URL.createObjectURL(img.blob)
    setEditSource({ messageId: msgId, blobId: blobId, preview, sourceCreatedAt, sourceKind })
  }

  async function handleNew() {
    const pid = useSession.getState().activeProviderId ?? providers[0]?.id
    if (!pid) return
    const id = await addConversation(pid)
    setDrawerOpen(false)
    navigate(`/c/${id}`)
  }

  async function handleSend(prompt: string, opts?: { editSourceMessageId?: number; uploadBlob?: Blob; size?: string }) {
    if (conversationId == null) return
    const finalSize = opts?.size ?? useSession.getState().defaultSize
    const result = await generate(conversationId, prompt, finalSize, opts?.editSourceMessageId, opts?.uploadBlob)
    if ('error' in result) {
      toast({
        variant: 'destructive',
        title: '生成失败',
        description: result.error.message,
      })
    }
  }

  function handleEdit(msgId: number) {
    db.messages.get(msgId).then((m) => {
      if (m?.imageBlobId != null) {
        void loadEditSource(msgId, m.imageBlobId, m.createdAt, 'chat')
      }
    })
  }

  function handleRemoteImageClick(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground safe-top">
      <OfflineBanner />
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden md:block h-full">
          <Sidebar activeId={conversationId} onSelect={(id) => navigate(`/c/${id}`)} onNew={handleNew} />
        </div>
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="md:hidden border-b border-border p-2">
            <Button size="icon" variant="ghost" onClick={() => setDrawerOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
          {conversationId == null ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <p className="text-lg mb-4">开始一次新的创作</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleNew}>新建对话</Button>
                  <Button variant="outline" onClick={() => navigate('/settings')}>管理密钥</Button>
                </div>
              </div>
            </div>
          ) : (
            <ChatView
              conversationId={conversationId}
              onBack={() => navigate('/')}
              onSettings={() => navigate('/settings')}
              onOpenImage={(blobId) => setViewerBlobId(blobId)}
              onRemoteClick={handleRemoteImageClick}
              onEdit={handleEdit}
              onSend={handleSend}
              editSource={editSource}
              onClearEdit={clearEdit}
              onPreviewImage={(blobId) => setViewerBlobId(blobId)}
              bottomInset={bottomInset}
              statusBar={<StatusBar activeConversationId={conversationId} />}
            />
          )}
        </main>
      </div>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar activeId={conversationId} onSelect={(id) => { setDrawerOpen(false); navigate(`/c/${id}`) }} onNew={handleNew} />
        </SheetContent>
      </Sheet>
      <ImageViewer
        blobId={viewerBlobId}
        prompt={undefined}
        onClose={() => setViewerBlobId(null)}
      />
    </div>
  )
}
