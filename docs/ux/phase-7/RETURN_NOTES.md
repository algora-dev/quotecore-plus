# Phase 7 implemented return

Status: implemented source candidate; ready for integration and owner testing. Not deployed or runtime-approved here.

## Authority and baseline

Incoming archive `quotecore-plus-phase7-ux-handoff-2026-09-27.zip` (SHA-256 `055e7c83a36f2295e0bd78fa780a96019217ce405bfe2372bd60fe91b6e13d03`), baseline `01fc47e1`, branch `ux/phase-4`. Incoming `HANDOFF.md` REV 2 is preserved byte-for-byte. Owner approved the full Phase 7 plan, including two template destinations and the current orange-led design language. `DECISIONS.md` records implementation refinements required by actual source.

## Implemented

- Resources is a grouped hub, with only two primary template destinations. Document Templates combines four existing stores in a searchable/filterable library without changing their schemas, actions or identifiers. Its chooser explains quote header/footer versus quote structure, order details, and full invoice/payment templates.
- Message Templates provides named subject/body templates, a wording preview, purpose filter, existing merge-variable insertion, optional default attachment and the existing company-wide default. All current Send consumers still receive all saved company templates; General is the cross-document choice.
- All existing template fields remain in specialised, consistent editors. Old list URLs redirect to the appropriate unified view. Existing edit/create/save-from-quote routes remain valid. An explicit refresh after successful template saves/deletes updates the newly aggregated library; no polling refresh was added.
- Pricing Library/Smart Components, supplier portal/directory/library and Inbox use the shared C64/C63 presentation. Mobile actions are visible without hover; filters wrap; fields and native dialogs reflow; native supplier time fields stack at narrow widths.
- The shell adds an in-flow mobile return fallback on ordinary workspace routes. Explicit back links take precedence. Protected workspaces retain their owned exit/dirty-guard paths. Existing navigation state, mount ownership, edge tab and marks remain intact.
- P6 carryovers: Quotes error signal reaches the list; creation pickers distinguish exposed load failures from empty results; catalogue source load moved from render to a cancellation-safe effect; onboarding tutorial href corrected; supplied paywall plan prices drive presentation, and signup points to existing pricing instead of duplicating amounts.

## Important source findings

Invoice templates already support full header/footer, bank/payment link, notes and terms; they are not merely payment profiles. Quote structures are estimating presets, not customer-document line templates. Message purpose values are `quote_send`, `order_send`, `followup`, `decline_response`, `custom`; there is no invoice/all enum. The previous conceptual brief is corrected by these facts without database changes.

Inbox is an existing alert/message index, not a chat composer. This return does not invent replies, conversations, an invoice-layout engine, or unavailable duplicate/copy functionality.

## Verification

Read `VALIDATION.md`, reports and the 65-route audit. Static specimens use implemented views with invented test data; effects, saves, uploads, auth, checkout and backend actions are not executed. They are not live application screenshots. No broad app-runtime claim is made.

## Integration

Start with `INTEGRATION.md`, use `FILE_CHANGES.json`, compare protected hashes, then run Gavin's normal complete release gates. Read `AGENT_TODOS.md` before deciding what remaining behaviour needs a separately owned correction. Do not use older Phase 6 or incoming Phase 7 notes as a completed-implementation manifest.
