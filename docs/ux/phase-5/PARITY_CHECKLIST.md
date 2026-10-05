> Historical first Phase 5 style pass. Superseded by `../phase-5-final/README.md`; its tests and behavior descriptions are not final-pass evidence.

# Runtime checklist — not executed in this environment

## Shared editor and responsive controls

- [ ] Build, full typecheck and lint with the locked Next/React/dependency versions.
- [ ] 1440/1280/1024/800 widths and narrow phone fallback; expanded/hidden shell, Help Drawer, notices, 200% zoom, long names, large amounts. No page-wide overflow, unreachable actions or clipped overlays. Preview may scroll internally; do not scale its numeric content with CSS transforms.
- [ ] One editor/preview tree, stable state while resizing. Hide/reopen removes controls from tab order without losing edits; focus lands on Show editing panel / Hide as appropriate. No new page refresh/remount.
- [ ] Keyboard, visible hover/focus/pressed, disabled/pending, reduced motion/transparency and forced colours. Native file upload is reachable by keyboard. Drawing search supports keyboard opening, typing and native option activation; Escape/outside-click policy stays its owner’s existing contract.
- [ ] Every original copilot/assistant target remains reachable. Invoice tabs must be activated before tab-specific targets; other sections are not collapsed behind an extra navigation layer.
- [ ] Native confirmations/type-picker/full-size preview and legacy nested add/catalog/AI/header/payment dialogs: focus, Enter, Escape, close, pending, stacking, scrolling and returning to the trigger. C56 alone does not provide focus containment for a legacy overlay.

## Customer Quote (also Labour Sheet)

- [ ] Existing digital/manual/blank/generic quotes hydrate; roof groups, extras and missing-component recovery are present. Custom/component/catalog additions and AI image/PDF/text import retain contracts and billing/error guards.
- [ ] Edit a line through its preview pencil; text/description, numeric quantity, unit price, custom base cost, show-price and per-line material/labour margins preserve before/after totals. Reorder/remove confirmation works globally across groups.
- [ ] Show, Price, Units and In total stay independent under their existing disabled rules, including hidden-but-totalled lines. Quantity column, hide line prices, hide totals, margin breakdown and full-size preview display the same choices.
- [ ] Header/footer/logo, apply/save branding template, tax audience/default selection/custom tax/rate/reset and margin apply-save warning remain. Reset taxes still uses its existing owned refresh; no polling was added.
- [ ] Save success, margin-warning cancel/continue, failed save, retry and return destination. P5-SAVE-01 is an existing required owned fix, not asserted passing.
- [ ] Labour-sheet custom editor/preview title, includeMargins=false, custom save action and taxAudience=labor are not converted into customer pricing behavior.

## Invoice

- [ ] Hydrate blank/quote-derived invoices; add custom/catalog/component and AI imports; inline edit, reorder, remove, visibility/quantity/price/in-total flags. Dates, notes, terms, branding and references unchanged.
- [ ] Existing 2-second autosave, manual save-and-return and failure/retry. Verify price-visibility flag persistence in the real app. Header never says a separately dirty payment block is saved.
- [ ] Edit and explicitly save each payment field; test general save/back/send before payment save (P5-PAY-01). Payment details/note/link appear correctly in preview/export after persistence.
- [ ] Draft/sent/viewed/payment-reported/paid/disputed/cancelled: correct send/reset/cancel/confirm-payment/read-only guards. Customer link marks draft sent as before; public link/status tracking remain correct. Inbox-origin back link preserved.
- [ ] Send test-tip, compose/link/share, templates, entitlements, attachments, follow-ups and errors stay in the existing SendDocumentButton controller. No implicit save barrier was added.
- [ ] Exactly one [data-pdf-content]; PDF captures only InvoicePreview, not toolbar/activity. Compare long/multi-page notes, lines, logo, payment details, tax/source amounts and visibility with baseline. P5-TAX-01 remains owned work.

## Orders — both families and both visual columns

- [ ] Up-front picker gives Line-by-line and Visual; new Visual starts single. Existing single/double/line_by_line links/orders load their original saved format. Family cannot be converted; one/two columns remains mutable and is retained after save/reload.
- [ ] Quote-derived and blank creation, selected-component filtering, one-time hydration, saved edit, source measurement system and currency unchanged.
- [ ] Supplier/reference/type/colour/date/delivery address/notes/company/contact/logo/header template/minimise/expand. Required reference guard and over-storage/upload error paths retain their old outcomes.
- [ ] Line-by-line: add/edit/import/reorder/remove, quantity/description/prices, include-in-total vs visibility, all-pricing/fine visibility controls, footer, default/custom taxes. Items-only live preview is not mistaken for full saved header; saved/public/PDF/order output parity checked.
- [ ] Visual: library/manual/catalog item; Single Item, Linear, Area, Volume; metric/imperial options; lengths and multipliers; variables; L×W or L×W×D detail; fixed purchased quantity vs measurement total; descriptions/notes; angle calculator; every existing validation.
- [ ] Drawing/image association, linked/all/search/none, image/name/measurements visibility, per-item collapse, edit, reorder and remove confirmation. Uploaded drawings and historical image URLs still render on single and double previews and saved outputs.
- [ ] Save pending/failure/retry, cancel navigation, existing order preview and reload. No prices introduced to visual component cards. PDF/email/public order renderers remain the owned original implementation.

## Cross-area protection

- [ ] Smoke check Gavin's current Takeoff/mobile/Smart Assistant work; this return must not replace files outside FILE_CHANGES. Keep /q-mark.png, single orange edge tab, Quotes/Drafts and notification refresh fix.
- [ ] Owner reviews all formats together, then Gavin supplies a newer integrated baseline. No automatic Phase 6 work.
