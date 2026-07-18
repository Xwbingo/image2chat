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

export function HomePage() {
  const navigate = useNavigate()
  const params = useParams<{ conversationId?: string }>()
  const conversationId = params.conversationId ? Number(params.conversationId) : undefined
  const providers = useProviders()
  const { setActiveProviderId } = useSession()
  const { generate } = useGenerate()
  const [editSource, setEditSource] = useState<{ messageId: number; blobId: number } | undefined>()
  const [viewerBlobId, setViewerBlobId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (providers.length > 0) {
      const current = useSession.getState().activeProviderId
      if (current == null) setActiveProviderId(providers[0].id!)
    }
  }, [providers.length])

  async function handleNew() {
    const pid = useSession.getState().activeProviderId ?? providers[0]?.id
    if (!pid) return
    const id = await addConversation(pid)
    setDrawerOpen(false)
    navigate(`/c/${id}`)
  }

  async function handleSend(prompt: string, editSourceId?: number, size?: string) {
    if (conversationId == null) return
    if (editSourceId != null) {
      const srcMsg = await db.messages.get(editSourceId)
      if (srcMsg) setEditSource({ messageId: editSourceId, blobId: srcMsg.imageBlobId! })
    }
    const finalSize = size ?? useSession.getState().defaultSize
    await generate(conversationId, prompt, finalSize, editSourceId)
  }

  async function handleRetry(msgId: number) {
    const m = await db.messages.get(msgId)
    if (!m?.prompt || m.role !== 'assistant') return
    let editSourceId: number | undefined
    const userMsgs = await db.messages
      .where('conversationId').equals(m.conversationId)
      .and((x) => x.role === 'user' && x.createdAt < m.createdAt)
      .sortBy('createdAt')
    const lastUser = userMsgs[userMsgs.length - 1]
    if (lastUser?.kind === 'image_edit_request') {
      const prevAssistant = await db.messages
        .where('conversationId').equals(m.conversationId)
        .and((x) => x.role === 'assistant' && x.createdAt < lastUser.createdAt)
        .reverse()
        .sortBy('createdAt')
      const src = prevAssistant[0]
      if (src?.id != null) editSourceId = src.id
    }
    void handleSend(m.prompt, editSourceId, m.size)
  }

  function handleEdit(msgId: number) {
    db.messages.get(msgId).then((m) => {
      if (m?.imageBlobId != null) {
        setEditSource({ messageId: msgId, blobId: m.imageBlobId })
      }
    })
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <OfflineBanner />
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden md:block h-full">
          <Sidebar activeId={conversationId} onSelect={(id) => navigate(`/c/${id}`)} onNew={handleNew} />
        </div>
        <main className="flex-1 flex flex-col">
          <div className="md:hidden border-b border-border p-2">
            <Button size="icon" variant="ghost" onClick={() => setDrawerOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
          {conversationId == null ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <p className="text-lg mb-4">开始一次新的创作</p>
                <Button onClick={handleNew}>新建对话</Button>
              </div>
            </div>
          ) : (
            <ChatView
              conversationId={conversationId}
              onBack={() => navigate('/')}
              onOpenImage={(blobId) => setViewerBlobId(blobId)}
              onRetry={handleRetry}
              onEdit={handleEdit}
              onSend={handleSend}
              editSource={editSource}
              onClearEdit={() => setEditSource(undefined)}
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
