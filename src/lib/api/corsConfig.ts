export type CorsMode = 'direct' | 'builtin'

export type CorsDraft = {
  mode: CorsMode
}

export function corsDraftFromValue(value: string | undefined): CorsDraft {
  if (!value?.trim()) return { mode: 'direct' }
  return { mode: 'builtin' }
}

export function corsValueFromDraft(draft: CorsDraft): string | undefined {
  return draft.mode === 'builtin' ? '/api/cors' : undefined
}
