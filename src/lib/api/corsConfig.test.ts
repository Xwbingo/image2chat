import { describe, expect, it } from 'vitest'
import { corsDraftFromValue, corsValueFromDraft } from './corsConfig'

describe('corsDraftFromValue', () => {
  it.each([undefined, '', ' '])('maps blank value %j to direct mode', (value) => {
    expect(corsDraftFromValue(value)).toEqual({ mode: 'direct' })
  })

  it('maps the exact builtin path to builtin mode', () => {
    expect(corsDraftFromValue('/api/cors')).toEqual({ mode: 'builtin' })
  })

  it.each(['custom-proxy', ' /api/cors ', 'https://proxy.example/cors'])(
    'maps unsupported value %j to builtin mode',
    (value) => {
      expect(corsDraftFromValue(value)).toEqual({ mode: 'builtin' })
    },
  )
})

describe('corsValueFromDraft', () => {
  it('maps direct mode to undefined', () => {
    expect(corsValueFromDraft({ mode: 'direct' })).toBeUndefined()
  })

  it('maps builtin mode to the exact builtin path', () => {
    expect(corsValueFromDraft({ mode: 'builtin' })).toBe('/api/cors')
  })
})
