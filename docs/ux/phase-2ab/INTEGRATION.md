# Gavin: integrate Phase 2A + 2B only

## Read and baseline

Read root AGENT_BRIEF.md, DATABASE_AND_SERVICES.md and RETURN_NOTES.md, then INTEGRATION_UPDATE.md. Owner explicitly expanded Phase 2 to Global shell + Home + genuine Job Space. Current baseline is the integrated Phase 1 ZIP dated 24 September (Gavin notes commit a306a0cd). The rejected earlier Phase 2 ZIP is NOT an input. Do not stack these two Phase 2 returns.

The new UI standard is 2.2. Keep Phase 1 builder controls and workflow; later Guided mode is deferred. This code return retains all original files. Old WorkspaceNav/MobileHeader and Phase 1 docs are preserved, but the workspace layout now uses QcAppShell.

## Before opening the preview

The data brief states preview and production may share one database. A preview URL is not isolation. Use separate nonproduction credentials, storage, auth callbacks, email sinks, payments, cron/follow-ups, Xero/QBO and other integrations. Verify that actions cannot contact real customers. This source's Summary may persist an original snapshot on first visit; takeoff also has first-open work. A browse-only review is not guaranteed read-only. Do not run it against customer data.

## Apply the coherent change set

1. Create/use the isolated UX branch from current integrated main, and pin a recoverable baseline. Reconcile newer mobile/agent changes first.
2. Read FILE_CHANGE_NOTES.md and CHANGED_FILES.json. Integrate the complete set of shared shell + summary components/CSS together. Do not overwrite the live repo or copy individual screenshot-styled files without their imports.
3. Resolve HOME-01 and JOB-01 using DATA_CONTRACTS.md or explicitly retain the honest not-wired placeholders for the first visual checkpoint. Full hub-data acceptance needs those bindings. No public API/schema change is authorised by this UI handoff.
4. Use the project's existing dependency lockfile and commands. No new dependencies or configuration are supplied. Run full typecheck, lint/build, smoke and relevant e2e tests in the complete environment.
5. Compare protected-file and source changes against the input baseline. Never silently relax guards to make a UI test pass. Record any necessary corrective code separately and explain its scope.
6. Work through CAPABILITY_PARITY.csv and PARITY_CHECKLIST.md. Capture the running desktop and phone states, not only our static reference.
7. Publish to safe preview, request Shaun's approval, fix phase findings there, then return a new integrated ZIP as the next phase baseline. Stop before Phase 3.

## Mandatory regression gates

- Timed refresh: after >90 seconds on each builder step and Job Space section, expanded cards/notes/upload drafts/menus must not reset; Review must not jump to Extras. Existing AlertBell scoped-polling and QuoteBuilderV2Wrapper fixes are hash-identical.
- Shell: expanded/rail/hidden, route defaults/restore, mobile sheet, keyboard focus, changing account/plan, sticky notices and open Help drawer. No duplicate polling subscribers or notification controls.
- Takeoff: only shell changes here. Desktop zoom/pan, pointer calibration and area/line accuracy must survive entering/leaving rail/hidden modes. Test shipped mobile one-panel/dirty-exit/pitch/save flow unchanged.
- Documents: actual internal/customer/labour PDFs and tax/rounding values versus pinned baseline; download while each correct tab is visible; long document overflow confined. Do not infer PDF parity from HTML fixture.
- Workflows: sends/tests/attachments/expiry/reopen/withdraw/duplicate/accounting export, quote revision requests, schedule edit/delete, uploads/storage limits, notes and all deep links.
- Other consumers: Orders and Invoices ActivityCardClient legacy presentation, all legacy pages inside new shell, all plan/assistant/supplier gates.

## Questions/issues to keep visible

P2AB-01 HOME-01 and JOB-01 bindings need Gavin's scoped data wiring.
P2AB-02 Original snapshot currently has historical totals but some current measurement/component presentation; preserve the inherited policy and have owner compare. Do not claim a fully historical record.
P2AB-03 Embedded customer/labour previews use the existing tax-rate calculation while other full-preview paths may use richer tax lines. Preserved, not reconciled here.
P2AB-04 Legacy canvas-file paths and storage deletion need existing G03 owner retest; do not remove files to simplify UI.
P2AB-05 Native QcDialog mobile menu, existing custom SendDocument modals, Help drawer and assistant layering need real browser keyboard/stack tests.
G01 locked failed-margin-save/confirmation behaviour remains unchanged; G02/G03/G05 pending retests remain on Gavin's existing list.

Static parser and source-invariant checks are not a passed application build. No application commands, credentials or live services were used by the UX agent.
