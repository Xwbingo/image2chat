import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { PwaUpdatePrompt } from '@/components/PwaUpdatePrompt'
import { SettingsSheet } from '@/components/SettingsSheet'
import { seedBuiltinProviders, dedupeProviders } from '@/lib/repo'
import { router } from '@/routes'
import { RouterProvider } from 'react-router-dom'
import { useProviders } from '@/hooks/useProviders'
import { useSession } from '@/stores/useSession'

export default function App() {
  const [ready, setReady] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const providers = useProviders()
  const resolvedTheme = useSession((s) => s.resolvedTheme)

  useEffect(() => {
    (async () => {
      await dedupeProviders()
      await seedBuiltinProviders()
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  useEffect(() => {
    if (!ready) return
    const isEmpty = providers.length === 0
    setNeedsOnboarding(isEmpty)
  }, [ready, providers])

  if (!ready) return null
  if (needsOnboarding) {
    return (
      <>
        <OnboardingWizard onDone={() => setNeedsOnboarding(false)} />
        <Toaster />
        <SettingsSheet />
      </>
    )
  }
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
      <PwaUpdatePrompt />
      <SettingsSheet />
    </>
  )
}