# AI Assistant MVP — End-to-End Implementation Plan

**Author:** Gavin · **Date:** 2026-06-03 · **Status:** DRAFT for Gerald second-opinion review
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
                │  POST /api/assistant/chat  (SSE stream)
                │  body: { messages[], context{}, sessionId }
                ▼
┌─────────────────────────────────────────────────────────────┐
│  ASSISTANT SERVICE LAYER  (app/lib/assistant/*)               │
│  • Orchestrator: OpenAI Responses API + tool loop            │
│  • System prompt: "explain/guide, never invent workflow"     │
│  • Tool registry (read-only in V1)                           │
│  • Chat history persistence (assistant_sessions/messages)    │
└───┬───────────────┬───────────────┬─────────────────────────┘
    │               │               │
    ▼               ▼               ▼
┌─────────┐   ┌────────────┐   ┌──────────────────┐
│ KNOWLEDGE│  │ WORKFLOW   │   │ LIVE CONTEXT      │
│ SERVICE  │  │ SERVICE    │   │ (from client)     │
│ pgvector │  │ Copilot    │   │ page/module/      │
│ doc embed│  │ guides as  │   │ workflow/step/    │
│ search   │  │ defs       │   │ item/elements     │
└─────────┘   └────────────┘   └──────────────────┘
```

### 3.1 Tool contract (the stable interface — design once, reuse forever)
V1 tools (all **read-only**, per spec security model):
- `search_help_docs(query, {section?, k?})` → top-k semantic doc chunks (title, slug, snippet, score).
- `get_current_context()` → returns the client-supplied live context object (page, module, workflow, step, selectedItem, visibleElements, permissions).
- `get_current_workflow(workflowId?)` → workflow definition (steps, instructions, target elements, completion events). Defaults to current workflow from context.
- `get_current_step(workflowId?)` → current step + completion requirement + next valid step (app decides; AI only reads).
- `get_ui_element_details(elementId)` → label/description/purpose of a visible element.
- `request_ui_highlight(target, treatment?)` → returns structured `{action:"highlight", target, treatment}` for the client to execute. Server validates target is in the visibleElements allowlist (no arbitrary DOM access).

**Future tools (stubbed in registry, NOT implemented in V1):** `get_schedule`, `get_tasks`, `get_notifications`, `get_account_summary`, `create_event_draft`, `create_task_draft`, `submit_user_action`. Registry is designed so adding these later = add a handler + permission scope, no orchestrator rewrite.

### 3.1a UI Element Registry (NEW — Shaun-requested, Phase 0 foundation)

**Single source of truth** mapping every important interactive element to a stable assistant-facing ID. Doing this early prevents a brutal refactor later and is the shared vocabulary for highlighting, guidance, onboarding, `visibleElements`, flow authoring (§6a), and future voice/mobile.

- **`app/lib/assistant/uiRegistry.ts`** — declarative map: `id → { selector, label, page, role: 'button'|'input'|'dropdown'|'modal'|'table'|'menu-item', description }`. Example: `'add-component-button': { selector: '[data-assistant-id="add-component-button"]', label: 'Add Component', page: '/components', role: 'button', description: 'Opens the new-component form.' }`.
- **DOM contract:** every registered element carries `data-assistant-id="<id>"`. We **migrate the 99 existing `data-copilot` IDs** into this scheme (alias both during transition; `data-copilot` keeps the headless engine working, `data-assistant-id` becomes canonical). New elements only need the one attribute.
- **The registry is the highlight allowlist** — `request_ui_highlight(target)` only accepts registry IDs, and only those present in the current `visibleElements`. No arbitrary DOM access.
- **`get_ui_element_details(id)`** reads label/role/description straight from the registry.
- **Validation:** a build check fails CI if a workflow `.flow.md` references a `ui:` ID not in the registry, or if a registry ID's `data-assistant-id` is missing from the codebase (catches drift as the app grows).

### 3.2 Context object (assembled by app, never inferred by AI)
```ts
interface AssistantContext {
  userId: string; accountId: string;            // companyId
  currentPage: string;                          // route key
  currentModule: string | null;
  currentWorkflow: string | null;               // maps to a guide id
  currentStep: string | null;
  selectedItem: { id: string; name: string } | null;
  visibleElements: { id: string; label: string }[];  // also the highlight allowlist
  permissions: { tier: string; canWrite: false }; // V1 always read-only
}
```
A new client-side `AssistantContextProvider` assembles this — reusing Copilot's existing page-detection logic and `pathnameToDocSlug`, plus a lightweight `[data-assistant]`/`[data-copilot]` element scan for `visibleElements`.

---

## 4. Data model (new migrations — additive, nullable, pre-authorized)

1. **Enable pgvector**: `create extension if not exists vector;`
2. **`doc_chunks`**: `id, slug, section, heading, chunk_index, content text, token_count, embedding vector(1536), updated_at`. IVFFlat/HNSW index on `embedding`. **No RLS needed** (docs are non-tenant, public knowledge) — but served only via service layer, never client-direct.
3. **`assistant_sessions`**: `id, user_id, company_id, title, created_at, updated_at, last_active_at`. RLS: owner-only.
4. **`assistant_messages`**: `id, session_id, role (user|assistant|tool), content, tool_calls jsonb, tool_results jsonb, created_at`. RLS via session ownership.
5. (Optional V1) **`assistant_events`**: audit log of tool calls / highlight requests for debugging + future write-action logging foundation.

Migrations applied via Management API per standing permissions; types regenerated. One DB serves dev+main — additive only.

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

**What we keep vs delete:**
- **KEEP (headless):** the Copilot *engine* — page-detection (`pathname → workflowId`), step targeting, and step-completion validation logic from `CopilotProvider`. It runs with **no UI**, purely as a **state provider** the assistant reads via `get_current_workflow` / `get_current_step`. This preserves the working validation logic (lowest risk, ships fastest) and means the app stays the source of truth for *which* step the user is on — the AI only narrates it, never advances it.
- **DELETE (user-facing):** `CopilotOverlay` (tooltip UI), `CopilotToggle`, the standalone enable/visible toggle, and the `account-copilot` settings tab in its current form. The mode toggle moves into the chat modal.
- **CONVERT (to data):** the ~108 guide steps in `guides.ts` / `guides.roofing.ts` / `guides.generic.ts` become a pure **Workflow Definition DB** (see §6a authoring). `app/lib/assistant/workflows.ts` adapts `CopilotGuide`/`CopilotStep` → spec `WorkflowDefinition` (`workflowId`, `steps[].{id, instruction, targetElement, completionEvent}`): `description`→`instruction` (now a *hint*), `target`→`targetElement` (now a **registry ID**, see §5a), `validation`→`completionEvent`. Trade-aware (roofing/generic) preserved.

Net: Copilot disappears as a product surface; its brain survives headless as the workflow engine behind the one assistant. This is the clean version of the original "(a) headless" lean, with the UI fully retired per Shaun.

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
- Every `ui:` token is a **UI Element Registry ID** (§5a) — Shaun references the human label, Gavin/registry resolves it to a selector. If an ID doesn't exist yet, that's the signal to add it to the registry (one line) — surfacing exactly which new elements a new feature needs tagged.
- A **compiler** `scripts/build-workflows.ts` parses `.flow.md` → validated `WorkflowDefinition` (checks every `ui:` exists in the registry, every `until:` maps to a known completion check) → emits the workflow DB the assistant reads. Fails loudly on unknown IDs so nothing silently breaks.
- Result: Shaun describes a flow in ~6 lines of near-English; it wires into highlighting, guidance, onboarding, and (later) voice/mobile automatically. Adding/editing a flow = edit one `.flow.md` + (if new UI) add registry IDs. No assistant-logic changes.

**Deliverable:** the `.flow.md` format spec + compiler + one converted example (migrate `create-component` guide to prove the path), landed in Phase 0/3.

---

## 7. Assistant orchestrator (the brain)

- **Provider**: OpenAI Responses API, model `gpt-5-mini` (per spec). Wrap behind a thin `llmClient` so model is swappable.
- **Loop**: receive `{messages, context}` → inject system prompt + serialized context → stream model output → on tool call, dispatch to registry handler → feed tool result back → continue until final text. Stream tokens to client via **SSE** (simpler than WebSocket for one-way streaming; Vercel-friendly; spec allows either).
- **System prompt** encodes the Core Design Principle: explain/guide/clarify/teach/answer; never invent workflows; app is source of truth; summarise docs (don't paste); use `request_ui_highlight` for onboarding; stay read-only.
- **Guardrails**: tool allowlist enforced server-side; highlight targets validated against `visibleElements`; per-user rate limit (reuse `consume_rate_limit` RPC, fail-closed); max tool-call depth; token budget cap per turn.
- **Cost**: GPT-5 Mini + small embeddings = low. Add per-session + per-day token ceilings in service config.

---

## 8. Frontend — floating widget (first client)

- **New** `app/components/assistant/AssistantWidget.tsx` (+ provider): floating, draggable, collapsible, persists across pages (mount in `[workspaceSlug]/layout.tsx`), chat history retained (from `assistant_sessions`), streaming responses (SSE consumer), markdown rendering.
- **Highlight executor**: listens for `request_ui_highlight` results → applies pulsing outline / glow / spotlight to `[data-assistant="<target>"]` (reuse Copilot's existing spotlight CSS where possible). Detects completion to let the assistant progress narration.
- **Context wiring**: `AssistantContextProvider` feeds the live context object into each `/api/assistant/chat` request.
- **Replace Copilot UI**: behind feature flag `NEXT_PUBLIC_AI_ASSISTANT_V1`. When ON: hide `CopilotOverlay` + `CopilotToggle`, show `AssistantWidget`. When OFF: legacy Copilot. (Keep CopilotProvider mounted headless if we choose §6(a).) Clean rollback path.
- **Modes designed-in**: widget abstracts transport so `text` (V1), `voice` (future), `mobile` (future) reuse the same `/api/assistant/chat` contract.

---

## 9. Mobile-readiness (the non-negotiable foundation requirement)

Everything that makes the assistant smart lives server-side behind `/api/assistant/*` and the tool contract — **the widget holds zero business logic**. Concretely:
- Chat endpoint is a clean JSON+SSE API → any client (RN mobile, voice) calls it identically.
- Context object is a documented schema → mobile assembles its own (mobile page/screen instead of web route).
- Tools are a registry with permission scopes → mobile-only tools (`get_schedule`, `get_tasks`, write-drafts) added later without touching orchestrator.
- Auth via Supabase session token in the API → mobile uses the same.
- Highlight commands are structured JSON → mobile interprets them for native UI.

**V2/mobile = new clients + new tools + write-action approval flow. No rewrite of the brain.** This is the architectural test the spec demands and this design passes it.

---

## 10. Phased delivery

- **Phase 0 — Foundations (no UI):** deps (`openai`, pgvector helpers, SSE parser); migrations (pgvector + `doc_chunks` + `assistant_sessions/messages`); `embed-docs.ts` + embed all 95 docs + CLI retrieval test; **UI Element Registry (`uiRegistry.ts`) seeded from the 99 existing `data-copilot` IDs + `data-assistant-id` migration started**; **flow-authoring compiler (`build-workflows.ts`) + `.flow.md` format + one converted example (`create-component`)**. *Ship behind no flag — pure backend/foundation. Registry + compiler are dependencies for Phases 3–4.*
- **Phase 1 — Service + knowledge tool:** assistant service layer, orchestrator + Responses API loop, `search_help_docs` tool, `/api/assistant/chat` SSE endpoint, chat persistence. Test via curl/script (documentation Q&A working headless). *This is the API the mobile app will use.*
- **Phase 2 — Floating widget (docs-only):** `AssistantWidget` + provider, streaming UI, history, draggable/collapsible, behind `NEXT_PUBLIC_AI_ASSISTANT_V1`. Replaces Help Drawer for Q&A. Old Copilot UI still live in parallel until Phase 5.
- **Phase 3 — Context + workflow tools:** `AssistantContextProvider`, context object, `get_current_context/workflow/step/ui_element_details`, workflow adapter over the (now headless) Copilot engine + workflow DB. Assistant becomes page/workflow-aware. Add the in-modal **"Respond only" / "Guide me" mode toggle** (§6).
- **Phase 4 — UI highlighting:** `request_ui_highlight` tool + frontend executor + registry allowlist validation + visual treatments. Onboarding guidance parity with old Copilot, but conversational.
- **Phase 5 — Copilot UI retirement:** flag ON by default; **delete `CopilotOverlay` + `CopilotToggle` + standalone Copilot enable option**; keep the engine headless + guide data as workflow source; migrate `account-copilot` settings tab → assistant settings (mode default, etc.).
- **Phase 6 — Hardening + smoke:** rate limits, cost caps, error/empty-state UX, audit log, pre-live tier tests, smoke checklist entries. Then Shaun sign-off → merge.

Each phase ships to `development` independently, flag-gated, build-passing. Future-tool stubs land in Phase 1's registry but stay disabled.

---

## 11. Risks / open decisions (flagged for Gerald)

1. **§6 — RESOLVED by Shaun (2026-06-03):** retire Copilot UI/toggle entirely; keep the engine headless as workflow state-provider; mode toggle lives in the chat modal ("Respond only" / "Guide me"); guide strings are model *hints*, not verbatim copy. (Was an open a/b decision; now locked.) Gerald: validate the headless-engine approach is sound, not whether to do it.
2. **OpenAI API key / billing**: not currently wired (no Stripe key either, separate matter). Need Shaun to provision `OPENAI_API_KEY` + confirm cost ceilings. **Blocks Phase 1 testing.**
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
