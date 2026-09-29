# Audited baseline contracts

These are source findings, not observations from a logged-in production session. Paths below are relative to the supplied 2026-09-29 second UX handoff. Unchanged files keep their original line numbers; use anchors when merging newer branches.

| Finding | Actual source |
|---|---|
| Confirmation idempotent for already-confirmed quote, rejects non-draft other states, assigns number only through existing guarded action | `app/(auth)/[workspaceSlug]/quotes/actions.ts:1466–1516`, `confirmQuote` |
| Old draft wrapper confirms then summary; non-draft wrapper just summary | same file `1518–1533` |
| Customer-lines read is existing authoritative loader | same file `1989`, `loadCustomerQuoteLines` |
| Margin update is existing server action | same file `2090`, `updateQuoteMargins` |
| Summary Create/Edit uses customer-edit directly | `app/(auth)/[workspaceSlug]/quotes/[id]/summary/job-space/JobOverview.tsx:40,59–60` |
| Customer editor receives saved lines, quote components/taxes/collections from current loader | `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/page.tsx:1–69` |
| Customer editor saved-lines/initial-lines hydration retained | same directory `CustomerQuoteEditor.tsx`, effect using `savedLines`; see untouched file |
| Actual explicit saves, global margin guard and no autosave | `CustomerQuoteEditor.tsx:741–803` |
| Material, labour and per-line margin interface | `CustomerQuoteEditor.tsx:1313–1382`, line-selection fields |
| Existing Save & return | `CustomerQuoteEditor.tsx:900–914` |

The proposed existence query + createCustomerQuote helper from the conversational audit was rejected after reading this actual baseline. No such action is required or implemented. Direct routing is both smaller and faithful to the current architecture.

## Framework reference
Repository AGENTS.md requests installed Next docs; `node_modules` is intentionally absent in the supplied archive. The pinned dependency is Next 16.2.12, so existing route patterns were inspected and official error-boundary documentation checked during implementation. It distinguishes a server refetch retry from cached reset, and records `unstable_retry` as introduced in 16.2. No dependency upgrade was made.

Official reference (accessed 2026-09-29): https://nextjs.org/docs/app/api-reference/file-conventions/error#version-history . Current docs describe the newer stable `retry` name; the implementation uses the baseline's 16.2 `unstable_retry` name plus a native-link fallback, not the newer required prop.
