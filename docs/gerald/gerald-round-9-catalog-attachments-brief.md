# Gerald Round 9 — Catalog Library + Attachments + Resource Library Audit Brief

**Date:** 2026-06-01
**Author:** Gavin (QuoteCore+ Agent)
**Scope:** Everything added since your last review. Pre-merge security pass before `development → main`.

---

## Context

Since Round 8 (2026-05-25, HEAD `9f58dfa`) and the mid-stream digital-takeoff audit (`gerald-2026-05-29`, resolved in `6a70d87`), three new features have landed on `development`. The takeoff/multi-page work you already audited is **out of scope** here — this brief covers only the genuinely new surface.

**Repo:** `github.com/algora-dev/quotecore-plus`
**Branch under review:** `development` (HEAD `1da0b48`)
**Baseline (last thing you saw):** takeoff work through `2b8de87`
**Delta:** ~4,600 lines, 2 new migrations, 2 new tables. Not yet merged to `main`.

Please focus on the security-relevant hotspots flagged below rather than line-by-line on UI.

---

## 1. Catalog Library (commits `57f943f` → `04faa19`)

Lets a company upload a supplier price-list CSV, parse/preview/map it in-browser, store parsed rows, and search them to populate quote lines.

**Architecture:** PapaParse in-browser (parse/preview/validate/map) → batched server-side insert → `pg_trgm` GIN search. **Raw CSV file is NOT stored** — only parsed JSONB rows in `catalogs.data_bytes`.

**New migration:** `supabase/migrations/20260531120000_catalog_library.sql` (351 lines) — APPLIED to production Supabase (one DB serves dev+prod). New `catalogs` table + RLS + `require_catalog_slot()` RPC + tier columns on `subscription_plans` (`feat_catalogs`, `catalog_limit`).

**Please scrutinise:**
- **CSV injection / formula injection** — parsed cell values flow into JSONB and later into quote lines + PDFs. Are values that start with `=`, `+`, `-`, `@` neutralised anywhere they could be re-exported to a spreadsheet? Search-result rendering: any XSS path from catalog cell content into the DOM?
- **`pg_trgm` search** — `app/(auth)/[workspaceSlug]/catalogs/search/route.ts` (101 lines): is the search term parameterised? Any LIKE/ILIKE pattern-injection or ReDoS risk? Is the query company-scoped at the DB layer (RLS), not just app-layer?
- **Batched insert** — `import-rows/route.ts` (140 lines): row-count / payload-size cap before insert? Could a malicious CSV (millions of rows) exhaust the storage quota or DOS the insert? Is `data_bytes` counted toward the company storage quota via `assertCanUseStorage` BEFORE insert, not after?
- **RLS on `catalogs`** — confirm cross-company read/write is impossible; confirm archived catalogs still consume storage but free the active-count slot correctly.
- **Tier gate** — `require_catalog_slot()` RPC + `CatalogLimitReachedError`. Tiers: pro=3, **pro_plus=5** (the real mid-tier code; `pro_max` does not exist), premium=unlimited. Is the limit enforced server-side, not just hidden in UI?
- **In-quote search** — `CatalogSearchModal.tsx` + `CustomerQuoteEditor.tsx` changes: does adding a catalog row to a quote re-verify catalog ownership server-side?

## 2. Attachments Library (commits `3e2990b` → `80f039d`)

Reusable company file library that can be attached to outbound quote/order emails.

**New migration:** `supabase/migrations/20260601100000_company_attachments.sql` (233 lines) — APPLIED. New `company_attachments` table + RLS + `require_attachment_slot()` RPC (error codes P0001 inactive / P0012 feature_not_available / **P0014 attachment_limit_reached**) + plan cols `feat_attachment_library`, `attachment_limit`. Tiers 3/5/unlimited.

**Please scrutinise:**
- **Email attachment download trust model** — `app/lib/email/attachments.ts` `buildEmailAttachments()`: it downloads whatever storage paths it's given via the **service-role** client and does NOT re-check ownership (documented as caller's responsibility). The only callers so far are the load actions. **Key question for you:** when the per-use send picker lands (Phases 5–6, not yet built), the ownership gate MUST resolve client-supplied attachment IDs → paths server-side via company-scoped queries, never accept a raw path. Is the current trust-boundary documentation sufficient, or should `buildEmailAttachments` itself enforce a company_id scope as defence-in-depth?
- **Resend payload guard** — `sendEmail()` (`app/lib/email/send.ts`, +45 lines): 38MB total-payload cap (Resend ~40MB hard). Is the cap on the SUM of attachments + body, base64-aware (base64 inflates ~33%)? What happens on overflow — hard fail or silent drop?
- **Signed-upload scope** — `app/lib/files/signed-upload.ts` + `signed-upload-types.ts`: new `library` upload scope under `{companyId}/library/` in the `QUOTE-DOCUMENTS` bucket. Confirm the signed-upload token is bound to the requesting company's prefix and can't be used to write outside `{companyId}/`.
- **Storage accounting** — delete relies on the `storage.objects` DELETE trigger to decrement `storage_used_bytes` (no manual adjust). `createAttachment` re-reads real size via `storage.list`. Any path where a file is uploaded but the row insert fails, leaving an orphaned object that still counts quota (or doesn't)?
- **RLS on `company_attachments`** — cross-company read/write impossible; archived rows behave correctly for the active-count slot.

## 3. Resource Library restructure (commit `1da0b48`)

Route rename `/templates` → `/resources` + redirect shim + relocation of Order Templates & Catalogs management into tabs. Mostly moves/renames, lower security surface, but two things to glance at:

- **Redirect shim** — `app/(auth)/[workspaceSlug]/templates/[[...rest]]/page.tsx` (28 lines): it reads params + searchParams and `redirect()`s to `/resources/...`. Confirm it's an open-redirect-safe internal redirect only (no user-controlled host/protocol; constructed from `workspaceSlug` + fixed path). It sits inside the `(auth)` group so auth still applies — confirm.
- **robots.ts** — still disallows `/*/templates` and now `/*/resources` (both private app routes). Fine, just noting.
- These routes are all inside `(auth)` — no new unauthenticated surface introduced.

---

## What we'd most like from you

1. Any **High/Critical** in the catalog CSV pipeline (injection, DOS, quota bypass) or the attachment download/upload trust boundary — these are the highest-risk new surfaces.
2. RLS confirmation on the two new tables (`catalogs`, `company_attachments`).
3. A pre-emptive read on the **upcoming** attachment send pipeline (Phases 5–6): we want the ownership-gate design right before we build it, not patched after. Design intent is in `docs/attachments-phase-4-6-brief.md` — flag if our "resolve IDs→paths server-side, never trust client path" plan has a hole.
4. Anything cheaper to fix now (pre-merge) than after `development → main`.

**Not in scope:** digital takeoff / multi-page (audited 05-29), generic trades (audited round 8), Stripe/billing core (audited round 8). Flag if you see regressions there, but no need to re-review.
