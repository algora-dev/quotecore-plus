# Phase 6 — Presentation changes and capability locations

**Status:** implemented source candidate. Owner review of deployed behavior is pending.

## Shared contracts

- **C61 QcJourney / QcJourneyHeader:** opt-in presentation root, page hierarchy, explicit controls/rows/panels. No API, state machine, router, authorization, money formatting or data ownership.
- **C62 QcJourneySteps:** read-only named progress. Receives existing current step; cannot navigate or bypass validation.
- **C63 QcJourneyDialog:** C27 adapter with local C53 context for nested helpers. Does not own the form or its close state.
- Native existing controls receive the existing C01 and field vocabulary without changing their native type or form membership. Controls retain source callbacks; new keyboard links and upload keyboard activation are presentation/accessibility additions.
- PasswordField and TaxEditor v2 appearance are explicit call-site opt-ins. Existing unmigrated consumers keep the default.

## A. Lists and connections

Quotes retains Confirmed/Drafts, query/sort/status controls, quota gating, draft destinations and all export/delete behavior. Record identity is a real keyboard link; checkboxes and action clicks keep stopPropagation behavior. Resource Library is a secondary action; New Quote remains primary. Job Spaces is not a replacement for Quotes.

Invoices retains current search/filtering, overdue/attention context, status menus, public/edit links, cancellation/draft-delete behavior and bulk actions. Number, recipient, value, date and status reflow into labelled mobile rows rather than disappearing.

Orders remains a **recent list of at most 20 loaded records**. Existing Custom/From Quote/template paths, six status choices, supplier responses and output/edit actions remain. No misleading full-history search or invented pagination is added.

Each bulk selection cap remains 25. Fixed bulk controls reserve bottom space and clear the mobile shell; verify in the real application shell and with Help/Assistant overlays open.

Creation/quote-line selection, shared send/share, follow-up, accounting export, reopen/withdraw and attachment selection use common spacing and controls. Send, generate email and copy link remain different configured modes. No document-preview fork or lifecycle change.

## B. Catalogue and files

Catalogue import shows Choose file → Name → Map columns → Review & save. It still saves a catalogue only. CSV header detection, parsing, numeric interpretation, optional mapping, 35,000-row cap and 2,000-row batches are unchanged.

Conversion shows Choose catalogue → Fields & rows → Component library → Create. Name mapping is required by the original validation. Up to the first 20 rows are selected by default; the count explains when selected rows are hidden by the current filter. Selection still uses original row indices and cap behavior. The destination is shown using the existing library choice; no new data model or parser.

Existing account/logo/template/attachment/drawing-library uploads share visual requirements, file controls, keyboard focus and real progress/error/storage feedback. File types, compression/resizing, storage/RPC/URL behavior and separate handlers remain as-is. Takeoff acquisition and mobile uploads are excluded.

## C. Settings and joining

Account navigation and profile/company/security/payment/integration/support panels adopt clearer hierarchy and fields. Existing dirty/save/message states and their independent submissions remain. Currency/trade/unit/margin/tax fields retain warnings and semantics.

Billing keeps current/purchased/effective plan distinctions, storage, cancellation, dunning, contact-us/coming-soon options, plan details and confirmation dialogs. Activation presents choosing a subscription, while account billing presents managing it. Plans remain sourced from existing inputs. A checkout return message no longer claims payment is verified solely because a query parameter says success.

Login, signup, recovery, onboarding and paywall use a consistent near-white card and current controls. Paid access is explicit. Email/password/Google, draft/ref context, recovery checks, MFA, redirect destinations and cookie/access rules remain. Named progress reflects existing stages; no new funnel or free plan is introduced.

## Responsive and interaction behavior

Rows stack below 1100px; supported phone layouts reserve selection-action space and use readable fields. Tables deliberately scroll inside their own containers. Controls show hover/focus/pressed states, and reduced-motion/forced-colors rules are included. The app shell, actual phone safe areas, scrolling, browser zoom, native dialogs and on-screen keyboards remain runtime gates.

Not every nested legacy surface is rewritten: existing browser alerts/confirms and two callback-owning overlays are retained; already-modern Document Studio, Takeoff and Assistant controls remain untouched. Scope is the exact file manifest and parity checklist, not a claim that no legacy UI exists anywhere.
