# Acceptance checklist | do not tick from screenshots alone

## Required browser fixtures

Test a new draft, a standard/blank quote, a confirmed manual quote, a digital-populated quote, a quote without customer document, one with customer/labour documents, sent/viewed/accepted/declined/withdrawn/expired states, unresolved revisions, scheduled and sent messages, multi-currency and multi-tax records, large names/files/notes, low-plan users, supplier users, Assistant flag on/off, and an impersonated account. Use disposable nonproduction records only.

## Shell and Home

- [ ] 390/768/1024/1440/1920 widths; expanded/rail/hidden; label and focus visibility.
- [ ] Route-specific editor/takeoff defaults do not overwrite normal preference.
- [ ] Close/reopen mobile navigation; focus containment/restoration; backdrop does not dismiss.
- [ ] All destinations, required notices, account/logout, Help, Inbox and bell exist and preserve gating.
- [ ] Exactly one bell poller/inbox instance; >90-second state regression.
- [ ] Welcome, signup/calculator imports, saved doc and takeoff draft restoration still fire correctly.
- [ ] New quote cap, measurement modes and unit/default collection selection unchanged.
- [ ] HOME-01 when wired: correct tenant rows, draft destinations, no fake fallback rows.

## Job Space

- [ ] Overview is default; full costing document is not on the landing hub.
- [ ] Revision attention state takes priority; accepted/declined/withdrawn copy does not invent a mandatory next stage.
- [ ] Customer document create/view/edit and labour create/view/edit are present.
- [ ] Current/Original is discoverable in Costing summary; amounts match baseline.
- [ ] `from=inbox`, deep links `tab=customer/labor/files/activity/summary`, back/forward, send-to-customer-tab event.
- [ ] Notes, uploads and communication state survive tab changes and polling.
- [ ] Actual customer/internal/labour PDF export from the correct visible section, long documents, logo and fonts.
- [ ] All original send/test/share/expiry/withdraw/reopen/duplicate/export behaviour.
- [ ] File download/delete/upload, legacy canvas paths, storage-limit and failure states.
- [ ] Revisions, follow-up edit/delete/send controls and bounded message history.
- [ ] JOB-01 when wired: multiple related orders/invoices, no cross-company matches, errors not empty data.
- [ ] Existing order layout choices/column hint/line selector and invoice customer-line selector.
- [ ] Orders/Invoices ActivityCardClient consumers still use the legacy branch.
- [ ] Admin audit remains admin-only. Internal values do not leak into customer PDFs/emails.

## Interaction and mechanics

- [ ] Every enabled custom button/link/tab/row has visible pointer hover and keyboard focus; cursor-only is not enough.
- [ ] Focus remains visible under hover; pressed and pending/disabled states; no control jump/scale.
- [ ] Body/stacking/focus of native menu and existing send/export dialogs with Help or Assistant open.
- [ ] Actual desktop canvas coordinates/calibration after sidebar resize; no state or zoom reset.
- [ ] Shipped mobile takeoff dirty/pitch/AI/component/save flow, canvas visibility and one-panel invariant unchanged.

## Release gate

- [ ] Full typecheck/build/lint/smoke/e2e and targeted parity tests logged by Gavin.
- [ ] Safe preview owner approval and before/after screenshots attached to ledger.
- [ ] New integrated archive saved before beginning another phase; production merge/rollback planned separately.
