# Smart Assistant V2 Plan (draft for owner review)

Date: 2026-09-24. Status: DRAFT - awaiting Shaun's review before any build.
Source vision: Shaun 2026-09-24 (voice note). V1 reference: docs/SMART_ASSISTANT_QC_PLAN.md.

## 1. Mission

Make the Smart Assistant the bridge between mobile and the full QuoteCore+ account: a user on their phone can run the app end-to-end by talking to the assistant.

- **Navigate**: "Pull up the quote for John Smith" -> assistant resolves the entity, routes the app to it, and minimises itself. Covers quotes, drafts, customer quote editor, orders, order editor, invoices, invoice editor, components.
- **Edit with stored confirmation**: the assistant can change things, but every meaningful change ends with "here is what I did / what I will do - confirm?" Confirmed by button tap or voice. Every confirmation is stored as auditable proof: diff, who, when, method. No important change without a stored human sign-off.
- **Create draft-first**: conversational quote creation lands as a draft the user can open, inspect, and iterate on ("looks good" / "change the pitch to 30"). Never straight to final or sent.
- **Permission sliders**: owner-configurable per section (hidden / read-only / edit). Even at full edit access, confirm-first still applies to every important action.
- **Future hooks**: sending emails, project manager module, scheduling - all through the same action framework.

Why: on mobile, talking beats tapping. Combined with the digital takeoff + AI scan, this makes the whole product usable from a phone, hands-busy, eyes-elsewhere.

## 2. Where V1 stands (do not undo these)

Existing: read-only chat at /[ws]/assistant (dark-launched via assistant_feature_flags), knowledge search, quota + billing guardrails, tool registry, UI registry, in-app widget with highlight/guide hooks, config page, admin grant/revoke + per-company turn quota.

Locked invariants carried into V2:

1. `sa_finish_run` executes as service_role only
2. Quota = assistant_turn_reservations (no FK to runs, company-serialized flag-row FOR UPDATE); duplicate replay checked BEFORE quota/flag refusal; same request-id + different payload = request_id_conflict
3. `match_sa_chunks` derives company from auth.uid(), never from a client param
4. History = latest 30 prior messages; current message included once via run_id
5. `calculate` tool stays UNREGISTERED - numbers only ever come from records or the pricing engine. The assistant edits inputs; the engine computes prices
6. Feature flags: service-role writes only, never a companies column
7. Config permissions: owner/admin by default + members_can_manage toggle; members granted manage cannot escalate others
8. Clarity privacy: data-clarity-mask stays on the chat root

V1 known gaps: non-streaming replies, no admin usage view, turn runs inside the API request.

## 3. V2 architecture

### 3.1 Action framework (the core new thing)

Two action classes:

- **Reversible internal edits** (draft fields, component rates/quantities, invoice/order edits): apply immediately as a staged change, show a confirmation card in chat ("changed waste from 3% to 5% - confirm?"), user confirms or the change is auto-reverted when the session ends. User can also review on the real page, then confirm in chat later.
- **Irreversible/external actions** (send email, delete, withdraw, anything leaving the account): require explicit PRE-confirmation before execution. No exceptions, at any permission level.

Lifecycle: intent -> tool call -> action record created (status: proposed) -> confirmation card rendered in chat -> user confirms (button or voice) -> commit via existing server action -> ledger row finalised (status: confirmed/committed).

Confirmation methods:

- **Button**: tap Confirm in the chat card. Client sends the confirmation with the action id; server records it.
- **Voice**: the user's affirmative reply transcript is matched to the pending action and stored as the proof. If ambiguous, the assistant asks again - never guesses on confirmations.

**Locked verification rule (owner, 2026-09-24): every action must be shown to the user in one of two ways, and BOTH end in a confirm affordance:**

- **Mode A - chat summary**: the assistant explains exactly what it did in the chat, with a Confirm button (or the user replies "confirmed" / "yes that's right" by text or voice)
- **Mode B - navigate-and-show**: the assistant routes the app to the created/edited entity (draft quote, invoice, component, email, message) and minimises itself - hiding the chat reveals the real mobile page. The user verifies on the page, then confirms or asks for changes in chat
- Default by action type: creations and structural edits prefer Mode B (with a Mode A summary in chat as well); field-level edits use Mode A. The ledger row records which mode was offered.

### 3.2 Audit ledger (proof of human sign-off)

New table `sa_action_log`:

- company_id, user_id, run_id, action_type, entity_type, entity_id
- payload_before / payload_after (JSONB)
- status: proposed | confirmed | committed | reverted | expired
- confirmation_method: button | voice
- confirmation_phrase (voice only, verbatim transcript), confirmed_at, created_at
- RLS: company-scoped, read for owner/admin; rows are append-only for clients (no client-side edit/delete)

This is the liability shield: "the assistant changed things without permission" is answered with a ledger row showing the exact diff and the human's stored confirmation.

### 3.3 Permission model

Per-section levels: `hidden | read_only | edit`. Sections (initial set): quotes, orders, invoices, components, customers, emails, billing, settings.

- Stored in assistant config (JSON column or child table - decided at build)
- Default: read_only on core sections; hidden on emails, billing, settings
- Enforced SERVER-SIDE at tool admission: a hidden section's data tools are not registered for that company; read_only strips write tools; edit gates only by confirmation rules. UI hiding is cosmetic only and never the enforcement
- Owner/admin configure in the existing /[ws]/account/smart-assistant page (slider UI). Members cannot change permissions

### 3.4 Navigation bridge

- New read tools: fuzzy entity search over quotes/orders/invoices/components/customers by name/number/status (RLS-scoped RPCs, same pattern as match_sa_chunks)
- Client-side nav execution: the tool returns the route; the assistant widget calls router.push and auto-minimises. No server mutation involved - navigation itself needs no confirmation
- Works from any page; "this quote" resolves from page context (widget already exposes page facts)

### 3.5 Creation flows (draft-first)

- create_quote flow: assistant collects customer, job name, components, measurements, pitch -> creates a DRAFT quote via existing quote-creation server actions -> "draft created, take a look" + navigate button. Confirmation: the draft exists (reversible class), but nothing leaves draft state without explicit confirmation
- Edit flows: component rate/qty/waste/pitch edits go through the action framework as staged diffs; the pricing engine recomputes server-side (rule 5)
- Extension point for later phases: material orders, invoices from quote, scheduled follow-ups

### 3.6 Voice (mobile) - two tiers

Chat mode always exists: typed messages, or voice notes that get transcribed (like Telegram today).

**Tier 1 - sequential voice (standard)**: browser STT in (Web Speech API, port of the proven Apex pattern, pause-tolerant auto-restart) + spoken replies out via OpenAI TTS (same vendor as the chat model). Turn-based: user speaks, assistant replies aloud, auto-speak toggle. The assistant verbally flags when visual verification is needed ("I've opened the draft - take a look, then confirm"). Metered per company (characters spoken) on a voice-usage ledger; cost passed to the customer via plan allowance + overage.

**Tier 2 - conversation mode (premium add-on)**: OpenAI Realtime API, full-duplex speech-to-speech over WebRTC - interruptible, low latency, natural voice options, function calling into the same tool registry. Same rules apply: every action goes through the confirmation framework; voice confirms stored as transcript proof. Priced per minute with a hard per-company spend cap; sold as a paid add-on / higher tier.

**Both tiers** reuse the existing quota infrastructure pattern (turn reservations) extended with a voice-usage ledger. Confirmations are stored identically regardless of mode.

**iOS PWA risk (verify FIRST, spike P5.0)**: microphone permission and audio playback inside a standalone (added-to-home-screen) PWA on iOS, plus WebRTC for Tier 2. If a capability is blocked in standalone mode, ship what works (e.g. STT in + text out) and document the platform limit. Owner iPhone is the test device.

### 3.7 Attention layer ("what needs my attention today?")

Read-only aggregation: follow-ups due, quotes viewed but not accepted, orders awaiting supplier response, invoices overdue. Cheap, high perceived value, makes the assistant the home screen. Uses existing data, no new writes.

### 3.8 V1 debts scheduled in

Streaming replies, admin usage view. Not blocking the above but land during V2.

### 3.9 PWA platform workstream (parallel, feeds the same handoff)

Most assistant usage happens in the installed PWA on phones, so two PWA problems are in scope:

1. **Push notifications**: iOS 16.4+ supports Web Push for installed PWAs, so a real solution exists: service worker + VAPID keys + push subscription, backend dispatch (Vercel route + cron) from app events (quote viewed/accepted, order response, invoice paid/overdue) and assistant events (attention items, "draft awaiting your confirmation"). Android/Chrome already fine. Design so the notification TAP deep-links to the right page (pairs with the navigation bridge).
2. **iOS PWA cold-start logout**: telemetry is already live (auth_session_debug, patch_055; 180-day cookie maxAge shipped). Remaining suspects: standalone WKWebView storage eviction / cookie partitioning. This is a research task for the external agent: survey options (persistent-storage request, storage buckets, service-worker session refresh, cookie strategy, auth bridge) and recommend one; Gavin implements.

Both go into the assistant agent brief as first-class tasks.

## 4. Phases (each independently shippable, feature-flagged)

| Phase | Scope | Acceptance |
|---|---|---|
| P0 Foundations | sa_action_log migration, permission storage + config sliders, admin visibility | Migration applied (additive/nullable); sliders save + read back; no behaviour change yet |
| P1 Navigation | Entity search tools + router bridge + auto-minimise | Owner test: "pull up quote for <customer>" on iPhone lands on the right quote |
| P2 Attention | Aggregation tools + response formatting | Owner test: daily summary is accurate vs dashboard |
| P3 Write framework | Staged actions, confirmation cards, ledger writes, permission enforcement | A component edit flows: propose -> confirm (button) -> ledger row -> pricing engine recompute; read_only company cannot invoke write tools (server 403) |
| P4 Creation + edits | Quote-from-conversation, component edit suite, iterate-on-draft | Owner test: spoken quote created as draft, edited, totals correct via engine |
| P5a Voice tier 1 | Browser STT in + OpenAI TTS spoken replies, metered | Owner test on iPhone: spoken request, spoken reply, confirm by voice recorded in ledger |
| P5b Voice tier 2 | Realtime conversation mode (premium add-on) | Owner test: live interruptible conversation, action confirm stored, spend cap enforced |
| P6 Debts | Streaming, admin usage view | Subjective smoothness + admin panel shows usage |
| P7 PWA | Push notifications + login/logout fix | Owner test: iPhone PWA receives quote-event notification, tap opens the page; cold-start logout resolved |

Rules: every new API route ships with an end-to-end harness (same standard as scripts/test-calibration-e2e.mjs) BEFORE being called done. Each phase: build behind the existing assistant_feature_flags, owner tests on RS Roofing account, then broaden.

## 5. Boundary with the UX overhaul (running in parallel)

- Assistant agent owns: app/components/assistant/**, app/components/smart-assistant/**, app/lib/assistant/**, app/lib/smart-assistant/**, app/api/assistant/**, app/api/smart-assistant/**, /[ws]/assistant/**, /[ws]/account/smart-assistant/**
- UX agent owns: everything else, per AGENT_BRIEF.md
- Shared surfaces (chat launcher styling, config page shell): assistant agent builds function-first; UX agent restyles later in its account phase. Conflicts resolved by me at integration.

## 6. External agent packaging (when we get there)

Full-codebase zip (same build pattern as the UX handoff: repo at current main, no env/secrets, verified) plus: this plan, the V1 invariants list (section 2) framed as hard rules, the verification rule (3.1), the two-tier voice architecture (3.6), the PWA tasks (3.9), the may/may-not-modify boundary (section 5 - this agent MAY touch server code inside its domain, but never quota/billing/auth/security code paths), and the RETURN_NOTES protocol. Agent drafts SQL migrations; I review and apply (standing permission, additive/nullable only). I run builds/e2e, commit, deploy; owner tests each phase.

## 7. Open decisions (defaults chosen - flip any)

1. **Permission slider scope**: single 3-level slider per section covering BOTH read and write (hidden = cannot even read). Default: yes, one slider. Alternative: separate read/write toggles.
2. **Voice shipping shape**: two tiers - sequential voice standard, realtime conversation as paid add-on (3.6). Default: yes, both, tier 1 first.
3. **Auto-revert window** for unconfirmed reversible edits: default = end of session. Alternative: fixed timeout (e.g. 30 min).
4. **Ledger retention**: rows kept indefinitely. (No deletion UI in V2.)
5. **PWA work**: external agent researches + codes notifications and the logout fix inside the assistant handoff (3.9); Gavin reviews, applies, deploys.
