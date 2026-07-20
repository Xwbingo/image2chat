/**
 * Cloudflare Pages Function — same-origin CORS proxy.
 *
 * Mounted at `/api/cors` when the site is deployed to Cloudflare Pages.
 * Production entry point; the request/response core lives in
 * `../cors-shared.ts` so the dev server (see `vite.config.ts`) can run
 * the same handler against `npm run dev`.
 *
 * Usage in this app: 密钥管理 → 对应中转站 → CORS 代理 = `/api/cors`
 *
 * This file is intentionally outside `src/` and outside the main tsconfig
 * so it does not affect the Vite/React build. Cloudflare Pages picks it
 * up automatically from the project-root `functions/` directory.
 */

import { handleCors } from '../cors-shared'

export const onRequest = async (context: { request: Request }): Promise<Response> =>
  handleCors(context.request)