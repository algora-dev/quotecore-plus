# Message Center — Next Session Handoff (Phase 3+4 + breadcrumb fix)

> Written 2026-06-09 by Gavin at end of session. All of Phase 1+2 is SHIPPED to
> `development` (HEAD `aa35a76`). Tree clean. This file = the next build chunk,
> to land as **ONE commit** (Shaun asked to batch the breadcrumb fix with the
> status work).

## Status of prior work (DONE, do not redo)
- Inbox expand-in-place accordion + multi-entity bell routing — `145cb8a`.
- Order Open 404 fix (links to `/material-orders/<id>/preview`) + Open/To-Do/Done
  tooltips — `aa35a76`.
- Legacy alert FK backfilled (order ON-1022). Every alert in DB now linkable.

## THIS CHUNK — locked decisions from Shaun (2026-06-09)

### 1. Breadcrumb "Back" fix (batch into this commit)
- When a user opens an invoice/order/quote **from the Message Center**, the
  "Back" breadcrumb currently sends them to the main list page. It should send
  them back to **the inbox** instead.
- Approach: add `?from=inbox` to the Open links in `InboxList.tsx` `openHref`
  (and optionally the bell). Destination pages' breadcrumb reads the param and
  sets back target to `/<ws>/inbox` when present; otherwise unchanged.
- Files: inbox `openHref` (and `AlertBell.hrefFor`), plus the breadcrumb
  component on quote summary / invoice detail / order preview pages.

### 2. Recipient-driven statuses — surface ONLY on main list pages
- **CRITICAL SCOPE:** statuses appear ONLY in the existing **Status column** on
  the main **Quotes / Orders / Invoices list pages** — exactly where Status
  already lives. **NOT** in the Message Center / inbox UI at all.
- **"Read"** status: flips on the quote/order/invoice itself when the
  *recipient* first opens the public link (`/accept/[token]`, `/orders/[token]`,
  `/invoice/[token]`). MUST be stored separately from the alert `is_read` column
  (which means "the owner read the alert") — do not conflate; mixing corrupts
  the unread badge. Use a `viewed_at` / status value on the item row.
- **"Action needed"** status: fires on EXACTLY two events — **dispute opened**
  OR **change requested (from an order or quote)**. Nothing else (no
  request-info-as-separate, no revision-as-separate beyond change-requested).
- Stamping must be GET-on-mutate-safe (server action / POST, not a bare GET a
  scanner could trigger). See MEMORY "GET-on-mutate is a class of bug".

### 3. Invoices Status column upgrade (part of this chunk)
- The Invoices main list Status column must be upgraded to the **dropdown-style
  Status** version that the **Orders and Quotes** main lists already use, so all
  three match. Look at the orders/quotes list Status column for the exact
  pattern; replicate it on invoices. (Follow AGENTS.md UI patterns — rounded-full
  badges, dropdown component already in use elsewhere.)

### 4. Settings section in Message Center
- New Settings section/tab in `/<ws>/inbox`.
- ONE persisted, company-level preference for now:
  **"Notify me when recipients open (Read)."**
- Behaviour: the **status always updates** regardless of the toggle. The toggle
  ONLY controls whether a *Read* alert is created. The other events
  (accept/decline/dispute/change-requested) already alert by default — leave them.

## DB notes
- Likely need: status enum value(s) or `viewed_at` columns on quotes/orders/
  invoices where missing; a company-level `notify_on_recipient_view` pref.
- Migrations are pre-authorized (MEMORY STANDING PERMISSIONS). Additive/nullable
  only; one DB serves dev+main so safe. Regen types after.
- Verify each table's current status enum BEFORE adding values — orders/quotes
  already have status systems; check what "viewed"/"action needed" map onto.

## Build discipline
- `next build` must pass before commit. ONE commit for the whole chunk.
- Push to `development` (pre-authorized). Do NOT merge to main.
- Add a smoke-test line to `docs/smoke-tests/CHECKLIST.md` (use the `edit` tool,
  NEVER `Set-Content -NoNewline` — it corrupts the non-ASCII in that file).
