import type { ProviderType } from '../db'

export const BUILTIN_PROVIDERS = {
  packy:  { name: 'Packy',  baseUrl: 'https://www.packyapi.com' },
  runapi: { name: 'RunAPI', baseUrl: 'https://runapi.co' },
} as const

const ALL_SIZES = [
  '1024x1024', '1536x1024', '1024x1536',
  '2048x2048', '2048x1152',
  '3840x2160', '2160x3840',
] as const

export type ImageSize = (typeof ALL_SIZES)[number]

export const DEFAULT_SIZE: ImageSize = '2048x1152'

export function getSupportedSizes(type: ProviderType): ImageSize[] {
  if (type === 'runapi') {
    return ['1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152']
  }
  return [...ALL_SIZES]
}

export function isImageSize(s: string): s is ImageSize {
  return (ALL_SIZES as readonly string[]).includes(s)
}