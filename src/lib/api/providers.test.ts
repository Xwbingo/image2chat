import { describe, expect, it } from 'vitest'
import { getSupportedSizes, BUILTIN_PROVIDERS } from './providers'

describe('getSupportedSizes', () => {
  it('packy supports all 9 sizes', () => {
    const sizes = getSupportedSizes('packy')
    expect(sizes).toHaveLength(9)
    expect(sizes).toContain('1152x2048')
    expect(sizes).toContain('4096x4096')
  })
  it('runapi supports the 6 non-4K sizes', () => {
    const sizes = getSupportedSizes('runapi')
    expect(sizes).not.toContain('3840x2160')
    expect(sizes).not.toContain('2160x3840')
    expect(sizes).not.toContain('4096x4096')
    expect(sizes).toContain('1152x2048')
    expect(sizes).toHaveLength(6)
  })
  it('uuapi supports all 9 sizes', () => {
    expect(getSupportedSizes('uuapi')).toHaveLength(9)
  })
  it('custom supports all 9', () => {
    expect(getSupportedSizes('custom')).toHaveLength(9)
  })
})

describe('BUILTIN_PROVIDERS', () => {
  it('exposes packy, runapi, and uuapi', () => {
    expect(BUILTIN_PROVIDERS.packy.baseUrl).toBe('https://www.packyapi.com')
    expect(BUILTIN_PROVIDERS.runapi.baseUrl).toBe('https://runapi.co')
    expect(BUILTIN_PROVIDERS.uuapi.baseUrl).toBe('https://uuapi.cc')
  })
})