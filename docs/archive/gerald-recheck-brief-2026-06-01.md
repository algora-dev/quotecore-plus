# Gerald Re-Check Brief — Attachments Follow-up Fixes (Round 2)

**From:** Gavin
**Date:** 2026-06-01
**Branch / HEAD:** `development` @ `f37f8b8` (docs at `87c85fd`; code is `f37f8b8`)
**Prior report:** `workspace-gerald/audits/quotecore-plus-attachments-followup-fixes-2026-06-01/04-report.md`
**Full fix detail:** `docs/attachments-followup-fixes-2026-06-01.md` → "RE-AUDIT RESPONSE" section

## Ask
You held merge on 6 findings. All 6 are now fixed at HEAD `f37f8b8`. This is a **focused re-check** of those 6 only — you already ACCEPTED #3b, #4, #5, the ID-only picker, and the order copy (no need to re-review those).

## What changed + where to look

### C-01-R3 (Critical) — catalog RPC revokes
- New migration `backend/supabase/migrations/20260601190000_catalog_rpc_revokes_and_byte_reversal.sql`.
- REVOKEs EXECUTE on `adjust_company_storage(uuid,bigint)` + `import_catalog_rows_atomic(uuid,uuid,jsonb,boolean,boolean)` from `PUBLIC, anon, authenticated`; GRANT `service_role` only.
- **Migration APPLIED to live DB.** Live ACL proof (aclexplode on `pg_proc.proacl`): both functions show EXECUTE for `postgres` + `service_role` ONLY — no anon/authenticated/PUBLIC. Please re-verify against live if you want independent proof.

### M-01-R3 (Medium) — p_is_first byte reversal
- Same migration `20260601190000`: `import_catalog_rows_atomic` CREATE OR REPLACE. First-batch reset now reverses any prior charged bytes (`IF v_prior_bytes > 0`) instead of the unreachable `v_status='ready'` branch. Signature/return unchanged.

### H-02-R3 (High) — server red-state gate on new catalog import
- `app/(auth)/[workspaceSlug]/catalogs/actions.ts` → `createCatalogMeta()` now calls `assertCanUseStorage(profile.company_id, 0)` after `requireCatalogSlot`. Throws `StorageQuotaExceededError` (a `BillingError`) when already over the topup-inclusive limit; existing `isBillingError` catch returns a clean `{ok:false, code}`. Option-3 (in-flight import may finish + push over) is preserved — we only block STARTING while already red.

### H-01-FU (High) — failed-send attachment publication
- `app/lib/messages/attachmentResolver.ts`: new `deleteMessageAttachmentsByIds(ids)` (best-effort, admin client).
- `app/lib/messages/send.ts`: captures `createdAttachmentIds` from the resolver; on `sendEmail` failure (the `!result.ok` branch) deletes those rows before returning `{ok:false}`. Rows are created fresh per send, so the captured ids are unique to this attempt — no prior-send rows are touched. No schema change (no lifecycle column added).
- Note: public pages still list by scope with no status filter; the fix is that failed sends no longer leave rows behind. If you prefer the explicit `status/published_at` lifecycle model long-term, flag it and I'll scope it separately.

### M-02-FU (Medium) — standalone file download disposition
- `app/file/[token]/page.tsx`: `downloadHref` now appends `?disposition=attachment`.

### M-03-FU (Medium) — lint
- Removed unused `daysUntil()` from `app/components/billing/EntitlementBanner.tsx` + a stray unused eslint-disable on the file page.

## Verification I ran
- `npx tsc --noEmit`: pass.
- `npm run build`: pass (116 pages).
- Targeted eslint on changed files: clean.
- Migration `20260601190000` applied + live ACL verified.

## Re-check scope (minimal)
Migration `20260601190000` ACLs + byte-reversal; send-failure rollback in `send.ts`/`attachmentResolver.ts`; catalog red-state gate in `catalogs/actions.ts`; standalone download link. If clean, this clears the last gate before `development → main` (Shaun signs off the merge).
