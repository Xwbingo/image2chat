import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { Message } from '@/lib/db'

export function useMessages(conversationId: number | undefined): Message[] {
  const list = useLiveQuery(
    async () => {
      if (conversationId == null) return []
      return db.messages.where('conversationId').equals(conversationId).sortBy('createdAt')
    },
    [conversationId],
    [],
  )
  return list ?? []
}