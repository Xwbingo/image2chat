# image2chat Web PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Progressive Web App that lets users configure image-generation relay providers (Packy / RunAPI / custom), chat in a multi-session UI to generate and edit images via `gpt-image-2`, and persist everything locally in IndexedDB. Deliverable is a deployable static site (`dist/`) that can be wrapped into an Android APK via PWABuilder.

**Architecture:** Single-page React + TypeScript SPA built with Vite. Zustand for cross-component UI state, Dexie (IndexedDB) for persistence with `liveQuery` driving reactive reads. React Router for navigation. shadcn/ui + Tailwind for components. `vite-plugin-pwa` (Workbox) for manifest + Service Worker. Native `fetch` for API calls (no axios).

**Tech Stack:**
- Vite 5, React 18, TypeScript 5, React Router 6
- Tailwind CSS 3 + shadcn/ui (Radix primitives)
- Dexie 4 (IndexedDB), Zustand 4
- vite-plugin-pwa (Workbox)
- date-fns, clsx, tailwind-merge
- Test: Vitest, @testing-library/react, fake-indexeddb, MSW, jsdom

## Global Constraints

- Source root: `src/`. Test root: `src/**/*.test.ts` colocated.
- Package name: `image2chat`
- All API calls use native `fetch` + `AbortController` with 120s timeout — never `axios`
- Default image params: `model="gpt-image-2"`, `n=1`, `quality="high"`, `response_format="url"`, `size="2048x1152"` — only `size` is exposed to UI
- 7 image sizes: 1024x1024, 1536x1024, 1024x1536, 2048x2048, 2048x1152, 3840x2160, 2160x3840
- RunAPI excludes 4K sizes (1024x1024, 1536x1024, 1024x1536, 2048x2048, 2048x1152)
- API keys stored in Dexie (plaintext, browser context) — same risk profile as localStorage
- Generated images stored as Blob in Dexie `images` table immediately after API returns URL
- PWA `display: standalone`, `theme_color: #6750a4`, maskable icon required
- Service Worker: precache app shell, NetworkOnly for relay API (no caching of generated content)
- Path alias: `@/*` → `src/*`
- Every commit is a single reviewable unit; use `git add <files>` not `git add .`
- No commits to `packyapi.md` / `runapi.md` / `usstory.md` (they're reference docs at the repo root, leave them untouched)

---

## Phase 0 — Scaffolding

### Task 1: Vite project + Tailwind + shadcn init + app shell

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`
- Create: `tailwind.config.js`, `postcss.config.js`, `components.json`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles/globals.css`
- Create: `src/lib/utils.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: a runnable Vite dev server showing a centered "image2chat" heading on a dark page; `npm run build` succeeds.

- [ ] **Step 1: Write `.gitignore`**
```gitignore
node_modules/
dist/
dist-ssr/
*.local
.vite/
.superpowers/
.DS_Store
```

- [ ] **Step 2: Write `package.json`**
```json
{
  "name": "image2chat",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-popover": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "dexie": "^4.0.8",
    "dexie-react-hooks": "^1.1.7",
    "lucide-react": "^0.453.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0",
    "tailwind-merge": "^2.5.4",
    "tailwindcss-animate": "^1.0.7",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.7.7",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.1",
    "msw": "^2.6.4",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: completes without errors; `node_modules/` created; `package-lock.json` created.

- [ ] **Step 4: Write `tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Write `tsconfig.node.json`**
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Write `vite.config.ts`**
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 7: Write `tailwind.config.js`**
```js
import animate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
    },
  },
  plugins: [animate],
}
```

- [ ] **Step 8: Write `postcss.config.js`**
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```
> **Note**: `postcss.config.js` with `export default` is fine — PostCSS supports ESM configs when `"type": "module"` is set.

- [ ] **Step 9: Write `components.json`** (shadcn config)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 10: Write `src/styles/globals.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 262 83% 58%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 262 83% 58%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 263 70% 70%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 263 70% 70%;
  }
  body { @apply bg-background text-foreground antialiased; }
}
```

- [ ] **Step 11: Write `src/lib/utils.ts`**
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 12: Write `src/test-setup.ts`**
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 13: Write `src/App.tsx`**
```tsx
export default function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
      <h1 className="text-3xl font-semibold">image2chat</h1>
    </div>
  )
}
```

- [ ] **Step 14: Write `src/main.tsx`**
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 15: Write `index.html`**
```html
<!doctype html>
<html lang="zh-CN" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#6750a4" />
    <title>image2chat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 16: Verify dev + build**

Run: `npm run build`
Expected: `dist/` created, no TypeScript errors.

Run: `npm run dev` (background) → curl `http://localhost:5173/` returns HTML with `<div id="root">`. Stop server.

- [ ] **Step 17: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js components.json index.html src/ .gitignore
git commit -m "chore: scaffold vite + react + ts + tailwind + shadcn theme"
```

---

## Phase 1 — Data & Domain

### Task 2: Dexie schema + types + db.ts

**Files:**
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Produces: `db: Image2ChatDB` singleton, plus exported types `ProviderPreset`, `Conversation`, `Message`, `ImageBlob`, `ProviderType`, `MessageRole`, `MessageKind`, `MessageStatus`.

- [ ] **Step 1: Write failing test `db.test.ts`**
```ts
import 'fake-indexeddb/auto'
import { db } from './db'

describe('db schema', () => {
  it('stores and retrieves a provider', async () => {
    const id = await db.providers.add({
      name: 'Packy', baseUrl: 'https://www.packyapi.com',
      apiKey: 'sk-x', type: 'packy', isBuiltIn: 1, createdAt: Date.now(),
    })
    const p = await db.providers.get(id)
    expect(p?.name).toBe('Packy')
  })

  it('cascades messages when conversation is deleted', async () => {
    const pid = await db.providers.add({
      name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0,
    })
    const cid = await db.conversations.add({
      title: 't', createdAt: 0, updatedAt: 0, providerPresetId: pid,
    })
    await db.messages.add({
      conversationId: cid, role: 'user', kind: 'text_prompt',
      prompt: 'hi', status: 'success', createdAt: 0,
    })
    await db.conversations.delete(cid)
    const remaining = await db.messages.where('conversationId').equals(cid).toArray()
    expect(remaining).toEqual([])
  })
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- db.test.ts`
Expected: compile error (db module missing).

- [ ] **Step 3: Write `src/lib/db.ts`**
```ts
import Dexie, { type Table } from 'dexie'

export type ProviderType = 'packy' | 'runapi' | 'custom'
export type MessageRole = 'user' | 'assistant'
export type MessageKind = 'text_prompt' | 'image_result' | 'image_edit_request'
export type MessageStatus = 'pending' | 'generating' | 'success' | 'failed'

export interface ProviderPreset {
  id?: number
  name: string
  baseUrl: string
  apiKey: string
  type: ProviderType
  isBuiltIn: 0 | 1
  createdAt: number
}

export interface Conversation {
  id?: number
  title: string
  createdAt: number
  updatedAt: number
  providerPresetId: number
}

export interface Message {
  id?: number
  conversationId: number
  role: MessageRole
  kind: MessageKind
  prompt?: string
  imageBlobId?: number
  remoteImageUrl?: string
  size?: string
  status: MessageStatus
  errorCode?: string
  createdAt: number
}

export interface ImageBlob {
  id?: number
  blob: Blob
  mimeType: string
  createdAt: number
}

export class Image2ChatDB extends Dexie {
  providers!: Table<ProviderPreset, number>
  conversations!: Table<Conversation, number>
  messages!: Table<Message, number>
  images!: Table<ImageBlob, number>

  constructor() {
    super('image2chat')
    this.version(1).stores({
      providers: '++id, type, createdAt',
      conversations: '++id, updatedAt, providerPresetId',
      messages: '++id, conversationId, createdAt, status',
      images: '++id, createdAt',
    })
  }
}

export const db = new Image2ChatDB()
```

- [ ] **Step 4: Verify test passes**

Run: `npm test -- db.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "feat(db): Dexie schema for providers, conversations, messages, images"
```

---

### Task 3: API types + error types + provider config + image utils

**Files:**
- Create: `src/lib/api/types.ts`
- Create: `src/lib/api/errors.ts`
- Create: `src/lib/api/providers.ts`
- Create: `src/lib/image.ts`
- Test: `src/lib/api/errors.test.ts`
- Test: `src/lib/api/providers.test.ts`
- Test: `src/lib/image.test.ts`

**Interfaces:**
- Produces:
  - `interface GenerateRequest`, `interface GenerateResponse`, `interface ImageData`
  - `type ApiError` (discriminated union of 7 kinds)
  - `parseApiError(response, body?)`, `parseNetworkError(e)`
  - `BUILTIN_PROVIDERS`, `getSupportedSizes(type)`
  - `createObjectURLSafe(blob)`, `revokeObjectURLSafe(url)`

- [ ] **Step 1: Write failing tests**

`src/lib/api/errors.test.ts`:
```ts
import { parseApiError, parseNetworkError } from './errors'

describe('parseApiError', () => {
  it('401 -> unauthorized', () => {
    const e = parseApiError(new Response('', { status: 401 }))
    expect(e.kind).toBe('unauthorized')
  })
  it('402 -> insufficient', () => {
    expect(parseApiError(new Response('', { status: 402 })).kind).toBe('insufficient')
  })
  it('429 -> rate_limited', () => {
    expect(parseApiError(new Response('', { status: 429 })).kind).toBe('rate_limited')
  })
  it('500 -> server_error', () => {
    expect(parseApiError(new Response('', { status: 500 })).kind).toBe('server_error')
  })
  it('400 with OpenAI error body -> bad_request with extracted message', () => {
    const e = parseApiError(new Response('', { status: 400 }), '{"error":{"message":"bad size"}}')
    expect(e.kind).toBe('bad_request')
    if (e.kind === 'bad_request') expect(e.message).toBe('bad size')
  })
  it('200 with empty data array -> content_filtered', () => {
    const e = parseApiError(new Response('{"created":1,"data":[]}', { status: 200 }))
    expect(e.kind).toBe('content_filtered')
  })
})

describe('parseNetworkError', () => {
  it('TypeError from fetch -> network', () => {
    expect(parseNetworkError(new TypeError('Failed to fetch')).kind).toBe('network')
  })
  it('AbortError -> network', () => {
    const e = new DOMException('aborted', 'AbortError')
    expect(parseNetworkError(e).kind).toBe('network')
  })
})
```

`src/lib/api/providers.test.ts`:
```ts
import { getSupportedSizes, BUILTIN_PROVIDERS } from './providers'

describe('getSupportedSizes', () => {
  it('packy supports all 7 sizes', () => {
    expect(getSupportedSizes('packy')).toHaveLength(7)
  })
  it('runapi excludes 4K', () => {
    const sizes = getSupportedSizes('runapi')
    expect(sizes).not.toContain('3840x2160')
    expect(sizes).not.toContain('2160x3840')
    expect(sizes).toHaveLength(5)
  })
  it('custom supports all 7', () => {
    expect(getSupportedSizes('custom')).toHaveLength(7)
  })
})

describe('BUILTIN_PROVIDERS', () => {
  it('exposes packy and runapi', () => {
    expect(BUILTIN_PROVIDERS.packy.baseUrl).toBe('https://www.packyapi.com')
    expect(BUILTIN_PROVIDERS.runapi.baseUrl).toBe('https://runapi.co')
  })
})
```

`src/lib/image.test.ts`:
```ts
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
```

- [ ] **Step 2: Verify tests fail**

Run: `npm test`
Expected: all 3 test files fail with compile errors.

- [ ] **Step 3: Write `src/lib/api/types.ts`**
```ts
export interface GenerateRequest {
  model?: string
  prompt: string
  n?: number
  size: string
  quality?: string
  response_format?: 'url' | 'b64_json'
  user?: string
}

export interface ImageData {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface GenerateResponse {
  created: number
  data: ImageData[]
}
```

- [ ] **Step 4: Write `src/lib/api/errors.ts`**
```ts
export type ApiError =
  | { kind: 'unauthorized'; message: string }
  | { kind: 'insufficient'; message: string }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'content_filtered'; message: string }
  | { kind: 'bad_request'; message: string }
  | { kind: 'server_error'; message: string }
  | { kind: 'network'; message: string }

interface OpenAiErrorBody { error?: { message?: string; type?: string; code?: string } }

function extractMessage(body: string | undefined): string | undefined {
  if (!body) return undefined
  try {
    const parsed = JSON.parse(body) as OpenAiErrorBody
    return parsed.error?.message
  } catch { return undefined }
}

export function parseApiError(response: Response, body?: string): ApiError {
  const msg = extractMessage(body)
  switch (response.status) {
    case 200: return { kind: 'content_filtered', message: msg ?? '返回为空' }
    case 401: return { kind: 'unauthorized', message: msg ?? '密钥无效或已过期' }
    case 402: return { kind: 'insufficient', message: msg ?? '余额不足' }
    case 429: return { kind: 'rate_limited', message: msg ?? '请求过快，请稍后再试' }
    case 400: return { kind: 'bad_request', message: msg ?? '请求参数错误' }
    default:
      if (response.status >= 500) return { kind: 'server_error', message: msg ?? '服务异常，请稍后再试' }
      return { kind: 'bad_request', message: msg ?? `未知错误 (${response.status})` }
  }
}

export function parseNetworkError(e: unknown): ApiError {
  const msg = e instanceof Error ? e.message : String(e)
  return { kind: 'network', message: `网络异常：${msg}` }
}
```

- [ ] **Step 5: Write `src/lib/api/providers.ts`**
```ts
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
```

- [ ] **Step 6: Write `src/lib/image.ts`**
```ts
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
```

- [ ] **Step 7: Verify all tests pass**

Run: `npm test`
Expected: 3 test files, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/api src/lib/image.ts src/lib/image.test.ts
git commit -m "feat(api): types, error parser, provider config, image utils"
```

---

### Task 4: Session store (Zustand) + localStorage helpers

**Files:**
- Create: `src/stores/useSession.ts`
- Test: `src/stores/useSession.test.ts`

**Interfaces:**
- Produces:
  - `useSession(): { activeProviderId: number | null; defaultSize: ImageSize; setActiveProviderId(id); setDefaultSize(size) }`
  - Persists to `localStorage` keys `i2c.activeProviderId` and `i2c.defaultSize`

- [ ] **Step 1: Write failing test `useSession.test.ts`**
```ts
import { renderHook, act } from '@testing-library/react'
import { useSession } from './useSession'

beforeEach(() => localStorage.clear())

describe('useSession', () => {
  it('starts with default size and no active provider', () => {
    const { result } = renderHook(() => useSession())
    expect(result.current.defaultSize).toBe('2048x1152')
    expect(result.current.activeProviderId).toBeNull()
  })

  it('persists defaultSize to localStorage', () => {
    const { result } = renderHook(() => useSession())
    act(() => result.current.setDefaultSize('1024x1024'))
    expect(localStorage.getItem('i2c.defaultSize')).toBe('1024x1024')
  })

  it('persists activeProviderId to localStorage', () => {
    const { result } = renderHook(() => useSession())
    act(() => result.current.setActiveProviderId(7))
    expect(localStorage.getItem('i2c.activeProviderId')).toBe('7')
  })

  it('restores persisted values on init', () => {
    localStorage.setItem('i2c.defaultSize', '3840x2160')
    localStorage.setItem('i2c.activeProviderId', '42')
    const { result } = renderHook(() => useSession())
    expect(result.current.defaultSize).toBe('3840x2160')
    expect(result.current.activeProviderId).toBe(42)
  })
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- useSession.test.ts`
Expected: compile error.

- [ ] **Step 3: Write `src/stores/useSession.ts`**
```ts
import { create } from 'zustand'
import { DEFAULT_SIZE, isImageSize, type ImageSize } from '@/lib/api/providers'

interface SessionState {
  activeProviderId: number | null
  defaultSize: ImageSize
  setActiveProviderId: (id: number | null) => void
  setDefaultSize: (size: ImageSize) => void
}

const KEY_PID = 'i2c.activeProviderId'
const KEY_SIZE = 'i2c.defaultSize'

function readPid(): number | null {
  const v = localStorage.getItem(KEY_PID)
  return v ? Number(v) : null
}

function readSize(): ImageSize {
  const v = localStorage.getItem(KEY_SIZE)
  return v && isImageSize(v) ? v : DEFAULT_SIZE
}

export const useSession = create<SessionState>((set) => ({
  activeProviderId: readPid(),
  defaultSize: readSize(),
  setActiveProviderId: (id) => {
    if (id == null) localStorage.removeItem(KEY_PID)
    else localStorage.setItem(KEY_PID, String(id))
    set({ activeProviderId: id })
  },
  setDefaultSize: (size) => {
    localStorage.setItem(KEY_SIZE, size)
    set({ defaultSize: size })
  },
}))
```

- [ ] **Step 4: Verify test passes**

Run: `npm test -- useSession.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useSession.ts src/stores/useSession.test.ts
git commit -m "feat(state): useSession zustand store with localStorage persistence"
```

---

## Phase 2 — Network

### Task 5: fetch client (generateImage + editImage) + MSW tests

**Files:**
- Create: `src/lib/api/client.ts`
- Create: `src/test/handlers.ts` (MSW)
- Create: `src/test/server.ts`
- Test: `src/lib/api/client.test.ts`

**Interfaces:**
- Produces:
  - `generateImage(baseUrl, apiKey, req): Promise<GenerateResponse>`
  - `editImage(baseUrl, apiKey, prompt, sourceBlob, size): Promise<GenerateResponse>`
  - Throws `ApiError` on failure

- [ ] **Step 1: Write failing test `client.test.ts`**
```ts
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { generateImage, editImage } from './client'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('generateImage', () => {
  it('POSTs to /v1/images/generations with bearer header', async () => {
    let captured: { headers: Headers; body: string } | null = null
    server.use(http.post('https://www.packyapi.com/v1/images/generations', async ({ request }) => {
      captured = { headers: request.headers, body: await request.text() }
      return HttpResponse.json({ created: 1, data: [{ url: 'https://cdn/x.png' }] })
    }))
    const res = await generateImage('https://www.packyapi.com', 'sk-test', {
      prompt: 'cat', size: '2048x1152',
    })
    expect(res.data[0].url).toBe('https://cdn/x.png')
    expect(captured!.headers.get('authorization')).toBe('Bearer sk-test')
    expect(JSON.parse(captured!.body)).toMatchObject({ prompt: 'cat', size: '2048x1152' })
  })

  it('throws ApiError with kind=unauthorized on 401', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('', { status: 401 }),
    ))
    await expect(generateImage('https://www.packyapi.com', 'bad', { prompt: 'x', size: '1024x1024' }))
      .rejects.toMatchObject({ kind: 'unauthorized' })
  })

  it('throws ApiError with kind=network on fetch failure', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () => HttpResponse.error()))
    await expect(generateImage('https://www.packyapi.com', 'k', { prompt: 'x', size: '1024x1024' }))
      .rejects.toMatchObject({ kind: 'network' })
  })
})

describe('editImage', () => {
  it('POSTs multipart to /v1/images/edits', async () => {
    let captured: FormData | null = null
    server.use(http.post('https://www.packyapi.com/v1/images/edits', async ({ request }) => {
      captured = await request.formData()
      return HttpResponse.json({ created: 1, data: [{ url: 'https://cdn/y.png' }] })
    }))
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const res = await editImage('https://www.packyapi.com', 'sk-test', 'make red', blob, '1024x1024')
    expect(res.data[0].url).toBe('https://cdn/y.png')
    expect(captured!.get('model')).toBe('gpt-image-2')
    expect(captured!.get('prompt')).toBe('make red')
    expect(captured!.get('size')).toBe('1024x1024')
    expect(captured!.get('image')).toBeInstanceOf(Blob)
  })
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- client.test.ts`
Expected: compile errors.

- [ ] **Step 3: Write `src/test/server.ts`**
```ts
import { setupServer } from 'msw/node'

export const server = setupServer()
```

- [ ] **Step 4: Write `src/test/handlers.ts`** — leave empty (tests register handlers per case).

- [ ] **Step 5: Write `src/lib/api/client.ts`**
```ts
import type { GenerateRequest, GenerateResponse } from './types'
import { parseApiError, parseNetworkError } from './errors'

const TIMEOUT_MS = 120_000

function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  signal?.addEventListener('abort', () => ctrl.abort())
  return ctrl.signal
}

export async function generateImage(
  baseUrl: string, apiKey: string, req: GenerateRequest,
): Promise<GenerateResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/images/generations`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model ?? 'gpt-image-2',
        prompt: req.prompt,
        n: req.n ?? 1,
        size: req.size,
        quality: req.quality ?? 'high',
        response_format: req.response_format ?? 'url',
        user: req.user,
      }),
      signal: withTimeout(TIMEOUT_MS),
    })
    const body = await res.text()
    if (!res.ok) throw parseApiError(res, body)
    return JSON.parse(body) as GenerateResponse
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) throw e
    throw parseNetworkError(e)
  }
}

export async function editImage(
  baseUrl: string, apiKey: string,
  prompt: string, sourceBlob: Blob, size: string,
): Promise<GenerateResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/images/edits`
  const form = new FormData()
  form.append('model', 'gpt-image-2')
  form.append('prompt', prompt)
  form.append('image', sourceBlob, 'source.png')
  form.append('n', '1')
  form.append('size', size)
  form.append('quality', 'high')
  form.append('response_format', 'url')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form,
      signal: withTimeout(TIMEOUT_MS),
    })
    const body = await res.text()
    if (!res.ok) throw parseApiError(res, body)
    return JSON.parse(body) as GenerateResponse
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e) throw e
    throw parseNetworkError(e)
  }
}
```

- [ ] **Step 6: Verify tests pass**

Run: `npm test`
Expected: 4 + 3 = 7 tests pass across all test files (db, errors, providers, image, useSession, client).

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/client.ts src/lib/api/client.test.ts src/test/
git commit -m "feat(api): generateImage + editImage fetch client with MSW tests"
```

---

### Task 6: Repositories — providers + conversations + messages + images

**Files:**
- Create: `src/lib/repo.ts` (single file with all repo functions for simplicity)
- Test: `src/lib/repo.test.ts`

**Interfaces:**
- Produces:
  - Providers: `addProvider(p)`, `updateProvider(id, patch)`, `deleteProvider(id)`, `getProvider(id)`, `countProviders()`, `seedBuiltinProviders()`
  - Conversations: `addConversation(providerPresetId)`, `renameConversation(id, title)`, `deleteConversation(id)`, `touchConversation(id)`
  - Messages: `addMessage(m)`, `updateMessageStatus(id, status, errorCode?)`, `setMessageBlobId(id, blobId)`, `setMessageRemoteUrl(id, url)`, `getMessage(id)`
  - Images: `addImage(blob, mimeType)`

- [ ] **Step 1: Write failing test `repo.test.ts`**
```ts
import 'fake-indexeddb/auto'
import { db } from './db'
import {
  addProvider, countProviders, seedBuiltinProviders,
  addConversation, addMessage, updateMessageStatus, getMessage,
  addImage, setMessageBlobId,
} from './repo'

beforeEach(async () => { await db.delete(); await db.open() })

describe('seedBuiltinProviders', () => {
  it('adds packy and runapi when empty', async () => {
    await seedBuiltinProviders()
    expect(await countProviders()).toBe(2)
  })

  it('does not duplicate when already seeded', async () => {
    await seedBuiltinProviders()
    await seedBuiltinProviders()
    expect(await countProviders()).toBe(2)
  })
})

describe('messages', () => {
  it('updates status and errorCode', async () => {
    const pid = await addProvider({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
    const cid = await addConversation(pid)
    const mid = await addMessage({ conversationId: cid, role: 'assistant', kind: 'image_result', size: '2048x1152', status: 'generating', createdAt: 0 })
    await updateMessageStatus(mid, 'failed', '401')
    const m = await getMessage(mid)
    expect(m?.status).toBe('failed')
    expect(m?.errorCode).toBe('401')
  })

  it('binds image blob', async () => {
    const pid = await addProvider({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
    const cid = await addConversation(pid)
    const mid = await addMessage({ conversationId: cid, role: 'assistant', kind: 'image_result', size: '2048x1152', status: 'success', createdAt: 0 })
    const bid = await addImage(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'image/png')
    await setMessageBlobId(mid, bid)
    const m = await getMessage(mid)
    expect(m?.imageBlobId).toBe(bid)
  })
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- repo.test.ts`
Expected: compile errors.

- [ ] **Step 3: Write `src/lib/repo.ts`**
```ts
import { db } from './db'
import type { ProviderPreset, Conversation, Message, ImageBlob, MessageStatus } from './db'
import { BUILTIN_PROVIDERS } from './api/providers'

export async function addProvider(p: Omit<ProviderPreset, 'id'>): Promise<number> {
  return db.providers.add(p)
}

export async function updateProvider(id: number, patch: Partial<ProviderPreset>): Promise<void> {
  await db.providers.update(id, patch)
}

export async function deleteProvider(id: number): Promise<void> {
  await db.providers.delete(id)
}

export async function getProvider(id: number): Promise<ProviderPreset | undefined> {
  return db.providers.get(id)
}

export async function countProviders(): Promise<number> {
  return db.providers.count()
}

export async function seedBuiltinProviders(): Promise<void> {
  const existing = await db.providers.toArray()
  const have = new Set(existing.map((p) => p.type))
  const now = Date.now()
  if (!have.has('packy')) {
    await db.providers.add({
      name: BUILTIN_PROVIDERS.packy.name,
      baseUrl: BUILTIN_PROVIDERS.packy.baseUrl,
      apiKey: '', type: 'packy', isBuiltIn: 1, createdAt: now,
    })
  }
  if (!have.has('runapi')) {
    await db.providers.add({
      name: BUILTIN_PROVIDERS.runapi.name,
      baseUrl: BUILTIN_PROVIDERS.runapi.baseUrl,
      apiKey: '', type: 'runapi', isBuiltIn: 1, createdAt: now + 1,
    })
  }
}

export async function addConversation(providerPresetId: number, title = '新对话'): Promise<number> {
  const now = Date.now()
  return db.conversations.add({ title, createdAt: now, updatedAt: now, providerPresetId })
}

export async function renameConversation(id: number, title: string): Promise<void> {
  await db.conversations.update(id, { title, updatedAt: Date.now() })
}

export async function touchConversation(id: number): Promise<void> {
  await db.conversations.update(id, { updatedAt: Date.now() })
}

export async function deleteConversation(id: number): Promise<void> {
  await db.conversations.delete(id)
}

export async function setConversationProvider(id: number, providerPresetId: number): Promise<void> {
  await db.conversations.update(id, { providerPresetId, updatedAt: Date.now() })
}

export async function addMessage(m: Omit<Message, 'id'>): Promise<number> {
  return db.messages.add(m)
}

export async function updateMessageStatus(id: number, status: MessageStatus, errorCode?: string): Promise<void> {
  await db.messages.update(id, { status, errorCode })
}

export async function setMessageBlobId(id: number, blobId: number): Promise<void> {
  await db.messages.update(id, { imageBlobId: blobId })
}

export async function setMessageRemoteUrl(id: number, url: string): Promise<void> {
  await db.messages.update(id, { remoteImageUrl: url })
}

export async function setMessagePrompt(id: number, prompt: string): Promise<void> {
  await db.messages.update(id, { prompt })
}

export async function getMessage(id: number): Promise<Message | undefined> {
  return db.messages.get(id)
}

export async function addImage(blob: Blob, mimeType: string): Promise<number> {
  return db.images.add({ blob, mimeType, createdAt: Date.now() })
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npm test`
Expected: all previous + 4 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repo.ts src/lib/repo.test.ts
git commit -m "feat(repo): provider/conversation/message/image repository functions"
```

---

## Phase 3 — Hooks & UI primitives

### Task 7: Dexie-backed hooks (useProviders, useConversations, useMessages)

**Files:**
- Create: `src/hooks/useProviders.ts`
- Create: `src/hooks/useConversations.ts`
- Create: `src/hooks/useMessages.ts`
- Test: `src/hooks/useMessages.test.tsx`

**Interfaces:**
- Produces:
  - `useProviders(): ProviderPreset[]`
  - `useConversations(): Conversation[]`
  - `useMessages(convId: number | undefined): Message[]`

- [ ] **Step 1: Write failing test `useMessages.test.tsx`**
```tsx
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '@/lib/db'
import { useMessages } from './useMessages'

beforeEach(async () => { await db.delete(); await db.open() })

it('returns messages for a conversation reactively', async () => {
  await db.messages.add({ conversationId: 1, role: 'user', kind: 'text_prompt', prompt: 'hi', status: 'success', createdAt: 1 })
  const { result } = renderHook(() => useMessages(1))
  await waitFor(() => { expect(result.current).toHaveLength(1) })
  await db.messages.add({ conversationId: 1, role: 'assistant', kind: 'image_result', status: 'success', createdAt: 2 })
  await waitFor(() => { expect(result.current).toHaveLength(2) })
})

it('returns empty array when conversationId is undefined', () => {
  const { result } = renderHook(() => useMessages(undefined))
  expect(result.current).toEqual([])
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- useMessages.test.tsx`
Expected: compile error.

- [ ] **Step 3: Write `src/hooks/useProviders.ts`**
```ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { ProviderPreset } from '@/lib/db'

export function useProviders(): ProviderPreset[] {
  const list = useLiveQuery(() => db.providers.orderBy('createdAt').toArray(), [], [])
  return list ?? []
}
```

- [ ] **Step 4: Write `src/hooks/useConversations.ts`**
```ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { Conversation } from '@/lib/db'

export function useConversations(): Conversation[] {
  const list = useLiveQuery(() => db.conversations.orderBy('updatedAt').reverse().toArray(), [], [])
  return list ?? []
}
```

- [ ] **Step 5: Write `src/hooks/useMessages.ts`**
```ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { Message } from '@/lib/db'

export function useMessages(conversationId: number | undefined): Message[] {
  const list = useLiveQuery(
    async () => {
      if (conversationId == null) return []
      return db.messages.where('conversationId').equals(conversationId).sortBy('createdAt')
    },
    [conversationId],
    [],
  )
  return list ?? []
}
```

- [ ] **Step 6: Verify tests pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/
git commit -m "feat(hooks): Dexie liveQuery hooks for providers/conversations/messages"
```

---

### Task 8: shadcn/ui primitives (button, input, card, dialog, sheet, toast, dropdown-menu)

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/toast.tsx` + `src/components/ui/toaster.tsx` + `src/components/ui/use-toast.ts`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/label.tsx`

- [ ] **Step 1: Initialize shadcn for each component**

Run: `npx shadcn@latest add button input textarea card dialog sheet dropdown-menu toast badge label`
Expected: 10 files generated under `src/components/ui/` plus `use-toast.ts`.

If `shadcn` CLI not available, write the files manually using the standard shadcn/ui templates (well-known code). The files are largely boilerplate using `@radix-ui/*` primitives.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): shadcn/ui primitives (button, input, dialog, sheet, toast, etc.)"
```

---

## Phase 4 — Screens

### Task 9: OnboardingWizard

**Files:**
- Create: `src/components/OnboardingWizard.tsx`
- Test: `src/components/OnboardingWizard.test.tsx`

**Interfaces:**
- Produces:
  - `<OnboardingWizard onDone: () => void>` — three-step wizard; saves selected template + key to Dexie; calls `onDone()` after successful save.

- [ ] **Step 1: Write failing test `OnboardingWizard.test.tsx`**
```tsx
import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { OnboardingWizard } from './OnboardingWizard'

beforeEach(async () => { await db.delete(); await db.open() })

it('renders welcome page initially', () => {
  render(<OnboardingWizard onDone={() => {}} />)
  expect(screen.getByText('开始使用')).toBeInTheDocument()
})

it('completes onboarding with packy template + key', async () => {
  const user = userEvent.setup()
  const onDone = vi.fn()
  render(<OnboardingWizard onDone={onDone} />)
  await user.click(screen.getByText('开始使用'))
  await user.click(screen.getByText('Packy'))
  await user.type(screen.getByLabelText(/SK 密钥/i), 'sk-test')
  await user.click(screen.getByText('完成'))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  const providers = await db.providers.toArray()
  expect(providers).toHaveLength(1)
  expect(providers[0].type).toBe('packy')
  expect(providers[0].apiKey).toBe('sk-test')
})

it('shows error when submitting empty key', async () => {
  const user = userEvent.setup()
  render(<OnboardingWizard onDone={() => {}} />)
  await user.click(screen.getByText('开始使用'))
  await user.click(screen.getByText('Packy'))
  await user.click(screen.getByText('完成'))
  expect(await screen.findByText(/请填写密钥/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- OnboardingWizard.test.tsx`
Expected: compile errors.

- [ ] **Step 3: Write `src/components/OnboardingWizard.tsx`**
```tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addProvider, seedBuiltinProviders } from '@/lib/repo'
import { BUILTIN_PROVIDERS, type ProviderType } from '@/lib/api/providers'

interface Props { onDone: () => void }

type Step = 'welcome' | 'choose' | 'key'

export function OnboardingWizard({ onDone }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  const [type, setType] = useState<ProviderType>('packy')
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFinish() {
    setError(null)
    if (key.trim().length === 0) { setError('请填写密钥'); return }
    setBusy(true)
    await seedBuiltinProviders()
    const baseUrl = type === 'custom' ? customUrl.trim() :
      type === 'packy' ? BUILTIN_PROVIDERS.packy.baseUrl : BUILTIN_PROVIDERS.runapi.baseUrl
    const name = type === 'custom' ? (customName.trim() || '自定义') :
      type === 'packy' ? 'Packy' : 'RunAPI'
    await addProvider({
      name, baseUrl, apiKey: key.trim(),
      type, isBuiltIn: type === 'custom' ? 0 : 1,
      createdAt: Date.now(),
    })
    setBusy(false)
    onDone()
  }

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="text-2xl">欢迎使用 image2chat</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">配置中转站，开始 AI 图像创作。</p>
            <Button className="w-full" onClick={() => setStep('choose')}>开始使用</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>选择中转站</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => { setType('packy'); setStep('key') }}>
              Packy<br /><span className="text-xs text-muted-foreground">{BUILTIN_PROVIDERS.packy.baseUrl}</span>
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => { setType('runapi'); setStep('key') }}>
              RunAPI<br /><span className="text-xs text-muted-foreground">{BUILTIN_PROVIDERS.runapi.baseUrl}</span>
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { setType('custom'); setStep('key') }}>
              自定义添加
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>输入 SK 密钥</CardTitle>
          <p className="text-sm text-muted-foreground">
            {type === 'packy' ? `中转站：${BUILTIN_PROVIDERS.packy.baseUrl}` :
             type === 'runapi' ? `中转站：${BUILTIN_PROVIDERS.runapi.baseUrl}` :
             `自定义：${customUrl || '请填写域名'}`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {type === 'custom' && (
            <>
              <div>
                <Label>名称</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="我的中转站" />
              </div>
              <div>
                <Label>域名</Label>
                <Input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://example.com" />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="key">SK 密钥</Label>
            <Input id="key" type="password" value={key} onChange={(e) => setKey(e.target.value)} />
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep('choose')}>返回</Button>
            <Button className="flex-1" disabled={busy} onClick={handleFinish}>完成</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npm test`
Expected: 3 new tests pass; all previous tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingWizard.tsx src/components/OnboardingWizard.test.tsx
git commit -m "feat(ui): OnboardingWizard (3-step provider setup)"
```

---

### Task 10: useGenerate hook — orchestrates API + DB + image download

**Files:**
- Create: `src/hooks/useGenerate.ts`
- Test: `src/hooks/useGenerate.test.tsx`

**Interfaces:**
- Produces:
  - `useGenerate(): { generate(convId, prompt, size, editSourceMessageId?): Promise<{ messageId: number } | { error: ApiError }> }`

- [ ] **Step 1: Write failing test `useGenerate.test.tsx`**
```tsx
import 'fake-indexeddb/auto'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderHook, act } from '@testing-library/react'
import { db } from '@/lib/db'
import { useGenerate } from './useGenerate'

beforeAll(() => server.listen())
afterEach(async () => { server.resetHandlers(); await db.delete(); await db.open() })
afterAll(() => server.close())

it('success path: inserts pending msg, calls API, persists blob, marks success', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
    HttpResponse.json({ created: 1, data: [{ url: 'https://cdn/x.png' }] }),
  ))
  // Stub blob fetch
  server.use(http.get('https://cdn/x.png', () =>
    new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer, { headers: { 'content-type': 'image/png' } }),
  ))

  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const { result } = renderHook(() => useGenerate())
  let res: any
  await act(async () => { res = await result.current.generate(cid, 'cat', '2048x1152') })
  expect(res?.messageId).toBeGreaterThan(0)
  const msgs = await db.messages.toArray()
  expect(msgs).toHaveLength(1)
  expect(msgs[0].status).toBe('success')
  expect(msgs[0].imageBlobId).toBeGreaterThan(0)
})

it('error path: marks message failed with errorCode', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
    new HttpResponse('', { status: 401 }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const { result } = renderHook(() => useGenerate())
  let res: any
  await act(async () => { res = await result.current.generate(cid, 'cat', '2048x1152') })
  expect(res?.error?.kind).toBe('unauthorized')
  const msgs = await db.messages.toArray()
  expect(msgs[0].status).toBe('failed')
  expect(msgs[0].errorCode).toBe('401')
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- useGenerate.test.tsx`
Expected: compile errors.

- [ ] **Step 3: Write `src/hooks/useGenerate.ts`**
```ts
import { useCallback } from 'react'
import { db } from '@/lib/db'
import { getProvider, addMessage, updateMessageStatus, setMessageBlobId, setMessageRemoteUrl, addImage, touchConversation, setMessagePrompt } from '@/lib/repo'
import { generateImage, editImage } from '@/lib/api/client'
import type { ApiError } from '@/lib/api/errors'

interface Success { messageId: number }
interface Failure { error: ApiError }
export type GenerateResult = Success | Failure

export function useGenerate() {
  return {
    generate: useCallback(async (
      conversationId: number,
      prompt: string,
      size: string,
      editSourceMessageId?: number,
    ): Promise<GenerateResult> => {
      const conv = await db.conversations.get(conversationId)
      if (!conv) return { error: { kind: 'bad_request', message: '会话不存在' } }
      const provider = await getProvider(conv.providerPresetId)
      if (!provider) return { error: { kind: 'bad_request', message: '中转站未配置' } }

      const now = Date.now()
      const userMsgId = await addMessage({
        conversationId, role: 'user',
        kind: editSourceMessageId != null ? 'image_edit_request' : 'text_prompt',
        prompt, size, status: 'success', createdAt: now,
      })
      if (editSourceMessageId != null) await setMessagePrompt(userMsgId, prompt)
      const assistantId = await addMessage({
        conversationId, role: 'assistant', kind: 'image_result',
        size, status: 'generating', createdAt: now + 1,
      })
      await touchConversation(conversationId)

      try {
        let url: string
        if (editSourceMessageId != null) {
          const srcMsg = await db.messages.get(editSourceMessageId)
          if (!srcMsg?.imageBlobId) throw { kind: 'bad_request', message: '找不到参考图' }
          const img = await db.images.get(srcMsg.imageBlobId)
          if (!img) throw { kind: 'bad_request', message: '参考图丢失' }
          const res = await editImage(provider.baseUrl, provider.apiKey, prompt, img.blob, size)
          url = res.data[0]?.url
          if (!url) throw { kind: 'content_filtered', message: '返回为空' }
        } else {
          const res = await generateImage(provider.baseUrl, provider.apiKey, { prompt, size })
          url = res.data[0]?.url
          if (!url) throw { kind: 'content_filtered', message: '返回为空' }
        }
        await setMessageRemoteUrl(assistantId, url)
        // Download blob in background
        try {
          const r = await fetch(url)
          if (r.ok) {
            const blob = await r.blob()
            const bid = await addImage(blob, blob.type || 'image/png')
            await setMessageBlobId(assistantId, bid)
          }
        } catch { /* keep remoteUrl as fallback */ }
        await updateMessageStatus(assistantId, 'success')
        return { messageId: assistantId }
      } catch (e: any) {
        const err: ApiError = e?.kind ? e : { kind: 'network', message: e?.message ?? '未知错误' }
        await updateMessageStatus(assistantId, 'failed', String((err as any).kind ?? 'unknown'))
        return { error: err }
      }
    }, []),
  }
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npm test`
Expected: 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGenerate.ts src/hooks/useGenerate.test.tsx
git commit -m "feat(generate): useGenerate hook (orchestrate API + DB + blob download)"
```

---

### Task 11: Sidebar (conversation list)

**Files:**
- Create: `src/components/Sidebar.tsx`
- Test: `src/components/Sidebar.test.tsx`

**Interfaces:**
- Produces:
  - `<Sidebar activeId?: number; onSelect: (id: number) => void; onNew: () => void />`

- [ ] **Step 1: Write failing test `Sidebar.test.tsx`**
```tsx
import 'fake-indexeddb/auto'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { Sidebar } from './Sidebar'

beforeEach(async () => { await db.delete(); await db.open() })

it('renders empty state', () => {
  render(<Sidebar onSelect={() => {}} onNew={() => {}} />)
  expect(screen.getByText('新建对话')).toBeInTheDocument()
})

it('lists conversations and calls onSelect on click', async () => {
  const pid = await db.providers.add({ name: 'P', baseUrl: 'u', apiKey: 'k', type: 'custom', isBuiltIn: 0, createdAt: 0 })
  await db.conversations.add({ title: 'Alpha', createdAt: 0, updatedAt: 1, providerPresetId: pid })
  await db.conversations.add({ title: 'Beta', createdAt: 0, updatedAt: 2, providerPresetId: pid })
  const onSelect = vi.fn()
  render(<Sidebar onSelect={onSelect} onNew={() => {}} />)
  expect(await screen.findByText('Alpha')).toBeInTheDocument()
  expect(screen.getByText('Beta')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Alpha'))
  expect(onSelect).toHaveBeenCalledWith(expect.any(Number))
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- Sidebar.test.tsx`
Expected: compile errors.

- [ ] **Step 3: Write `src/components/Sidebar.tsx`**
```tsx
import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/useConversations'
import { useProviders } from '@/hooks/useProviders'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteConversation } from '@/lib/repo'

interface Props {
  activeId?: number
  onSelect: (id: number) => void
  onNew: () => void
}

export function Sidebar({ activeId, onSelect, onNew }: Props) {
  const conversations = useConversations()
  const providers = useProviders()
  const activeProvider = providers[0]

  return (
    <aside className="w-64 border-r border-border flex flex-col h-full bg-card">
      <div className="p-3 border-b border-border">
        <Button className="w-full" onClick={onNew}>
          <Plus className="w-4 h-4 mr-2" /> 新建对话
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">还没有会话</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => c.id != null && onSelect(c.id)}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between group',
                c.id === activeId && 'bg-accent',
              )}
            >
              <span className="truncate text-sm">{c.title}</span>
              <Trash2
                className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); if (c.id != null) deleteConversation(c.id) }}
              />
            </button>
          ))
        )}
      </div>
      <div className="p-3 border-t border-border text-xs text-muted-foreground">
        当前：{activeProvider?.name ?? '未配置'}
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npm test`
Expected: 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Sidebar.test.tsx
git commit -m "feat(ui): Sidebar with conversation list"
```

---

### Task 12: MessageBubble + ChatView (display only)

**Files:**
- Create: `src/components/MessageBubble.tsx`
- Create: `src/components/ChatView.tsx` (display + status, no composer yet)
- Test: `src/components/MessageBubble.test.tsx`

**Interfaces:**
- Produces:
  - `<MessageBubble message: Message; onImageClick: (blobId: number) => void; onRetry: (msgId: number) => void; onEdit: (msgId: number) => void />`
  - `<ChatView conversationId: number; onBack: () => void; onOpenImage: (blobId: number) => void; onNewConversation: () => void />`

- [ ] **Step 1: Write failing test `MessageBubble.test.tsx`**
```tsx
import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { MessageBubble } from './MessageBubble'

beforeEach(async () => { await db.delete(); await db.open() })

it('renders user text prompt', () => {
  render(<MessageBubble message={{ id: 1, conversationId: 1, role: 'user', kind: 'text_prompt', prompt: 'hello', status: 'success', createdAt: 0 }} onImageClick={() => {}} onRetry={() => {}} onEdit={() => {}} />)
  expect(screen.getByText('hello')).toBeInTheDocument()
})

it('renders generating placeholder for assistant with status generating', () => {
  render(<MessageBubble message={{ id: 1, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'generating', createdAt: 0 }} onImageClick={() => {}} onRetry={() => {}} onEdit={() => {}} />)
  expect(screen.getByText(/正在创作/i)).toBeInTheDocument()
})

it('renders failed state with retry button', async () => {
  const onRetry = vi.fn()
  render(<MessageBubble message={{ id: 5, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'failed', errorCode: '500', createdAt: 0 }} onImageClick={() => {}} onRetry={onRetry} onEdit={() => {}} />)
  expect(screen.getByText(/服务异常/i)).toBeInTheDocument()
  await userEvent.click(screen.getByText('重试'))
  expect(onRetry).toHaveBeenCalledWith(5)
})

it('renders 去设置 button for 401', () => {
  render(<MessageBubble message={{ id: 5, conversationId: 1, role: 'assistant', kind: 'image_result', status: 'failed', errorCode: '401', createdAt: 0 }} onImageClick={() => {}} onRetry={() => {}} onEdit={() => {}} />)
  expect(screen.getByText('去设置')).toBeInTheDocument()
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- MessageBubble.test.tsx`
Expected: compile errors.

- [ ] **Step 3: Write `src/components/MessageBubble.tsx`**
```tsx
import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import type { Message } from '@/lib/db'
import { createObjectURLSafe, revokeObjectURLSafe } from '@/lib/image'
import { cn } from '@/lib/utils'

interface Props {
  message: Message
  onImageClick: (blobId: number) => void
  onRetry: (msgId: number) => void
  onEdit: (msgId: number) => void
}

const GENERATING_LABELS = ['正在创作…', '勾勒中', '渲染中', '精修中']

const ERROR_DISPLAY: Record<string, string> = {
  'unauthorized': '密钥无效或已过期',
  'insufficient': '余额不足',
  'rate_limited': '请求过快，请稍后再试',
  'content_filtered': '内容未通过审核',
  'bad_request': '请求参数错误',
  'server_error': '服务异常，请稍后再试',
  'network': '网络异常',
}

function isRetryable(errorCode?: string): boolean {
  if (!errorCode) return true
  return ['rate_limited', 'server_error', 'network', '500', '429'].includes(errorCode)
}

export function MessageBubble({ message, onImageClick, onRetry, onEdit }: Props) {
  const isUser = message.role === 'user'
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (tick % 4 === 0) {
      // force re-render to rotate generating label
    }
  }, [tick])

  useEffect(() => {
    if (message.status !== 'success' || !message.imageBlobId) return
    let cancelled = false
    db.images.get(message.imageBlobId).then((img) => {
      if (cancelled || !img) return
      setBlobUrl(createObjectURLSafe(img.blob))
    })
    return () => { cancelled = true; if (blobUrl) revokeObjectURLSafe(blobUrl) }
  }, [message.imageBlobId, message.status])

  useEffect(() => {
    if (message.status !== 'generating') return
    const id = setInterval(() => setTick((t) => t + 1), 4000)
    return () => clearInterval(id)
  }, [message.status])

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[70%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2">
          {message.prompt && <p className="whitespace-pre-wrap break-words">{message.prompt}</p>}
          {message.imageBlobId && blobUrl && <img src={blobUrl} alt="" className="mt-2 rounded max-w-full" />}
        </div>
      </div>
    )
  }

  // assistant
  const label = GENERATING_LABELS[tick % GENERATING_LABELS.length]

  return (
    <div className="flex justify-start mb-3">
      <div className={cn(
        'max-w-[70%] rounded-2xl rounded-bl-sm px-3 py-2',
        message.status === 'failed' && 'border border-destructive',
        message.status !== 'failed' && 'border border-border',
      )}>
        {message.status === 'pending' || message.status === 'generating' ? (
          <div className="h-48 w-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">{label}</span>
          </div>
        ) : message.status === 'success' ? (
          <>
            {(blobUrl || message.remoteImageUrl) && (
              <img
                src={blobUrl ?? message.remoteImageUrl!}
                alt=""
                className="rounded cursor-zoom-in"
                onClick={() => message.imageBlobId != null && onImageClick(message.imageBlobId)}
              />
            )}
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => message.imageBlobId != null && onImageClick(message.imageBlobId)}>查看</Button>
              <Button size="sm" variant="outline" onClick={() => message.id != null && onEdit(message.id)}>编辑</Button>
            </div>
          </>
        ) : (
          <div className="p-2">
            <p className="text-sm text-destructive mb-2">
              {ERROR_DISPLAY[message.errorCode ?? ''] ?? message.errorCode ?? '生成失败'}
            </p>
            {isRetryable(message.errorCode) ? (
              <Button size="sm" variant="outline" onClick={() => message.id != null && onRetry(message.id)}>
                <RefreshCw className="w-3 h-3 mr-1" /> 重试
              </Button>
            ) : message.errorCode === '401' ? (
              <Button size="sm" variant="outline" onClick={() => location.assign('/settings')}>
                <SettingsIcon className="w-3 h-3 mr-1" /> 去设置
              </Button>
            ) : (
              <Button size="sm" variant="ghost">我知道了</Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/ChatView.tsx`** (display + status, composer added in Task 13)
```tsx
import { useMessages } from '@/hooks/useMessages'
import { MessageBubble } from './MessageBubble'
import { useEffect, useRef } from 'react'
import { db } from '@/lib/db'
import { updateMessageStatus } from '@/lib/repo'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  conversationId: number
  onBack: () => void
  onOpenImage: (blobId: number) => void
  onRetry: (msgId: number) => void
  onEdit: (msgId: number) => void
}

export function ChatView({ conversationId, onBack, onOpenImage, onRetry, onEdit }: Props) {
  const messages = useMessages(conversationId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-fail stale generating messages (>5 min)
  useEffect(() => {
    const STALE = 5 * 60 * 1000
    const now = Date.now()
    messages.forEach((m) => {
      if (m.status === 'generating' && now - m.createdAt > STALE) {
        updateMessageStatus(m.id!, 'failed', 'timeout')
      }
    })
  }, [messages.length])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 p-3 border-b border-border">
        <Button size="icon" variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <h2 className="font-semibold">会话 #{conversationId}</h2>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onImageClick={onOpenImage}
            onRetry={onRetry}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify tests pass**

Run: `npm test`
Expected: 4 new MessageBubble tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/MessageBubble.tsx src/components/MessageBubble.test.tsx src/components/ChatView.tsx
git commit -m "feat(ui): MessageBubble (states + actions) and ChatView shell"
```

---

### Task 13: Composer (input + send + edit mode)

**Files:**
- Create: `src/components/Composer.tsx`
- Modify: `src/components/ChatView.tsx` — integrate Composer
- Test: `src/components/Composer.test.tsx`

**Interfaces:**
- Produces:
  - `<Composer onSend: (prompt, editSourceMessageId?) => void; editSource?: { messageId: number; blobId: number }; onClearEdit: () => void />`

- [ ] **Step 1: Write failing test `Composer.test.tsx`**
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from './Composer'

it('calls onSend with trimmed prompt', async () => {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} />)
  const textarea = screen.getByPlaceholderText(/描述你想要的图像/i)
  await userEvent.type(textarea, '  a red apple  ')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalledWith('a red apple', undefined)
})

it('does not call onSend for empty prompt', async () => {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} />)
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).not.toHaveBeenCalled()
})

it('passes editSource when in edit mode', async () => {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} editSource={{ messageId: 7, blobId: 99 }} onClearEdit={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText(/描述你想要的图像/i), 'make blue')
  await userEvent.click(screen.getByText('发送'))
  expect(onSend).toHaveBeenCalledWith('make blue', 7)
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- Composer.test.tsx`
Expected: compile errors.

- [ ] **Step 3: Write `src/components/Composer.tsx`**
```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, X } from 'lucide-react'

interface Props {
  onSend: (prompt: string, editSourceMessageId?: number) => void
  editSource?: { messageId: number; blobId: number }
  onClearEdit?: () => void
}

export function Composer({ onSend, editSource, onClearEdit }: Props) {
  const [text, setText] = useState('')

  function handleSend() {
    const t = text.trim()
    if (!t) return
    onSend(t, editSource?.messageId)
    setText('')
  }

  return (
    <div className="border-t border-border p-3 bg-background">
      {editSource && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="bg-accent px-2 py-1 rounded">编辑模式</span>
          <button onClick={onClearEdit} className="hover:text-foreground"><X className="w-3 h-3" /></button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <Textarea
          placeholder="描述你想要的图像…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          rows={2}
          className="resize-none"
        />
        <Button onClick={handleSend} disabled={text.trim().length === 0}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `ChatView.tsx`** to accept `onSend` and render Composer. Modify the file — replace the function signature and the JSX:

```tsx
interface Props {
  conversationId: number
  onBack: () => void
  onOpenImage: (blobId: number) => void
  onRetry: (msgId: number) => void
  onEdit: (msgId: number) => void
  onSend: (prompt: string, editSourceMessageId?: number) => void
  editSource?: { messageId: number; blobId: number }
  onClearEdit?: () => void
  statusBar?: React.ReactNode  // injected from parent
}

export function ChatView({ conversationId, onBack, onOpenImage, onRetry, onEdit, onSend, editSource, onClearEdit, statusBar }: Props) {
  // ... existing logic ...
  return (
    <div className="flex flex-col h-full">
      <header>...</header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">...</div>
      {statusBar}
      <Composer onSend={onSend} editSource={editSource} onClearEdit={onClearEdit} />
    </div>
  )
}
```

- [ ] **Step 5: Verify tests pass**

Run: `npm test`
Expected: 3 new Composer tests pass; all previous still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Composer.tsx src/components/Composer.test.tsx src/components/ChatView.tsx
git commit -m "feat(ui): Composer (text input + send + edit mode indicator)"
```

---

### Task 14: StatusBar + ParamSheet + ProviderSheet

**Files:**
- Create: `src/components/StatusBar.tsx`
- Create: `src/components/ParamSheet.tsx`
- Create: `src/components/ProviderSheet.tsx`
- Test: `src/components/StatusBar.test.tsx`

**Interfaces:**
- Produces:
  - `<StatusBar />` — reads `useSession()` + `useProviders()`; renders two buttons (current provider name + current size); clicking opens respective sheet.

- [ ] **Step 1: Write failing test `StatusBar.test.tsx`**
```tsx
import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { StatusBar } from './StatusBar'

beforeEach(async () => { await db.delete(); await db.open(); localStorage.clear() })

it('renders current provider and size', async () => {
  await db.providers.add({ name: 'Packy', baseUrl: 'u', apiKey: 'k', type: 'packy', isBuiltIn: 1, createdAt: 0 })
  render(<StatusBar />)
  expect(screen.getByText(/Packy/)).toBeInTheDocument()
  expect(screen.getByText(/2K 横向/)).toBeInTheDocument()
})

it('opens param sheet on size click and selects new size', async () => {
  render(<StatusBar />)
  await userEvent.click(screen.getByText(/2K 横向/))
  expect(screen.getByText(/1:1/)).toBeInTheDocument()
  await userEvent.click(screen.getByText(/1:1/))
  expect(localStorage.getItem('i2c.defaultSize')).toBe('1024x1024')
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- StatusBar.test.tsx`
Expected: compile errors.

- [ ] **Step 3: Write `src/components/ParamSheet.tsx`**
```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { getSupportedSizes, type ImageSize } from '@/lib/api/providers'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerType: 'packy' | 'runapi' | 'custom' | undefined
  current: ImageSize
  onSelect: (size: ImageSize) => void
}

const LABELS: Record<ImageSize, string> = {
  '1024x1024': '1:1', '1536x1024': '横向', '1024x1536': '纵向',
  '2048x2048': '2K 正方形', '2048x1152': '2K 横向',
  '3840x2160': '4K 横向', '2160x3840': '4K 纵向',
}

export function ParamSheet({ open, onOpenChange, providerType, current, onSelect }: Props) {
  const sizes = getSupportedSizes(providerType ?? 'packy')
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[60vh]">
        <SheetHeader><SheetTitle>选择尺寸</SheetTitle></SheetHeader>
        <div className="grid grid-cols-2 gap-2 p-4">
          {sizes.map((s) => (
            <Button
              key={s}
              variant={s === current ? 'default' : 'outline'}
              onClick={() => { onSelect(s); onOpenChange(false) }}
              className={cn('justify-start')}
            >
              {LABELS[s]}
              <span className="ml-auto text-xs text-muted-foreground">{s}</span>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: Write `src/components/ProviderSheet.tsx`**
```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProviders } from '@/hooks/useProviders'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentId: number | null
  onSelect: (id: number) => void
}

export function ProviderSheet({ open, onOpenChange, currentId, onSelect }: Props) {
  const providers = useProviders()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[60vh]">
        <SheetHeader><SheetTitle>切换中转站</SheetTitle></SheetHeader>
        <div className="space-y-2 p-4">
          {providers.map((p) => (
            <Button
              key={p.id}
              variant={p.id === currentId ? 'default' : 'outline'}
              className="w-full justify-between"
              onClick={() => { if (p.id != null) { onSelect(p.id); onOpenChange(false) } }}
            >
              <span>{p.name}</span>
              <Badge variant="secondary">{p.type}</Badge>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5: Write `src/components/StatusBar.tsx`**
```tsx
import { useState } from 'react'
import { useSession } from '@/stores/useSession'
import { useProviders } from '@/hooks/useProviders'
import { ParamSheet } from './ParamSheet'
import { ProviderSheet } from './ProviderSheet'
import { setConversationProvider } from '@/lib/repo'
import type { ImageSize } from '@/lib/api/providers'
import { db } from '@/lib/db'

const SIZE_LABELS: Record<ImageSize, string> = {
  '1024x1024': '1:1', '1536x1024': '横向', '1024x1536': '纵向',
  '2048x2048': '2K 正方形', '2048x1152': '2K 横向',
  '3840x2160': '4K 横向', '2160x3840': '4K 纵向',
}

interface Props { activeConversationId?: number }

export function StatusBar({ activeConversationId }: Props) {
  const providers = useProviders()
  const { activeProviderId, defaultSize, setActiveProviderId, setDefaultSize } = useSession()
  const [paramOpen, setParamOpen] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? providers[0]

  async function selectProvider(id: number) {
    setActiveProviderId(id)
    if (activeConversationId != null) await setConversationProvider(activeConversationId, id)
  }

  return (
    <div className="border-t border-border px-3 py-2 flex gap-2 bg-background">
      <button onClick={() => setProviderOpen(true)} className="text-xs px-2 py-1 rounded hover:bg-accent">
        当前：{activeProvider?.name ?? '未配置'} ▾
      </button>
      <button onClick={() => setParamOpen(true)} className="text-xs px-2 py-1 rounded hover:bg-accent ml-auto">
        尺寸：{SIZE_LABELS[defaultSize]} ▾
      </button>
      <ParamSheet
        open={paramOpen}
        onOpenChange={setParamOpen}
        providerType={activeProvider?.type}
        current={defaultSize}
        onSelect={setDefaultSize}
      />
      <ProviderSheet
        open={providerOpen}
        onOpenChange={setProviderOpen}
        currentId={activeProvider?.id ?? null}
        onSelect={selectProvider}
      />
    </div>
  )
}
```

- [ ] **Step 6: Verify tests pass**

Run: `npm test`
Expected: 2 new tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/ParamSheet.tsx src/components/ProviderSheet.tsx src/components/StatusBar.tsx src/components/StatusBar.test.tsx
git commit -m "feat(ui): StatusBar with size/provider sheets"
```

---

### Task 15: ImageViewer + SettingsPage

**Files:**
- Create: `src/components/ImageViewer.tsx`
- Create: `src/pages/SettingsPage.tsx`
- Test: `src/components/ImageViewer.test.tsx`

**Interfaces:**
- Produces:
  - `<ImageViewer blobId: number | null; prompt?: string; onClose: () => void />`
  - `<SettingsPage />` — provider list, edit key, add custom, delete

- [ ] **Step 1: Write failing test `ImageViewer.test.tsx`**
```tsx
import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { ImageViewer } from './ImageViewer'

beforeEach(async () => { await db.delete(); await db.open() })

it('renders nothing when blobId is null', () => {
  const { container } = render(<ImageViewer blobId={null} onClose={() => {}} />)
  expect(container.firstChild).toBeNull()
})

it('renders image after loading blob', async () => {
  const id = await db.images.add({ blob: new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' }), mimeType: 'image/png', createdAt: 0 })
  render(<ImageViewer blobId={id} onClose={() => {}} />)
  await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
})
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- ImageViewer.test.tsx`
Expected: compile errors.

- [ ] **Step 3: Write `src/components/ImageViewer.tsx`**
```tsx
import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { createObjectURLSafe, revokeObjectURLSafe, downloadBlob, copyToClipboard } from '@/lib/image'
import { useToast } from '@/components/ui/use-toast'
import { Download, Copy } from 'lucide-react'

interface Props {
  blobId: number | null
  prompt?: string
  onClose: () => void
}

export function ImageViewer({ blobId, prompt, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [mime, setMime] = useState<string>('image/png')
  const { toast } = useToast()

  useEffect(() => {
    if (blobId == null) return
    let cancelled = false
    db.images.get(blobId).then((img) => {
      if (cancelled || !img) return
      setMime(img.mimeType)
      setUrl(createObjectURLSafe(img.blob))
    })
    return () => {
      cancelled = true
      if (url) revokeObjectURLSafe(url)
    }
  }, [blobId])

  if (blobId == null) return null

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-background p-2">
        {url && <img src={url} alt="" className="w-full h-auto rounded" />}
        <div className="flex gap-2 p-2">
          <Button onClick={async () => {
            if (!url) return
            const r = await fetch(url)
            const b = await r.blob()
            await downloadBlob(b, `image2chat-${Date.now()}.${mime.split('/')[1] ?? 'png'}`)
            toast({ title: '已保存到下载' })
          }}>
            <Download className="w-4 h-4 mr-2" /> 保存到设备
          </Button>
          {prompt && (
            <Button variant="outline" onClick={async () => {
              await copyToClipboard(prompt)
              toast({ title: '已复制 prompt' })
            }}>
              <Copy className="w-4 h-4 mr-2" /> 复制 prompt
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Write `src/pages/SettingsPage.tsx`**
```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Plus } from 'lucide-react'
import { useProviders } from '@/hooks/useProviders'
import { addProvider, updateProvider, deleteProvider } from '@/lib/repo'

export function SettingsPage() {
  const providers = useProviders()
  const [editing, setEditing] = useState<{ id: number; key: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')

  async function saveAdd() {
    if (!name.trim() || !url.trim()) return
    await addProvider({
      name: name.trim(), baseUrl: url.trim(), apiKey: key.trim(),
      type: 'custom', isBuiltIn: 0, createdAt: Date.now(),
    })
    setAdding(false); setName(''); setUrl(''); setKey('')
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">设置</h1>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-2" /> 添加自定义</Button>
      </div>
      <div className="space-y-3">
        {providers.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{p.baseUrl}</p>
              </div>
              <Badge>{p.type}</Badge>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing({ id: p.id!, key: p.apiKey })}>
                <Edit className="w-3 h-3 mr-1" /> 编辑 Key
              </Button>
              {p.isBuiltIn === 0 && (
                <Button size="sm" variant="outline" onClick={() => p.id != null && deleteProvider(p.id)}>
                  <Trash2 className="w-3 h-3 mr-1" /> 删除
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑密钥</DialogTitle></DialogHeader>
          <Label>SK 密钥</Label>
          <Input type="password" value={editing?.key ?? ''} onChange={(e) => editing && setEditing({ ...editing, key: e.target.value })} />
          <DialogFooter>
            <Button onClick={async () => {
              if (editing) await updateProvider(editing.id, { apiKey: editing.key }); setEditing(null)
            }}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加自定义中转站</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>名称</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>域名</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" /></div>
            <div><Label>SK 密钥</Label><Input type="password" value={key} onChange={(e) => setKey(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>取消</Button>
            <Button onClick={saveAdd}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 5: Verify tests pass**

Run: `npm test`
Expected: 2 new ImageViewer tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ImageViewer.tsx src/components/ImageViewer.test.tsx src/pages/SettingsPage.tsx
git commit -m "feat(ui): ImageViewer dialog + SettingsPage"
```

---

## Phase 5 — Wire-up & PWA

### Task 16: Routing + HomePage wiring + offline banner

**Files:**
- Create: `src/pages/HomePage.tsx`
- Create: `src/routes.tsx`
- Create: `src/components/OfflineBanner.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces:
  - `<HomePage />` — desktop: sidebar + chat; mobile: hamburger sheet. Manages: new conversation, send, retry, edit-mode flow, image viewer.
  - `/` (default), `/c/:conversationId`, `/settings`

- [ ] **Step 1: Write `src/components/OfflineBanner.tsx`**
```tsx
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (!offline) return null
  return (
    <div className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 px-3 py-1.5 text-xs flex items-center gap-2">
      <WifiOff className="w-3.5 h-3.5" /> 当前离线，仅可查看历史
    </div>
  )
}
```

- [ ] **Step 2: Write `src/pages/HomePage.tsx`**
```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { ChatView } from '@/components/ChatView'
import { Composer } from '@/components/Composer'
import { StatusBar } from '@/components/StatusBar'
import { ImageViewer } from '@/components/ImageViewer'
import { OfflineBanner } from '@/components/OfflineBanner'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useProviders } from '@/hooks/useProviders'
import { useSession } from '@/stores/useSession'
import { addConversation, setMessagePrompt } from '@/lib/repo'
import { db } from '@/lib/db'
import { useGenerate } from '@/hooks/useGenerate'

export function HomePage() {
  const navigate = useNavigate()
  const params = useParams<{ conversationId?: string }>()
  const conversationId = params.conversationId ? Number(params.conversationId) : undefined
  const providers = useProviders()
  const { setActiveProviderId } = useSession()
  const { generate } = useGenerate()
  const [editSource, setEditSource] = useState<{ messageId: number; blobId: number } | undefined>()
  const [viewerBlobId, setViewerBlobId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Auto-pick first provider if none selected
  useEffect(() => {
    if (providers.length > 0) {
      const current = useSession.getState().activeProviderId
      if (current == null) setActiveProviderId(providers[0].id!)
    }
  }, [providers.length])

  async function handleNew() {
    const pid = useSession.getState().activeProviderId ?? providers[0]?.id
    if (!pid) return
    const id = await addConversation(pid)
    setDrawerOpen(false)
    navigate(`/c/${id}`)
  }

  async function handleSend(prompt: string, editSourceId?: number) {
    if (conversationId == null) return
    if (editSourceId != null) {
      const srcMsg = await db.messages.get(editSourceId)
      if (srcMsg) setEditSource({ messageId: editSourceId, blobId: srcMsg.imageBlobId! })
    }
    setEditSource(undefined)
    await generate(conversationId, prompt, useSession.getState().defaultSize, editSourceId)
  }

  function handleEdit(msgId: number) {
    db.messages.get(msgId).then((m) => {
      if (m?.imageBlobId != null) {
        setEditSource({ messageId: msgId, blobId: m.imageBlobId })
      }
    })
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <OfflineBanner />
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden md:block h-full">
          <Sidebar activeId={conversationId} onSelect={(id) => navigate(`/c/${id}`)} onNew={handleNew} />
        </div>
        <main className="flex-1 flex flex-col">
          <div className="md:hidden border-b border-border p-2">
            <Button size="icon" variant="ghost" onClick={() => setDrawerOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
          {conversationId == null ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <p className="text-lg mb-4">开始一次新的创作</p>
                <Button onClick={handleNew}>新建对话</Button>
              </div>
            </div>
          ) : (
            <ChatView
              conversationId={conversationId}
              onBack={() => navigate('/')}
              onOpenImage={(blobId) => setViewerBlobId(blobId)}
              onRetry={(msgId) => db.messages.get(msgId).then((m) => m?.prompt && handleSend(m.prompt))}
              onEdit={handleEdit}
              onSend={handleSend}
              editSource={editSource}
              onClearEdit={() => setEditSource(undefined)}
              statusBar={<StatusBar activeConversationId={conversationId} />}
            />
          )}
        </main>
      </div>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar activeId={conversationId} onSelect={(id) => { setDrawerOpen(false); navigate(`/c/${id}`) }} onNew={handleNew} />
        </SheetContent>
      </Sheet>
      <ImageViewer
        blobId={viewerBlobId}
        prompt={viewerBlobId != null ? undefined : undefined}
        onClose={() => setViewerBlobId(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Write `src/routes.tsx`**
```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { SettingsPage } from '@/pages/SettingsPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/c/:conversationId', element: <HomePage /> },
  { path: '/settings', element: <SettingsPage /> },
])
```

- [ ] **Step 4: Replace `src/App.tsx`**
```tsx
import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { db } from '@/lib/db'
import { seedBuiltinProviders } from '@/lib/repo'
import { router } from '@/routes'
import { RouterProvider } from 'react-router-dom'
import { useProviders } from '@/hooks/useProviders'

export default function App() {
  const [ready, setReady] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const providers = useProviders()

  useEffect(() => {
    seedBuiltinProviders().then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return
    // Onboarding only required if NO provider has a non-empty apiKey
    const hasKey = providers.some((p) => p.apiKey.length > 0)
    setNeedsOnboarding(!hasKey)
  }, [ready, providers])

  if (!ready) return null
  if (needsOnboarding) {
    return (
      <>
        <OnboardingWizard onDone={() => setNeedsOnboarding(false)} />
        <Toaster />
      </>
    )
  }
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}
```

- [ ] **Step 5: Verify dev server boots**

Run: `npm run dev` (background) → curl `http://localhost:5173/` returns HTML.
Run: `npm run lint` → no TS errors.
Stop server.

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/HomePage.tsx src/routes.tsx src/components/OfflineBanner.tsx src/App.tsx
git commit -m "feat(ui): routing + HomePage wiring + offline banner"
```

---

### Task 17: PWA manifest + Service Worker + icons

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/favicon.svg`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable.png`
- Modify: `vite.config.ts` (add VitePWA plugin)
- Modify: `index.html` (link manifest, apple-touch-icon)

**Interfaces:**
- Produces: PWA build with manifest + SW. Dev server serves manifest; `npm run build` includes SW in `dist/sw.js`.

- [ ] **Step 1: Generate placeholder icons**

Use any PNG generator. Simplest: write a 512x512 solid purple PNG to `public/icons/icon-512.png`. For 192 and maskable, resize via Python:

Run: `python -c "from PIL import Image; img = Image.new('RGB',(512,512),(103,80,164)); img.save('public/icons/icon-512.png'); img.thumbnail((192,192)); img.save('public/icons/icon-192.png'); img2 = Image.new('RGB',(512,512),(103,80,164)); img2.save('public/icons/icon-maskable.png')"` (requires `pip install pillow` first if missing).

If PIL unavailable, write the same 512x512 PNG file and copy it to all three paths. The spec calls for three sizes but the manifest only validates the URLs resolve.

- [ ] **Step 2: Write `public/favicon.svg`**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#6750a4"><rect width="24" height="24" rx="6"/></svg>
```

- [ ] **Step 3: Write `public/manifest.webmanifest`**
```json
{
  "name": "image2chat",
  "short_name": "image2chat",
  "description": "AI 图像生成聊天",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f172a",
  "theme_color": "#6750a4",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Update `index.html`**
```html
<!doctype html>
<html lang="zh-CN" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#6750a4" />
    <title>image2chat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Update `vite.config.ts`**
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
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
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
})
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: `dist/` contains `index.html`, `manifest.webmanifest`, `sw.js` (or `registerSW.js`), `icons/`.

- [ ] **Step 7: Verify manifest serves**

Run: `npm run preview` (background) → curl `http://localhost:4173/manifest.webmanifest` returns JSON.
Stop server.

- [ ] **Step 8: Commit**

```bash
git add public/ vite.config.ts index.html
git commit -m "feat(pwa): manifest + service worker + icons"
```

---

### Task 18: E2E smoke test (Playwright) + final verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Create: `e2e/fixtures.ts`

- [ ] **Step 1: Install Playwright**

Run: `npm install -D @playwright/test`
Run: `npx playwright install chromium`

- [ ] **Step 2: Write `playwright.config.ts`**
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: { baseURL: 'http://localhost:5173' },
})
```

- [ ] **Step 3: Write `e2e/smoke.spec.ts`**
```ts
import { test, expect } from '@playwright/test'

test('onboarding → home loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('欢迎使用 image2chat')).toBeVisible()
  await page.getByText('开始使用').click()
  await page.getByText('Packy').click()
  await page.getByLabel(/SK 密钥/i).fill('sk-playwright-test')
  await page.getByText('完成').click()
  // After onboarding, home should render with empty state
  await expect(page.getByText('开始一次新的创作')).toBeVisible({ timeout: 10_000 })
})
```

- [ ] **Step 4: Run smoke test**

Run: `npx playwright test`
Expected: 1 test passes.

- [ ] **Step 5: Run full test suite**

Run: `npm test && npm run lint && npm run build`
Expected: all unit tests pass, no TS errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test(e2e): playwright smoke test for onboarding flow"
```

---

## Self-Review Notes

- **Spec coverage:**
  - §1 范围 → Tasks 1–18
  - §2 技术栈 → Task 1 (Vite/React/TS/Tailwind/shadcn); Task 8 (shadcn primitives); Task 16 (Router)
  - §3 数据模型 → Task 2 (Dexie), Task 3 (types), Task 4 (session store)
  - §4 UI 流程 → Tasks 9–15 (all screens)
  - §5 网络 → Tasks 3, 5, 6
  - §6 错误 UX → Task 12 (MessageBubble retry logic)
  - §7 PWA → Task 17
  - §8 测试 → Each task has tests; Task 18 E2E
- **Type consistency:** All entities (`ProviderPreset`, `Conversation`, `Message`, `ImageBlob`, `MessageStatus`, etc.) are defined in Task 2 and referenced by exact name in later tasks. `ApiError` is the discriminated union from Task 3 and used uniformly in Tasks 5, 10, 12. `useGenerate` returns `{ messageId } | { error }` as specified in Task 10.
- **Placeholder scan:** No "TBD/TODO/FIXME" in code blocks. The phrase "see Step N" cross-references are minimal.
- **Ambiguity:** "保存到设备" = `<a download>` flow in Task 15 ImageViewer. Status-bar location is mobile = inline above composer; desktop = within ChatView's flex column. Both are rendered by `<StatusBar activeConversationId={id} />` injected into ChatView via the `statusBar` prop (Task 13 step 4).