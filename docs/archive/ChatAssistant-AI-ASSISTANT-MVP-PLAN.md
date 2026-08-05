# AI Assistant MVP — End-to-End Implementation Plan

**Author:** Gavin · **Date:** 2026-06-03 · **Status:** REVISED post-Gerald review (findings folded in) — ready for build

> **Gerald review folded in (2026-06-03, report `audits/quotecore-plus-ai-assistant-mvp-plan-review-2026-06-03/04-report.md`).** Accepted in full. Key changes: (1) **security/tenancy envelope + rate-limit + cost caps + retention move to Phase 0/1, not Phase 6** — never expose an LLM endpoint without them; (2) **server derives auth/company/tier from the Supabase session; client context is hints only** — never trusted; (3) **extract a true headless `workflowService` first** — do NOT keep `CopilotProvider` mounted as the engine (it's DOM-coupled + mutates `copilot_progress`); (4) **semantic protocol layer** (`screenKey/elementId/actionId`) so mobile maps to native refs, not CSS selectors — avoids V2 rewrite; (5) **one canonical `data-assistant-id`**, schema-bound `.flow.md` grammar, future tools NOT in live registry, explicit REVOKE on `doc_chunks`. Inventory corrected to **103 `data-copilot` IDs across 18 files** (auto-generate the seed, don't hand-count).
**Source spec:** `docs/ChatAssistant/AI Assistant MVP - Technical Specification & Architecture Brief.pdf`
**Branch target:** `development` (feature-flagged; nothing merges to `main` until smoke-passed + Shaun sign-off)

---

## 0. Why this doc exists

Shaun wants the current Copilot + Help/Docs systems replaced by a single conversational, context-aware AI assistant. The Copilot *feature* is retired; a mode toggle inside the chat modal flips the assistant between "Respond only" and "Guide me" (§6). Two Shaun-mandated foundations sit under this: a **UI Element Registry** (§3.1a) and a **dead-simple flow-authoring path** so Shaun can add/edit guided steps as the app grows (§6a). Critically: **V1 must be architected as the foundation for the future mobile assistant.** The assistant's brain (knowledge, tools, workflow logic, context handling) must live behind an **API/service layer** that the web widget is just one client of — so the mobile app, voice mode, etc. plug into the same backend later with zero rewrite.

This is NOT a chatbot bolt-on. It's the first version of an account-aware assistant platform.

---

## 1. Current-state audit (what exists today, grounded in code)

### 1.1 Copilot system — `app/components/copilot/`
- **`CopilotProvider.tsx`** (client context): page-detection state machine. Watches `usePathname()`, maps route → `guideId`, walks DOM for `[data-copilot="..."]` targets, tracks `currentStep`, validates step completion (`input`/`click`/`select`), persists to `copilot_progress` table (`user_id`, `company_id`, `copilot_enabled`, `copilot_visible`, `guides_completed`, `current_guide`, `current_step`).
- **`CopilotOverlay.tsx`**: renders the tooltip/spotlight UI anchored to the target element.
- **`guides.ts` / `guides.roofing.ts` / `guides.generic.ts`**: ~108 steps across ~13 guides (`components`, `digital-takeoff`, `labor-sheet`, `customer-labor`, `quote-builder`, `digital-quote-builder`, `create-quote`, `flashing-draw`, `material-order-create`, `material-orders-hub`, `account-settings`, `flashings-orders`). **This is the workflow knowledge the spec wants preserved.**
- **`types.ts`**: `CopilotStep { id, target(CSS selector), title, description, position, page, validation, validationTarget, nudgeText }`, `CopilotGuide { id, name, description, steps[] }`.
- **Mounted in** `app/(auth)/[workspaceSlug]/layout.tsx`: `<CopilotProvider userId companyId initialState trade>` wraps `<HelpDrawerProvider>` ... `<CopilotOverlay />`.
- **Trade-aware**: roofing trade → roofing guides; all other trades → generic guides. Driven by `company.default_trade`.

**Key insight:** The Copilot guides already ARE structured workflow definitions (steps, target UI element, completion validation, instruction text). They map almost 1:1 onto the spec's "Workflow Definitions" knowledge source. We do **not** rewrite this knowledge — we re-expose it.

### 1.2 Help/Docs system — `app/lib/docs/` + `content/docs/` + `app/components/docs/`
- **`content/docs/`**: 95 `.mdx` files across 12 sections (getting-started, components, templates, building-a-quote, customer-facing, labor-and-installers, flashings, material-orders, files-and-quotes, account, help, concepts) + `_trade-overlays`. Frontmatter: `title, description, order, status, updated`.
- **`tree.ts`**: walks docs at build/first-request, caches `DocTree`. Exposes `getDocTree()`, `findDocBySlug()`, `getSearchIndex()` (title+description+slug+section — lightweight, NOT full-text semantic).
- **`route-mapping.ts`**: `pathnameToDocSlug()` — maps current in-app path → most relevant doc slug (first-match-wins regex rules). **Reuse this for context: "which doc is relevant to where the user is."**
- **`HelpDrawer.tsx`**: in-app left-edge drawer; `<HelpDrawerTrigger>` (header button) + `<HelpDrawerPanel>`. Renders doc HTML, has its own search over the lightweight index.
- **`app/(public)/docs/`** + **`app/api/docs/`**: public docs site + API.

**Key insight:** Docs are MDX-on-disk, not in DB. Current search is title/description only — **no semantic/vector search exists.** The spec requires pgvector semantic retrieval. This is net-new and the largest single backend piece.

### 1.3 What does NOT exist yet (net-new)
- **No OpenAI / AI SDK / pgvector / ws / SSE-parser deps.** `package.json` has none of: `openai`, `ai`, `@ai-sdk/openai`, `pgvector`, `ws`, `eventsource-parser`. (Supabase JS 2.100.1 present.)
- **No vector store / embeddings pipeline.** pgvector extension not enabled; no embeddings table.
- **No assistant service layer, no chat endpoint, no streaming infra, no chat history persistence.**
- **No structured "live context" assembler** (current page/module/workflow/selected item/visible elements) — Copilot infers this client-side ad hoc; nothing exposes it as a clean context object.
- **No UI-highlight command channel** addressable by an assistant (Copilot drives highlight internally via its own overlay; there's no `{action:"highlight", target}` request path).
- **No tool/function registry** the model can call.
- **No formal UI Element Registry** — BUT a strong seed exists: **99 `data-copilot="..."` attributes across 17 files** with clean, consistent naming (`add-component`, `component-name`, `measurement-dropdown`, `component-save`, `cl-send-modal`, `account-billing`, etc.). The registry is a *formalize + extend* job, not from-scratch. These IDs become the registry seed.

---

## 2. One-paragraph understanding (the "brief explainer" for Shaun)

> *(One-paragraph version for quick read; full detail below.)*
>
> We already have two halves of this: a Copilot that knows the app's workflows step-by-step (target elements + completion rules) and a 95-page MDX docs library with route-aware mapping. They run independently and neither is conversational. The plan is to build a **headless Assistant service** (API-first) that fuses three knowledge sources — semantically-indexed docs (new pgvector store), the existing Copilot guides re-exported as structured workflow definitions, and a live app-context object assembled by the frontend — and exposes them to GPT-5 Mini via the OpenAI Responses API through a fixed set of read-only tools (search docs, get context, get workflow/step, get UI element, request highlight). A new floating chat widget replaces the Copilot UI as the first client of that service; the model explains/guides/clarifies but never invents workflow — the app stays the source of truth for state. Because all intelligence lives behind the service + tool contract (not in the widget), the future mobile app, voice mode, and eventual write-actions plug into the exact same backend by adding tools and clients, not rewriting.

---

## 3. Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENTS (interchangeable)                                    │
│  • Web floating widget (V1 — this MVP)                        │
│  • Mobile app (future)   • Voice (future)                     │
└───────────────┬─────────────────────────────────────────────┘
                │  POST /api/assistant/chat  (SSE stream)  [AUTH REQUIRED]
                │  body: { messages[], hints{}, sessionId,
                │          assistantProtocolVersion, clientCapabilities }
                ▼
┌─────────────────────────────────────────────────────────────┐
│  SECURITY ENVELOPE (Phase 0/1 — first, not last)             │
│  • Supabase session → server-derived userId/companyId/tier   │
│  • Client `hints` validated, never trusted                   │
│  • Fail-CLOSED rate limit + token/cost caps + timeout/abort  │
├─────────────────────────────────────────────────────────────┤
│  ASSISTANT SERVICE LAYER  (app/lib/assistant/*)               │
│  • Orchestrator: OpenAI Responses API + tool loop            │
│  • System prompt: "explain/guide, never invent workflow"     │
│  • Tool registry (read-only in V1; future tools NOT live)    │
│  • Chat persistence w/ retention policy (minimal metadata)   │
└───┬───────────────┬───────────────┬─────────────────────────┘
    │               │               │
    ▼               ▼               ▼
┌─────────┐   ┌────────────┐   ┌──────────────────┐
│ KNOWLEDGE│  │ WORKFLOW   │   │ CONTEXT RESOLVER  │
│ SERVICE  │  │ SERVICE    │   │ session(trusted)+ │
│ pgvector │  │ headless   │   │ client hints      │
│ doc embed│  │ (no DOM,   │   │ (validated) →     │
│ search   │  │ compiled   │   │ server context    │
│ svc-only │  │ JSON)      │   │ (entity refs      │
│          │  │            │   │  server-verified) │
└─────────┘   └────────────┘   └──────────────────┘
```

**Three structural rules from Gerald, now binding:**
- **Server is the source of tenancy/permissions.** `userId`, `companyId`, `tier`, entitlements come from the authenticated Supabase session — never the request body. The client sends a **hint envelope** only; every selected-entity ref is server-verified before any tool uses it.
- **Workflow service is genuinely headless** — pure functions over compiled workflow JSON (route/screen key + trade + flags + progress → workflow/step/next/required element IDs). No DOM queries, no `copilot_progress` mutation, no overlay lifecycle. The old Copilot overlay (until retired) becomes just *one client* of this service, not the state owner.
- **Protocol is semantic-first** — `screenKey / featureKey / workflowId / stepId / elementId / actionId` are canonical. Web maps `elementId → data-assistant-id`; mobile maps `elementId → native/accessibility ref`. Highlights return `{ type:'highlight', elementId, treatment, reason }`, not a selector.

### 3.1 Tool contract (the stable interface — design once, reuse forever)
V1 tools (all **read-only**, per spec security model):
- `search_help_docs(query, {section?, k?})` → top-k semantic doc chunks (title, slug, snippet, score).
- `get_current_context()` → returns **server-validated context** assembled from the authenticated session + bounded client hints (screenKey, server-verified selectedEntityRefs, visibleElementIds, server-computed permissions). **Never raw client claims.**
- `get_current_workflow(workflowId?)` → workflow definition from the headless workflow service (steps, instructions, required element IDs, completion events). Defaults to current workflow from resolved context.
- `get_current_step(workflowId?)` → current step + completion requirement + next valid step (workflow service decides; AI only reads).
- `get_ui_element_details(elementId)` → label/role/description from the registry for a currently-visible element.
- `request_ui_highlight(elementId, treatment?)` → returns `{ type:"highlight", elementId, treatment, reason }`. Server validates `elementId` against the registry **and** the current visible-element set. Client (web/mobile) maps it to its own render. No selector ever crosses the wire.

**Future tools — NOT registered in the live registry (Gerald M-06).** `get_schedule`, `get_tasks`, `get_notifications`, `get_account_summary`, `create_event_draft`, `create_task_draft`, `submit_user_action` live in a **design doc / disabled module exported only in tests** — never wired into the live tool loop until implemented, permissioned, and tested. The live V1 registry contains the 6 read-only tools above and nothing else. The registry *shape* still supports adding them later (handler + permission scope) with no orchestrator rewrite.

### 3.1a UI Element Registry (NEW — Shaun-requested, Phase 0 foundation)

**Single source of truth** mapping every important interactive element to a stable assistant-facing ID. Doing this early prevents a brutal refactor later and is the shared vocabulary for highlighting, guidance, onboarding, `visibleElements`, flow authoring (§6a), and future voice/mobile.

- **`app/lib/assistant/uiRegistry.ts`** — declarative semantic map: `elementId → { label, screenKey, role: 'button'|'input'|'dropdown'|'modal'|'table'|'menu-item', description }`. **No CSS selector in the canonical entry** — the web client resolves `elementId → data-assistant-id`; mobile resolves to a native/accessibility ref. From the registry, a typed `assistantElementIds` union is generated for compile-time safety.
- **ONE canonical DOM attribute (Gerald M-01): `data-assistant-id="<id>"`.** The context scanner AND the highlight executor both read this single field — no mixing of `data-assistant` / `data-copilot` / `data-assistant-id`. During migration we *alias* legacy `data-copilot` only where the old engine still needs it; canonical is `data-assistant-id`. Prefer a small `<AssistantElement id="...">` wrapper over raw string attributes for new work.
- **Seed is auto-generated, not hand-counted (Gerald L-02):** a `scripts/seed-ui-registry.ts` inventories the existing **103 `data-copilot` IDs across 18 files** (incl. dynamic `data-copilot={item.x}` cases) and emits a migration checklist. Dynamic/conditional IDs get explicit registry entries or are excluded deliberately.
- **The registry is the highlight allowlist** — `request_ui_highlight(elementId)` only accepts registry IDs present in the current visible set.
- **Drift enforcement (Gerald M-02), stronger than grep:** CI fails on (a) workflow IDs not in registry, (b) registry IDs with no code reference, (c) duplicate static IDs, (d) route/screen coverage gaps. Plus dev-only runtime diagnostics for visible duplicate IDs and missing current-step element IDs.

### 3.2 Context: client hints (untrusted) → server-resolved context (trusted)

**Two distinct objects (Gerald H-01).** The client sends *hints*; the server derives the authoritative context.

```ts
// Sent by client — HINTS ONLY, never trusted for tenancy/permissions
interface AssistantClientHints {
  assistantProtocolVersion: string;             // e.g. "1.0"
  clientCapabilities: string[];                 // e.g. ["web","highlight","sse"]
  screenKey: string;                            // semantic screen, not raw URL
  selectedEntityRefs: { type: string; id: string }[]; // server-verifies each
  visibleElementIds: string[];                  // registry IDs only
}

// Built by SERVER from authenticated Supabase session + validated hints
interface AssistantServerContext {
  userId: string; companyId: string;            // from session, NOT body
  serverPermissions: { tier: string; canWrite: boolean; entitlements: string[] }; // server-computed
  screenKey: string;                            // echoed if valid
  selectedEntities: { type: string; id: string; name: string }[]; // only server-verified refs survive
  visibleElementIds: string[];                  // intersected with registry
  workflow: { workflowId: string|null; stepId: string|null }; // from headless workflow service
}
```
A client-side `AssistantContextProvider` assembles **hints** (semantic `screenKey` via a route→screen map reusing `pathnameToDocSlug` logic, plus a `data-assistant-id` scan for `visibleElementIds`). The server **never** accepts client `permissions` or unverified entity refs — it recomputes them. Mobile assembles its own hints (screen/native refs) against the same server contract.

---

## 4. Data model (new migrations — additive, nullable, pre-authorized)

1. **Enable pgvector**: `create extension if not exists vector;`
2. **`doc_chunks`**: `id, slug, section, heading, chunk_index, content text, token_count, content_hash, embedding vector(1536), updated_at`. IVFFlat/HNSW index. **Explicit lockdown (Gerald M-05):** `REVOKE ALL ON doc_chunks FROM anon, authenticated, PUBLIC;` — service-role only. Public docs today, but no client-direct DB habit, and future private/trade-overlay docs stay safe. Retrieval returns bounded snippets (slug/title/section + chunk), not full raw docs.
3. **`assistant_sessions`**: `id, user_id, company_id, title, visibility ('user'|'company'), retention_until, created_at, updated_at, last_active_at`. RLS owner-only by default; `visibility` decided up front (Gerald M-04 — don't rely on vague 'owner-only' if teams later need shared support).
4. **`assistant_messages`**: `id, session_id, role, content, tool_calls jsonb, tool_results jsonb, created_at`. RLS via session ownership. **No secrets/tokens/signed URLs/acceptance URLs/attachment URLs stored** in content (Gerald M-04). Default **retention window (30–90d, env-configurable)** + user/company delete controls land *with* this table, not later.
5. **`assistant_events`** (V1, not optional): tool-call/highlight audit — **metadata only**, no raw prompts/chunks/context snapshots. Foundation for future write-action logging.

Every assistant table/RPC gets explicit `REVOKE`/`GRANT` in its migration (Gerald), even public ones. Migrations via Management API per standing permissions; types regenerated. One DB serves dev+main — additive only.

---

## 5. Embeddings / knowledge pipeline

- **Build script** `scripts/embed-docs.ts`: walks `content/docs/*.mdx` (reuse `tree.ts` walk), strips MDX/frontmatter to text, chunks by heading (~300–500 tokens, overlap), embeds via OpenAI `text-embedding-3-small` (1536-dim), upserts to `doc_chunks` keyed by `slug+chunk_index`. Idempotent; diff by `updated` frontmatter or content hash so re-runs only re-embed changed docs.
- **Trigger**: run manually in V1 (npm script) + a CI/Vercel build hook later. Docs change rarely; no live re-index needed for MVP.
- **Retrieval**: `knowledge.search(query, k)` → embed query → pgvector `<=>` cosine top-k → return chunks. Service-layer only.

---

## 6. Copilot → headless workflow engine + guides-as-data (Shaun-confirmed direction)

**Decision LOCKED by Shaun (2026-06-03):** The Copilot *user-facing feature* (the on/off toggle, the `CopilotOverlay` tooltip UI, the separate "turn Copilot on" option) is **removed entirely.** It is replaced by a single mode toggle *inside the chat assistant modal*:

- **"Respond only" mode** — assistant is reactive: answers questions, no proactive guidance.
- **"Guide me" mode** — assistant sees where the user is, tells them where they are, what the next step is, and how to complete it — AND the user can still converse freely in between steps in natural language (NOT rigid pre-written popups). The model *generates* the guidance conversationally; the pre-written guide `description` strings become **hints to the model, never user-facing copy shown verbatim.**

**CRITICAL CORRECTION (Gerald H-03): "keep CopilotProvider mounted headless" is wrong and we are NOT doing that.** The current `CopilotProvider` is *not* a clean engine — it gates auto-detection on `state.enabled`/`state.visible` (`CopilotProvider.tsx:134`), queries the DOM directly (`:157,164,197,238,…`), persists UI state to `copilot_progress` (`:82-86`), and `setVisible(false)` disables the guide (`:343`). Mounting it hidden would mutate user progress, couple guidance to DOM timing, and break entirely on mobile (no DOM). Instead:

**What we EXTRACT vs delete:**
- **EXTRACT into a pure `workflowService` (no React, no DOM, no `copilot_progress`):** a stateless module over **compiled workflow JSON**. Inputs: `screenKey`, `trade`, feature flags, current workflow progress. Outputs: `workflow`, `currentStep`, `validNextSteps`, `requiredElementIds`. This is what the assistant reads via `get_current_workflow`/`get_current_step`. App stays source of truth for *which* step; AI only narrates. Workflow *progress* lives in a new **`assistant_workflow_progress`** table — NOT overloaded onto `copilot_progress`.
- **DELETE (user-facing):** `CopilotOverlay`, `CopilotToggle`, the standalone enable/visible toggle, and the `account-copilot` settings tab. The mode toggle moves into the chat modal. (Until Phase 5 retirement, the old overlay may stay live in parallel as one *client* of the workflow service — never the state owner.)
- **CONVERT (to data):** the ~108 guide steps in `guides.ts`/`guides.roofing.ts`/`guides.generic.ts` are compiled to **Workflow Definition JSON** via the §6a pipeline. Mapping: `description`→`instruction`/`say` (model *hint*, never verbatim), `target`→semantic `elementId` (registry, §3.1a), `validation`→a typed `until:` completion check (§6a). Trade-aware (roofing/generic) preserved.

Net: Copilot disappears as a product surface; its workflow *knowledge* survives as compiled JSON behind a genuinely headless service. Mobile reuses it directly because there's no DOM coupling left.

## 6a. Flow authoring — dead-simple path for Shaun to add/edit Copilot steps (NEW, Shaun-requested)

**Requirement:** As the app grows and new feature UX flows need adding/editing, Shaun must have an *extremely simple* way to hand Gavin an intended user flow (page → each step → which input/button → next) that compiles into the workflow DB and works seamlessly with the assistant — no code spelunking.

**Design — a near-English flow spec that compiles to a Workflow Definition:**
- Shaun authors (or pastes to Gavin) a flow in a flat, plain-language format — one file per workflow under `content/workflows/<workflow-id>.flow.md` (or a fenced block he sends in chat). Example:
  ```
  workflow: create-component
  page: /components
  trade: any        # or: roofing | generic
  steps:
    - do: click "Add Component" button        ui: add-component-button       until: name-field appears
    - do: enter a component name              ui: component-name-input        until: filled
    - do: choose a measurement type           ui: measurement-dropdown        until: selected
    - do: set the material price              ui: component-rate-input         until: filled
    - do: click Save                          ui: component-save-button        until: saved
  ```
- Every `ui:` token is a **registry `elementId`** (§3.1a) — Shaun references the human label; the registry resolves it per-client (web `data-assistant-id`, mobile native ref). Unknown ID = compile error = the signal to register that element (one line).
- **`until:` is a strict, schema-bound grammar (Gerald M-03) — NOT free text.** Allowed validators only: `clicked:<id>`, `input_non_empty:<id>`, `exists:<id>`, `route:<screenKey>`, `event:<eventName>`, `selected:<id>`. The human prose `until: name-field appears` above is authoring sugar that must map to one of these (e.g. `exists:component-name-input`); the compiler rejects anything it can't resolve. `do:`/`say:` is human copy only — never executable logic.
- A **compiler** `scripts/build-workflows.ts` parses `.flow.md` → validated Workflow Definition JSON (every `ui:` in registry, every `until:` a known validator) → emits the compiled workflow the headless service reads. Emits a **readable error report** Shaun/Gavin can fix; fails the build on any unresolved ID or validator.
- Result: Shaun describes a flow in ~6 lines; it wires into highlighting, guidance, onboarding, and (later) voice/mobile automatically. Adding/editing a flow = edit one `.flow.md` + (if new UI) add registry IDs.

**Deliverable:** the `.flow.md` grammar spec + compiler + one converted example (`create-component`) — landed in Phase 0 (registry/compiler) so Phase 3 workflow tools consume compiled JSON, never the live DOM engine.

---

## 7. Assistant orchestrator (the brain)

- **Provider**: OpenAI Responses API, model `gpt-5-mini` (per spec). Wrap behind a thin `llmClient` so model is swappable.
- **Loop**: receive `{messages, hints}` → **server resolves trusted context** (§3.2) → inject system prompt + resolved context → stream model output → on tool call, dispatch to registry handler (re-validated against the trusted envelope) → feed result back → continue until final text. Stream via **SSE** (one-way, Vercel-friendly, `await`-safe re our fire-and-forget gotcha; with proper abort cleanup on disconnect).
- **System prompt** encodes the Core Design Principle: explain/guide/clarify/teach/answer; never invent workflows; app is source of truth; summarise docs (don't paste); use `request_ui_highlight` for onboarding; stay read-only.
- **Guardrails are Phase-1 ACCEPTANCE CRITERIA, not later hardening (Gerald H-02):** auth required (no anon endpoint); `checkRateLimit(..., { failClosed: true })`; per-user + per-company + IP burst limits; max input chars / output tokens / tool-call depth; request timeout + SSE abort cleanup; daily/monthly token+cost ceilings (env-configurable); audit metadata only. Highlight `elementId` validated against registry + current visible set.
- **Cost**: GPT-5 Mini + small embeddings = low, but the cap is the control. Ceilings enforced from the first live call.

---

## 8. Frontend — floating widget (first client)

- **New** `app/components/assistant/AssistantWidget.tsx` (+ provider): floating, draggable, collapsible, persists across pages (mount in `[workspaceSlug]/layout.tsx`), chat history retained (from `assistant_sessions`), streaming responses (SSE consumer), markdown rendering.
- **Highlight executor (web client)**: listens for `{type:'highlight', elementId, treatment}` → resolves `elementId → [data-assistant-id="<id>"]` → applies pulsing outline / glow / spotlight (reuse Copilot spotlight CSS). The protocol carries no selector; only the web executor knows about `data-assistant-id`.
- **Hints wiring**: `AssistantContextProvider` feeds the **hint envelope** (§3.2) into each request; server resolves trusted context.
- **Replace Copilot UI**: behind `NEXT_PUBLIC_AI_ASSISTANT_V1`. ON: show `AssistantWidget`. Old overlay stays in parallel (as a workflow-service client) until Phase 5 retirement. Clean rollback path. **Keep Help Drawer/`/docs` available as deterministic fallback (Gerald L-01) through controlled go-live.**
- **Modes designed-in**: widget abstracts transport so `text` (V1), `voice` (future), `mobile` (future) reuse the same `/api/assistant/chat` contract + semantic protocol.

---

## 9. Mobile-readiness (the non-negotiable foundation requirement)

Everything that makes the assistant smart lives server-side behind `/api/assistant/*` and the tool contract — **the widget holds zero business logic**. Gerald H-04 was right that a web-selector-shaped foundation would NOT actually avoid a V2 rewrite; the fix is a **semantic protocol layer**, now baked in:
- **Canonical identifiers are semantic, not web-shaped:** `screenKey, featureKey, workflowId, stepId, elementId, actionId`. No CSS selector or web route is ever part of the protocol. Web resolves `elementId → data-assistant-id`; mobile resolves `elementId → native/accessibility ref`. Same for `screenKey` (web route map vs mobile screen map).
- **Auth/tenancy server-derived** from the Supabase session → mobile uses the same session, sends the same hint envelope.
- **Highlights are semantic JSON** (`{type, elementId, treatment, reason}`) → each client renders natively.
- **Versioned:** every request carries `assistantProtocolVersion` + `clientCapabilities` from day one, so new clients negotiate features without breaking old ones.
- **Tools** are a registry with permission scopes → mobile-only tools added later (handler + scope), no orchestrator rewrite. (Not pre-registered until built — §3.1.)

**V2/mobile = new client adapters (screen map + element-ref map + native highlight executor) + new tools + write-action approval flow. No rewrite of the brain or protocol.** This is the architectural test the spec demands; with the semantic layer, the design passes it for real.

---

## 10. Phased delivery (reordered per Gerald — security/protocol first)

- **Phase 0A — Protocol + security envelope (FIRST):** define `AssistantClientHints` + `AssistantServerContext` (§3.2) + semantic protocol (`screenKey/elementId/actionId`, `assistantProtocolVersion`, `clientCapabilities`); server-side auth/company/tier/entitlement derivation from Supabase session; rate-limit (fail-closed) + token budget + cost ceiling + timeout + retention config — **all defined before any OpenAI call.** Deps (`openai`, pgvector helpers, SSE parser).
- **Phase 0B — Foundations (no chat UI):** migrations (pgvector + `doc_chunks` w/ REVOKE, `assistant_sessions/messages/events`, `assistant_workflow_progress`); `embed-docs.ts` (content-hash diff, deletes stale chunks) + embed all 95 docs; service-role-only retrieval; **eval set of ~20 common QCP questions → expected source slugs**; **UI Element Registry auto-seeded** from the 103 `data-copilot` IDs (18 files) + `data-assistant-id` migration; **`.flow.md` grammar + `build-workflows.ts` compiler + `create-component` converted example.**
- **Phase 1 — Headless chat endpoint:** assistant service + Responses API loop + **`search_help_docs` ONLY**; `/api/assistant/chat` SSE; chat persistence w/ retention. *Acceptance gates (Gerald H-02): auth, fail-closed rate limit, cost/token caps, SSE abort, empty-result behaviour — all tested via curl/script.* This is the API the mobile app will use.
- **Phase 2 — Web widget, docs-only:** `AssistantWidget`, streaming UI, history, draggable/collapsible, behind `NEXT_PUBLIC_AI_ASSISTANT_V1`. **Keep Help Drawer + `/docs` available.** Do NOT touch Copilot yet.
- **Phase 3 — Workflow service extraction:** build pure `workflowService` over compiled JSON; convert one guide; prove `get_current_workflow`/`get_current_step` **with no DOM coupling**; `AssistantContextProvider` (hints) + server context resolver; `get_current_context`/`get_ui_element_details`; in-modal **"Respond only" / "Guide me"** toggle (§6).
- **Phase 4 — Registry + highlight:** `request_ui_highlight(elementId)` + semantic command protocol + web executor (`data-assistant-id` only) + visual treatments + allowlist validation.
- **Phase 5 — Retire legacy Copilot UI:** only after the assistant guides the same core workflows + smoke passes. Flag ON by default; **delete `CopilotOverlay` + `CopilotToggle` + standalone toggle**; migrate `account-copilot` settings → assistant settings.
- **Phase 6 — Final hardening + smoke + eval pack:** error/empty-state UX polish, pre-live tier tests, smoke checklist, **eval pack** (docs Q&A, workflow guidance, malicious-context tampering, cross-company entity-ref attempts, rate/cost-limit behaviour). Then Shaun sign-off → merge.

Each phase ships to `development` independently, flag-gated, build-passing. **No future tools in the live registry at any phase** (§3.1).

---

## 11. Risks / open decisions (flagged for Gerald)

1. **§6 — LOCKED (Shaun) + CORRECTED (Gerald H-03):** retire Copilot UI/toggle; **extract a pure headless `workflowService`** (do NOT mount the DOM-coupled `CopilotProvider` as the engine); mode toggle in chat modal; guide strings are model hints. Resolved.
2. **All Gerald findings (H-01→L-02) ACCEPTED and folded in** (see banner at top + inline tags). No open disputes.
3. **OpenAI API key / billing**: Shaun confirmed he'll provision `OPENAI_API_KEY` when needed. Needed at **Phase 0B** (doc embedding) + cost ceilings before Phase 1.
3. **Responses API + GPT-5 Mini availability/SDK**: confirm the `openai` SDK version supports Responses API tool-calling + streaming as spec assumes; fallback to Chat Completions tool-calling if needed (same tool contract, swappable client).
4. **Doc chunk freshness**: manual re-embed in V1 acceptable? (Docs change rarely — Gavin says yes.)
5. **Highlight security**: confirm allowlist-from-visibleElements is sufficient (prevents AI highlighting arbitrary/sensitive DOM).
6. **SSE vs WebSocket on Vercel**: Gavin picks SSE (one-way, serverless-friendly, `await`-safe per our Vercel fire-and-forget gotcha). Gerald sanity-check.
7. **History/PII**: chat messages may contain customer/quote data → `assistant_messages` RLS owner-only + don't log raw content into `assistant_events` beyond tool metadata.
8. **Scope creep guard**: V1 = read-only, 6 tools, docs+context+workflow+highlight. No write actions, no schedule/tasks. Hold the line.
9. **UI Element Registry drift (NEW):** as the app grows, new elements must get `data-assistant-id` + a registry entry or guidance silently breaks. Mitigated by the CI validation check (§3.1a) + flow-compiler failing on unknown IDs (§6a). Gerald: is the enforcement strong enough, or do we need a stricter gate?
10. **Flow-authoring ergonomics (NEW):** the `.flow.md` format (§6a) must be genuinely simple for Shaun *and* unambiguous for the compiler. Gerald: review the format — too loose (compiler can't parse) or too strict (Shaun finds it fiddly)?

---

## 12. What I need from Shaun before Phase 1 ships
- `OPENAI_API_KEY` provisioned (dev env) + monthly cost ceiling. **(Shaun confirmed 2026-06-03: will set up the API when Gavin needs it.)**
- Confirm model choice (GPT-5 Mini) or accept Gavin's fallback if SDK gaps.
- ~~Green-light §6~~ **RESOLVED** — direction locked (see §6).

---

*End of plan. Gerald: please review §3 (tool contract) + §3.1a (UI Element Registry), §6/§6a (headless engine + flow authoring), §9 (mobile-readiness — does this truly avoid a V2 rewrite?), and §11 risks (esp. new #9 registry drift, #10 flow ergonomics). Flag anything missed or any minor edits.*
