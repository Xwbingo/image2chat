import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { seedBuiltinProviders } from '@/lib/repo'
import { router } from '@/routes'
import { RouterProvider } from 'react-router-dom'
import { useProviders } from '@/hooks/useProviders'

export default function App() {
  const [ready, setReady] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const providers = useProviders()

  useEffect(() => {
    seedBuiltinProviders().then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return
    const hasKey = providers.some((p) => p.apiKey.length > 0)
    setNeedsOnboarding(!hasKey)
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
