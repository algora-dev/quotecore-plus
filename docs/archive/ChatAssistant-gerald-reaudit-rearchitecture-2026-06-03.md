# Gerald Re-Audit Request — AI Assistant Guide-me Re-Architecture

**Date:** 2026-06-03 (eve)
**Requested by:** Gavin (via Shaun)
**Bundle HEAD:** `d07bbd2` on `development`
**Baseline for diff:** `ad75b73` (the last Gerald-reviewed assistant state — Phases 0A→4). Everything after `ad75b73` up to `d07bbd2` is the re-architecture.
**Gate:** This audit is a precondition for the `development → main` merge (101 commits ahead of `8fac898`). Assistant ships OFF on main via flags, but the code merges, so it must be clean.

---

## What changed since your last review (`ad75b73`)

The assistant was re-architected from a rigid, DB-progress-driven tour player into a **conversational, client-step-driven** model. Legacy Copilot runtime was removed entirely; the assistant is now the sole in-app helper. Relevant commits:

- `ca75c69` Stage 1 — removed Copilot runtime from the user-facing app (kept `guides.*.ts` content + `data-copilot` anchors as data).
- `b46552b` Stage 2 — workflow **library** (`app/lib/assistant/library/{types,intents,workflowLibrary}.ts`, derived at module load from the Copilot guides) + **browser-facts** hook (`app/components/assistant/useBrowserFacts.ts`, observation-only).
- `09d137c` Stage 3 — **conversational orchestrator** rewrite. New library-backed tools; `recentActions` added to context.
- `2264afa` Stage 4 — **client step-engine** (`useGuideEngine.ts`), new **`GET /api/assistant/workflow`** endpoint, `begin_guide` tool + `guide_start` SSE event.
- `424b02f`, `58a9380`, `95e42d2` — Next/Back/Reset, highlight click-release, Finish.
- `3cfbd60` Stage 5 — deleted orphaned Copilot runtime + the old `workflowService.ts`.

---

## Focus areas (highest → lowest priority)

### 1. Read-only invariant still holds
- Confirm `assertRegistryReadOnly()` passes: all live V1 tools `requiresWrite:false`; no `FUTURE_TOOL_IDS` leaked into the live set. New tools to scrutinise: `find_workflows`, `list_workflows`, `get_workflow`, `get_workflow_step`, `begin_guide`.
- Confirm none of the new tool handlers (in `orchestrator.ts` dispatch) perform any write/mutation; they only read the in-memory library.

### 2. New endpoint auth/tenancy — `app/api/assistant/workflow/route.ts`
- GET `?id=<workflowId>`. Confirm tenancy/trade is resolved from the SESSION via `resolveServerContext` (NOT the query string), feature-flag gated, returns selector-free steps only, no DB writes, no data leak across tenants. The query string carries only a workflow id; verify it cannot influence tenancy or surface another company's data.
- It synthesizes a minimal hints envelope (`screenKey:'home'`) to run `resolveServerContext` — confirm that's safe and only `trade` is consumed.

### 3. `recentActions` trust model — `protocol.ts` + `contextResolver.ts`
- `recentActions` is CLIENT-OBSERVED (from `useBrowserFacts`), surfaced to the model via `get_current_context`. Confirm: it is sanitized + bounded (`sanitiseRecentActions`, max `REQUEST_LIMITS.maxRecentActions=8`), malformed entries dropped, and it is NEVER used for any permission/tenancy decision anywhere in the request path. It should only ever be model-readable "what the user appears to have done."

### 4. Semantic protocol / no selector leak
- Confirm NO CSS selectors cross the wire in any new path: `get_workflow`/`get_workflow_step` step projections, the `/api/assistant/workflow` response, the `guide_start` SSE event, and `request_ui_highlight`. Only semantic `elementId` / `workflowId` should appear. Web maps elementId→`data-assistant-id` (legacy `data-copilot` fallback) client-side.
- `request_ui_highlight` two-layer validation (registry id + `ctx.visibleElementIds`) must be intact.

### 5. Client-trust boundary
- The client step-engine (`useGuideEngine.ts`) holds the full step list and drives progression. Confirm nothing security-relevant is delegated to the client: steps are reference/instructional only (no permissions, no data mutations), and the server never trusts client-asserted step state for anything sensitive.

### 6. General regression / DOS surface
- New SSE event + endpoint: confirm they sit behind the same flag/auth/rate-limit/cost guards as the chat route (the workflow endpoint is a cheap in-memory read; confirm no unbounded work).
- Confirm the removed `assistant_workflow_progress` DB path isn't half-wired anywhere (orphan reads/writes).

---

## Known non-blockers (already noted, not for this audit)
- App-side (NOT assistant): component-create on a read-only account surfaces a raw "unexpected response" error — separate friendly-message fix.
- Docs/flows authoring deferred (Shaun).

## Where to put the report
`workspace-gerald/audits/quotecore-plus-ai-assistant-rearchitecture-<date>/` (your usual structure). Shaun coordinates kicking off the run.
