import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'

export function PwaUpdatePrompt() {
  const { toast } = useToast()
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    const { id, dismiss } = toast({
      title: '有新版本可用',
      description: '点“刷新”加载最新功能',
      duration: Number.POSITIVE_INFINITY,
      action: (
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          刷新
        </Button>
      ),
    })
    return () => dismiss(id)
  }, [needRefresh])

  useEffect(() => {
    if (!offlineReady) return
    toast({ title: '已支持离线使用' })
    setOfflineReady(false)
  }, [offlineReady, toast, setOfflineReady])

  return null
}
