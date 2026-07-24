import { defineConfig, type Connect, type Plugin } from 'vite'
import type { ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { handleCors } from './functions/cors-shared'

/**
 * Dev-only middleware that mounts `/api/cors` on the Vite dev server.
 *
 * Production uses `functions/api/cors.ts` (Cloudflare Pages Function);
 * both call the same `handleCors()` so the proxy contract is identical
 * locally and in production. This lets `applyCorsProxy()` (which targets
 * the relative path `/api/cors`) work against `npm run dev` against
 * relays like RunAPI that don't return CORS headers.
 */
function corsProxyDevPlugin(): Plugin {
  return {
    name: 'image2chat:cors-proxy-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/cors')) return next()
        try {
          await runProxy(req, res)
        } catch (err) {
          console.error('[cors-proxy-dev]', err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end('Proxy error')
          } else {
            res.end()
          }
        }
      })
    },
  }
}

const HOP_BY_HOP = new Set([
  'host', 'connection', 'origin', 'referer', 'content-length',
  'transfer-encoding', 'content-encoding',
])

async function runProxy(req: Connect.IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host ?? 'localhost'
  const fullUrl = `http://${host}${req.url}`

  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue
    if (HOP_BY_HOP.has(k.toLowerCase())) continue
    headers.set(k, Array.isArray(v) ? v.join(', ') : String(v))
  }

  const method = (req.method ?? 'GET').toUpperCase()
  let body: BodyInit | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    body = Buffer.concat(chunks)
  }

  const request = new Request(fullUrl, { method, headers, body })
  const response = await handleCors(request)

  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    res.setHeader(key, value)
  })

  if (response.body) {
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
  }
  res.end()
}

export default defineConfig({
  plugins: [
    react(),
    corsProxyDevPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'image2chat',
        short_name: 'image2chat',
        description: 'AI 图像生成聊天',
        theme_color: '#6750a4',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.includes('packyapi.com') || url.hostname.includes('runapi.co'),
            handler: 'NetworkOnly',
            options: { cacheName: 'relay-api' },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173 },
})