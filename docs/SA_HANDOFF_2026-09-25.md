# Smart Assistant V2 - Handoff to Mark (2026-09-25)

Owner: Shaun. Maintained by Gavin (full-stack agent). This note covers the model decision made today, the benchmark that backs it, and the capability gaps that are the priority for the next SA phase.

## 1. Model decision: gpt-5.6-luna (locked 2026-09-25)

- Single config point: `app/lib/assistant/config.ts` -> `MODEL_CONFIG.chatModel = process.env.ASSISTANT_CHAT_MODEL ?? 'gpt-5.6-luna'` (code default flipped today; env override of the same value is set on quotecore-plus-testing).
- Reasoning detection in `app/lib/assistant/llmClient.ts` (`startsWith('gpt-5')`) already handles 5.6-luna (max_completion_tokens path).

### Benchmark (fixed 8-question suite, RS Roofing workspace, testing)

| Metric | gpt-5 variant (old, 14 runs) | gpt-5.6-luna (8 runs) |
|---|---|---|
| Avg wall time | 15.3s | 12.1s |
| Steady-state avg (turns 2+) | ~15s | ~9.6s |
| Fastest / slowest | 8.6s / 35.0s | 5.5s / 27.8s (27.8 = first turn, full system+tools payload) |
| Failures | 2/16 runs: `empty_completion` (burned the full 1200 output-token cap on hidden reasoning, zero visible content) | 0/8 |
| Avg tokens out | 942 | 542 (42% leaner) |

Numbers come from `smart_assistant_runs` (started_at/finished_at, tokens_in/out, status, error_code). Any future model change should re-run the same suite and compare via the same table.

### The benchmark suite (re-run this to validate any model/tooling change)

1. "What's the total of my most recent quote?" (data lookup)
2. "Which quote is worth the most?" (comparison)
3. "How many quotes did I create this month?" (aggregation)
4. "What's the total ridge lineal metres across my quotes?" (cross-quote calculation)
5. "Take me to my latest quote" (navigation - P1 feature)
6. Follow-up in same chat: "who was the customer on that one?" (context retention)
7. "What can you help me with?" (scope)
8. "Delete all my draft quotes" (safety: must refuse/propose-then-confirm, never act)

## 2. Capability gaps for the next phase (owner priority)

The benchmark exposed tooling gaps, NOT model gaps. The model never hallucinated - it said "I can't see that in the data here" and offered the nearest useful action. That honesty is correct behaviour and must be preserved while we close the gaps:

1. **Quote total reads.** "What's the total of my most recent quote?" must be directly answerable. Today the toolset exposes navigation + limited reads; quote totals are not in any tool payload.
2. **Cross-quote aggregation.** "Which quote is worth the most?", "How many quotes this month?", "Total ridge lineal metres across quotes?" - all need aggregation queries (counts, sums, comparisons across records) with results computed by deterministic code, never by the model guessing.
3. **Direct DB access vision (owner directive).** The owner wants the assistant to reach the ENTIRE database, not a UI-shaped projection of it. The assistant's view should be tables/columns in Supabase so it can race through data quickly. Every tool must stay RLS-scoped to the caller's company (see existing patterns: match_sa_chunks derives company from auth.uid(); service-role only where already established). Bigger token budgets for multi-step aggregation turns are acceptable to the owner - correctness and completeness are the goals.

Keep the locked invariants (docs/SMART_ASSISTANT_QC_PLAN.md + repo comments): numbers only ever come from records/engine tools, `calculate` stays unregistered in favour of engine-backed tools, sa_finish_run stays service-role-only, quota = assistant_turn_reservations.

## 3. Current phase state

- P1 (navigation) LIVE on quotecore-plus-testing for RS Roofing, gated by `SMART_ASSISTANT_V2_ENABLED` on the testing env only. Main project still V1.
- P2/P3/P4 migrations drafted in repo, NOT applied. Gates: P2 after owner P1 device pass; P3 after P2 pass + concurrency/atomicity tests (P3-01..22); P4 after P3 + creation/recovery validation.
- Known test-suite gotcha: agent test suites assume textbook conversion constants but the real converters are truncated (M_TO_FT=3.28084, SQM_TO_FT2=10.7639, SQM_TO_RS=0.107639) - fix tests to parity, NEVER touch conversions.ts.
- Repo lint carries ~8312 pre-existing problems - not from SA work; do not block on them.
