export type ExtractedImage = { kind: 'b64' | 'url' | 'data_url'; value: string }

export function extractImageFromResponse(json: unknown): ExtractedImage | null {
  if (typeof json === 'string') return detectStringImage(json)

  if (json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data) && (json as { data: unknown[] }).data.length > 0) {
    const first = (json as { data: unknown[] }).data[0]
    if (first && typeof first === 'object') {
      const obj = first as Record<string, unknown>
      if (typeof obj.b64_json === 'string') return { kind: 'b64', value: obj.b64_json }
      if (typeof obj.url === 'string') {
        const r = detectStringImage(obj.url)
        if (r) return r
      }
      if (typeof obj.b64 === 'string') return { kind: 'b64', value: obj.b64 }
      if (typeof obj.image === 'string') return detectStringImage(obj.image)
    } else if (typeof first === 'string') {
      return detectStringImage(first)
    }
  }

  return walkForImage(json, new WeakSet())
}

function detectStringImage(s: string): ExtractedImage | null {
  if (s.startsWith('data:image/')) return { kind: 'data_url', value: s }
  if (s.startsWith('http://') || s.startsWith('https://')) {
    if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(s)) return { kind: 'url', value: s }
    return null
  }
  if (s.length >= 200 && /^[A-Za-z0-9+/=]+$/.test(s)) {
    return { kind: 'b64', value: s }
  }
  return null
}

function walkForImage(node: unknown, seen: WeakSet<object>): ExtractedImage | null {
  if (!node) return null
  if (typeof node === 'string') return detectStringImage(node)
  if (typeof node !== 'object') return null
  if (seen.has(node as object)) return null
  seen.add(node as object)
  if (Array.isArray(node)) {
    for (const item of node) {
      const r = walkForImage(item, seen)
      if (r) return r
    }
    return null
  }
  for (const key of Object.keys(node as Record<string, unknown>)) {
    const r = walkForImage((node as Record<string, unknown>)[key], seen)
    if (r) return r
  }
  return null
}