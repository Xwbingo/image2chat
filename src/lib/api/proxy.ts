/**
 * If corsProxy is set, returns `${corsProxy}${sep}url=${encodeURIComponent(targetUrl)}`.
 * Otherwise returns the targetUrl unchanged.
 */
export function applyCorsProxy(targetUrl: string, corsProxy: string | undefined | null): string {
  if (!corsProxy) return targetUrl
  const trimmed = corsProxy.trim()
  if (!trimmed) return targetUrl
  const sep = trimmed.includes('?') ? '&' : '?'
  return `${trimmed}${sep}url=${encodeURIComponent(targetUrl)}`
}