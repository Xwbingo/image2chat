import { describe, expect, it } from 'vitest'
import { getSupportedSizes, BUILTIN_PROVIDERS } from './providers'

describe('getSupportedSizes', () => {
  it('packy supports all 7 sizes', () => {
    expect(getSupportedSizes('packy')).toHaveLength(7)
  })
  it('runapi excludes 4K', () => {
    const sizes = getSupportedSizes('runapi')
    expect(sizes).not.toContain('3840x2160')
    expect(sizes).not.toContain('2160x3840')
    expect(sizes).toHaveLength(5)
  })
  it('custom supports all 7', () => {
    expect(getSupportedSizes('custom')).toHaveLength(7)
  })
})

describe('BUILTIN_PROVIDERS', () => {
  it('exposes packy and runapi', () => {
    expect(BUILTIN_PROVIDERS.packy.baseUrl).toBe('https://www.packyapi.com')
    expect(BUILTIN_PROVIDERS.runapi.baseUrl).toBe('https://runapi.co')
  })
})