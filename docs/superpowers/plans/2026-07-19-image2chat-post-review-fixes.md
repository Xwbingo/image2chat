# image2chat Post-review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the eight requested Web PWA fixes in one localized patch, update affected tests and the review report, and produce the exact requested commit.

**Architecture:** Keep the current React Router, Dexie, native `fetch`, and Tailwind architecture. Change the API/generation boundary to consume inline base64 image data, pass upload/edit options through `Composer` → `ChatView` → `HomePage` → `useGenerate`, and leave existing persisted remote URL fields available for old records and fallback display.

**Tech Stack:** React 18, TypeScript 5, Vite, Dexie, React Router, Tailwind, lucide-react, Vitest, Testing Library, MSW, fake-indexeddb.

## Global Constraints

- Modify only the files needed for the eight requested fixes plus affected tests, the plan, and the requested report.
- Do not add dependencies, database migrations, or source comments.
- Use `response_format: 'b64_json'` for both generation and editing requests.
- Preserve the existing `Message.remoteImageUrl` field and remote fallback callback.
- Keep provider API keys editable for built-in providers and show configuration state visibly.
- Run `npm test`, `npm run lint`, and `npm run build` before claiming completion.
- Create exactly one commit with message `fix: 8 user-reported issues (light theme, b64_json, upload, 4K group, title, dedupe, edit-source fallback, accessible settings)`.

---

### Task 1: Provider deduplication and accessible configuration

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/components/OnboardingWizard.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/ProviderSheet.tsx`
- Modify: `src/components/StatusBar.tsx`
- Test: `src/components/OnboardingWizard.test.tsx`
- Test: `src/components/StatusBar.test.tsx`

**Interfaces:**
- `SettingsPage.saveAdd` queries `db.providers` by exact trimmed `baseUrl`, updates an existing row, or adds one custom row.
- `OnboardingWizard.handleFinish` performs a `baseUrl` lookup first for the custom provider path, then falls back to type-based built-in handling.
- `App` renders onboarding only when `providers.length === 0` after initialization.
- Settings remains reachable through the home empty state and sidebar, and provider rows display an unconfigured marker in `ProviderSheet`.

- [ ] **Step 1: Update provider save paths**

In `SettingsPage.tsx`, import `db`, query `db.providers.where('baseUrl').equals(url.trim()).first()`, call `updateProvider` with trimmed key/name when found, otherwise call `addProvider`, then clear the add form. In `OnboardingWizard.tsx`, after seeding and before the type lookup, query custom `baseUrl`; update the matching row with the trimmed key/name and return through `setBusy(false); onDone()`.

- [ ] **Step 2: Change onboarding gating and settings entry points**

In `App.tsx`, replace the key-presence check with `const isEmpty = providers.length === 0` and `setNeedsOnboarding(isEmpty)`. Add `管理中转站` to the home empty state with `navigate('/settings')`, and add a sidebar settings button so the route is reachable while viewing a conversation on desktop or mobile.

- [ ] **Step 3: Show empty-key provider state**

In `ProviderSheet.tsx`, render each provider with a red status dot and `(未配置)` label when `p.apiKey.trim()` is empty. Keep the existing selection behavior. The existing settings edit-key action remains available for built-ins because only deletion is gated by `isBuiltIn === 0`.

- [ ] **Step 4: Run focused provider tests**

Run: `npm test -- src/components/OnboardingWizard.test.tsx src/components/StatusBar.test.tsx`
Expected: all focused tests pass.

---

### Task 2: Inline base64 image generation and upload/edit flow

**Files:**
- Modify: `src/lib/api/client.ts`
- Modify: `src/hooks/useGenerate.ts`
- Modify: `src/components/Composer.tsx`
- Modify: `src/components/ChatView.tsx`
- Modify: `src/pages/HomePage.tsx`
- Test: `src/lib/api/client.test.ts`
- Test: `src/hooks/useGenerate.test.tsx`
- Test: `src/components/Composer.test.tsx`

**Interfaces:**
- `Composer` calls `onSend(prompt, { editSourceMessageId?: number; uploadBlob?: Blob })` and owns an optional upload preview.
- `ChatView` forwards the same options object and an optional `onRemoteClick` callback.
- `useGenerate.generate(conversationId, prompt, size, editSourceMessageId?, uploadBlob?)` sends uploads directly to `editImage`; otherwise it uses the existing message source or generation endpoint.
- The API result is consumed from `response.data[0].b64_json`, decoded with `atob`, persisted as a PNG Blob, and marked successful without a URL fetch.

- [ ] **Step 1: Update API request formats and fixtures**

Change generation’s default request body field to `response_format: req.response_format ?? 'b64_json'` and editing’s multipart field to `'b64_json'`. Change MSW fixtures and assertions to return/assert `b64_json`, and assert the captured generation body contains `response_format: 'b64_json'`.

- [ ] **Step 2: Add base64 decoding and upload-aware generation**

Replace `fetchImageUrl` and the remote fetch in `useGenerate.ts` with:

```ts
function base64ToBlob(b64: string, mime = 'image/png'): Blob {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
```

Add `uploadBlob?: Blob` to `generate`. After creating the user/assistant messages, choose `editImage(..., uploadBlob, size)` when present, otherwise choose the existing message source edit path or `generateImage`. Decode `data[0].b64_json`, persist it with `addImage`, bind the blob, and mark success. Keep `remoteImageUrl` unset or empty for new base64 responses.

- [ ] **Step 3: Add Composer file input and preview**

Add `useRef`, `Paperclip`, and hidden `input[type=file][accept="image/*"]`. Store `{ blob, preview }`, reject files larger than 10 MB with the existing toast hook, revoke object URLs on replacement/clear, render a thumbnail with an `X` clear button, and send `uploadBlob` with the options object. Preserve prompt trimming and 4000-character validation.

- [ ] **Step 4: Thread send options through the chat page**

Update `ChatView`’s `onSend` type and pass `onRemoteClick` to `MessageBubble`. Update `HomePage.handleSend` to read `opts.editSourceMessageId`, optionally load its source message into edit state, select `opts.size ?? useSession.getState().defaultSize`, and call `generate(..., opts.editSourceMessageId, opts.uploadBlob)`. Update retry to build the options object while preserving size/edit source.

- [ ] **Step 5: Run focused API/generation/composer tests**

Run: `npm test -- src/lib/api/client.test.ts src/hooks/useGenerate.test.tsx src/components/Composer.test.tsx`
Expected: generation and edit tests pass with no secondary CDN request; Composer tests assert the options object and upload Blob.

---

### Task 3: Image viewer fallback and visible 4K grouping

**Files:**
- Modify: `src/components/MessageBubble.tsx`
- Modify: `src/components/ChatView.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/components/ParamSheet.tsx`
- Test: `src/components/MessageBubble.test.tsx`
- Test: `src/components/StatusBar.test.tsx`

**Interfaces:**
- `MessageBubble` accepts `onRemoteClick?: (url: string) => void` and always invokes either blob or remote handlers for image click/view/edit controls.
- `HomePage.handleRemoteImageClick(url)` opens the remote URL in a new tab with `noopener,noreferrer`.
- `ParamSheet` groups available sizes into 常规, 2K, and 4K tiers and filters out unsupported entries, including the entire 4K tier for RunAPI.

- [ ] **Step 1: Make success image actions functional without a blob**

Use `blobUrl ?? message.remoteImageUrl` for image display and dispatch `onImageClick` when `imageBlobId` exists, otherwise dispatch `onRemoteClick` when a remote URL exists. Apply the same fallback to 查看. Keep 编辑 tied to the message id.

- [ ] **Step 2: Add remote callback and 4K UI**

Pass `onRemoteClick` from `HomePage` through `ChatView`; implement `window.open(url, '_blank', 'noopener,noreferrer')`. Add the requested `TIER` mapping and `TIERS` list in `ParamSheet`, render section labels and a 4K badge on 4K buttons, and gate each section based on supported sizes.

- [ ] **Step 3: Run focused UI tests**

Run: `npm test -- src/components/MessageBubble.test.tsx src/components/StatusBar.test.tsx`
Expected: existing image/error/status tests pass and the size sheet still selects supported sizes.

---

### Task 4: Conversation auto-title and light theme

**Files:**
- Modify: `src/lib/repo.ts`
- Modify: `index.html`
- Test: `src/lib/repo.test.ts`

**Interfaces:**
- `addMessage` updates a new conversation’s title from the first user `text_prompt`, using `m.prompt.trim().slice(0, 20)`, and updates `updatedAt` on all user text prompts.
- HTML defaults to the light CSS variables by removing the root `dark` class.

- [ ] **Step 1: Add title behavior test**

Create a conversation titled `新对话`, add a user `text_prompt` with surrounding whitespace, then assert the title is the trimmed first 20 characters and `updatedAt` changes. Add a second prompt assertion that the existing custom title is preserved.

- [ ] **Step 2: Implement repository title updates and remove dark root class**

Insert the conversation lookup/update logic after `db.messages.add` in `addMessage`, return the inserted id, and change `<html lang="zh-CN" class="dark">` to `<html lang="zh-CN">`.

- [ ] **Step 3: Run focused persistence tests**

Run: `npm test -- src/lib/repo.test.ts`
Expected: all repository tests pass.

---

### Task 5: Full verification, report, and exact commit

**Files:**
- Modify: `.superpowers/sdd/task-18-report.md`
- Include in commit: all source/test changes from Tasks 1–4 and this plan file

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: all tests pass, including the existing 51+ test baseline plus updated coverage.

- [ ] **Step 2: Run TypeScript lint/type verification**

Run: `npm run lint`
Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: `tsc -b` and Vite build both succeed and produce `dist/`.

- [ ] **Step 4: Append the post-review report section**

Append a `## Post-review fixes` section to `.superpowers/sdd/task-18-report.md` listing the eight completed fixes and the final test/lint/build results, without replacing the existing findings or fixes section.

- [ ] **Step 5: Inspect status and diff**

Run: `git status --short; git diff --check; git diff --stat; git diff`
Expected: only the intended source/tests/plan/report files are changed; pre-existing `.idea/*` files remain untracked and unstaged.

- [ ] **Step 6: Create the one requested commit**

```bash
git add index.html src/App.tsx src/pages/SettingsPage.tsx src/pages/HomePage.tsx src/hooks/useGenerate.ts src/lib/api/client.ts src/lib/repo.ts src/components/OnboardingWizard.tsx src/components/ProviderSheet.tsx src/components/StatusBar.tsx src/components/Sidebar.tsx src/components/MessageBubble.tsx src/components/ChatView.tsx src/components/Composer.tsx src/components/ParamSheet.tsx src/lib/api/client.test.ts src/hooks/useGenerate.test.tsx src/components/Composer.test.tsx src/components/MessageBubble.test.tsx src/components/StatusBar.test.tsx src/lib/repo.test.ts src/components/OnboardingWizard.test.tsx docs/superpowers/plans/2026-07-19-image2chat-post-review-fixes.md .superpowers/sdd/task-18-report.md
git commit -m "fix: 8 user-reported issues (light theme, b64_json, upload, 4K group, title, dedupe, edit-source fallback, accessible settings)"
```

Expected: one new commit with the exact message; record its SHA for the final response.
