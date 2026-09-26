# Smart Assistant V2 - Handoff to Mark (2026-09-26)

Owner: Shaun. Maintained by Gavin (full-stack agent). Since your last handoff (2026-09-25 evening), the facts + speed layers went live, P2 and P3 are live for the owner's test company, and the full P3 editing flow has been verified end-to-end with the owner. This note covers what shipped, two production case studies from today's owner tests, and the scope for your next phase: ranking + cross-quote rollups.

## 1. What shipped since your last handoff zip

- **Facts layer (live):** migration 20260925160000 applied (`sa_v2_speed_scope`, `sa_v2_count`, `sa_v2_quote_snapshot`). Engine-backed quote totals and exact counts, zero LLM. Owner-verified with 0.9s / 0-token turns.
- **P1.5 speed layer (live):** canonical latest/list/number/capability intents take a zero-LLM path. Question forms ("what's my latest quote", "what is the total price of X") now hit it too, not just command verbs (commit 3df29f8b).
- **P2 attention (live):** attention migration applied + p2 rollout flag set for RS Roofing.
- **P3 write actions (live):** enabled for RS Roofing after a clean acceptance battery (25/25 phase 2, 28/28 write battery incl. duplicate-confirm atomicity, cancel-terminal, digest conflict, cross-user denial). Provisioner: `scripts/test-sa-v2-provision.mjs` (throwaway company + real conversation/proposal turns + fixtures JSON).
- **P3 verified with the owner (2026-09-26 13:50):** "set the material rate on the Ridge component of my draft 9th canvas test to 25 per m" - proposal turn 8.2s, card "Review Ridge" with before/after (rate 0 -> 25/m, engine material cost 0 -> 258.02 NZD), button confirm, status committed in `assistant_v2_actions` + `sa_action_log`, matching proof digests, `quote_components` row updated (material_rate 25.0000, engine recalc 10.3208m x 25 = 258.02), `calc_audit` override trail intact (field, userId, previousValue, timestamp). Rollout state: p1/p2/p3 true, p4 false.
- **Model hotfix (e363af6c):** OpenAI now rejects `reasoning_effort` when function tools are present on gpt-5.6-luna chat completions (overnight validation change; instant 400 `upstream_error`, 0 tokens, every turn). Tool turns send `reasoning_effort: none`; no-tools synthesis keeps low effort. If a model call 400s upstream with 0 tokens, check this first.
- Also merged since your base: UX Phase 5 Document Studio, takeoff canvas UX pass, PWA icons. No overlap with SA files.

## 2. Case studies from today's owner tests (learn from these)

**Case 1 - named-record resolution failure (13:11).** The owner asked for an edit on "my draft 9th canvas test". The model demanded "its draft quote number" - a field that does not exist on drafts - and refused to act on the name twice, even though search had the right draft as the clear winner (score 85 vs 56.9). Root causes: (a) the existing named-open guidance was speed-gated and stripped whenever the speed layer handled the turn, and (b) clarification triggered despite an unambiguous winner. Fix (33953670, unconditional rules in `app/lib/smart-assistant/v2/tools.server.ts`): drafts have NO quote number, the user's name IS the answer; act on the clearly strongest search match, ask only on genuine ties. Lesson: correctness rules must never be speed-gated.

**Case 2 - flag/permissions lesson (13:41).** The P3 edit tools were not offered to the model in a live owner test despite being "enabled". Vercel env listings MASK values and can be silently stale/wrong; the rollout/permission wiring had to be verified at the database level and by runtime behaviour (tool registration in the actual turn, `smart_assistant_runs` rows), never by `vercel env ls`. After fixing the wiring, the same test passed at 13:50 with the full chain above. Lesson: verify by runtime behaviour, then verify the actual production row, then declare success.

## 3. Scope for your next phase (owner priority order)

1. **Cross-quote rollups and aggregation.** The remaining benchmark failures: "Which quote is worth the most?", "How many quotes did I create this month?", "What's the total ridge lineal metres across my quotes?" Build aggregation reads (counts, sums, comparisons across records) computed by deterministic code/SQL, never model arithmetic. Multi-step turns with bigger token budgets are explicitly acceptable to the owner - correctness and completeness are the goals.
2. **Ranking + resolution hardening.** Today's prompt rules made the model act on clear winners, but the ranking itself is still flat scores. Expose structural ranking signals (score, recency, status, name-exact match tiers) so the strongest match is machine-actable and ties are detectable and rare. Keep the unconditional rules from 33953670.
3. **Owner directive - direct RLS-scoped DB reads.** The owner wants the assistant to reach the ENTIRE database as tables/columns, not a UI-shaped projection, so it can answer fast without bespoke per-question tools. Every read must stay RLS-scoped to the caller's company (existing pattern: `match_sa_chunks` derives company from `auth.uid()`, never trusts a param). Read-only; all writes stay P3 propose-then-confirm.

## 4. Locked invariants (do not break)

- Numbers only ever come from records/engine tools. The `calculate` tool stays UNREGISTERED.
- `sa_finish_run` is executable by service_role ONLY.
- Quota = `assistant_turn_reservations` protocol (no FK to runs, company-serialized, duplicate replay checked before quota refusal).
- All writes use propose_then_confirm + requester_button + retain_action_fields (owner-approved 2026-09-24). Never silent writes.
- Write actions log to both `assistant_v2_actions` and `sa_action_log` with matching proof digests.
- Model = gpt-5.6-luna. Any model change re-runs the 8-question benchmark (docs/SA_HANDOFF_2026-09-25.md section 1) and compares via `smart_assistant_runs`.

## 5. Gotchas and working rules

- Real converters are truncated (M_TO_FT=3.28084, SQM_TO_FT2=10.7639, SQM_TO_RS=0.107639). Fix tests to parity; NEVER touch conversions.ts.
- Repo lint carries ~8312 pre-existing problems (QcDialog refs-during-render, minified bundle warnings) - not from SA work, do not block on them.
- P4 (creation/recovery) stays gated: only after P3 holds in live use; concurrency/atomicity gates P3-01..22 remain the reference.
- Verify runtime behaviour from `smart_assistant_runs` (status/error_code/tokens) - it is the observability table for every turn.
- Return your work as a zip against this base. Gavin LF-normalizes, drift-checks against this commit, integrates, runs gates, deploys to quotecore-plus-testing, and verifies with the owner before the next loop.
