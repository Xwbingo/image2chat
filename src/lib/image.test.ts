import { describe, expect, it, vi } from 'vitest'
import { createObjectURLSafe, revokeObjectURLSafe } from './image'

describe('image utils', () => {
  it('createObjectURLSafe returns URL.createObjectURL result', () => {
    const fake = 'blob:fake' as unknown as string
    const orig = URL.createObjectURL
    URL.createObjectURL = vi.fn(() => fake)
    const url = createObjectURLSafe(new Blob())
    expect(url).toBe(fake)
    URL.createObjectURL = orig
  })

  it('revokeObjectURLSafe swallows errors when URL is invalid', () => {
    expect(() => revokeObjectURLSafe('not-a-real-url')).not.toThrow()
  })
})