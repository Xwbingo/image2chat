# Task 18 — Final review fixes

## Findings (from whole-branch review)

### Critical
1. Retry drops size + editSource — `src/pages/HomePage.tsx:85`
2. `any` casts in error path — `src/hooks/useGenerate.ts:52`, `:55`
3. `setMessagePrompt` is dead code — `src/hooks/useGenerate.ts:33`, import `:3`
4. `timeout` errorCode is non-retryable — `src/components/MessageBubble.tsx:33`

### Important
5. `isBuiltIn` mismatch in OnboardingWizard — `src/components/OnboardingWizard.tsx:34`
6. Duplicate provider entries — `OnboardingWizard.handleFinish` after seed
7. No conversation rename UI — `Sidebar.tsx`
8. Sidebar delete lacks confirmation — `Sidebar.tsx:42`
9. Orphaned blobs — `deleteConversation` in `src/lib/repo.ts:58`
10. Prompt length unvalidated — `Composer.tsx:17`
11. `parseApiError` 200-path dead code — `errors.ts:22-32` + test `:27-30`

## Fixes applied

(summarized after implementation)

## Post-review fixes

1. Deduplicated custom providers by exact base URL in SettingsPage and custom onboarding, with a Dexie baseUrl index migration.
2. Kept the main router available when providers exist, added settings entry points, and marked providers without keys as `(未配置)`.
3. Switched generation and editing requests to `b64_json` and persisted decoded image blobs without a second URL fetch.
4. Made image view actions use remote URL fallback when a blob is unavailable and threaded the remote viewer callback.
5. Grouped image sizes into 常规, 2K, and 4K sections with visible 4K badges.
6. Added 10MB-validated image upload previews and direct upload-source editing.
7. Auto-named new conversations from the first user text prompt, limited to 20 characters.
8. Removed the root dark class so the PWA defaults to the light theme.

Verification: `npm test` passed with 15 test files and 54 tests; `npm run lint` passed; `npm run build` succeeded.

## Task 18 follow-up: 4 user polish requests (commit fa7f096)

1. **Rename "管理中转站" → "密钥管理"** — `src/pages/HomePage.tsx:107` (empty-state button) and `src/pages/SettingsPage.tsx:37` (h1). Sidebar.tsx link still uses "管理中转站" for the button label (out of scope of explicit rename list — flag if you want it changed too).
2. **Provider dedup migration** — added `dedupeProviders()` to `src/lib/repo.ts` (sort by apiKey-presence + id, keep first per `baseUrl|name`, bulkDelete the rest) and wired it into `src/App.tsx` bootstrap before `seedBuiltinProviders`. Two new tests in `src/lib/repo.test.ts` verify dedup-by-key and non-dedup of distinct providers.
3. **API key validation** — new `src/lib/api/validate.ts` exposing `validateApiKey(baseUrl, apiKey)` (POST `prompt:""` to `/v1/images/generations`, 15s timeout, 401/403 → invalid, any other code → valid). New "测试" button on each provider card in `src/pages/SettingsPage.tsx` with `Zap` icon and toast feedback. Covered by `src/lib/api/validate.test.ts` (5 tests).
4. **Mobile UX polish** — safe-area utilities in `src/styles/globals.css`; `safe-top`/`safe-bottom` on `HomePage` root, `ChatView` header, and `Composer`. Button default + icon, Input, and Textarea all bumped to `h-11` (44px) per Apple HIG. `Composer` textarea set to `rows={1}`, `inputMode="text"`, `autoComplete="off"`. `Sheet` bottom side gets `max-h-[85vh]` and safe-area padding. `Sidebar` conversation items `py-2` → `py-3`. Existing Enter-to-send behavior preserved (no `preventDefault` on Shift+Enter).

Verification (post-fix): `npm test` → 16 files, 61 tests pass (was 54, +7 new); `npm run lint` clean; `npm run build` succeeded.

## Round 4: validateApiKey strictness (commit 54dd404)

**Bug:** fa7f096's `validateApiKey` treated any 2xx as valid. Permissive relays (容错中转站) return `200 OK { data: [] }` for unauthenticated requests too, so random API keys were accepted as "valid". User reported "随机输入都被判 valid".

**Fix — 3-layer defense in `src/lib/api/validate.ts`:**

1. **URL format pre-check** — reject invalid URLs (or non-http(s) schemes like `ftp://`) before making a network call. Avoids pointless request + clear error message ("域名格式无效").
2. **Empty key pre-check** — reject whitespace-only keys with a clear error ("密钥不能为空"). No network call.
3. **2xx requires non-empty data** — after `res.ok`, parse JSON and require `data[0].url` or `data[0].b64_json` to be a non-empty string. Empty/missing array, missing fields, or malformed JSON all → `invalid` with `content_filtered` error ("API 返回空数据，无法确认密钥有效（可能是空响应/容错中转站）"). This is the layer that catches permissive relays.

Other status codes remain unchanged: 401/403 → `unauthorized`; 4xx other → `bad_request`; 5xx → `server_error`; network → `network`. All definitively invalid.

**SettingsPage tweak:** toast wording updated so "密钥有效" (key valid) is paired with "可以生成图片" and any `valid:false` shows "无法确认密钥有效" — accurate reflection that the new logic distinguishes confirmed-valid from can't-confirm.

**New test cases in `src/lib/api/validate.test.ts` (11 total, was 7):**
- URL format rejection (invalid string, `ftp://`) — no request made
- Empty key rejection — no request made
- `Authorization: Bearer` header + full probe body shape verified
- 200 + `data[0].url` → valid
- 200 + `data[0].b64_json` → valid
- **200 + empty `data: []` → invalid** (the regression test for the bug)
- 200 + malformed JSON → invalid
- 401 → invalid (`unauthorized`)
- 403 → invalid
- 400 → invalid (`bad_request`)
- 500 → invalid (`server_error`)
- network error → invalid (`network`)

Verification: `npm test` → 16 files, 67 tests pass (was 61, +6 net from validate suite 7→11, with stricter assertions on the 200+empty case flipping from valid→invalid); `npm run lint` clean; `npm run build` succeeded.

## Round 5: cheap key validation via /v1/models + mobile UX polish + rename button to 管理密钥

**Fix 1 — `validateApiKey` switches to GET /v1/models probe** (`src/lib/api/validate.ts`)

Previous strategy POSTed a real generation request to `/v1/images/generations`. That consumed 1 quota unit and took 10–30s. New strategy hits the OpenAI-compatible metadata endpoint `GET /v1/models` with `Authorization: Bearer <key>`:

- 200 OK → definitively valid (auth passed; no quota consumed)
- 401/403 → definitively invalid (`unauthorized`)
- 404/405 → invalid with `bad_request` + message "该中转站不支持 /v1/models，无法自动验证。请直接生成图片测试。" (clearly tells the user this relay can't be auto-verified)
- 5xx/network → invalid with explanatory message
- URL/key format pre-checks retained

Test file `src/lib/api/validate.test.ts` rewritten to 7 focused tests covering: invalid URL, empty key, GET method + path + bearer header on success, 401/403, 404 "endpoint not supported", network failure. The older 11 tests (POST generation probe, empty-data permissive relay regression, etc.) are no longer relevant to the new strategy.

**Fix 2 — HomePage empty-state button renamed** (`src/pages/HomePage.tsx:107`)

`密钥管理` → `管理密钥` per user request. The SettingsPage h1 still says `密钥管理` (out of scope of the explicit rename).

**Fix 3 — Mobile UX polish**

3a. **`src/styles/globals.css`** — added `@layer base` rule: `input, textarea, select { font-size: 16px; }` to prevent iOS Safari auto-zoom on focus. Exempted `.text-xs input/textarea/select` (12px) so badges remain compact.

3b. **`src/components/ui/toaster.tsx`** — ToastViewport classes now full-width on mobile (`left-0 right-0 flex-col-reverse`) and revert to standard bottom-right on `sm:`. Added `safe-bottom` for iOS home-indicator inset.

3c. **`src/components/Sidebar.tsx`** — Pencil and Trash2 icons wrapped in `<button aria-label>` with `p-1.5 -m-1.5` to give a ~28-32px touch hit area without changing layout. Group-hover opacity behavior retained. Footer paragraph bumped from `text-xs` to `text-sm` for mobile readability and wrapped in `safe-bottom`.

3d. **`src/pages/SettingsPage.tsx:64`** — outer padding changed from `p-4` to `px-3 py-4 sm:p-4` so 320px-wide screens get a bit more horizontal room.

3e. **`src/components/ChatView.tsx:62`** — message list padding `p-4` → `p-3 sm:p-4`.

3f. **`src/components/Composer.tsx`** — Textarea now `rows={2}` with `min-h-[44px] max-h-32 text-base` so single-line usage on mobile still has room for multi-line prompts and meets the 44px touch-target height.

3g. **`src/components/MessageBubble.tsx`** — generating placeholder `h-48 w-64` → `h-48 w-full max-w-xs sm:w-64`. On mobile the placeholder fills the message card up to 320px; on larger screens reverts to 256px.

3h. **Composer safe-bottom** — already present from Round 4 (`<div className="border-t border-border p-3 bg-background safe-bottom">`); no change needed.

3i. **Sidebar footer safe-bottom** — wrapped in `safe-bottom` (see 3c).

**Verification**
- `npm test` → 16 files, **63 tests pass** (was 67; net −4 because validate.test.ts shrunk from 11 → 7 tests, and the now-irrelevant POST-probe / permissive-relay / b64_json / 400 / 500 cases were dropped)
- `npm run lint` clean
- `npm run build` succeeded (1688 modules, 426.89 kB JS / 26.50 kB CSS)

