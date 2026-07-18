import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { Conversation } from '@/lib/db'

export function useConversations(): Conversation[] {
  const list = useLiveQuery(() => db.conversations.orderBy('updatedAt').reverse().toArray(), [], [])
  return list ?? []
}