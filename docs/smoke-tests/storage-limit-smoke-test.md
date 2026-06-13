# Smoke Test — Catalog Atomic Import + Storage-Over-Limit ("Red") Blocking

**Feature:** Gerald Round 9 re-audit fixes (H-01-R/H-02-R/M-01-R) + Shaun option-3 storage policy.
**Env:** Dev (`quotecore-plus-dev.vercel.app`). One Supabase DB serves dev+prod.
**Project ref:** `aaavvfttkesdzblttmby`.

> Policy under test: A catalog import is allowed to COMPLETE even if it pushes the
> company over its plan storage quota (max overspill = the 10MB per-catalog ceiling).
> Going over flips the company **"red"**: ALL file uploads are blocked until they
> free space or upgrade. **Non-file actions (creating quotes, components, drawings)
> must keep working.**

---

## Part A — Forcing the over-storage ("red") state via SQL

Run these in the Supabase SQL editor (or the Management API query endpoint).
**Replace `<COMPANY_ID>`** with the test company's id. Find it with:

```sql
-- Find your test company by slug or email
select c.id, c.slug, c.plan_code, c.storage_used_bytes, c.storage_topup_bytes,
       sp.storage_limit_bytes as plan_limit_bytes,
       (sp.storage_limit_bytes + c.storage_topup_bytes) as effective_limit_bytes,
       (c.storage_used_bytes > sp.storage_limit_bytes + c.storage_topup_bytes) as is_over
  from public.companies c
  join public.subscription_plans sp
    on sp.code = public.company_effective_plan_code(c.id)
 where c.slug = '<YOUR_TEST_SLUG>';   -- or filter by id
```

### A1. FORCE OVER LIMIT (go red)

This sets `storage_used_bytes` to 1 byte above the effective limit. It does NOT
touch any plan rows, files, or quotes — it only edits the usage counter, so it's
fully reversible.

```sql
-- === FORCE RED: bump used bytes to limit + 1 ===
update public.companies c
   set storage_used_bytes = (
         select sp.storage_limit_bytes + c.storage_topup_bytes + 1
           from public.subscription_plans sp
          where sp.code = public.company_effective_plan_code(c.id)
       )
 where c.id = '<COMPANY_ID>';

-- Verify it took (is_over should be true):
select c.id, c.storage_used_bytes,
       (sp.storage_limit_bytes + c.storage_topup_bytes) as effective_limit_bytes,
       (c.storage_used_bytes > sp.storage_limit_bytes + c.storage_topup_bytes) as is_over
  from public.companies c
  join public.subscription_plans sp on sp.code = public.company_effective_plan_code(c.id)
 where c.id = '<COMPANY_ID>';
```

### A2. RESET TO HONEST USAGE (clear red after testing)

**IMPORTANT:** the force-script overwrites the real usage counter. To restore the
true value, recompute from actual stored data. Storage = sum of catalog `data_bytes`
+ the storage-trigger-tracked file objects. The trigger value can't be recomputed
from app tables alone, so the safest reset is to set it back to what it was BEFORE
the test (note the original number from the find-query above), OR recompute the
catalog portion and set files to 0 if this is a clean test company:

```sql
-- PREFERRED RESET: recompute the true value from ALL storage sources
-- (quote_files + company_attachments + catalogs). Verified to match the
-- live counter exactly on untouched accounts (2026-06-01). No need to have
-- recorded the original number — this reconstructs it.
update public.companies c
   set storage_used_bytes =
         coalesce((select sum(file_size)  from public.quote_files        where company_id = c.id), 0)
       + coalesce((select sum(file_size)  from public.company_attachments where company_id = c.id), 0)
       + coalesce((select sum(data_bytes) from public.catalogs           where company_id = c.id), 0)
 where c.id = '<COMPANY_ID>';

-- Verify back to honest + not over:
select c.slug, c.storage_used_bytes,
       (sp.storage_limit_bytes + c.storage_topup_bytes) as effective_limit_bytes,
       (c.storage_used_bytes > sp.storage_limit_bytes + c.storage_topup_bytes) as is_over
  from public.companies c
  join public.subscription_plans sp on sp.code = public.company_effective_plan_code(c.id)
 where c.id = '<COMPANY_ID>';
```

> The recompute above is the safe default. If you'd rather, you can also note
> the original `storage_used_bytes` from the find-query before forcing red and
> restore that exact number instead.

---

## Part B — Test cases

### B0. Baseline (NOT over limit)
1. Confirm `is_over = false` for the test company.
2. App shows NO storage banner. All file uploads work normally.

### B1. Storage banner appears when red
1. Run **A1** (force red). Refresh any workspace page.
2. **Expect:** red banner at top of shell: *"Storage limit reached … new file uploads are paused …"* with a **Manage storage** CTA → `/<slug>/account?tab=billing`.
3. Banner appears regardless of subscription status (test on an active/paid company too).

### B2. Every upload portal is blocked while red
For EACH portal, click the upload trigger and confirm the **StorageBlockedModal**
pops ("Storage limit reached", Manage storage / Close) and the file dialog does NOT open:
- [ ] Quote files — `quotes/[id]` FilesManager (both uploaders)
- [ ] Quote summary files panel — `quotes/[id]/summary`
- [ ] New-quote details form file upload — `quotes/new`
- [ ] Company logo — `account` LogoUploader
- [ ] Customer-quote-template logo — `resources` CustomerTemplateLogoUploader
- [ ] Catalog upload wizard — `resources?tab=catalogs` (or catalogs)
- [ ] Attachment library upload — `resources?tab=attachments`
- [ ] Flashing image upload — `flashings`
- [ ] Material-orders template/order file uploads
- [ ] Takeoff plan-image upload — `quotes/[id]/takeoff`
- [ ] (Any portal Gavin reports as "skipped" — verify manually)

### B3. Non-file actions still work while red (CRITICAL — Shaun point 1)
With the company still red:
- [ ] Create a new quote → succeeds (governed by quote_limit, not storage).
- [ ] Add a component → succeeds.
- [ ] Add/draw a measurement / drawing → succeeds.
- [ ] Edit existing data, send a quote, navigate → all work.
Only FILE uploads should be blocked. If any of the above is blocked, that's a BUG.

### B4. Server-side enforcement (not just UI)
The modal is UX; the server gate is the real protection. With the company red,
attempt a direct upload (e.g. via the catalog import or attachment mint) and confirm
the server rejects it with a storage/quota error even if the UI were bypassed.
- [ ] Catalog import while red on a NEW catalog: import COMPLETES (option 3) and
      company stays red. (Import is the one path allowed to push further over.)
- [ ] Attachment upload while red: blocked at mint (`storage_quota_exceeded`).
- [ ] Quote-file upload while red: blocked at finaliser.

### B5. Recovery — delete frees space, clears red
1. Run **A2** to restore honest usage (or delete a catalog/file to drop below limit).
2. Refresh → banner gone, upload portals work again.

---

## Part C — Catalog atomic-import correctness (H-01 fixes)

### C1. Per-catalog 10MB hard ceiling
1. Try importing a catalog whose parsed rows exceed ~10MB.
2. **Expect:** import rejected with "exceeds the 10MB / 250,000-row limit" — no
   partial catalog left in `ready`.

### C2. Abandoned import is still charged (no free storage)
1. Note `storage_used_bytes`.
2. Start a catalog import; let a batch or two land but DO NOT finish (close the tab
   mid-import, or it errors partway).
3. **Expect:** `storage_used_bytes` increased by roughly the bytes that landed —
   confirming per-batch charging. (Old bug: would stay unchanged.)
```sql
select id, status, row_count, data_bytes from public.catalogs
 where company_id = '<COMPANY_ID>' order by created_at desc limit 5;
select storage_used_bytes from public.companies where id = '<COMPANY_ID>';
```

### C3. Delete reverses the charge exactly
1. Note `storage_used_bytes` and the catalog's `data_bytes`.
2. Delete the catalog.
3. **Expect:** `storage_used_bytes` drops by exactly that catalog's `data_bytes`
   (clamped at 0). Works for `importing`, `error`, `ready`, and `archived` catalogs.

### C4. Replace-file does not double-charge
1. Import a catalog to `ready` (note used bytes).
2. Re-import / replace the file on the same catalog.
3. **Expect:** used bytes reflect the NEW file size only, not old+new (first batch
   reverses the prior charge before re-accounting).

### C5. No second path to "ready"
- Confirm `finalizeCatalog` is gone (code-level): only the import RPC's final batch
  sets `status='ready'`. There should be no app action that flips an `importing`
  catalog to `ready` without charging.

---

## Pass criteria
- B1–B5 all behave as specified (banner, modal on every portal, non-file actions
  unaffected, server enforces, recovery clears red).
- C1–C5 accounting is honest and exact.
- No console errors; `next build` green.
