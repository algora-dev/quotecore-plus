# QuoteCore+ — Phase 6 implementation proposal

**Prepared:** 27 September 2026  
**Status:** source-audited proposal; not an implementation return. No application files changed.  
**Owner:** Shaun. **Integration owner:** Gavin.

## 1. Recommendation

Proceed with **Phase 6 — Finish the everyday journeys**: a coordinated pass across the remaining lists, connecting dialogs, catalogue acquisition, uploads, account settings and sign-in/subscription journey. Keep the established navigation and business workflows. Improve hierarchy, discoverability, feedback and responsive presentation around them.

One owner-review phase is appropriate, implemented in three controlled groups. No further Takeoff, pricing or Document Studio architecture work needs to precede it. The design-system conflict in section 3 needs approval before implementation; the order-status discrepancy needs Gavin's contract check before editing those controls.

This is not a promise to redesign every remaining page in the repository. It is a bounded completion pass through the six journeys in the Phase 6 handoff, including their reachable dialogs and supporting upload controls.

## 2. Baseline and audit limits

The authoritative input is `quotecore-plus-phase6-ux-handoff-2026-09-27.zip`. Its handoff identifies commit `4106026a`, branch `ux/phase-4`; the export has no `.git` history, so that identity is supplied provenance, not independently verified Git history. The archive SHA-256 is:

`3dd0d92e8b0e2010e90b527c82fee5983c9c56e65d088e788b190e4dcc5eeb75`

The extracted export contains 2,797 files within `quotecore-plus/`, plus the outer start note. Byte comparisons found no missing, modified or additional files in the extracted tree. The proposal and provenance record are outside that tree.

Read order: outer `START_HERE_UX_PHASE6.md`; root agent/UX/parallel-lane notes; `docs/ux/phase-6/HANDOFF.md`; `docs/DESIGN_SYSTEM.md`; relevant prior integration notes and integrated components; current UX-standard v2.6 reference. The root `RETURN_NOTES.md` belongs to Smart Assistant P1.7, not this UX phase. Historical Phase 5 return notes are not evidence that Phase 5 is still unintegrated. [S01]

This was a **static source and dependency audit**, not a deployed-browser inspection. It covered the target route components, shared dialogs, upload handlers, relevant server read/write contracts and surrounding entry/exit paths. It is not a claim to have exercised every runtime branch. No installation, TypeScript check, Next build, authentication, email send, payment or production-data write was performed for this proposal.

## 3. Decisions and discrepancies

### P6-D01 — Owner approval needed: which visual standard governs the migration?

The latest Phase 6 brief explicitly requires the older `docs/DESIGN_SYSTEM.md` patterns: black primary buttons, all buttons pill-shaped, orange secondary accents. The integrated v2 controls instead define 12px control corners, an orange-gradient primary and a near-black secondary. Job Spaces—the brief's named reference—already uses those v2 controls. These are materially different instructions, not interchangeable descriptions of one style. [S02–S04]

**Recommendation:** extend the approved newer design used by Job Spaces and Document Studio to Phase 6. Reuse the current integrated primitives, retaining Gavin's fixes; do not copy an earlier standard ZIP over production components. Update the conflicting design notes so future agents have one clear authority. This recommendation requires Shaun's approval because the latest handoff expressly calls its alternative rules mandatory.

This is not a proposal to change the palette again or make everything orange. Primary/secondary hierarchy, focus feedback and component shape should follow the approved shared system consistently.

### P6-I01 — Gavin contract check: orders have more states than the brief lists

The brief lists `ready | ordered`. The actual order status menu **and server action allowlist** also contain `delivered`, `paid`, `pickup` and `waiting`. Preserve existing capabilities; do not remove those four options as a visual simplification or expand the backend under this phase. Gavin should reconcile the documented contract before that control is changed. Database acceptance of each value has not been runtime-tested here. [S05]

### P6-I02 — List completeness and failures must not be invented by the UI

Orders currently load the latest **20** records and are labelled “Recent Orders.” There is no existing complete-history search in that list. A restyle must not present it as a comprehensive order browser or add a search that silently implies it searches older records. Complete history/pagination would require a separate Gavin-owned data change. [S05]

Some loaders convert failures to empty arrays. The Quotes loader retains an error object but does not currently pass it to `QuotesList`; Job Spaces does receive failure/count context. The invoice-creation quote/template pickers also swallow failed requests into empty lists. Use genuine available loading/error states; where the UI lacks the necessary signal, record `AGENT-TODO` for the owner of that data contract rather than fabricate a reassuring empty or success state. [S06, S09]

## 4. Group A — Work lists and the steps between documents

### Lists: Quotes, Orders and Invoices

Use Job Spaces as the visual reference, not as a replacement data model. Establish a consistent page heading, primary creation action, supporting quota/status information, existing search/filter area, record rows and selection/action area.

On desktop, make identity, status and actions easy to scan. On phones, reorganise each row into readable labelled information rather than shrinking the desktop grid. Opening a record must be keyboard-accessible without making a checkbox, status picker or overflow action accidentally open the record. Do not add filters/sorting that the existing surface does not support merely to make all headers identical.

**Parity requirements:**

- Quotes keeps its Confirmed/Drafts structure, creation entry points, existing search/sort/filtering and draft-versus-Job-Space destinations. Drafts do not move to Job Spaces. Quote lifecycle, job progress and recipient attention are distinct concepts; do not collapse their state sets.
- Orders keeps Custom, From Quote and template entry points, the two-family picker, supplier responses, editing/preview links and current recent-order scope. Visual Order's one/two-column switch stays inside its editor.
- Invoices retains search/filtering, public view/edit, draft deletion and non-draft cancellation rules. The owner-editable lifecycle options remain distinct from system-reported viewed/payment-reported/disputed states.
- Bulk selection caps, selected-item behavior, serial export/audit operations, partial-failure results and confirmation rules remain intact. No new dashboard financial calculations or cross-currency totals. [S05–S08]

### Create, choose, send, share and confirm

Audit each entry path as a journey rather than making a new dialog system per document:

- New Quote: existing manual/digital/blank paths, units/trade/library/template choices and guards.
- New Invoice: blank/template or from-quote paths, including its existing line-selection step.
- New Order: line-by-line or visual family, then the current quote/item selection where applicable.
- Send/share: recipient/message, attachment selection, URL/email modes where supported, existing send gate and optional follow-ups.
- Connecting lifecycle dialogs: withdraw/reopen quote, reset/mark-order, delete/cancel/confirm-payment, follow-up scheduling and external-app export presentation.

Use clear titles and button labels describing the actual consequence. Keep pending states visible, destructive actions explicit and errors adjacent to their cause. Reuse existing modal ownership and state; changing a dialog's layout must not clear a draft or move the point at which a token or document is created.

The send flow is **already shared** through `SendDocumentModal`, `useSendDocument` and per-entity configuration. Improve its presentation once, but preserve differences: Order does not expose every Quote/Invoice mode; attachment sources and token strategies differ; triggered follow-ups are not universally available. Sending, share-link generation, saving a template and exporting to accounting are separate actions—not interchangeable “Done” buttons. [S09–S11]

Already-migrated Phase 5 editor dialogs should remain as they are unless a specific inconsistency is demonstrated. The document workspace, line Apply gating and recipient renderers are not redesign targets.

## 5. Group B — Catalogue acquisition and consistent uploads

### Catalogue → usable components

This is the main opportunity for a real usability improvement beyond visual consistency. Two related operations currently exist and must stay distinct:

**Import catalogue:** choose CSV → name catalogue → preview/map columns → save catalogue.

**Create components from catalogue:** choose own/supplier catalogue → choose rows/map fields → choose or create destination library → create → actual result summary.

Make the current step, selected rows, destination and next action continuously clear. Label column mapping in plain language and use existing row values to show what the chosen fields mean. A read-only mapped sample must use the existing interpretation, not introduce a second pricing/parser implementation. Give dense tables deliberate scrolling on small screens and keep navigation reachable without obscuring the data.

Keep upload, replacement and conversion visibly different: replacing catalogue rows is not adding another catalogue, and uploading a catalogue does not automatically create all its components.

**Exact constraints retained:** CSV import's 35,000-row cap and 2,000-row batches; existing header detection/parser behavior; optional upload mapping; required component name mapping during conversion; field-length warnings; one source column mapped to multiple fields; conversion maximum of 20 selected rows; its existing first-20 default selection; source selection; destination library creation; success counts and “convert more” behavior. Make the 20-row selection obvious rather than silently changing its default. [S12–S14]

Preserve catalogue rename/remap/additional named maps, replace/archive/unarchive/delete and supplier-catalogue saving. Update the import entry and completion in the Components area without redesigning the large Smart Component/pricing form or supplier publication/subscription workflows.

### Uploads: one understandable appearance, separate existing transports

Reuse the existing v2 upload presentation where it fits. Standardise visible instructions, accepted file types/limits, selected filename, replacement choice, validation, pending state and completion/error feedback across library attachments, logos, relevant template media and drawing-library uploads. Existing plan/document upload callers get only scoped compatibility treatment; Takeoff itself remains protected. [S15–S17]

Do not force all files through one uploader implementation. Catalogue CSV import, signed document uploads, image/logo uploads and plan/PDF processing have different contracts. File type/size limits, storage entitlement checks, signed URL creation, storage scopes, metadata finalisation and PDF-page behavior stay with their existing owners.

Show actual progress only when supplied. A spinner with an honest activity label is preferable to a fabricated percentage. Do not add resume/cancel/retry guarantees unsupported by the upload controller. “Uploaded” must not be shown prematurely while the existing metadata save is still pending.

## 6. Group C — Account, sign-in and subscription presentation

### Account and settings

Keep the existing Account tabs and `?tab=` deep links. Improve the internal hierarchy of Account, Company, Security, Billing, Integrations and Support. Group company identity, measurement/currency defaults and pricing/tax defaults clearly, while retaining every existing field, submit boundary and validation rule. Do not imply settings have a different scope of effect from the current implementation. [S18]

Security includes password/email changes, MFA and recovery—not just a new password input. Keep existing OAuth/account restrictions, confirmation and recovery controls. Integrations keep current connect/disconnect behavior; Support keeps its ticket submission flow.

The disabled Team placeholder remains disabled. The Q Assistant tab and its contents are not a route into redesigning Smart Assistant. The shell, logo assets and navigation mechanics are untouched.

### Billing and paywall: shared content, different context

The paywall currently reuses `BillingPanel` wholesale. Retain one source for available plans, limits and checkout actions, but adapt **presentation context**: an existing customer needs current subscription, billing management and plan-change information; a not-yet-entitled customer needs a clear plan choice and explanation of how to unlock the workspace. [S19]

Do not conflate purchased versus effective plan, checkout-return messaging versus active entitlement, or subscription management versus starting a new checkout. Display current prices and limits from existing data. Keep plan-change confirmations, cancellation/recovery states, storage limits, larger-plan enquiry options and applicable commercial links.

Stripe handlers, entitlement logic, plan definitions and webhook timing are protected. No free trial, no new free workspace tier and no bypass of the paywall. Existing standalone free-tools links are not a free application tier and need not disappear.

### Login → signup → onboarding → paywall

Use a consistent focused-form treatment with clear next action and branch-appropriate progress. Preserve email/password, Google, email verification/resend, passwordless handoff, forgotten password and account recovery. Retain redirect/draft handoff parameters and existing confirmation/privacy-safe messaging. [S20–S21]

The onboarding branches are not identical: ordinary and Google/passwordless paths have different fields and stages. Apply consistent presentation without forcing them into a newly invented universal sequence. Optional recovery questions stay optional. Preserve preferences and existing completion/redirect semantics; the protected workspace gate continues to enforce payment before access.

## 7. Shared-component and interaction approach

Prefer current `QcButton`, fields/notices/surfaces, `QcDialog`/`QcHostedDialog`, workflow-stepper and upload components. Introduce only genuinely reusable missing presentation pieces, for example a consistent index header/filter/action composition or mapping-field sample—not another generic document engine or design system.

Migrate shared callers explicitly. `ConfirmModal`, alerts, upload and PDF-related components are reused by protected Takeoff/editor surfaces; changing their global default styling or event behavior risks regressions outside Phase 6. Use scoped wrappers/opt-ins, and list every affected caller in the final manifest.

Retain handler identities and binding semantics where practical: `value`, `checked`, `name`, `ref`, input limits, disabled conditions, existing IDs and `data-copilot` targets. Preserve nested-form boundaries and stateful mounting. Do not introduce notification polling refreshes or remove all explicit post-mutation refreshes indiscriminately.

All migrated controls need visible hover, focus and pressed feedback, readable disabled explanations, adequate phone targets and keyboard access. Long dialogs need deliberate content scrolling and reachable actions. Preserve the owning flow's Escape/pending/close policy; the existing v2 dialog contract does not dismiss on backdrop click. Any change to dismissal behavior beyond an approved shared contract must be recorded, not silently introduced. [S22]

## 8. Explicit exclusions

No redesign of Advanced Builder, Guided mode, Takeoff desktop/touch engines, Document Studio interaction, C59/C60 output renderers, Smart Assistant or its retrieval/polling/settings behavior. No project management, Team implementation, new supplier marketplace flow, all-history order backend, new import formats or document lifecycle features.

No pricing/tax/measurement calculation change; no persistence/server-action/API semantics, RLS/schema, conversion constants, UTF-16 database types, Stripe/auth cookie or integration protocol change. No dependency upgrades, environment changes or new GitHub Actions. Marketing/admin/free tools and unrelated resource editors are not a global restyle target. Protected leaf components reused by an in-scope page remain protected.

## 9. Implementation and validation sequence

1. **Resolve P6-D01 and record P6-I01 with Gavin.** Freeze a path-level scope manifest. Obtain a newer integrated baseline if one is supplied before coding; never substitute an earlier returned ZIP.
2. **Baseline gates before editing:** use the locked dependency set; read relevant installed Next guides as `AGENTS.md` requires; run `npx tsc --noEmit` and `npm run build`. Save full logs. A missing build environment or failing baseline is an integration prerequisite to resolve, not a reason to label syntax checks a successful build.
3. **Implement Groups A, B and C separately internally.** Keep one owner-review phase, but bounded diffs and screenshots per group. The catalogue mapping and paywall-context screens deserve particular visual review; no large image-concept round is necessary to establish the already-approved common styling.
4. **Verify behavior and visual states in the app.** Desktop, tablet-width and phone cases; keyboard; long content; empty/pending/failed/limited states; nested dialogs; all entry/exit paths. Use authorised isolated fixtures for writes. Do not send real emails, create charges or mutate a shared production database merely to obtain screenshots.
5. **Final gates and return:** zero new TypeScript errors against baseline, successful actual Next build, LF new/changed files, exact changed-file manifest and zero unlisted changes. Deliver complete wrapped source, outer `START_HERE_RETURN.md`, Phase 6 return/design notes and evidence. Return the complete updated UX-standard archive when contracts/documentation change.

### Acceptance matrix

| Area | Essential checks |
|---|---|
| Quotes / Orders / Invoices | Existing views and row destinations; keyboard/nested actions; statuses without collapsing separate domains; search/filter behavior where present; bulk cap, partial export and deletion/cancellation restrictions; honest recent-list scope. |
| Create / send / share | Every existing creation path and its back steps; draft retention; entity-specific modes, attachments and expiry; billing gates; follow-up availability; no token or send before the existing user action; suppressed/test-send feedback not falsely reported as delivery. |
| Lifecycle / integrations dialogs | Existing pending locks and explicit consequence text; withdraw/reopen/reset side effects still owned by original handlers; cancellation counts and failures rendered accurately; accounting export guard/error states. |
| Catalogues | Valid/malformed/headerless CSV fixtures; named maps and multiple field mapping; unchanged limits/warnings; replace confirmation; selection cap/defaults across search; existing/new destination; partial/error reporting; actual result count. |
| Uploads | Keyboard/pointer/drop; accepted type/size; storage block; file replacement; existing PDF selection; transport failure versus metadata failure; no fake progress; no regressions in protected shared callers. |
| Account / security | Tab/deep-link behavior; correct existing save boundary; company defaults; email/password/MFA/recovery branches; integrations/support; Team and Assistant left intact. |
| Auth / billing | Password and Google/passwordless routes; verification/reset/recovery errors; redirect/draft handoff; branch-specific onboarding and skip; inactive/active entitlement routing; pending/failed/cancelled checkout; existing-subscription management through current handlers. |
| Cross-cutting | Responsive containment, focus order/return, nested modal behavior, visible interaction feedback, no stateful-workspace remount regression, source drift, full tsc/build logs. |

## 10. Source evidence index

Paths below are relative to the extracted `quotecore-plus/` wrapper unless specified. These are repository references for Gavin, not web citations. They record static-source evidence, not runtime verification.

- **S01 — Authority:** outer `START_HERE_UX_PHASE6.md`; `docs/ux/phase-6/HANDOFF.md`; root `AGENTS.md`, `START_HERE_UX.md`, `RETURN_NOTES.md`.
- **S02 — Conflicting legacy rules:** `docs/DESIGN_SYSTEM.md:23–48`; `docs/ux/phase-6/HANDOFF.md`, hard rule 1.
- **S03 — Integrated v2 tokens:** `app/components/ui/v2/qc-tokens.css:51–56,84–86`; `app/components/ui/v2/qc.css:7–25,38–48,80–99`; `QcButton.tsx` in the same directory. Separate reference: `QuoteCore-Plus-UX-Handoff-v2.6.zip`.
- **S04 — Reference index:** `app/(auth)/[workspaceSlug]/job-spaces/JobSpacesList.tsx:1–60` and its adjacent stylesheet/model.
- **S05 — Orders mismatch / recent limit:** `app/(auth)/[workspaceSlug]/material-orders/order-list.tsx:43–52`; `order-list-actions.ts:7–23,41–54`; `orders-hub.tsx` in the same directory.
- **S06 — Quote loader and error context:** `app/components/workspace/QuoteIndexPage.tsx:25–56,98–111,163–171`.
- **S07 — Quote list capabilities:** `app/(auth)/[workspaceSlug]/quotes/QuotesList.tsx:14,76–107,219–350,487–491`; remaining render/export/confirmation sections of that component.
- **S08 — Invoice restrictions:** `app/(auth)/[workspaceSlug]/invoices/InvoiceList.tsx:19,100–140,200–277,441–447,772–793`; its existing `actions.ts` used as a read-only contract reference.
- **S09 — Creation:** `app/(auth)/[workspaceSlug]/quotes/new/QuoteDetailsForm.tsx`; `app/(auth)/[workspaceSlug]/invoices/CreateInvoiceModal.tsx:68–83,120–127,233–274`; `invoices/invoice-from-quote/[quoteId]/InvoiceLineSelector.tsx`; `material-orders/OrderLayoutPickerModal.tsx`; `material-orders/order-from-quote/quote-selector.tsx` and `[quoteId]/LineSelector.tsx` (workspace-relative paths).
- **S10 — Shared send:** `app/components/send/entityConfig.ts:36–105`; `SendDocumentModal.tsx`, `useSendDocument.ts`, `SendDocumentButton.tsx`, `SendTestTipModal.tsx`; `app/components/attachments/AttachmentSendPicker.tsx`.
- **S11 — Connecting lifecycle dialogs:** `app/(auth)/[workspaceSlug]/quotes/[id]/summary/WithdrawQuoteButton.tsx`, `ReopenQuoteButton.tsx`, `ScheduleFollowUpButton.tsx`, `SendToAppButton.tsx`; `app/(auth)/[workspaceSlug]/material-orders/[orderId]/preview/order-preview.tsx:109–178,223–236`; `app/components/ResetButton.tsx`.
- **S12 — CSV upload:** `app/(auth)/[workspaceSlug]/catalogs/upload-wizard.tsx:39–40,172–195,348–368,442–510` and import/save handlers above the render.
- **S13 — Catalogue management:** `app/(auth)/[workspaceSlug]/catalogs/catalog-list.tsx`, `edit-catalog-modal.tsx`, `replace-catalog-modal.tsx:70–144,174`; `app/(auth)/[workspaceSlug]/resources/ResourcesSection.tsx` and `TemplatesPageClient.tsx:12–16,146–164`.
- **S14 — Component conversion:** `app/(auth)/[workspaceSlug]/components/components/AddFromCatalogModal.tsx:13–17,137–161` and destination/create/success sections; parent `app/(auth)/[workspaceSlug]/components/component-list.tsx`.
- **S15 — Common upload:** `app/components/FileUploader.tsx:7–34,45–98,101–145`; existing `appearance`-scoped presentation and caller-owned `onUpload`.
- **S16 — Library attachments:** `app/(auth)/[workspaceSlug]/attachments/upload-attachment-modal.tsx:16–17,36–96,157–179`; `attachment-list.tsx`, `AttachmentsTab.tsx`.
- **S17 — Other upload callers:** `app/(auth)/[workspaceSlug]/account/LogoUploader.tsx`; `resources/CustomerTemplateLogoUploader.tsx`; `drawings/flashing-list.tsx:93–143,186–238,324–365` (workspace-relative paths); `app/components/FileUploader.tsx` call sites in existing plan/file panels.
- **S18 — Account:** `app/(auth)/[workspaceSlug]/account/AccountTabs.tsx`, `account/page.tsx`; `settings/CompanySettingsForm.tsx`, `PasswordSection.tsx`, `EmailChangeSection.tsx`, `MfaSection.tsx`; `app/components/TaxEditor.tsx` (read-only behavior reference).
- **S19 — Billing/gate:** `app/(auth)/[workspaceSlug]/account/billing/BillingPanel.tsx:83–95,160–206,264–310,327–351`; `app/(auth)/paywall/page.tsx:15–34,46–96,221`; `app/(auth)/[workspaceSlug]/layout.tsx:38–51`. Protected `app/lib/billing/paywall-plans.ts` inspected as a data-source reference.
- **S20 — Auth and recovery:** `app/login/page.tsx`; `app/login/TroubleSigningInPanel.tsx`; `app/login/recover/RecoverFlow.tsx`; `app/signup/page.tsx`; `app/auth/reset-password/page.tsx`.
- **S21 — Onboarding branches:** `app/(auth)/onboarding/page.tsx`; `OnboardingForm.tsx:32–73`; `GoogleOnboardingForm.tsx`; `SecurityQuestionsStep.tsx` in the same directory.
- **S22 — Dialog contracts:** `app/components/ConfirmModal.tsx:8–18,41–65`; `app/components/ui/v2/QcDialog.tsx:21–22,34–65`; `QcHostedDialog.tsx` in the same directory.

## Approval requested

Approve the six-area scope and the use of the existing **newer v2 design system**, correcting the contradictory legacy instructions. No additional product feature decisions are needed to begin this bounded implementation. Gavin's order-status contract check and the baseline build gates remain prerequisites for the affected work.
