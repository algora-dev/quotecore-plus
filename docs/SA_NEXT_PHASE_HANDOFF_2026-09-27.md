# SA next-phase handoff — 2026-09-27 (supersedes SA_P1.6_NEXT_PHASE_HANDOFF_2026-09-26.md)

**Baseline commit:** `72f3c3bb` (branch `ux/phase-4`). This zip is that exact tree plus ONLY this handoff doc + `START_HERE_SA_NEXT_PHASE.md`. Drift anchors here (SHA-256, LF-normalized).
**For:** the external Smart Assistant agent. **Integration owner:** Gavin. **Owner:** Shaun.

## Live state — do not rediscover

- **P1.7 retrieval intelligence is INTEGRATED, GATED and LIVE** on quotecore-plus-testing (deployment `inpcsqv86`+). Migration `20260926190000` applied: `sa_v2_retrieval_query_v17` (SECURITY INVOKER) + capabilities reader returns `intelligence_version=1`. Flag `SMART_ASSISTANT_RETRIEVAL_V17_ENABLED=true` on testing Production only. Telemetry-proven: `intelligenceActive`/`intelligenceByServer=true`, `sa_composite_resolution` events, zero repair-budget stops.
- Also in this tree: UX Phase 6 (everyday journeys) integrated + owner-reviewed. **UX surfaces belong to another agent lane — do NOT touch them** (see Protected).
- Model: `gpt-5.6-luna` locked (code default + env). Tool turns send `reasoning_effort=none` (upstream rejects it WITH function tools — hotfix e363af6c, preserve).
- One-company testing policy: RS Roofing only. Do not widen rollout, do not add test companies, never mutate RS Roofing data.
- All flags/env state unchanged. P4 stays OFF (gated on P3 holding in live use — current evidence is positive: guards fired correctly in today's owner session).

## Fix priorities — with LIVE OWNER-SESSION EVIDENCE (2026-09-27, RS Roofing)

The owner ran a smoke test today. Speed good (3.5-6.4s), zero errors, all guards held — but 3 of 4 answers were weak. Verbatim transcript + diagnosis:

| # | Owner asked | Assistant answered | Verdict |
|---|---|---|---|
| 1 | "How many quotes do I have?" | "Record count: 8.\n\nScope: quotes; non-draft quotes only" | CORRECT (8) but reads like debug output. Zero-LLM fast-path template needs humanizing. |
| 2 | "Show me my Ridge quotes with their linked orders and invoice status." | "No accessible quote records matched 'Ridge', boss." | WRONG interpretation. "Ridge" searched quote names — none are named Ridge. Should interpret as quotes CONTAINING Ridge components. |
| 3 | "Set the Ridge material rate to 30 per m on quote 1014" | "Which job do you mean for quote 1014?" + 5 options | Over-cautious: #1014 is a UNIQUE quote number — must resolve without disambiguation. Bare-numeral loose matching struck again. |
| 4 | (confirmed quote #1014) | "I couldn't prepare that change, boss. Quote #1014 isn't an eligible unsent quote..." | CORRECT — safe refusal, P3 eligibility guard working. Not a bug. |

**Priority order:**

1. **Component-qualified interpretation** (evidence #2): "Ridge quotes" / "quotes with Ridge" must resolve through quote_components (component search → owning quotes), not parent text search. This is the highest-value intelligence fix — composites already exist in v17; extend resolution semantics.
2. **Unique bare-numeral resolution** (evidence #3): an explicit unique quote number ("quote 1014", "#1014") must short-circuit to exact `quote_number` match — no disambiguation when exactly one match. Keep disambiguation for genuinely ambiguous name matches. (Carries over P1.6 residual "bare-numeral name matching" with a live example; numeric-aware NAME matching stays optional and must not weaken unique-resolution safety.)
3. **Customer-qualifier phrase bundling** (P1.7 residual, ~1/5 nondeterministic): "for John Smith" phrases get bundled into parent text search instead of `customer_name` filter → honest empty/clarify. Fix the qualifier extraction.
4. **Humanize fast-path answers** (evidence #1): zero-LLM answers should read like a person: "You have 8 quotes (excluding drafts)" — not "Record count: 8. Scope: ...". Template-level change, no engine risk.
5. **P3 composite verification nondeterminism** (P1.6 residual): identical draft+component edit prompts proposed correctly once, refused once. Single composite resolve or stronger one-shot guidance; never weaken propose-then-confirm.
6. **Scale fix P1.7.1** (mandatory before any wider rollout): 100k-catalogue WORDS search hits 8s statement_timeout (500) — `sa_v2_retrieval_rank()` per-row is not indexable. Fix: AND ILIKE pre-filter per word BEFORE the rank predicate (trigram index exists; EXPLAIN shows ILIKE 7.9-199ms, exact 6.4s, count 869ms). Plus engine boundary: 200 complete=238ms / 201 too_broad=150ms — keep.
7. **Scale gates**: EXPLAIN (ANALYZE, BUFFERS) representative compiled queries at 100k catalogue_rows; >200-quote refusal boundary; hard wall-clock timeout proof.

## Next-phase scope (owner direction: review, improve, next phase)

- **Ranking hardening + cross-quote rollups** (the documented next SA phase): extremal/winner evidence beyond single-field max, ranked listings over scoped quote sets, rollup answers with completeness accounting — all through the existing registry/compiler/engine. No new unrestricted SQL tools.
- Latency: keep zero-model canonical paths; one model call for simple retrieval; reduce related-orders variance (repair-attempt budget or tighter tool error hints).
- Knowledge phase stays GATED OFF (`knowledge_enabled=false` everywhere).
- Any new registry sources/fields MUST regenerate SQL + fingerprint (`node scripts/generate-sa-retrieval-sql.cjs`; `--check` catches drift) and ship as a NEW ADDITIVE migration. Never hand-edit generated SQL; schema.json is the single source.

## Invariants (non-negotiable)

- Preserve Luna + tool-turn `reasoning_effort=none`; P1.5/P2/P3 behaviours and flags; P4 OFF; admission/reservation/quota/replay/finish protocol; service-only finalisation; tenant isolation via admitted-run scope + RLS invoker readers; Hidden/View/Edit enforcement incl. field-level permissions; no model SQL, no tenant selector, no model self-classification; result taxonomy (empty/ambiguous/permission_denied/feature_disabled/unsupported/read_failed) stays distinct — never paper over a capability gap with prompt wording.
- **Protected from your lane:** ALL UX surfaces (Phase 6 + upcoming Phase 7 — another agent owns them), marketing pages, Takeoff/mobile flows, billing/auth logic, `app/lib/conversions.ts`, `app/lib/supabase/database.types.ts` (UTF-16 LE — edit tools corrupt it), pricing/calc engines, configs/deps, GitHub Actions.
- Real enums (teach, never guess): invoice `draft|sent|viewed|payment_reported|paid|disputed|cancelled`; quote `draft|confirmed|sent|accepted|declined|expired|archived`; orders ready|ordered (+ UI action states delivered/paid/pickup/waiting preserved by UX).
- Rollback for retrieval: company `enabled=false` + remove server flag; KEEP code/metadata tables.

## Verification approach (owner-approved — same as the UX agent loop)

**Do NOT attempt `npm install`, `npx tsc`, or `npm run build` — your environment cannot run them and that is expected.** Do the source-level checks you can (as your P1.7 return did). Be truthful about what was and wasn't verified.

**Gavin runs ALL release gates at integration:** offline suites + tsc exact parity (80 pre-existing) + lint (0 in changed) + build + `generate-sa-retrieval-sql.cjs --check` + v17 RPC battery + live acceptance on throwaway fixtures + deploy to testing + owner verify. P1.6 and P1.7 both integrated with zero drift using exactly this loop.

## Return format

Full updated source ZIP extracting into a `quotecore-plus/` wrapper + `START_HERE_RETURN.md` at zip root + changed-files manifest (SHA-256, LF-normalized) + evidence logs + explicit owner decision points. Deliver to Gavin for integration.
