# Runtime acceptance checklist (Gavin + owner)

Source/static tests do not complete these gates. Use approved non-production fixtures and your normal safe test accounts. No real customer mail, invoice payment, recovery lockout or destructive production test is authorised by this checklist.

## Integration

- [ ] Merge against exact source ZIP, not a previous phase return; preserve later agent changes.
- [ ] Full TypeScript, changed-file lint and Next build succeed with real dependencies. Review React hook rules without restructuring unrelated working code.
- [ ] Confirm CSS imports resolve and C66 inherits integrated v2 tokens on every list.
- [ ] Protected files/invariants unchanged, except deliberately merged newer Gavin changes documented separately.

## Bulk lists

- [ ] Each of Quotes, Orders, Invoices: select1/multiple/max25; cap remains; hidden selections behave as before.
- [ ] Full export, partial export, zero success, provider rejection, ZIP compression failure and browser download blocking. Check all visible failures and actual counts.
- [ ] Quote begin-audit failure stops; post-download audit failure says check download; audit payload/ownership unchanged.
- [ ] Result persists until dismissed/next operation, never vanishes via timeout. Disclose long error names and scroll details by keyboard/touch.
- [ ] Delete Cancel invokes no action. Confirm invokes once, respects pending. Partial/skipped results clearly distinguished; failures retain selection for retry.
- [ ] Delete final order: empty list still shows outcome.
- [ ] Invoice sent/non-draft entries are not bulk-deleted; existing local refresh/reconciliation and cancel behavior retained.
- [ ] Status failure keeps previous displayed state and announces error; all current statuses retained. Escape returns to trigger; row navigation is not triggered by status/action clicks.
- [ ] Destructive row controls reachable without hover and have visible focus/pressed states.

## New Quote

- [ ] Customer blank/whitespace, mode absent, Digital without plan: no create call; correct inline guidance/focus. Original disabled condition still applies.
- [ ] Keyboard native required-input event and blur error behave without duplicate browser popup; entered values persist.
- [ ] Component, Digital, Standard paths still reach their exact existing destinations with templates/measurement system unchanged.
- [ ] Test Generic Trades flag off and on; every existing industry and selected component collection retains correct payload. Phone selects stack; no functionality replaced.
- [ ] Original cap/subscription/feature/storage upgrade states win over ordinary form errors; typed server failure is shown.
- [ ] Image10MB/PDF50MB limits, PDF page choice/cancellation, signed upload and quote handoff unchanged.

## Templates, catalogue, components, suppliers, security

- [ ] Name missing is local; empty quote structure asks before save; cancel preserves draft; acknowledge errors before caller continues.
- [ ] Create/edit/delete/apply/default/logo operations retain exact template names/fields. Current copy-existing Quote Header works.
- [ ] Nested message/manager dialogs retain correct stacking/focus. Library remains fresh after create/edit/delete.
- [ ] Coverage inputs, decimals/waste and duplicate-image validation appear in current component form; calculation outputs unchanged.
- [ ] Catalogue 190px Actions column and row actions unchanged; supplier rename/delete/geolocation errors use native shared feedback, not browser alerts.
- [ ] Recovery delete cancel does nothing; successful provider behavior and P8-SECURITY-01 failure handling checked by Gavin. MFA toggles/enrolment/removal retain guards and confirmation ordering.
- [ ] Legacy Resources URL redirects with correct workspace; direct active template links still work.
- [ ] Order-from-Quote still shows all previously eligible non-draft statuses, never drafts.

## Interaction quality and regressions

- [ ] Desktop1440, phone390, compact320 and landscape; large text/zoom; no clipped actions or page-wide overflow in real shell.
- [ ] Keyboard-only completion, focus returns to surviving trigger/main heading, no focus left inside dismissed result.
- [ ] Screen reader announces one useful result and associated field errors; live region timing does not double-announce excessively.
- [ ] Forced colors/reduced motion, safe areas/soft keyboard, nested dialog Escape/backdrop/pending; no hidden primary action.
- [ ] Smoke protected Takeoff, mobile Takeoff, Builder, Document Studio and Smart Assistant for accidental remount/style leakage. No refresh polling introduced.
- [ ] Owner approves actual preview application. Static gallery is not deployment evidence.
