# RETURN NOTES - P1.7.2 Task Context Quality (2026-09-28)

## Start here

This is the actual P1.7.2 implementation based on the latest supplied `quotecore-plus-SA-quality-handoff-2026-09-28.zip` (agent commit `482513c8`). Reconcile newer branch changes rather than overwriting blindly.

**NOT DEPLOYED. SQL NOT APPLIED. New task feature defaults OFF. No measured live latency claim.**

The previous root UX return notes are preserved byte-for-byte at `docs/sa-p172-2026-09-28/BASELINE_RETURN_NOTES.md`. The supplied quality brief remains intact. P172-specific source/delivery changes are described by `FILE_CHANGES.json`; historical manifests stay historical.

## What was corrected

P171's old unresolved search could intercept a complete unrelated request before retrieval/model. This implementation owns that design mistake: one shared task-boundary decision now precedes both paths instead of automatically folding every message into prior resolver state.

- Distinguishes new request, expected clarification, dependent follow-up, explicit correction, task closure and an uncertain task boundary. No extra classifier model call. Unrecognized complete wording reaches the existing first planning call, not a fake “no data” result.
- Keeps conversation, task and admitted run distinct. New tasks exclude old pending clues, record references/actions and model history; true continuations preserve the appropriate task. Exact #1014 after a failed Ridge LIST is fresh; #1014 answering a Ridge COST parent question continues.
- Done / Move on are authenticated metadata-only controls. Not quite focuses an editable refinement. No generated reply on button click, history deletion, business approval/cancellation or quota/run manipulation. Forgetting Done does not break new requests.
- Version-fenced task/candidate choices, saved boundary messages, task-scoped resolver state and fresh selected-record reads prevent stale buttons/late responses reopening closed tasks. Current permission and knowledge epochs are enforced.
- Owner list/restatement phrases retrieve real relationship matches. Ridge/ridges/ridging normalization retains specific qualifiers. Customer lists use customer filters. Supported latest/first selections consistently use creation order and one clickable result, not a picker or the legacy updated-at shortcut.
- Removes repeated identical supposed broadening within a turn; no cross-turn business-data cache. Existing one-to-five credible candidate selection, P3 proposal safeguards and general retrieval remain.
- Canonical failed requests get an inline failure tied to the user message. Unknown outcomes retain the SAME request key and one Check request control. Provider diagnostics and per-stage task timings are sanitized; no new retry worker or finalization path.

## Locked boundaries preserved

The original turn HTTP route and canonical run pipeline, model config/Luna reasoning client, dependency manifests, all **180 original migration SQL files**, pricing/tax/currency engines and unrelated UI are unchanged. P2/P3 and existing confirmation/audit are retained. No P4/knowledge enablement, new Orders edits, visual redesign, voice, PWA or analytics expansion.

Only functional assistant controls/presentation are changed. There is no arbitrary SQL tool, model-authored database write or second business data store.

## Required integration sequence

1. Read `docs/SMART_ASSISTANT_P172_HANDOFF_2026-09-28.md`, `docs/sa-p172-2026-09-28/validation/VALIDATION.md` and `DATABASE_ACCEPTANCE.md`.
2. Keep `SMART_ASSISTANT_TASK_CONTEXT_ENABLED=false` through build and SQL review. Existing flags/config remain as in the agent deployment. Run dependency install, real tsc/lint/production build in the normal environment. Run `node scripts/run-smart-assistant-task-quality-offline.mjs`.
3. Review/test/apply ONLY `backend/supabase/migrations/20260928150000_sa_v2_task_context.sql` to the approved testing database. Two private task-metadata tables and eight narrow functions; do not mass-apply pending migrations. Test owner/tenant/epoch/CAS/current-run/role grants before enabling.
4. Enable TASK_CONTEXT only on the intended testing deployment with existing resolver/retrieval/V17/P1 gates. Confirm `sa_task_boundary`, `sa_task_stage` and new task reader RPCs in logs. Missing setup fails explicitly; no silent fallback.
5. Run the owner's four exact messages in one continuous phone conversation, with NO New chat/Done between them. Then run true continuation, Done/forgotten Done, correction, pause/boundary, stale button, failure/uncertain replay and two-tab scenarios from `continuous-acceptance.json`. These are LIVE NOT RUN here. Validate actual selected IDs/cards and current data, not just plausible wording.
6. Measure per-turn overhead AND reduction of wrong follow-ups. Task-enabled turns add checkpoint read/begin/metadata-finish RPCs; sanitized stage timings expose each. No measured speed promise. Retain existing 90-second run deadline/usage accounting; effective DB cancellation remains a live acceptance gate.

Rollback TASK_CONTEXT=false disables this task router/UI but restores old P171 continuation behavior, with its known defect. The resolver master kill switch still works. Do not drop metadata tables or reset reservations to roll back. Old opaque task/candidate messages cannot reach a model after rollback.

## Actual evidence

**976 offline executable checks pass: 812 retained, 164 new.** See validation logs. These include real orchestration/service code with explicit mock transports, not live RLS/Luna. Syntax across 103 assistant files plus the two quote components, registry/static checks and 3,197 actual-baseline protected files pass.

The historical P171 raw-file checker already fails the supplied baseline at DESIGN_CHANGES.md due later agent UX edits. It has NOT been weakened. The P172 runner uses the actual Sept28 protected manifest and retains every original executable test.

Full typecheck was attempted on baseline and build, both exit 2 from missing dependencies. Diagnostic comparison is included; NOT a successful full typecheck. No install/lint/build, PostgreSQL, browser, Luna, scale or live cancellation test was run. The offline count is not a release success rate. Owner-verbatim continuous behavior is the acceptance bar.

## Limits and next handoff

No lower latency or perfect natural-language interpretation is claimed. Complex corrections still depend on the existing model planner; ambiguous cases can ask a boundary question. Context expiry is 15 minutes, not automatic task success. Done never confirms a proposal; old pending proposals retain original review/expiry guards. Generic header requests return identity/context and Open, not an unasked automatic pricing calculation. Lower-priority count-copy polish remains outside this quality correction.

Send the full ZIP plus `docs/sa-p172-2026-09-28/AGENT_INTEGRATION_PROMPT.txt`. Return actual testing deployment/flags, applied migrations, browser transcripts, selected records, task decisions, call/timing counts, security/concurrency evidence and remaining failures before any next feature phase.
