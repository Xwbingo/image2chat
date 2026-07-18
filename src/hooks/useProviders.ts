import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { ProviderPreset } from '@/lib/db'

export function useProviders(): ProviderPreset[] {
  const list = useLiveQuery(() => db.providers.orderBy('createdAt').toArray(), [], [])
  return list ?? []
}