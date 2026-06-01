# Gerald Round 9 — Re-audit Request (fixes applied)

**Date:** 2026-06-01
**Author:** Gavin
**Re:** Your Round 9 report `04-report.md` (C-01, H-01, H-02, H-03, M-01..M-04, L-01).
**Branch:** `development` HEAD `1366089` (was `1da0b48` at your review).
**Migration applied to Supabase:** `backend/supabase/migrations/20260601140000_round9_security_fixes.sql`.

All three blocking findings (C-01, H-01, H-02) are fixed + pushed. H-03 baked into the phase design before build. M-01 + L-01 also done. Please re-verify.

## C-01 + M-04 — Cross-tenant RPC access — FIXED
- The five `SECURITY DEFINER` RPCs are called **only** via the service-role admin client (verified: `entitlements.ts`, `catalogs/search/route.ts` all use `createAdminClient()`). So instead of adding per-call auth checks, I revoked client execute entirely.
- **REVOKE EXECUTE on `search_catalog_rows`, `company_catalog_count`, `require_catalog_slot`, `company_attachment_count`, `require_attachment_slot` FROM `anon`, `authenticated`, `PUBLIC`.**
  - Note: Supabase default-grants to `anon` AND `authenticated` separately. My first pass revoked `authenticated`+`PUBLIC` only and `anon` survived (it could call `search_catalog_rows` unauthenticated — worse than the original). Caught it in post-apply verification and revoked `anon` too.
  - **Verified live** via `pg_proc` + `aclexplode`: only `postgres` (owner) and `service_role` retain EXECUTE on all five.
- **Defensive hardening of `search_catalog_rows`** (verified live in `pg_get_functiondef`): `LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100)`; LIKE wildcards escaped — `ILIKE '%'||replace(replace(replace(coalesce(p_query,''),'\','\\'),'%','\%'),'_','\_')||'%' ESCAPE '\'`.
- **Please confirm:** the revoke approach is acceptable (vs. self-authorising function body). My reasoning: zero legitimate client callers exist, so removing the grant is a smaller attack surface than relying on an in-function `auth.uid()` check.

## H-01 — Catalog storage/growth now server-authoritative — FIXED
- `app/(auth)/[workspaceSlug]/catalogs/import-rows/route.ts`:
  - Byte size computed server-side from accepted rows (`Buffer.byteLength(JSON.stringify(raw))`), never from browser `dataBytes`.
  - Hard caps: `MAX_ROWS_PER_CATALOG = 250_000`, `MAX_BYTES_PER_CATALOG = 50MB`; batch rejected if it would exceed either.
  - On `isLastBatch`: re-assert quota against the authoritative total; on failure mark catalog `error` (not `ready`); charge `storage_used_bytes` once by the true total; flip to `ready`.
- `createCatalogMeta` (`catalogs/actions.ts`) now inserts `data_bytes: 0` and charges nothing (was trusting + charging browser estimate).
- **Accounting invariant:** storage charged exactly once when a catalog reaches `ready`. `isFirstBatch` replace-file and `deleteCatalog` only reverse the charge when prior status was `ready`/`archived`, so abandoned `importing`/`error` catalogs (running `data_bytes` never charged) don't mis-decrement. Addresses your M-03 concern too.
- **Please sanity-check** the replace-file + abandoned-import accounting paths.

## H-02 — Attachment mint gating + orphan cleanup — FIXED
- `app/lib/files/signed-upload.ts`: when `scope.kind === 'library'`, `requireFeature(companyId,'attachment_library')` + `requireAttachmentSlot(companyId)` run **before** minting the signed URL. A disabled/Starter account or a user at cap now fails at mint, before any bytes land.
- `app/(auth)/[workspaceSlug]/attachments/actions.ts`: `createAttachment` validates the `{companyId}/library/` prefix first, then on ANY failure path (gate race, DB insert error) calls `cleanupOrphan(path)` which `storage.remove([path])` — only ever a company-verified path, so it can't delete outside the company folder.
- `MintUploadResult` extended with `feature_gated` + `attachment_limit_reached` codes.
- **Note:** I did not add the UI-side cap disable (your remediation #2) yet — the server gate is the real fix and is in. I can add the client-side "at cap" disable as a follow-up if you want belt-and-braces.

## H-03 — Attachment send design (pre-build) — REVISED IN BRIEF
- `docs/attachments-phase-4-6-brief.md` Phase 6 rewritten:
  - **No raw `AttachmentSource[]` on `SendOutboundMessageInput`.** Instead `attachmentSelection?: { libraryAttachmentIds?: string[]; quoteFileIds?: string[] }`.
  - New server-only resolver `resolveOutboundAttachmentSources({companyId, quoteId, ...ids})` queries `company_attachments` by `id+company_id+archived_at is null` and `quote_files` by `id+quote_id` (quote verified to belong to company); drops any unresolved id.
  - `buildEmailAttachments` to be locked module-private and/or require `companyId` + assert `${companyId}/` path prefix as defence-in-depth.
  - Picker props carry IDs, not storage paths.
- **Please confirm** this design closes H-03 before we build Phases 5–6.

## M-01 — Resend guard base64-aware — FIXED
- `app/lib/email/send.ts`: now computes `base64EncodedSize(rawAttachmentBytes) + body bytes` vs `40MB − 1MB headroom`. User-facing error reports the usable raw budget. (Was: raw bytes vs 38MB.)

## M-02 — atomic slot check — NOT changed yet (your call)
- The cap check + insert/unarchive are still separate PostgREST calls (small overshoot window on concurrent creates at caps of 3/5). I can wrap count+mutation in a single RPC with `pg_advisory_xact_lock` if you want it closed pre-merge, or defer as low-likelihood. Your steer.

## L-01 — delta lint — FIXED
- `catalog-list.tsx` unused `effectivePlanCode` removed from destructure; `upload-wizard.tsx` `let matrix` → `const`. `npx eslint` clean on the delta. (Legacy lint debt elsewhere untouched.)

## Verification done
- `npx tsc --noEmit` clean. `npm run build` passed. Types regenerated (no diff — function-body/grant-only migration).
- Migration applied to Supabase + grants/hardening verified live.
- Pushed `1da0b48..1366089` to `development`.

**Open questions for you:** (1) revoke-vs-self-authorise for C-01; (2) H-03 design sign-off; (3) M-02 — close now or defer; (4) want the H-02 client-side cap disable as well?
