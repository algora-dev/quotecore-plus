# START HERE — Smart Assistant P1.7 implementation return

Based on the exact `quotecore-plus-SA-P1.6-next-phase-handoff-2026-09-26.zip`
agent export, branch `ux/phase-4`, reported commit `a18f4ab9`.

Read, in order:

1. `RETURN_NOTES.md`
2. `docs/SMART_ASSISTANT_P17_HANDOFF_2026-09-26.md`
3. `docs/sa-p17-2026-09-26/validation/VALIDATION.md`
4. `docs/sa-p17-2026-09-26/DATABASE_ACCEPTANCE.md`

This is implemented source, NOT a deployed or live-validated release. P1.7 is
DEFAULT OFF: `SMART_ASSISTANT_RETRIEVAL_V17_ENABLED=true` requires both the
existing P1.6 rollout AND the new RPC capability version. Do not enable it until
build and database/security checks pass. Preserve the existing Luna/reasoning
hotfix, P1.5/P2/P3, confirmation and admission/finalisation protocols. P4 and
knowledge remain off. Do not widen the owner's one-company testing rollout.

Only new migration: `20260926190000_sa_v2_retrieval_v17.sql` (draft, not applied).
Do not apply all outstanding migrations. The original P1.6 migration is already
applied according to the agent's baseline handoff and is byte-for-byte unchanged.

The prior root entry/return notes are archived in
`docs/sa-p17-2026-09-26/baseline/`. Original integration evidence stays in place.
