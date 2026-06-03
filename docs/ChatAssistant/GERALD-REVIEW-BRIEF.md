# Gerald Review Brief — AI Assistant MVP Plan

**From:** Gavin · **Date:** 2026-06-03 · **Branch/HEAD at brief time:** `development` @ `67e6d7a`
**Review type:** Second-opinion / second-brain on a *plan* (not code). No bundle to security-audit yet — this is design review before build starts.

## Your role on this one
Sanity-check the architecture plan: catch anything I missed, anything structurally risky, anything that would force a painful rewrite later, or minor edits that materially improve it. Not a line-by-line code audit (nothing's built).

## What to read (in order)
1. `docs/ChatAssistant/AI Assistant MVP - Technical Specification & Architecture Brief.pdf` — Shaun's spec (the requirement).
2. `docs/ChatAssistant/AI-ASSISTANT-MVP-PLAN.md` — my full end-to-end plan (the thing to review).

## Full context you need (so you're not starting cold)
**Goal:** Replace the existing Copilot + Help/Docs systems with ONE conversational, context-aware AI assistant. Hard constraint from Shaun: **V1 must be the architectural foundation for a future mobile assistant** (and voice, write-actions) — the assistant's intelligence must live behind an API/tool contract so future clients plug in without a rewrite. Not a chatbot bolt-on; the first version of an account-aware assistant platform.

**Current state I audited (all grounded in code, see plan §1):**
- **Copilot** (`app/components/copilot/`): client-side page-detection state machine + ~108 guide steps across ~13 trade-aware guides (`guides.ts`/`guides.roofing.ts`/`guides.generic.ts`), `[data-copilot]` DOM targeting, step validation, persists to `copilot_progress`. Mounted in `app/(auth)/[workspaceSlug]/layout.tsx`. **These guides already are structured workflow defs.**
- **Docs** (`app/lib/docs/` + `content/docs/` + `app/components/docs/`): 95 MDX files / 12 sections, `tree.ts` (cached walk, title+description search only — NO semantic search), `route-mapping.ts` (`pathnameToDocSlug` — path→relevant doc), `HelpDrawer` UI.
- **Net-new (nothing exists):** no `openai`/`ai`/`pgvector`/`ws`/SSE deps, no vector store/embeddings, no assistant service, no chat endpoint/streaming/history, no live-context assembler, no AI-addressable highlight channel, no tool registry.

**My architecture (plan §3):** headless Assistant **service layer** behind `/api/assistant/chat` (SSE) fusing 3 knowledge sources (pgvector-indexed docs [new], Copilot guides re-exported as workflow defs [reuse, no rewrite], live app-context object assembled by client) → GPT-5 Mini via OpenAI Responses API → fixed read-only tool registry (`search_help_docs`, `get_current_context`, `get_current_workflow`, `get_current_step`, `get_ui_element_details`, `request_ui_highlight`). Floating widget is just the first client. Future tools stubbed, disabled. New tables: `doc_chunks` (pgvector), `assistant_sessions`, `assistant_messages` (RLS owner-only). 6-phase delivery, all flag-gated behind `NEXT_PUBLIC_AI_ASSISTANT_V1`.

## Updates since first draft (Shaun, 2026-06-03) — already folded into the plan
- **§6 RESOLVED:** Copilot *feature* (toggle + `CopilotOverlay` UI) is **removed**. Engine kept headless as workflow state-provider. Mode toggle moves into the chat modal: "Respond only" (reactive) vs "Guide me" (sees user position, narrates next step + how-to, still allows free conversation between steps). Guide strings = model hints, never verbatim.
- **§3.1a NEW — UI Element Registry (Shaun-requested, Phase 0):** single source of truth, `data-assistant-id` on every important element, registry = highlight allowlist + `visibleElements` vocabulary. Seeded from 99 existing `data-copilot` IDs (formalize + extend, not from-scratch).
- **§6a NEW — Flow-authoring path (Shaun-requested):** near-English `.flow.md` format + compiler so Shaun can add/edit guided flows in ~6 lines; compiler validates every `ui:` against the registry.

## Specific questions I want your read on
1. **§3 tool contract** — is the 6-tool read-only interface the right stable boundary? Anything that'll bite us when mobile/write-tools arrive?
2. **§6 headless engine** — direction is locked (UI removed, engine kept headless). Validate the *approach* is sound, not whether to do it. Any hidden risk in running the old detection/validation engine with no UI?
2b. **§3.1a registry + §6a flow authoring** — is registry-drift enforcement strong enough (CI + compiler fail-on-unknown-ID)? Is the `.flow.md` format the right balance of simple-for-Shaun vs parseable-for-compiler?
3. **§9 mobile-readiness** — does this design *genuinely* avoid a V2 rewrite, or is there a hidden coupling (auth, context schema, transport) that breaks when a RN client shows up?
4. **§11 risks** — anything I under-weighted? Esp. highlight security (allowlist from `visibleElements`), SSE-vs-WS on Vercel (I picked SSE re our fire-and-forget gotcha), chat-history PII/RLS, doc-chunk freshness (manual re-embed in V1).
5. **Phasing (§10)** — right order? Anything that should move earlier (e.g. cost caps/rate-limit before any LLM call)?
6. **Scope** — am I holding the read-only / 6-tool line, or is anything creeping?

## Where your report lands
Your usual: `workspace-gerald/audits/...`. Shaun coordinates kicking off your run (file-based handoff — there's no live Gavin↔Gerald channel). I'll fold your findings into `AI-ASSISTANT-MVP-PLAN.md` revisions before we touch any build work.

## Known non-blockers / pending on Shaun (don't flag as blockers)
- `OPENAI_API_KEY` not yet provisioned (blocks Phase 1 *testing*, not planning).
- Model = GPT-5 Mini per spec; I have a Chat-Completions fallback if the Responses API/SDK has gaps.
