# REPORT — UX Completion, 3 October 2026

## Decisions and boundaries

Shaun approved Message Center, Free Roof Takeoff entry/output, and a selective legacy punch list. Smart Assistant mobile typography was explicitly deferred; **all SA files are unchanged**. The `START_HERE_UX_2026-10-03.md` §6 black-pill clause conflicts with the leading owner override in `docs/DESIGN_SYSTEM.md` and the current v2.14 kit. This return follows the approved newer orange-gradient/dark-text/rounded-rectangle language and records the conflict rather than rewriting historical instructions.

This is a frontend implementation candidate, not a verified live release. There is no database, dependency, API, server-action, pricing/geometry or permission change. The authoritative application tests belong to Darren/Gavin.

## Task 1 — Message Center

`InboxList` is a controlled message list, not an invented conversation system. A readable row shows category, unread status, time, title and a short preview. Select its main area to expand the real message and show the existing destination/action buttons. Selection checkboxes remain independent. Active / To-do / Archived, title/body search, all six type choices, selected-visible-only bulk operations, read/unread, archive/restore and permanent deletion retain their controller behavior.

Notification settings move to a clearly secondary view. Four existing event groups each expose app/email switches and disclose individual events. Mixed masters still use the original **any child on → master on; switch off → all off** rule. Labels show partial counts rather than falsely claiming all events are enabled. Errors and partial outcomes retain the supplied Phase 9 controller contract. No notification polling or router refresh was added. Existing assistant/navigation identifiers and `?from=inbox` return routes remain.

New files: `message-center-model.ts`, `MessageCenterRow.tsx`, `MessageCenterPreferences.tsx`, `message-center.css` under the existing inbox folder. Modified: `InboxList.tsx`, `page.tsx` there.

Verify: open messages → search/filter/select → expand/read → open related job/invoice/order → return; exercise partial/no-confirmation failures and archived deletion; change channel/event preferences and confirm persistence/rollback; check 320/390px and keyboard operation. See `MESSAGE_SURFACE_AUDIT.md` for what is and is not unified.

## Task 2 — Public Free Roof Takeoff

A new stateless entry presentation consumes the original Units → Components → Plan state, callbacks and guards. One next action is visible for each stage; units/components can be revisited without rebuilding the controller. File requirements, PDF selection, custom component limits, orientation advice and session scope are clear. The obsolete no-PDF/no-AI wording is corrected to match the actual baseline; no new PDF or AI feature was added.

The custom component form uses the v2 fields and native dialog. All existing rates, purchasing, waste and pitch choices remain. Its body scrolls within the viewport while Cancel/Save stay visible. The existing name-only validation, defaults and save normalization remain authoritative.

The results use deliberate report hierarchy, readable measurements/totals and the original formulas. Print/PDF stays in normal flow, keeps measurement rows whole, and lets long component groups continue onto the next sheet rather than stranding the header on page one. Create a quote opens the existing free generator. Save to QuoteCore+ uses the unchanged draft-save request; a real saved-draft link is now visible if the existing new-tab opening is blocked.

Modified: `FreeTakeoffApp.tsx`, `TakeoffOutputView.tsx`, `ComponentBuilderModal.tsx`, `page.tsx`. New: `FreeTakeoffEntry.tsx`, `free-takeoff-ui.css` in that folder, plus opt-in `app/components/ui/v2/qc-dialog-actions.css`.

**Shared consumers:** cladding and flooring already import the report/component dialog; they inherit this presentation. Their landing/controllers are not changed. Flooring still omits pitch controls, and flat-area report behavior is unchanged. Neither the shared workstation nor the mobile precision controller is wrapped in the new entry layout.

Verify: all unit choices, defaults and custom components, invalid/valid images and PDFs, cancelled page picker, portrait/landscape, existing canvas/AI-credit flow, report quantities versus baseline, long browser print, free-generator transfer, save failure/retry and blocked-popup fallback, and cladding/flooring. Real uploads/calibration/credits and downstream generators were not executed here.

## Task 3 — Eight selective legacy fixes

Supplier accordion state, banner-remove affordance, pricing toggle/type selection and error/hint readability; catalogue editor tab wrapping and CSV replacement dialog; saved-order action hierarchy and PDF/status failure feedback. These are eight discrete quick wins across four existing files. No supplier/catalogue CRUD or order lifecycle handler was replaced. The order document renderer and send modal are byte-identical to baseline.

See `LEGACY_PUNCH_LIST.md` for exact priorities, files and explicitly deferred surfaces. This is not a mechanical replacement of every old class or a claim that every possible state in the application has been accepted.

## Evidence

The release retains all 3,508 original files. Ten existing production files change and seven are new. All 388 original `app/lib` files, 104 API files, 83 action modules, 330 SQL files, 141 marketing/header files and 29 existing v2 primitive files are byte-identical; categories overlap. All other original files are also byte-identical. The selected path groups are evidence of boundaries, not a claim to have executed every feature.

96 normalized-AST preservation checks, 65 isolated browser/controller assertions, 60 responsive fixture cases, six short-viewport dialog cases, and four browser-print cases pass. Fourteen changed/new TS/TSX files pass syntax transpilation, and all 104 local imports resolve. No added `any` tokens. See `VALIDATION.md` for mocks, actual runtime versions and limitations. The source-return is not gated on unavailable dependencies, per Darren’s handoff.
