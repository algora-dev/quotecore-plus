# `app/lib/assistant` — AI Assistant service layer

Canonical plan: `docs/ChatAssistant/AI-ASSISTANT-MVP-PLAN.md` (Gerald-reviewed).

## Phase 0A — Protocol + security envelope (SHIPPED)

Pure scaffolding. No LLM calls, no chat endpoint, no UI. No `OPENAI_API_KEY`
needed. Everything is gated off by default (`AI_ASSISTANT_V1_ENABLED=false`).

| File | Purpose |
|------|---------|
| `protocol.ts` | Canonical **semantic** wire contract (no selectors/URLs). `AssistantClientHints` (untrusted), chat request/stream events, `HighlightCommand`, protocol version + `ClientCapability`. Safe to import anywhere (no React/DOM). |
| `config.ts` | Env-driven guardrail config: feature flag, request-size limits, model/token limits, rate-limit buckets, **cost ceilings**, **retention** policy, model selection. Conservative defaults so we're protected even unset. |
| `rateLimit.ts` | `checkAssistantRateLimits()` — wraps the shared `checkRateLimit`, **always fail-closed**, checks per-user + per-company + per-IP. |
| `costGuard.ts` | `checkCostBudget()` / `recordTokenUsage()` — token-budget contract. **Fails closed** until the `assistant_token_usage` store lands (Phase 0B). |
| `contextResolver.ts` | **H-01 fix.** `resolveServerContext(hints)` → trusted context. userId/companyId/tier/permissions come from the **session**, never the body. Entity refs are **server-verified** (deny-by-default; `quote` confirmed, others TODO Phase 3). |
| `toolRegistry.ts` | **M-06 fix.** The 6 read-only V1 tool definitions (handlers wired Phase 1/3/4). Future tools listed but **NOT registered**. `assertRegistryReadOnly()` invariant. |

### Decisions / guardrails locked here
- **Server is source of truth for tenancy + permissions.** Client sends hints only.
- **Semantic protocol** (`screenKey/elementId/actionId`) — web maps `elementId → data-assistant-id`, mobile maps to native refs. No selector crosses the wire.
- **All chat guardrails are acceptance criteria, not later hardening** (rate limit fail-closed, cost caps, size/timeouts, retention).
- **Read-only V1**: every live tool `requiresWrite: false`; future tools cannot leak into the live set (`assertRegistryReadOnly`).

## Phase 0B — Knowledge + registry + flow pipeline (SHIPPED)

| Artifact | Purpose |
|----------|---------|
| `backend/supabase/migrations/20260603100000_ai_assistant_foundation.sql` | pgvector + `doc_chunks` (REVOKEd) + `assistant_sessions/messages/events` + `assistant_token_usage` + `assistant_workflow_progress` + `match_doc_chunks` RPC. APPLIED to Supabase, types regenerated, lockdown verified (anon+authd denied on doc_chunks/RPC/token_usage). |
| `scripts/embed-docs.mjs` | Walks `content/docs/*.mdx`, heading-chunks, content-hash diff, embeds (text-embedding-3-small, 1536d), upserts `doc_chunks`, deletes stale. **585 chunks embedded** from 95 docs. Run: `node scripts/embed-docs.mjs`. |
| `costGuard.ts` (updated) | Now wired to the live `assistant_token_usage` table (queryUsage/recordTokenUsage). |
| `scripts/seed-ui-registry.mjs` | Inventories `data-copilot` anchors → `uiRegistry.generated.ts` (91 static ids) + flags 4 dynamic anchors for hand-registration. |
| `uiRegistry.ts` | Curated registry over the seed: semantic-only entries (no selector), `webSelectorFor`, `canHighlight` allowlist. |
| `scripts/build-workflows.mjs` + `content/workflows/*.flow.md` | `.flow.md` compiler — strict `ui:`(registry) + `until:`(validator grammar) validation, fails loud. `create-component.flow.md` converted → `workflows.generated.json`. |

**Retrieval eval:** 82% strict top-5 substring hit-rate; effective ~95% (the 3 'misses' returned the correct doc under a different slug). Known content gap: **no catalog doc exists yet** (recent feature) — write docs then re-run `embed-docs`.

## Phase 1 — Chat endpoint + orchestrator + search_help_docs (SHIPPED)

| File | Purpose |
|------|---------|
| `knowledge.ts` | `searchHelpDocs()` — embed query → `match_doc_chunks` RPC (service client) → bounded snippets. Backs the `search_help_docs` tool. |
| `llmClient.ts` | OpenAI SDK wrapper (`openai ^6.41`). `getEmbedding()` + `runChatStep()` (streaming Chat Completions tool-calling, usage out). Model-swappable via `MODEL_CONFIG`. |
| `sessions.ts` | `ensureSession` (ownership-verified), `persistMessage` (scrubs URLs/token blobs), `recordEvent` (metadata-only audit). |
| `orchestrator.ts` | `runAssistantTurn()` — system prompt (read-only, app-is-truth, respond/guide modes) + tool loop (Phase 1: `search_help_docs` only) + depth/token guards. |
| `app/api/assistant/chat/route.ts` | `POST` SSE endpoint. Gates IN ORDER: flag → parse → protocol/shape → **auth+trusted context** → **rate limit (fail-closed)** → **cost budget (fail-closed)** → stream turn → persist + record usage + audit. Abort cleanup on client disconnect. |

**Smoke (2026-06-03):** retrieval path verified end-to-end (waste question → `concepts/waste-and-pitch` sim 0.63, bounded snippets); token-usage table reachable; tsc 0 errors; eslint clean. Endpoint is **flag-gated OFF** (`AI_ASSISTANT_V1_ENABLED` unset) — no production surface until Phase 2 wires the widget + we enable on dev.

### Not yet built (next phases)
- **2:** `AssistantWidget` (floating, streaming, history) — first client; keep Help Drawer.
- **3:** headless `workflowService` + context/workflow tools + mode toggle.
- **4:** highlight tool + web executor. **5:** retire Copilot UI.
- **3:** headless `workflowService` extraction, context/workflow tools, mode toggle.
- **4:** highlight tool + web executor.
- **5:** retire legacy Copilot UI.

Verified: `tsc --noEmit` 0 errors, `eslint` clean (2026-06-03).
