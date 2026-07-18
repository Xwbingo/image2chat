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
