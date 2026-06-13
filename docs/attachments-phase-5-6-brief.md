# Attachments Phases 5–6 — Implementation Brief (Option B: hosted + token-gated)

**Status:** READY. Phase 4 (template-baked `attachment_id`) is shipped to `development` (`0f38fc4`), migration applied + types regenerated.
**Branch:** `development`. Do NOT merge to main. Migrations applied via Supabase Management API with Shaun approval (one DB serves dev+prod).
**Shell:** PowerShell — `;` not `&&`; `Get-ChildItem -LiteralPath` for `[workspaceSlug]` dirs; `[IO.File]::ReadAllText()` for migration SQL.
**Model intent:** Phase 5 picker/UI = mostly judgment (quote_files + library merge, entitlement gating) → Opus. Phase 6 gated-download route + resolver = security-critical → Opus, send to Gerald before merge.
**No emojis in app/UI/copy** (SVG icons only).

---

## DESIGN DECISION (locked with Shaun 2026-06-01)

**Option B — hosted files + token-gated download. NOT true email MIME attachments.**

Rationale: construction quotes carry roof photos / spec PDFs / warranty docs that routinely exceed the 40MB email ceiling. Files are stored private; the recipient reaches them through a **hosted page** behind the **same token that gates the quote/order** (or a per-attachment token for standalone sends). Email/auto-message body carries **text + a link button**, never the raw file.

### Three delivery contexts, one download mechanism
1. **Sent with a quote** → email links to the accept page (`/accept/[token]`); page shows an **Attachments** section (per-file Download + Download all).
2. **Sent with an order** → identical, `/orders/[token]`.
3. **Attachment-only auto-message** (no quote/order) → email has its own text body + a button linking to a **standalone hosted file page** with a Download button. Gated by a **per-attachment access token** (no quote/order token exists to reuse).

### Access control (Shaun: "gated")
- Downloads are NEVER open. A valid token (quote acceptance token / order token / per-attachment token) must resolve server-side first.
- After token validation, server mints a **short-expiry signed URL** (`getSignedUrl`, ~60–120s) and redirects/streams. Private storage stays private. **No raw storage paths ever reach the client.**

---

## GROUNDING — verified real surfaces (2026-06-01)

- **Send chokepoint:** `sendOutboundMessage()` in `app/lib/messages/send.ts`. `SendOutboundMessageInput` (line 52) already carries `companyId`, `relatedQuoteId?`, `relatedOrderId?` (quote/order mutually exclusive, enforced ~line 189). Single `sendEmail({...})` call ~line 350.
- **Quote send UI:** `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SendQuoteButton.tsx`.
- **Order send UI:** `app/(auth)/[workspaceSlug]/material-orders/[orderId]/preview/SendOrderButton.tsx`.
- **Public quote page:** `app/accept/[token]/page.tsx` — resolves `quotes` by `acceptance_token` via `createAdminClient()`. Already renders `DownloadQuoteButton` (PDF print). Attachments section goes here.
- **Public order page:** `app/orders/[token]/page.tsx` — resolves `material_orders` by token (high-entropy UUID, no HMAC). Attachments section mirrors here.
- **Attachment library:** `company_attachments` table; `loadAttachmentsForPicker()` → `AttachmentPickerItem {id,name,file_name,storage_path,file_size}`; `AttachmentRow` (fuller shape) already passed to `TemplatesPageClient`. Active = `archived_at IS NULL`.
- **Per-quote files:** `quote_files` table (all-tier, already exist on quotes).
- **Email helper:** `app/lib/email/attachments.ts buildEmailAttachments()` — **NOT used for delivery under Option B** (it produces MIME attachments). Leave it; do not wire it into the hosted flow. (Keep for any future true-attachment use; lock down per Gerald H-03 if ever wired.)
- **Storage helpers:** `app/lib/storage/helpers.ts` → `getSignedUrl(bucket, path, expiresIn=3600)`, `getSignedUrls(...)`. Bucket: `BUCKETS.QUOTE_DOCUMENTS` (where attachments live).

---

## DATA MODEL

Phase 4 gave us `email_templates.attachment_id` (template's baked default). Phases 5–6 need to record **which files were attached to a specific send**, so the hosted page knows what to show and the download route knows what's authorised.

### New table: `message_attachments` (migration, needs Shaun approval to apply)
Join rows recording the files attached to one outbound send / quote / order.

```
message_attachments
  id              uuid pk default gen_random_uuid()
  company_id      uuid not null references companies(id) on delete cascade
  -- exactly one of these scopes the attachment set:
  quote_id        uuid null references quotes(id) on delete cascade
  order_id        uuid null references material_orders(id) on delete cascade
  -- source file (exactly one of):
  library_attachment_id uuid null references company_attachments(id) on delete set null
  quote_file_id   uuid null references quote_files(id) on delete cascade
  -- standalone (attachment-only auto-message) access token:
  access_token    uuid null default gen_random_uuid()   -- only set/used for standalone sends
  display_name    text not null                          -- snapshot of file name at send time
  created_at      timestamptz not null default now()
```
- CHECK: exactly one of (`quote_id`,`order_id`) OR neither (standalone) — encode as: standalone rows have both null + a non-null `access_token`.
- CHECK: exactly one of (`library_attachment_id`,`quote_file_id`) is non-null.
- Indexes: `(quote_id)`, `(order_id)`, `(access_token) where access_token is not null`, `(company_id)`.
- RLS: company-scoped for authenticated reads; the public pages + download route use `createAdminClient()` (service-role) and scope by token → quote/order/company in code (same pattern as `/accept/[token]`).

Snapshotting `display_name` means deleting the underlying library file later still shows a sane (if now-unavailable) label; the download route re-checks the live file exists and 404s gracefully if gone.

---

## PHASE 5 — Send-time picker + hosted attachment surfaces

### 5a. Send-time picker (quote + order)
- **`SendQuoteButton.tsx`**: add an "Attachments" section in send mode. Two sources, multi-select:
  - **Library files** — from `loadAttachmentsForPicker()` (Pro+ gated via `attachmentsEnabled`; if not entitled, hide library source, allow quote_files only).
  - **This quote's files** — existing `quote_files` (all tiers).
  - Prefer passing the lists as **server props** from `summary/page.tsx` to keep RLS clean (match existing pattern). Picker shows `name` + `file_size`.
- **Template default pre-fill:** when the chosen template has `attachment_id`, pre-check that library file. User can uncheck / add others. Selection is **per-send**.
- **`SendOrderButton.tsx`**: mirror the same picker component (reuse if cleanly extractable into a shared `AttachmentSendPicker.tsx`). Order source = library files only (orders have no `quote_files` equivalent — confirm; if an order-file table exists, include it).
- Picker props carry **IDs only**, never `storage_path` (Gerald H-03 #5). `loadAttachmentsForPicker` currently returns `storage_path` — add a slimmer loader OR strip the path before it hits client props.

### 5b. Hosted Attachments section (public pages)
- **`app/accept/[token]/page.tsx`**: after token→quote resolution, query `message_attachments where quote_id = quote.id`. Render an **Attachments** card below the quote document:
  - Per file: name, size, a **Download** button that hits the gated route (5c / Phase 6).
  - A **Download all** action (sequential per-file links is fine for v1; zip is a follow-up).
- **`app/orders/[token]/page.tsx`**: mirror with `order_id`.
- **Standalone file page** — new route `app/file/[token]/page.tsx`: resolves `message_attachments` by `access_token`, renders file name + (image preview if `mime_type` is an image) + Download button. This is the target of the auto-message link button.

### 5c. Email/auto-message link button copy
- The send pipeline (Phase 6) injects the appropriate URL into the rendered email:
  - quote send → existing accept URL (attachments already visible on that page; no new button strictly required, but add an explicit "View attachments" anchor for clarity).
  - order send → existing order URL.
  - standalone auto-message → `…/file/<access_token>` with a "Download file" button.

---

## PHASE 6 — Send wiring + gated download route (security-critical, Opus, Gerald gate)

### 6a. ID-only selection on the send input (Gerald H-03 #1)
Add to `SendOutboundMessageInput`:
```ts
attachmentSelection?: {
  libraryAttachmentIds?: string[];
  quoteFileIds?: string[];
};
```
**Never** put raw storage paths on this long-lived input.

### 6b. Server-only resolver (Gerald H-03 #2) — `app/lib/messages/attachmentResolver.ts` (`import 'server-only'`)
`resolveOutboundAttachments({ companyId, quoteId, orderId, libraryAttachmentIds, quoteFileIds })`:
- Query `company_attachments` where `id IN (...) AND company_id = companyId AND archived_at IS NULL`.
- Query `quote_files` where `id IN (...) AND quote_id = quoteId` (and verify that quote belongs to `companyId`).
- **Silently drop** any id that doesn't resolve — never trust the client list.
- For each resolved file, INSERT a `message_attachments` row (scoped to quote_id/order_id, or standalone w/ access_token). Return the created rows (incl. tokens for standalone).

### 6c. Wire into `sendOutboundMessage`
- After render, before `sendEmail`: if `input.attachmentSelection`, call the resolver, create `message_attachments` rows, and inject the correct **link URL(s)** into the email body / template render context. No MIME attachment. `await` everything (Vercel serverless — no fire-and-forget).

### 6d. Auto-message path (Shaun: "wire it")
- Acceptance / follow-up / decline auto-messages: resolve the **template's baked `attachment_id`** through the resolver (server-side, company-scoped), create the `message_attachments` row, inject the hosted link. The automated send has no per-use picker — it relies solely on the template default. (Confirm which auto-sends route through `sendOutboundMessage`; wire there.)

### 6e. Gated download route — `app/api/attachments/[token]/download/route.ts` (or `app/d/[token]/route.ts`)
**The surface Gerald scrutinizes hardest. POST or GET?** GET is needed (browser download link), so this is a **read-only, non-mutating** GET that:
1. Validates token format.
2. Resolves authorisation server-side via `createAdminClient()`:
   - quote/order context: token = the quote acceptance_token / order token; the requested file id must belong to a `message_attachments` row for that quote/order.
   - standalone: token = `message_attachments.access_token`.
3. Confirms the underlying file still exists + belongs to the resolving company.
4. Mints a **short-expiry signed URL** (`getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, path, 90)`) and 302-redirects to it (or streams the bytes). **Raw path never returned to client.**
5. Rate-limit (`consume_rate_limit`) — token-guessing defence. Fail-closed on the auth check; the download itself can fail-open on the limiter.

### 6f. buildEmailAttachments — leave unwired
Under Option B it is not used. Do not thread it into the hosted flow. (If a future true-attachment need arises, apply Gerald H-03 #4: companyId prefix assertion / module-private.)

---

## VERIFICATION GATE (MANDATORY before push)
1. `npx tsc --noEmit` clean.
2. `npm run build` passes.
3. Migrations applied + types regenerated (with Shaun approval).
4. Manual (with Shaun): template baked file → send a quote → accept page shows Attachments → Download mints a working short-lived URL → after expiry the URL dies. Repeat for order + standalone auto-message link.
5. 2-failed-fix rule: stop + report after 2 failed fixes on the same error.

## COMMIT & PUSH
- Phase-per-commit (5a/5b, 6) for clean history. Read `memory/CREDENTIALS.md` for git PAT before push. Push to `origin development`.

## OPEN QUESTIONS FOR SHAUN (confirm before/while building)
1. **Order files source:** orders have no `quote_files`. Is the order attachment source **library-only**, or is there an order-file table to include?
2. **Download all:** v1 = sequential per-file links acceptable, or do you want a real zip bundle? (Zip = follow-up; flagging now.)
3. **Standalone file page preview:** for image files, show an inline preview + Download; for non-images (PDF/doc), just name + Download. OK?
```
```
```

## GERALD RE-AUDIT NOTE
This brief's Phase 6 (gated download + resolver) is net-new public surface. Send the diff to Gerald with the Round-9 catalog fixes when requesting the `development → main` sign-off.
