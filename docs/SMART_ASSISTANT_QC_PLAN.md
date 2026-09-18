# Smart Assistant for QuoteCore+ - Integration Plan (REV 2, 2026-09-17)

**Status:** PLANNING. Direction confirmed by Shaun (PWA, QR install, flag-gated rollout, paid STT). REV 2 incorporates triaged findings from the external review (OpenAI astra 6, 2026-09-17 brief v2). Triage decisions below are Gavin's, checked against codebase knowledge.

**Prior art:** Q in-app assistant (`app/lib/assistant/README.md`, shipped phases 0A-4) and t3-labs Smart Assistant V4.1 (`t3-labs/docs/SMART_ASSISTANT_SPEC.md`). READ BOTH before touching the engine.

## 0. External review triage (what we took, adapted, deferred, rejected)

### Accepted (in this plan)
1. **Shared config vs private conversations.** Assistant config + published knowledge = shared per company; conversations/messages/working state = private to the owning member. Admin does NOT get transcript access. A confirmed draft becomes a normal shared company record tagged with creator + `source='assistant'`. (External section 1.2)
2. **Identities separated.** company_id / user_id / assistant_config revision / conversation id / run id / client_request_id. Conversations are NOT one mutable object keyed by user_id. (3.1)
3. **Turn admission protocol:** one active turn per conversation; duplicate submit -> busy/dedup response; client_request_id + payload hash dedup; DB-backed active-run slot, not in-memory mutex. Reconnect = fetch run status, never auto-resubmit. (5.1-5.3)
4. **Quota reserve-before-spend** with pending/estimated settlement, idempotent corrections; count ALL paid calls (chat, embeddings, STT later). Extends Q's existing `assistant_token_usage` + costGuard rather than a parallel system. (9.1-9.2)
5. **Prompt injection posture:** uploaded knowledge + tool output + user text = untrusted data, never instructions; instructions/data separated in model input; no arbitrary SQL/URL fetch/code exec tools ever; retrieval authorization applied INSIDE the DB query/RPC (tenant-scoped), never fetch-global-then-filter. The guarantee is that unauthorized actions fail at the execution boundary, not that detection catches everything. (6.2, 6.3)
6. **No automatic shared learning.** Nothing said in chat becomes company knowledge without an explicit admin publish action. No searching coworkers' conversations. (6.1)
7. **Draft flow = preview -> explicit UI confirmation -> canonical commit.** Server-owned preview record binding inputs digest + price/rule versions + expiry; revalidate on confirm (prices/rules/customer changed -> regenerate + reconfirm); idempotent commit keyed to the preview; model can never manufacture confirmation. Drafts go through the SAME canonical quote service the desktop UI uses (verify server actions enforce invariants server-side - they do). V2B creates NEW drafts only; editing existing records is out of scope. (8)
8. **Ambiguous-input clarification** for high-impact fields: roof area vs footprint, sqm vs squares/feet, pitch, waste, new vs re-roof, disposal, tax, margin vs markup. Clarify, never guess. (8.1 - matches t3-labs clarification rule)
9. **QR = plain destination URL** (app.quote-core.com/assistant/install), zero credentials/state in it; member logs in with their own account; iOS caveat noted (17.2+ copies cookies at install, not other storage; do not rely on desktop->phone session transfer; support fresh login inside installed PWA). (10.1-10.2)
10. **PWA hardening:** stable manifest identity, no tenant-personalized manifests; feature-detect install prompt, illustrated fallback, never block usage on install; no SW-caching of personalized/auth/API/chat content; verify on real iOS + Android devices. (10.3, 11)
11. **Clarity exclusion:** assistant chat/transcript/config screens excluded from Clarity session replay; verify script actually stops loading on client-side navigation into assistant routes (not just SSR condition). Same for error-monitoring breadcrumbs: IDs + timings, never raw prompts/transcripts. (11)
12. **Knowledge ingestion states:** uploaded -> processing -> ready -> failed -> withdrawn; atomic publish (never half-ingested); withdrawal excludes from new retrieval immediately; limits on file type/size/parser time; private bucket, worker verifies tenant. (6.3, 13)
13. **Safe rendering:** restricted markdown/plain text only, no raw HTML/remote images/model-invented links; citations only through server-verified source references; financial figures rendered from structured engine output only, kept separate from model narrative. (6.4)
14. **Revocation checkpoints:** membership/entitlement re-checked at turn admission and before every commit; disabled feature stops NEW work only. (4.1)
15. **Separate kill switches:** exposure flag / entitlement / usage allowance are logically separate; disabling never drops tables or breaks the rest of the app. (15)
16. **Test matrix subset** folded into smoke checklist: cross-tenant IDs (T01), private-conversation isolation (T02), concurrent members (T03), duplicate submit (T05), retry-after-drop (T06), poisoned doc (T11), config-change mid-turn (T19), flag-off direct API attempts (T31). Full T01-T32 lives in the external brief; we implement the security-critical ones as automated gates, the rest manual smoke.

### Adapted (accepted intent, lighter implementation)
- **Run/lease/fencing:** full lease generations + fencing tokens are V2B (draft commit) requirements. V1 read-only chat gets the simpler version: active-run slot + idempotency key + run status enum (accepted/running/completed/failed/cancelled/interrupted). No SQL locks held across model waits - already Q's pattern.
- **Config revisioning:** per-turn immutable load via `config_updated_at` + audit events (Q already records events); no snapshot subsystem. Security disable overrides pinned config at the next checkpoint.
- **Usage ledger:** extend `assistant_token_usage` (exists, locked down) into the usage-event ledger with known/estimated status + append-only corrections. No new parallel table family.
- **Phase 0 discovery:** we do it as a 1-day repo spike inside Gavin's head (he knows the codebase), producing the slice list - not a formal external document.

### Deferred to the relevant phase (decided then, not now)
- STT provider/mode (benchmark in Phase 3; Deepgram token-TTL/streaming caveat noted - server-side enforcement required, or bounded batch first).
- Retention periods, provider data controls, support-access policy (before external testing).
- Pricing/allowances (Phase 4, from measured usage; $50-100 is illustrative).

### Rejected / not applicable
- Multi-assistant-per-company UI, granular permission roles UI, shared chat rooms, offline editing, queued writes, background listening (external also said don't build these).
- Native app (owner decision, locked).
- Full T01-T32 automation now - over-engineered for V1; security-critical subset only.

## 1. Core decisions (locked, unchanged from REV 1)
1. PWA, not native. 2. QR install flow (plain destination URL). 3. V1 read-only -> V2 drafts -> V3 voice. 4. Paid STT. 5. Hidden rollout via company feature flag + admin toggle, no Stripe product until Phase 4; test account secarter23@gmail.com. 6. Sessions per user. 7. Model NEVER computes prices; all numbers come from the deterministic engine or verbatim server-formatted record values (the numerical contract from the external review: engine output + trusted record rendering only).

## 2. Phases (revised order per external review; drafts remain the flagship)

### Phase 0 - Repo spike (half a day)
Map Q's lib (protocol/contextResolver/toolRegistry/costGuard/sessions/orchestrator), membership model, quote server actions, ingestion mechanisms (embed-docs pattern), caching, Clarity integration, existing PWA/manifest state. Output: slice list with exact files per slice. Identify conflicts between app permissions and V1 visibility policy (raise to Shaun if any).

### Phase 1 - Read-only assistant (desktop)
Slices (each independently shippable, flag-gated):
1. Migration (additive): `assistant_configs` (company_id, name, greeting, rule toggles jsonb, custom rules text[], config_updated_at, enabled), `assistant_knowledge_docs/_chunks` (tenant+status scoped, pgvector), `assistant_conversations` (company_id, user_id, config_revision_at, title, timestamps), `assistant_messages`, run/active-slot columns, `assistant_usage_events` (evolved from token_usage). RLS: conversations/messages owner-only (auth.uid() = user_id); configs/knowledge company-scoped; usage service-write-only. Cross-tenant FK consistency checks.
2. Flag + admin toggle (exposure separate from entitlement; layout-level hide + route 404 + API refuse; enable for Shaun's account).
3. Turn admission + run protocol (idempotency, busy response, run states, reconnect fetch).
4. Orchestrator port: Q's pipeline + t3-labs bounded authority (green/amber/red) + clarification rule; per-turn config load; instructions/data separation.
5. Read-only tools (RLS-scoped, targeted searches not bulk dumps): search_knowledge, list_quotes, get_quote, get_pricing, list_components, list_customers, get_invoice_status, get_order_status, calculate (engine, compute-only). Model allowlist server-side.
6. Config portal (desktop): name/greeting, rules toggles, custom rules, knowledge upload with ingestion states + atomic publish.
7. Quota reservation + usage ledger + Clarity exclusion + safe renderer.
8. Desktop chat UI (streaming, source cards, restricted markdown).
9. Smoke: cross-tenant, private-convo, duplicate submit, poisoned doc, flag-off direct API.

### Phase 1.5 - Installable read-only PWA
QR (plain URL) -> login -> assistant; manifest/scope/icons; install prompt + iOS tutorial fallback; session survival tests (refresh, logout, kill/reopen, reinstall) on real devices; no personalized caching; "Continue in browser" + copy-link fallback.

### Phase 2A - Draft preview
Structured intake conversationally -> engine computes -> server-owned preview record (inputs digest, versions, expiry) -> structured preview card (quantities/prices from engine output only, never model text). Private to the conversation until confirmed. UI states "saving will create a shared company record".

### Phase 2B - Draft creation
"Create draft in company workspace" button -> confirmation endpoint re-verifies everything + anti-CSRF + preview freshness -> canonical quote service commit (idempotent per preview) -> shared record tagged creator + source=assistant. Verify no accidental hooks fire (no sends/invoices/orders from assistant drafts). Conflict handling N/A (new drafts only).

### Phase 3 - Voice
Push-to-talk, editable transcript, confirm-before-calculate. STT benchmark (short-clip batch vs streaming) with roofing vocabulary + noisy audio; server-side duration/concurrency/cost enforcement (never trust client timers/tokens for caps); raw audio retention off; metered in provider billable units.

### Phase 4 - Commercial rollout
Measured unit economics from the ledger -> pricing/allowance proposal for Shaun; Stripe product + plan rows + paywall; team seat mechanics.

## 3. Testing-on-live strategy (unchanged)
Flag off = invisible. Flag on for secarter23@gmail.com. No Stripe product until Phase 4. Staging/synthetic data before Shaun's live testing. Security-critical tests are release gates (T01/T02/T05/T06/T11/T31 as a minimum bar).

## 4. Open questions (for Shaun, only what code can't answer)
1. Confirm private-transcript policy: admins cannot read members' conversations. (External assumed yes; we agree - flag if you want otherwise.)
2. When Phase 3 nears: raw audio retention + provider choice.
3. Phase 4: pricing + per-seat allowance structure.
