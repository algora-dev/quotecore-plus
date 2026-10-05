# Smart Assistant Quality Handoff — 2026-09-28

**SUPERSEDES** `docs/SA_NEXT_PHASE_HANDOFF_2026-09-27.md` (that brief predates P1.7.1 integration and both owner test sessions below).

**Loop:** REV2 (you source-check and implement; Gavin gates at integration — tsc parity, lint, offline suites, build, deploy, owner smoke). Your environment does not need to build; `npx tsc --noEmit` parity + your own reasoning gates are enough. Do not weaken existing assertions to pass.

**Model:** `gpt-5.6-luna` LOCKED (server default on testing). Do not change models.

**Kill switch:** `SMART_ASSISTANT_RESOLVER_ENABLED` env flag on `quotecore-plus-testing`. Resolver code paths must remain flag-guarded.

---

## 1. Current state (what you are building on)

- Branch tip: `ux/phase-4` @ `482513c8` (contains: SA P1.7 retrieval v17, SA P1.7.1 universal resolver `71098f54`, UX Phases 6-8, marketing V3). Live build: `n24ixsvqp` on https://quotecore-plus-testing.vercel.app.
- P1.7.1 resolver: 13 modules under the resolver path, ConversationCards/V2ChatClient candidate selection, orchestrator/retrieval/v2 wiring. Migration `20260927150000` APPLIED (adds `assistant_v2_resolution_states` table: id, run_id, company_id, user_id, conversation_id, permission_revision, sections[], state jsonb, created_at, expires_at).
- Flags live on testing Production env: SMART_ASSISTANT_V2_ENABLED, _SPEED, _FACTS, _RETRIEVAL, _RETRIEVAL_V17_ENABLED, _RESOLVER_ENABLED; ASSISTANT_CHAT_MODEL=gpt-5.6-luna.
- Baseline harnesses: `scripts/sa-resolver/*` (60-case battery), offline 812-test suite from the P1.7.1 return. These pass. **The owner's natural phrasings below do not.** The 60 cases test structured phrasings; the acceptance bar is now the owner's verbatim utterances (Section 4).

**Incident context (why two test sessions differ):** the owner's first session (09:38 UTC) ran on a build that accidentally lacked the resolver (deploy mishap, fixed). The second session (10:41 UTC) ran WITH the resolver live and was WORSE. Both sessions' failures are in scope; the second session's failures are the P0s.

---

## 2. Evidence — Owner session 2 (resolver live, 2026-09-28 10:41-10:42 UTC, conversation `cea2168d`)

All four messages are in ONE conversation (owner phone chat thread).

| # | User (verbatim) | Assistant reply (verbatim, abridged) | Run | Verdict |
|---|---|---|---|---|
| 1 | "show me my quotes with ridges" | "I have not found a genuinely relevant match in the sources searched. I will not offer unrelated substitutes. What is the item or record called? A quote/order/invoice number also works." | ef8e6d5a, completed, 1.8s | FAIL. This is a clear list request. It asked for a "record name" instead of searching components. |
| 2 | "I just want to see the quotes that contain ridge components" | "I still need one distinguishing clue; I have not guessed a replacement. What is the item or record called? ..." | 81bbe13b, completed, 1.3s | FAIL. "I still need" — treats the new message as continuation of the pending unresolved thread instead of a fresh, fully-specified request. |
| 3 | "quote 1014" | "I have not found a genuinely relevant match... I still cannot identify it reliably. Start a fresh request with its exact name or number and where it belongs; no substitute was selected." | fcc51187, completed, 1.5s | REGRESSION vs session 1 (session 1 answered this correctly with full details). A bare-number request is being swallowed by the pending resolution state. |
| 4 | "whats the most recent john smith quote" | (no reply) | 0a29ebe5, **failed**, error_code=upstream_error, 2.3s | FAIL. Dead air to the user. Failure path must degrade gracefully with a human message. |

**Key runtime observation:** all completed runs finished in 1.3-1.8s with tokens_in/out = 0 — the model was never called. The deterministic resolver layer is short-circuiting every message into clarification mode BEFORE retrieval/model. The 4th run attempted upstream and errored (`upstream_error`) — diagnose root cause (rate limit? malformed request after clarification-budget exhaustion? logs: `smart_assistant_runs.error_code`, server logs on Vercel for run `0a29ebe5`).

## 3. Evidence — Owner session 1 (pre-resolver build, 2026-09-28 09:38-09:40 UTC)

| # | User (verbatim) | Behaviour | Verdict |
|---|---|---|---|
| 1 | "show me all my quotes with ridges" | Scope: "with components matching 'ridges'" → empty result | FAIL — literal word match |
| 2 | "ridging?" | Scope: "with components matching 'ridging'" → empty (punctuation WAS stripped correctly) | FAIL — word-form mismatch |
| 3 | "quote 1014" | Correct answer, full details — but plain text, nothing clickable | PARTIAL — data right, no deep link |
| 4 | "show me all of John's quotes" | "Which job do you mean? Choose a matching record below." + scope "search 'John' (ranked suggestions)" | FAIL — list intent turned into single-picker; customer name routed to TEXT search |
| 5 | "the most recent john smith quote" | "Which job do you mean?..." + scope "search 'John Smith' (exact)" | FAIL — temporal qualifier ignored; customer name as text search |

**Real data anchors (RS Roofing):** components named `Ridge` (on 5 quotes) and `Ridge (Soft Edge, Standard)` (on 12). Quote 1014 = "Lot 2, 123 Easy Quote Lane", status confirmed, customer John Smith, saved total NZD $15,374.51. Customer "John Smith" has multiple quotes (hence disambiguation fired).

---

## 4. Fixes required (priority order)

### P0-A — Cross-run resolution state pollution (the "worse" regression)
The resolver persists per-conversation resolution state (`assistant_v2_resolution_states`) and is folding EVERY follow-up message into the pending unresolved resolution. Evidence: session 2 runs 2-3 ("I still need...", "Start a fresh request"). A new message that shares no entity/intent overlap with the pending resolution MUST start a NEW resolution. `quote 1014` after a failed ridges search must resolve instantly (it did in session 1 without the resolver).
Fix direction: on each inbound message, classify continue-vs-fresh against the pending state (entity overlap, intent similarity). When fresh: clear/ignore pending state, resolve from scratch. Audit `expires_at` handling and clarification-ceiling accounting (the 2-clarification budget must apply per resolution attempt, not per conversation lifetime).

### P0-B — Deterministic layer must not swallow clear requests
"I just want to see the quotes that contain ridge components" is fully specified. The resolver short-circuited to "what is the item called?" before any retrieval. A request with a clear scope (record type + component/customer qualifier) must ALWAYS run retrieval, then only ask when results are genuinely ambiguous. No path may ask for information the message already contains.

### P0-C — upstream_error dead air
Run `0a29ebe5` failed with no user-visible reply. Every failure path must return a graceful human message ("Something went wrong on my side — try again" tier) — never silence.

### P1-D — Component word-variant matching
Singular/plural (ridges→ridge), gerund (ridging→ridge), prefix/substring (ridge → "Ridge (Soft Edge, Standard)"), punctuation-insensitive (already OK). Tiered: exact → normalized → prefix/substring → fuzzy. When nothing matches, honest fallback naming closest matches: "No component called 'ridging'. Closest: Ridge (5 quotes), Ridge (Soft Edge, Standard) (12 quotes) — show those?" NEVER silently empty.

### P1-E — Temporal/ordinal qualifiers
"most recent", "latest", "newest", "first", "last" = deterministic sort+pick instruction. When present with a resolvable entity set: filter → sort created_at DESC → pick → answer with the record. NEVER disambiguate when the user has already specified WHICH one.

### P1-F — List intent
"all of John's quotes", "quotes with ridges" = LIST requests. Return the list (cards/summary), never a single-record picker. Disambiguation is only for singular intents with multiple candidates.

### P1-G — Customer qualifier routing
Names that match customers must route to the customer filter (customer_name), not text search. Evidence: session 1 scopes "search 'John' (ranked suggestions)" / "search 'John Smith' (exact)". This was the known P1.7 residual — now P1 priority. If a name matches BOTH a customer and job text, prefer customer, note the choice.

### P2-H — Clickable deep links in answers (owner: "absolute minimum bar")
Every entity reference in a direct answer (quotes/orders/invoices/customers/components) renders as a tappable card/link that navigates to that record. The cards infra already exists for candidate selection (ConversationCards); extend to direct answers. For "quote 1014" the answer card opens the quote.

### P2-I — Clarification copy on ALL ask paths
Every disambiguation/clarification reply includes, in the text itself: "Choose a matching record below, or send me more information." Plus a visible None-of-these option (exists on the resolver candidate path; missing on the search-suggestion path). If the user's target is not among the options, the copy must make clear they can just say so.

### P2-J — Fresh-start affordance (owner directive)
Add a "Move on" affordance after each assistant response (button in the chat UI + natural-language equivalent "move on" / "new question" handling server-side). Clicking/saying it closes the pending resolution state explicitly; the next message is treated as a fresh request. Complements P0-A's automatic detection; both ship.

### P2-K — Fast-path copy humanization
Retire robotic scope-dump replies ("Record count: 8. Scope: quotes; non-draft quotes only"). Answers read like a competent assistant: lead with the answer, one line of context, offer the next step.

---

## 5. Acceptance (owner's verbatim utterances — must-pass)

From session 2 (resolver live), in ONE conversation, in this order:
1. "show me my quotes with ridges" → returns the list (quotes containing Ridge / Ridge (Soft Edge, Standard) components), clickable.
2. "I just want to see the quotes that contain ridge components" → recognized as restating the same intent; answers (or refines), does NOT ask for a record name.
3. "quote 1014" → immediate full answer for quote 1014 with clickable open-record card, regardless of the two prior unresolved exchanges.
4. "whats the most recent john smith quote" → the single newest John Smith quote, with date stated, clickable; never a picker.

From session 1:
5. "ridging?" → variant-matched to Ridge components, honest closest-match fallback if no match.
6. "show me all of John's quotes" → list of John Smith's quotes via customer filter.

Structural:
7. Fresh-thread test: unresolved query → unrelated new question → new question answered cleanly (pending state does not leak).
8. Move-on test: unresolved query → "move on" → next question answered cleanly.
9. Variant matrix: ridge / ridges / ridging / "Ridge flashing" / trailing punctuation all resolve to the Ridge family or produce the honest closest-match fallback.
10. Failure injection: any upstream/model failure produces a graceful user-facing message; zero dead-air runs.
11. Existing suites still pass: 60-case battery (scripts/sa-resolver/*), P1.6 acceptance harness, offline 812-test suite (extend, do not weaken).

---

## 6. Invariants (do not break)

- Model `gpt-5.6-luna` locked; flags pattern preserved; resolver stays behind `SMART_ASSISTANT_RESOLVER_ENABLED`.
- Propose-then-confirm guard for ALL mutations (P3) preserved — rate changes on sent quotes must still be refused.
- `app/lib/takeoff/units/conversions.ts`, `app/lib/supabase/database.types.ts`, LOCKED_FILES registry: untouched.
- Migrations: additive-only, under `backend/supabase/migrations/`, with pg_proc verification notes.
- No em dashes in any user-facing copy.
- Do not touch marketing surfaces or UX Phase 6-8 surfaces (disjoint lanes; drift-checked at integration).
- Transcripts for diagnosis: `smart_assistant_messages` ⋈ `smart_assistant_runs` (full verbatim Q&A incl. tool_calls/sources). Use them; add queries to your evidence doc.

## 7. Return format

- `FILE_CHANGES.json` (path, before-hash, after-hash per file) + `RETURN_NOTES.md` + evidence doc with the 11 acceptance cases run offline where possible.
- Zip extracts into `quotecore-plus/` wrapper with `START_HERE_SA_QUALITY.md` at root (this integration loop requirement is standing).
- Declare every file you touch; undeclared drift vs baseline fails integration.
