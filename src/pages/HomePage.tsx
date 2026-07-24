import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { ChatView } from '@/components/ChatView'
import { StatusBar } from '@/components/StatusBar'
import { ImageViewer } from '@/components/ImageViewer'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PillToast } from '@/components/PillToast'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useProviders } from '@/hooks/useProviders'
import { useSession } from '@/stores/useSession'
import { useSettings } from '@/stores/useSettings'
import { addConversation, addImage, markStaleGeneratingAsFailed } from '@/lib/repo'
import { db, type ImageRef } from '@/lib/db'
import { useGenerate } from '@/hooks/useGenerate'
import { useToast } from '@/components/ui/use-toast'

const MAX_REFS = 3

export function HomePage() {
  const navigate = useNavigate()
  const params = useParams<{ conversationId?: string }>()
  const conversationId = params.conversationId ? Number(params.conversationId) : undefined
  const providers = useProviders()
  const hasConfiguredKey = providers.some((provider) => provider.apiKey.trim().length > 0)
  const { setActiveProviderId } = useSession()
  const { generate } = useGenerate()
  const { toast } = useToast()
  const [refs, setRefs] = useState<ImageRef[]>([])
  const [viewerBlobId, setViewerBlobId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [bottomInset, setBottomInset] = useState(0)

  useEffect(() => {
    if (providers.length > 0) {
      const current = useSession.getState().activeProviderId
      const currentProvider = providers.find((p) => p.id === current)
      const currentHasKey = !!currentProvider && currentProvider.apiKey.trim().length > 0
      if (current == null || !currentHasKey) {
        const firstConfigured = providers.find((provider) => provider.apiKey.trim().length > 0)
        setActiveProviderId(firstConfigured?.id ?? providers[0].id!)
      }
    }
  }, [providers.length, providers.map((p) => p.apiKey.trim().length > 0).join(',')])

  // Global cleanup: any conversation's 'generating' messages that are
  // older than 5min (i.e. the tab was closed/refreshed mid-request)
  // get marked failed. Cheaper than re-attaching the request, and the
  // user can manually re-send. ChatView still does the same sweep
  // locally for fast feedback while you're actively viewing a chat.
  useEffect(() => {
    void markStaleGeneratingAsFailed(5 * 60 * 1000)
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    // Ignore tiny viewport deltas (iOS Safari bounce / rubber-band / URL-bar
    // toggling) so the bottom dock doesn't jitter when the user is scrolling
    // near the edge of the chat. Only the keyboard actually shifts the
    // composer by a meaningful amount.
    const KEYBOARD_THRESHOLD_PX = 80
    const update = () => {
      const hidden = window.innerHeight - vv.height
      const next = hidden >= KEYBOARD_THRESHOLD_PX ? hidden : 0
      setBottomInset((prev) => (prev === next ? prev : next))
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

  useEffect(() => {
    setRefs([])
  }, [conversationId])

  async function handleAddLocal(file: File) {
    if (refs.length >= MAX_REFS) return
    const blobId = await addImage(file, file.type || 'image/png')
    setRefs((prev) => {
      if (prev.length >= MAX_REFS) return prev
      if (prev.some((r) => r.blobId === blobId)) return prev
      return [...prev, { blobId, kind: 'local', fileName: file.name }]
    })
  }

  function handleRemoveRef(blobId: number) {
    setRefs((prev) => prev.filter((r) => r.blobId !== blobId))
  }

  function handleReorderRefs(from: number, to: number) {
    setRefs((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function handleReferenceFromChat(assistantMsgId: number) {
    if (refs.length >= MAX_REFS) return
    void db.messages.get(assistantMsgId).then((m) => {
      if (!m?.imageBlobId) return
      setRefs((prev) => {
        if (prev.some((r) => r.blobId === m.imageBlobId)) return prev
        if (prev.length >= MAX_REFS) return prev
        return [...prev, { blobId: m.imageBlobId!, kind: 'chat', sourceMsgId: assistantMsgId }]
      })
    })
  }

  function handleClearRefs() {
    setRefs([])
  }

  async function handleNew() {
    const hasKey = providers.some((p) => (p.apiKey ?? '').length > 0)
    if (!hasKey) {
      useSettings.getState().openSettings()
      return
    }
    const activeId = useSession.getState().activeProviderId
    const activeProvider = providers.find((p) => p.id === activeId)
    const pid =
      activeProvider && activeProvider.apiKey.trim().length > 0
        ? activeProvider.id
        : (providers.find((p) => p.apiKey.trim().length > 0)?.id ?? providers[0]?.id)
    if (!pid) return

    let id: number | undefined
    const emptyConvs = await db.conversations.where('title').equals('新对话').toArray()
    for (const conv of emptyConvs) {
      if (conv.id == null) continue
      const msgCount = await db.messages.where('conversationId').equals(conv.id).count()
      if (msgCount === 0) {
        id = conv.id
        break
      }
    }

    if (id == null) {
      id = await addConversation(pid)
    }

    setDrawerOpen(false)
    navigate(`/c/${id}`)
  }

  async function handleSend(prompt: string, sendRefs: ImageRef[]) {
    if (conversationId == null) return
    setRefs(sendRefs)
    const result = await generate(conversationId, prompt, useSession.getState().defaultSize, sendRefs)
    if ('error' in result) {
      toast({
        variant: 'destructive',
        title: '生成失败',
        description: result.error.message,
      })
      return
    }
    setRefs([])
  }

  function handleRemoteImageClick(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground safe-top">
      <OfflineBanner />
      <PillToast />
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden md:block h-full">
          <Sidebar activeId={conversationId} onSelect={(id) => navigate(`/c/${id}`)} onNew={handleNew} hasConfiguredKey={hasConfiguredKey} />
        </div>
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {conversationId == null ? (
            <div className="flex-1 flex flex-col">
              <header className="flex items-center justify-end gap-2 p-3 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30"
                style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}>
                <ThemeToggle />
                <Button size="icon" variant="ghost" onClick={() => useSettings.getState().openSettings()} aria-label="密钥管理">
                  <Settings className="w-4 h-4" />
                </Button>
              </header>
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <p className="text-lg mb-4">开始一次新的创作</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={handleNew}>{hasConfiguredKey ? '新建对话' : '密钥管理'}</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ChatView
              conversationId={conversationId}
              onBack={() => navigate('/')}
              onMenu={() => setDrawerOpen(true)}
              onSettings={() => useSettings.getState().openSettings()}
              onOpenImage={(blobId) => setViewerBlobId(blobId)}
              onRemoteClick={handleRemoteImageClick}
              onReference={handleReferenceFromChat}
              onSend={handleSend}
              refs={refs}
              onAddLocal={handleAddLocal}
              onRemoveRef={handleRemoveRef}
              onReorderRefs={handleReorderRefs}
              onClearRefs={handleClearRefs}
              bottomInset={bottomInset}
              statusBar={<StatusBar activeConversationId={conversationId} />}
            />
          )}
        </main>
      </div>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" showCloseButton={false} className="p-0 w-64">
          <Sidebar activeId={conversationId} onSelect={(id) => { setDrawerOpen(false); navigate(`/c/${id}`) }} onNew={handleNew} hasConfiguredKey={hasConfiguredKey} />
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