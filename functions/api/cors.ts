/**
 * Cloudflare Pages Function — same-origin CORS proxy.
 *
 * Mounted at `/api/cors`. The client appends `?url=<encoded target>` and the
 * function forwards the request server-to-server (no browser CORS), then
 * rewrites the response with `Access-Control-Allow-Origin: *` so the browser
 * accepts it.
 *
 * Usage in this app: 密钥管理 → 对应中转站 → CORS 代理 = `/api/cors`
 *
 * This file is intentionally outside `src/` and outside the main tsconfig so
 * it does not affect the Vite/React build. Cloudflare Pages picks it up
 * automatically from the project-root `functions/` directory.
 */

interface Env {}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
}

function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function badRequest(reason: string): Response {
  return new Response(reason, { status: 400, headers: CORS_HEADERS })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') return preflight()

  const target = new URL(context.request.url).searchParams.get('url')
  if (!target) return badRequest('Missing ?url=')

  let decoded: string
  try {
    decoded = decodeURIComponent(target)
  } catch {
    return badRequest('Bad encoding in ?url=')
  }

  let parsed: URL
  try {
    parsed = new URL(decoded)
  } catch {
    return badRequest('Invalid URL in ?url=')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return badRequest('Only http(s) targets allowed')
  }

  const upstream = await fetch(parsed.toString(), {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  })

  const headers = new Headers(upstream.headers)
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v)

  return new Response(upstream.body, { status: upstream.status, headers })
}