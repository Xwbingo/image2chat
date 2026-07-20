/**
 * Core CORS-proxy handler. Pure function: takes a Web Request, returns a
 * Web Response. The same code runs in two places:
 *
 *  - Production:  functions/api/cors.ts (Cloudflare Pages Function, mounted
 *                 at /api/cors on the deployed site).
 *  - Development: vite.config.ts  (dev-only middleware, mounted at the same
 *                 path so the SPA's `applyCorsProxy()` works against
 *                 `npm run dev` without CORS errors when targeting a
 *                 non-CORS-friendly relay like RunAPI).
 *
 * URL contract: client appends `?url=<encoded target>`; we forward
 * server-to-server (no browser CORS), then rewrite the response with
 * `Access-Control-Allow-Origin: *` so the browser accepts it.
 */

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

function parseTarget(raw: string | null): URL | Response {
  if (!raw) return badRequest('Missing ?url=')
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
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
  return parsed
}

export async function handleCors(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return preflight()

  const target = parseTarget(new URL(request.url).searchParams.get('url'))
  if (target instanceof Response) return target

  const upstream = await fetch(target.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })

  const headers = new Headers(upstream.headers)
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v)

  return new Response(upstream.body, { status: upstream.status, headers })
}