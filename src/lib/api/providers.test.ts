import { describe, expect, it } from 'vitest'
import { getSupportedSizes, BUILTIN_PROVIDERS } from './providers'

describe('getSupportedSizes', () => {
  it('packy supports all 8 sizes', () => {
    const sizes = getSupportedSizes('packy')
    expect(sizes).toHaveLength(8)
    expect(sizes).toContain('1152x2048')
  })
  it('runapi supports all 8 sizes including 4K', () => {
    const sizes = getSupportedSizes('runapi')
    expect(sizes).toContain('3840x2160')
    expect(sizes).toContain('2160x3840')
    expect(sizes).toContain('1152x2048')
    expect(sizes).toHaveLength(8)
  })
  it('uuapi supports all 8 sizes', () => {
    expect(getSupportedSizes('uuapi')).toHaveLength(8)
  })
  it('custom supports all 8', () => {
    expect(getSupportedSizes('custom')).toHaveLength(8)
  })
})

describe('BUILTIN_PROVIDERS', () => {
  it('exposes packy, runapi, and uuapi', () => {
    expect(BUILTIN_PROVIDERS.packy.baseUrl).toBe('https://www.packyapi.com')
    expect(BUILTIN_PROVIDERS.runapi.baseUrl).toBe('https://runapi.co')
    expect(BUILTIN_PROVIDERS.uuapi.baseUrl).toBe('https://uuapi.cc')
  })
})