import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { seedBuiltinProviders, dedupeProviders } from '@/lib/repo'
import { router } from '@/routes'
import { RouterProvider } from 'react-router-dom'
import { useProviders } from '@/hooks/useProviders'

export default function App() {
  const [ready, setReady] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const providers = useProviders()

  useEffect(() => {
    (async () => {
      await dedupeProviders()
      await seedBuiltinProviders()
      setReady(true)
    })()
  }, [])

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
      </>
    )
  }
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}
