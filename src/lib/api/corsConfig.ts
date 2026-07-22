export type CorsMode = 'direct' | 'builtin' | 'custom'

export type CorsDraft = {
  mode: CorsMode
  customValue: string
}

export function corsDraftFromValue(value: string | undefined): CorsDraft {
  if (!value?.trim()) return { mode: 'direct', customValue: '' }
  if (value === '/api/cors') return { mode: 'builtin', customValue: '' }
  return { mode: 'custom', customValue: value }
}

export function corsValueFromDraft(draft: CorsDraft): string | undefined {
  if (draft.mode === 'direct') return undefined
  if (draft.mode === 'builtin') return '/api/cors'
  return draft.customValue.trim() || undefined
}
