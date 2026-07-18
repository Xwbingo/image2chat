export function createObjectURLSafe(blob: Blob): string {
  return URL.createObjectURL(blob)
}

export function revokeObjectURLSafe(url: string): void {
  try { URL.revokeObjectURL(url) } catch { /* ignore */ }
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = createObjectURLSafe(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => revokeObjectURLSafe(url), 1000)
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}