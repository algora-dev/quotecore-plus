# Smart Assistant Improvement Brief | 2026-09-24 | For external high-reasoning agent

Owner: Shaun. Integrator: Gavin. Status: Smart Assistant V2 P1 (find / read / navigate) live on the testing deployment for one company (RS Roofing). P2-P4 implemented in source, migrations drafted, NOT enabled. This brief covers the owner's device-pass feedback and the improvements wanted next. Read alongside docs/SMART_ASSISTANT_P1_P4_IMPLEMENTATION.md (architecture contract) and docs/SMART_ASSISTANT_V2_PLAN.md.

## Owner feedback (device pass, 2026-09-24 evening, verbatim intent)

1. SPEED IS THE BLOCKER: "waiting sometimes 15 seconds for a basic answer, which should genuinely take at most three seconds. It's pulling information straight out of a database... not really usable slow." Most-requested data is predictable: quotes, draft quotes, orders, invoices, plus general info requests.
2. TRAIL CLUTTER: after an answer, scrolling back shows the intermediate lookup trail (multiple cards per turn). Owner wants ONLY the answer and applicable click options.
3. EDIT REFUSAL: asked to "remove tech screws from one of the orders" - refused twice with no useful explanation, despite Edit permissions set. (Integrator note: edit phases are gated off AND material orders are outside the current P3 scope, which covers quote components only. The refusal was technically correct but the wording was useless. A partial fix shipped; the scope question needs a product decision.)
4. MOBILE BUTTONS should work better (card/action buttons ergonomics).
5. DESKTOP MIC: error guidance assumed iPhone while he was on desktop; the assistant must stay usable on desktop regardless of mic state.
6. Overall: "the assistant genuinely needs to be smart... we need smart and we need fast." Owner is open to stronger models and better logic.

## Measured evidence (integrator diagnostics, testing deployment)

- gpt-5-mini turns (16:28-16:36 UTC): 11.0s, 16.9s, 23.0s, 23.6s, 8.5s end-to-end per turn.
- gpt-5 (default reasoning) turns (17:31-17:34 UTC): 35.0s completed; TWO runs FAILED with no assistant message. Root cause: gpt-5 burns max_completion_tokens (1200) on hidden reasoning before emitting visible text, producing empty completions (orchestrator throws empty_completion).
- Shipped mitigations (2026-09-24 ~19:00): reasoning_effort low for gpt-5-family in llmClient; ASSISTANT_MAX_OUTPUT_TOKENS raised to 3000 on testing; multi-card trails collapsed to the final card; platform-aware mic errors; phase-off edit refusals now explain the gate.
- Remaining gap to the 3s target is architectural: every turn = admission + session read + N sequential model hops (each a full LLM roundtrip) + per-hop permission guards.

## Work streams wanted

### 1. Speed architecture (top priority)
- Deterministic fast-path for canonical intents before any model call: "open my most recent draft/quote/invoice/order", "show all drafts/quotes/invoices/orders", "open quote 1234". Execute via existing RPCs, produce the card + one-line answer server-side. Target under 2s. Must still respect the existing admission, quota, scope-marker and card-ownership invariants.
- Reduce hops for model turns (tool-result-to-final-answer flow), consider parallel tool calls where safe.
- Streaming replies (P6 pull-forward): first tokens visible within ~1-2s. The turn API currently returns only after full completion; the V1/V2 contract (reservation, replay, finish semantics in docs/SMART_ASSISTANT_QC_PLAN.md) must survive.
- Audit per-turn DB roundtrips (session read, guards, admission) for batching/caching within a single turn.

### 2. Assistant UI/UX quality
- Current shell reads "Microsoft Windows 1995" to the owner. Premium, simple, quiet (match the app's white/black/orange system, see docs/DESIGN_SYSTEM.md and app/components/ui/v2).
- Mobile: bigger, clearer action buttons on cards; comfortable one-hand reach; verify 44px+ targets.
- Desktop: proper modal sizing/typography; the shell must remain fully usable with mic unavailable.
- Conversation list/menu: keep compact (recent declutter shipped); refine to a polished pattern.

### 3. Voice input
- Desktop and Safari-browser flows must work; keep the iPhone home-screen-app limitation explained honestly (iOS blocks getUserMedia in standalone PWAs).
- Permission pre-flight (navigator.permissions.query) with proactive guidance before the user taps the mic.

### 4. Product decisions needed from owner (design, do not build without approval)
- Order editing scope: P3 today covers quote components only. Should "remove tech screws from an order" ever work? If yes, spec it as a P3 extension with the same propose-confirm-atomicity model.
- When P2-P4 phase gates should open (P2 migration applied? P3 concurrency tests? P4 recovery process?).

## Hard constraints (do not break)

- sa_finish_run stays service-role only; quota via assistant_turn_reservations; duplicate replay before refusal; scope markers (assistant_v2_run_scopes) before tools/history; permissions re-checked per read/action; propose_then_confirm + requester_button for all writes; no pricing engine or converter changes; no new dependencies without approval; no anthropic models (no budget); assistant knowledge search stays unregistered in V2 until a section taxonomy exists.
- All writes gated behind P3/P4 rollout flags (currently false). Testing deployment only for owner preview. One database serves dev and main - write harnesses need explicit owner-approved fixtures.

## Where things live

- Orchestrator seam: app/lib/smart-assistant/orchestrator.ts (V1/V2 registry switch, guard, history scoping)
- V2 tools/prompt: app/lib/smart-assistant/v2/tools.server.ts (find_records/open_record rules, prompt contract)
- LLM client: app/lib/assistant/llmClient.ts (model, reasoning_effort, streaming primitives)
- Client shell: app/components/smart-assistant/v2/ (V2ChatClient, ConversationCards, useVoiceNote, assistant.module.css)
- API: app/api/smart-assistant/{turn,transcribe}/route.ts + v2/{session,navigation,actions}/route.ts
- DB: migrations 20260924110000 (P0, live) through 20260924133000 (P4, drafts); sa_v2_* RPCs
- Diagnostics: smart_assistant_runs/messages + assistant_v2_cards tables (company dd3b3943-c760-4c21-9a9a-3a516d0c3356 = owner test company)

## Return format

Full integrated archive (same structure as received), root RETURN_NOTES.md, updated brief docs. Gavin integrates, builds, tests, and deploys the testing preview. Owner approves before anything reaches main.
## Addendum (19:15 screenshot diagnosis)

Owner screenshot (18:34, pre-fix build) showed the failure-retry pile-up: two identical stored user messages from two failed runs, the same text re-filled into the composer, an error banner and Refresh button - one request visually tripled. Integrator fix (2026-09-24): failed turns no longer re-fill the composer (the Retry same message button already handles idempotent retry); the underlying run failures were the gpt-5 reasoning-budget bug, also fixed. Remaining polish for the external agent: on ANY failure, consider collapsing consecutive stored user messages from failed retries into a single retryable entry in the thread view, and shorten the failure notice to one line.
