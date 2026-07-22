import { describe, expect, it } from 'vitest'
import { corsDraftFromValue, corsValueFromDraft } from './corsConfig'

describe('corsDraftFromValue', () => {
  it.each([undefined, '', ' '])('maps blank value %j to direct mode', (value) => {
    expect(corsDraftFromValue(value)).toEqual({ mode: 'direct', customValue: '' })
  })

  it('maps the exact builtin path to builtin mode', () => {
    expect(corsDraftFromValue('/api/cors')).toEqual({ mode: 'builtin', customValue: '' })
  })

  it.each(['custom-proxy', ' /api/cors ', '  https://proxy.example/cors  '])(
    'preserves custom value %j including whitespace',
    (value) => {
      expect(corsDraftFromValue(value)).toEqual({ mode: 'custom', customValue: value })
    },
  )
})

describe('corsValueFromDraft', () => {
  it('maps direct mode to undefined', () => {
    expect(corsValueFromDraft({ mode: 'direct', customValue: 'ignored' })).toBeUndefined()
  })

  it('maps builtin mode to the exact builtin path', () => {
    expect(corsValueFromDraft({ mode: 'builtin', customValue: 'ignored' })).toBe('/api/cors')
  })

  it('trims custom mode values', () => {
    expect(corsValueFromDraft({ mode: 'custom', customValue: '  https://proxy.example/cors  ' })).toBe(
      'https://proxy.example/cors',
    )
  })

  it('maps blank custom mode values to undefined', () => {
    expect(corsValueFromDraft({ mode: 'custom', customValue: '   ' })).toBeUndefined()
  })
})
