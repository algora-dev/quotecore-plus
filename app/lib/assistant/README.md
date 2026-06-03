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

### Not yet built (next phases)
- **0B:** migrations (pgvector + `doc_chunks` w/ REVOKE, `assistant_sessions/messages/events`, `assistant_workflow_progress`, `assistant_token_usage`), `embed-docs.ts`, UI Element Registry seed, `.flow.md` compiler. *Needs `OPENAI_API_KEY` for embedding.*
- **1:** `/api/assistant/chat` SSE endpoint + orchestrator + `search_help_docs` handler + chat persistence.
- **3:** headless `workflowService` extraction, context/workflow tools, mode toggle.
- **4:** highlight tool + web executor.
- **5:** retire legacy Copilot UI.

Verified: `tsc --noEmit` 0 errors, `eslint` clean (2026-06-03).
