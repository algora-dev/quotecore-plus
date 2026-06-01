# Attachments — Post-Smoke-Test Fixes (Shaun, 2026-06-01)

**Status:** PLANNED, not started. Branch `development`. Phases 4/5/6 already shipped + verified (`9993e5b` P5, `11340e6` P6, `0f38fc4` P4).
**Shell:** PowerShell — `;` not `&&`; `-LiteralPath` for `[token]`/`[workspaceSlug]` dirs.
**Model:** #4 (page state) + #3b (download disposition) = judgment → Opus. #1/#2/#3a/#3c/#5 = UI/copy, can drop to Sonnet.
**No emojis in app/UI/copy — SVG icons only.**

These are Shaun's findings after smoke-testing Phases 5/6. Confirmed understanding below.

---

## FIX #1 — Attachment picker: dropdown + tickboxes (not flat checkbox list)
- **Why:** flat list grows long → ugly UX.
- **Where:** `app/components/attachments/AttachmentSendPicker.tsx`.
- **What:** collapse the file list into a dropdown/popover; tickbox list lives inside. Show a summary (e.g. "2 files attached") on the closed control. Keep IDs-only props (no storage_path) — unchanged from Phase 6.
- **Scope:** pure frontend. Sonnet-able.
- **Gerald:** no.

## FIX #2 — Order email copy: drop "Material"
- **Why:** recipient sees "Material Order ON-1000"; should be "Order ON-1000".
- **Where:** order email template defaults + any hardcoded order send strings. Check: `app/(auth)/[workspaceSlug]/resources/EmailTemplateEditor.tsx` (DEFAULT_BODY_BY_KIND.order_send + subject), `app/lib/messages/send.ts` order render, order template seed/defaults, `material-orders` send path. Grep `Material Order` across app + lib.
- **What:** "Material Order {{order_number}}" → "Order {{order_number}}" everywhere recipient-facing. Internal labels (app nav "Material Orders") UNCHANGED — recipient-facing copy only.
- **Scope:** copy. Sonnet-able. **Verify** no merge-var breakage.
- **Gerald:** no.

## FIX #3 — Download UX (three sub-issues)

### 3a — "Download all" broken
- Diagnose first (subagent built it; behaviour unconfirmed). Likely the sequential-link trigger (anchor click loop / popup-blocked). Fix to reliably trigger each per-file download in sequence.

### 3b — Individual "Download" opens in browser instead of saving to device  🔴 GERALD SURFACE
- **Cause:** the gated route 302-redirects to a Supabase signed URL; browsers inline-render PDFs/images.
- **Fix options:**
  - (a) Add `&download=<filename>` to the Supabase signed URL (Supabase supports a download param on createSignedUrl via `{ download: filename }` option) — keeps the 302 redirect, no byte streaming. **PREFERRED — minimal change to the security surface.**
  - (b) Stream bytes through the route with `Content-Disposition: attachment; filename="..."`. More control but the route now proxies file bytes (more load, changes the route's behaviour materially).
- **Decision:** try (a) first (`getSignedUrl` helper gains an optional `downloadName`). If Supabase's download option is unreliable, fall back to (b).
- **Where:** `app/lib/storage/helpers.ts` (getSignedUrl downloadName param), `app/api/attachments/[token]/download/route.ts`.
- **Gerald:** YES — this changes the Phase 6 gated-download route. Flag in the re-audit note. Auth model UNCHANGED (still token→scope→company→signed URL); only the disposition changes.

### 3c — Unify the quote/order doc download into the attachments list + View/Download split
- **Why:** the existing quote/order PDF download button sits separately from the attachments; Shaun wants one clear place.
- **What:** on the public page, render ONE "Files" list containing: (1) the quote/order document itself, then (2) each attachment. Each row gets TWO actions:
  - **View** — opens in browser (current behaviour / inline).
  - **Download** — forces save-to-device (the 3b mechanism).
- **Where:** `app/accept/[token]/page.tsx` (+ its `DownloadQuoteButton` / secondaryAction wiring), `app/orders/[token]/page.tsx`, and the attachments rendering added in Phase 5b. Build a shared `PublicFileList.tsx` if clean.
- **Note:** the quote/order DOC download currently uses client-side print/PDF (`DownloadQuoteButton` printTargetId). View=current print-preview behaviour; Download for the doc = same generator but force-save. Attachments View/Download both go through the gated route (View = inline disposition, Download = attachment disposition — same route, a `disposition` query param or two link variants).
- **Gerald:** the attachment View/Download both use the gated route → covered by the 3b note. Doc download is client-side, not Gerald's surface.

## FIX #4 — Persistent post-decision quote/order page  🔴 BIGGEST ITEM
- **Why:** once accepted/declined, the token URL short-circuits to a status-only card (`app/accept/[token]/page.tsx:125` `if (quote.accepted_at || quote.declined_at) return <status card>`). So attachments sent by follow-up/auto-fire messages (which link to the SAME token URL) are unreachable. Same pattern on the order page.
- **Confirmed:** NO schema change. `message_attachments` already accumulates multiple rows per quote/order; `listAttachmentsForToken` already returns all of them. This is page-render logic only.
- **What (the new behaviour):**
  1. REMOVE the `accepted_at || declined_at` early return. ALWAYS render the original quote/order document.
  2. Add a **status banner** at the top when decided: "You accepted this quote on {date}" / "You declined this quote on {date}" (Shaun confirmed he wants the banner so the disabled buttons make sense).
  3. Accept + Decline buttons → **disabled** when `accepted_at || declined_at` set. **Request changes stays LIVE** (custom return messages still allowed post-decision).
  4. The **attachments / files section is ALWAYS present** below the document, listing every `message_attachments` row for this quote/order — original + any added later by follow-up/auto messages.
  5. Mirror ALL of the above on `app/orders/[token]/page.tsx`.
- **Flow Shaun described (acceptance criteria):**
  - Send → customer opens URL → sees quote + LIVE accept/decline/request + attachments (view/download).
  - Customer accepts + downloads attachments.
  - Accept-trigger auto-message fires, carries its own attachment(s), links to the SAME URL.
  - Customer clicks through → SAME quote page → status banner shows "accepted", accept/decline DISABLED, request LIVE, and the NEW attachment now appears in the files section.
- **Where:** `app/accept/[token]/page.tsx`, `app/orders/[token]/page.tsx`, the decision-button component (whatever renders accept/decline/request — find it; brief showed a `secondaryAction` pattern), Phase-5b attachments section.
- **Watch:** the decision buttons likely live in a client component with their own server actions — ensure the disabled state is driven by the server-fetched `accepted_at/declined_at`, not just client state. Request-changes action must remain callable post-decision (check its server action doesn't reject on already-decided).
- **Gerald:** changes WHAT the public page renders, not the auth model. Courtesy note only — not an auth change.

## FIX #5 — Catalog-line "Units" toggle doesn't hide Description/Quantity column
- **Why:** in CustomerQuoteEditor, catalog-added lines: the show/hide "Units" toggle doesn't hide the qty/units portion the way it does for component-driven lines.
- **Action:** SCOPE FIRST — read how component lines honour the units toggle vs how catalog lines compose their text (catalog lines use `composeLineText` joining description + quantity with " — "). Likely the catalog line stores the combined text and has no separate units field to toggle. If it's a cheap conditional on render, do it; if it needs a data-model change to separate desc/qty, report cost to Shaun and let him decide. **Report effort, don't assume.**
- **Gerald:** no.

---

## SEQUENCING
1. Quick wins, no Gerald dep: #2 (copy), #1 (dropdown), #3a (download-all fix), #3c (unified View/Download list).
2. #3b (force-download) — build, FLAG to Gerald (Phase-6 route change, auth unchanged).
3. #4 (persistent post-decision page) — biggest; careful on button-state-from-server + request-stays-live. Courtesy note to Gerald.
4. #5 — scope + report effort; fold in if cheap.

## VERIFICATION GATE (every push)
- `npx tsc --noEmit` exit 0; `npm run build` passes (116-ish pages).
- Manual with Shaun: decided quote still shows doc + banner + disabled accept/decline + live request + accumulated attachments; download forces save; order email reads "Order ON-…".

## GERALD
Bundle for re-audit with the Round-9 catalog fixes (still pending his correct-HEAD re-audit):
- #3b: gated-download route now sets download disposition (auth model unchanged).
- #4 (courtesy): public token page no longer short-circuits post-decision; renders doc + attachments always. No auth change.
