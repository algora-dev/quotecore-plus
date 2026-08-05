# QuoteCore+ Mobile Optimisation Assessment & Plan

**Date:** 2026-07-16  
**Planning model:** GPT-5.6 Sol  
**Implementation model:** GLM 5.2, one controlled task ID at a time  
**Branch:** `development` (at `a970aaf`, same as `main`)  
**Goal:** Assess the current app for mobile usability, define what needs to change, ensure no regressions, and create a detailed implementation plan for Dev only.

---

## 1. Understanding of the Task

Shaun wants a **mobile optimisation pass** on `app.quote-core.com` (the authenticated application, not the marketing site which was already audited). The key objectives:

1. **Assess current layout and code** — identify all mobile-blocking issues across the authenticated app.
2. **Define what needs to change** — prioritised plan, no coding yet.
3. **Dev only** — all work ships to `development` branch so `main` stays as the fallback.
4. **Don't break desktop** — every change must preserve desktop behaviour.
5. **Focus areas** (priority order):
   - Component creation page
   - Quote editor (customer quote editor + quote builder phases: Areas, Components, Extras, Review)
   - Order editor
   - Invoice editor
   - Summary pages (quotes, orders, invoices)
   - General mobile optimisation (hamburger menu, navigation, etc.)
6. **Explicitly deprioritised:** Digital Takeoff canvas and Drawings canvas — these get a "desktop recommended" warning, not a mobile redesign.
7. **Foundation for PWA** — this pass creates the responsive base that the future PWA implementation (per the attached brief) will build on.
8. **Conversion path** — free tools users on mobile → signup → app on mobile. The app must be usable when they arrive.

---

## 2. Current State Assessment

### 2.1 Git State
- `main` and `development` are both at `a970aaf` — identical, fully up to date.
- Local `HEAD` is also `a970aaf`; branch divergence is `0 / 0`.
- The only untracked file is this assessment document. No application code has changed.

### 2.2 Responsive Breakpoint Usage (quantified)

| Metric | Count | Notes |
|---|---|---|
| `sm:` usages in authenticated/shared UI | **64** | Present, but fragmented across individual pages. |
| `md:` usages in authenticated/shared UI | **35** | Mostly isolated layout overrides rather than a mobile system. |
| `lg:` usages in authenticated/shared UI | **35** | Useful in several editors, but inconsistent. |
| `overflow-x-auto` usages | **6** | Some bounded scrolling exists, but many tables/editors remain unprotected. |
| Viewport meta tag | Not explicitly set | Next.js 16 defaults to `width=device-width, initial-scale=1` but no explicit `viewport` export in layout.tsx. |
| PWA manifest | None | No `manifest.json` or manifest route exists. |
| Service worker | None | No SW registration or SW file exists. |

**Conclusion:** The app is desktop-first and has scattered responsive fixes, but no coherent mobile shell, editor pattern, touch standard, modal standard, or mobile regression contract. The problem is consistency and workflow design, not a total absence of breakpoints.

### 2.3 App Shell (`app/(auth)/[workspaceSlug]/layout.tsx`)

**Current layout:**
```
<header> (max-w-6xl, px-6, py-4)
  Logo | AlertBell | InboxLink | HelpDrawer | Account | Logout
  WorkspaceNav (Quotes | Orders | Invoices | Resources — pill buttons, flex-wrap)
</header>
<main> (max-w-6xl, px-6, py-10)
  {children}
</main>
```

**Mobile issues:**
- `px-6` (24px) materially reduces the working width at 320px; `py-10` also wastes vertical space.
- Header is a single row — logo + 5 header actions + nav. On 375px this will overflow or wrap badly.
- `WorkspaceNav` uses `flex-wrap` which helps, but 4 nav pills + 5 header items = 9 things in one bar.
- No hamburger menu, no collapsible navigation.
- AssistantWidget is `fixed bottom-5 right-5` — on mobile it can collide with content, cookie notices, bulk bars, and a future bottom navigation.
- No iPhone safe-area padding is defined.

### 2.4 Dashboard (`page.tsx`)

- Action cards use `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — this is actually fine for mobile (single column).
- Header uses `flex items-start justify-between gap-4` — could get cramped with the Tutorials button on small screens.
- Alert/draft banners use `flex items-center gap-3` — should stack vertically on mobile.

### 2.5 Quotes List (`QuotesList.tsx`)

- Filter tabs: `flex flex-wrap gap-2` — will wrap on mobile but 8 status filters will take significant vertical space.
- The desktop header hides below `sm`, but rows merely lose their desktop grid columns rather than becoming deliberately labelled mobile cards.
- Bulk select checkboxes + action bar — no mobile consideration.
- Search input uses `max-w-sm` — fine.
- Edit/delete actions use `opacity-0 group-hover:opacity-100`, making them undiscoverable on touch devices.

**Key issue:** Quote rows are designed as single-line table rows with multiple columns. On mobile they need to become stacked cards.

### 2.6 Quote Builder (`quote-builder.tsx`)

- Phase tabs: `flex` with 4 tabs — will overflow on 375px.
- Layout: `flex items-start justify-between` for header — could be cramped.
- Areas/Components/Extras/Review each have their own internal layouts.
- `RoofAreaCard` and `ExpandableComponent` are large components that need internal mobile review.
- Margins editor uses inline inputs — could be cramped.

### 2.7 Customer Quote Editor (`CustomerQuoteEditor.tsx`)

- Uses `flex flex-col lg:flex-row gap-6 items-start` — **good, this is the right pattern** but one of the only places it exists.
- Left panel: line items list. Right panel: live preview.
- On mobile (< lg), it stacks vertically — preview goes below editor. This is acceptable but the editor panel itself needs mobile review.
- Line items have multiple inline controls (text, qty, price, margin, toggles) — these will be very cramped on 375px.

### 2.8 Invoice Editor (`InvoiceEditor.tsx`)

- The left panel uses `w-full md:w-[480px]`, but the editor body remains a flex row with the preview beside it; this creates a mobile overflow/collision risk.
- Some buttons use `hidden sm:inline-flex` — hides secondary actions on mobile.
- Mobile needs an explicit Edit/Preview mode rather than two simultaneous panes.

### 2.9 Material Order Create (`order-create-form.tsx`)

- Contains some responsive subforms, but the main editor is a desktop sidebar + A4 preview workspace.
- The preview uses a 210mm width and 297mm minimum height.
- Mobile needs one surface at a time: Details, Items, Preview.

### 2.10 Invoice List, Order List, Inbox List

- Invoice and order list headers hide on small screens, but their row content is not intentionally re-labelled as mobile cards.
- Inbox has less responsive treatment than the commercial lists.
- Fixed bulk-action bars can collide with the Assistant and future bottom navigation.

### 2.11 Component List (`component-list.tsx`)

- 84KB file (large).
- Uses `grid grid-cols-2 gap-3` — 2 columns even on mobile. Should be 1 column on mobile.
- Component creation form has many fields (type, measurement type, rates, waste, pitch, etc.) — needs mobile form layout review.
- Many controls use `py-1`; edit/delete and library actions are hover-led or too small for touch.

### 2.12 Settings, Account, Resources Pages

- Settings: form-based, should be manageable on mobile with input width fixes.
- Account/Billing: `BillingPanel.tsx` is 40KB — large billing UI that needs mobile review.
- Resources: templates, catalogs, email templates — multiple sub-pages, each needs review.

### 2.13 Modals

- 61 authenticated/shared files contain full-screen overlay patterns.
- Only a small subset consistently use `role="dialog"` and `aria-modal="true"`.
- Focus trapping, initial focus, focus return, Escape handling, and body-scroll locking are inconsistent.
- No bottom-sheet/full-screen mobile pattern exists.

### 2.14 Takeoff Canvas (`TakeoffWorkstation.tsx`)

- 274KB file — the largest component in the app.
- Full Fabric.js canvas workspace. **Desktop-optimised by design.**
- Mobile gets a warning plus safe results/measurements/access where practical, not a canvas redesign.

### 2.15 Drawings Canvas (`FlashingCanvas.tsx`)

- 93KB file. Full drawing canvas. **Desktop-optimised by design.**
- Mobile gets a warning plus safe record/output access where practical, not a canvas redesign.

### 2.16 Design System

- `DESIGN_SYSTEM.md` exists and is comprehensive for buttons, badges, rows, modals, icons.
- **No mobile-specific patterns documented** — no breakpoints, no touch target rules, no mobile navigation pattern.
- The design system needs a "Mobile Patterns" section added.

### 2.17 Touch Target Audit

Current buttons/badges use:
- `px-3 py-1` — nav pills (~28px height, below 44px minimum)
- `px-2.5 py-1` — status badges (not interactive, OK)
- `px-4 py-2` — main buttons (~36px height, below 44px but acceptable for non-critical)
- Icon buttons: `p-1.5` — ~24px, too small for touch

**Project requirement:** minimum 44×44px touch targets. The visible icon can stay small; the clickable container must grow.

### 2.18 Horizontal Overflow Risk

Pages most likely to cause horizontal overflow on mobile:
1. **Quote rows** (QuotesList) — multiple columns in a single row
2. **Invoice editor** — line item tables
3. **Order create form** — `grid-cols-3` section
4. **Component list** — `grid-cols-2` cards
5. **Quote builder** — phase tabs, area cards, component entries
6. **Billing panel** — pricing tables
7. **Summary pages** — multi-column layouts
8. **Raw tables and document previews** — only six `overflow-x-auto` uses exist across the authenticated/shared UI

---

## 3. Viewport Sizes to Support

| Width | Device | Priority |
|---|---|---|
| 320px | iPhone SE (smallest common) | Must not break |
| 375px | iPhone standard | Primary mobile target |
| 390px | iPhone 14/15 | Primary mobile target |
| 768×1024 | Tablet portrait | Must work well |
| 1024×768 | Tablet landscape | Verify editor/canvas boundary |
| 1440×900 | Desktop | No regression |

Also test touch-only use without hover, the mobile keyboard open, iPhone safe areas, keyboard-only navigation, and 200% browser zoom/reflow.

### 3.1 Safe Test Data

Before implementation begins:

- Use or create a dedicated QA user and workspace.
- Prefix every sample entity with `[MOBILE-QA]`.
- Create sample customer/job, quote, order, invoice, Smart Components, image, and PDF records only inside that QA workspace.
- Use controlled test recipient addresses only; never send to real customers or suppliers.
- Do not use existing customer records as test fixtures.
- Record QA record IDs privately, not in the repository.
- The final report must list which QA records were created or modified and confirm that no real customer data changed.

---

## 4. Controlled Execution Plan (Authoritative)

This section controls implementation order. The code-specific workstream notes in Section 5 add detail, but they must not be used to skip task boundaries, checkpoints, or regression gates defined here.

If any wording in Section 5 differs from Section 4, **Section 4 overrides Section 5**.

### 4.1 GLM 5.2 Implementation Contract

The coding work is intentionally decomposed for GLM 5.2. The implementation agent must follow these rules:

1. Execute one task ID at a time.
2. Read only the task's named files plus directly imported components required to understand the change.
3. Before changing any shared component, search and list every authenticated, public, marketing, and docs consumer.
4. Keep the task write set narrow. Do not edit files owned by a later task unless a build blocker makes it unavoidable.
5. Do not combine responsive work with architectural refactoring, state-management replacement, calculation changes, or naming clean-up.
6. Do not change quote/order/invoice/component calculations, pricing, tax/VAT, API contracts, database schema, RLS, permissions, authentication, autosave timing, document generation, or send behaviour.
7. Preserve compact desktop density. Mobile inputs may use `text-base md:text-sm`; do not globally enlarge desktop controls.
8. Use CSS/container layout rules first, capability checks only where behaviour genuinely differs, and never user-agent sniffing.
9. Test the changed workflow immediately after each meaningful change, not only at the end of the task.
10. Run focused validation after every task. Run full `npm run lint` and `npm run build` after any shared-foundation task and at every batch/editor checkpoint.
11. Commit each completed task separately with its task ID. Record that commit as the rollback point.
12. If a task fails twice, stop, restore the last passing state if necessary, and report the blocker instead of continuing to patch.
13. Do not begin the next checkpoint-gated task until the required review has occurred.
14. Navigation warnings apply only to `dirty-unsaved` and `save-failed`; do not add blanket `beforeunload` behaviour.
15. Mobile form controls should normally use `text-base md:text-sm`; do not force every control to `w-full` when its natural width is clearer or more usable.
16. The 44×44px requirement applies to the interactive hit area, not necessarily the visible icon or visual control.
17. Any required browser/device test that cannot be performed must be recorded as **Human verification required** with exact reproduction and pass/fail steps. Chrome emulation is not proof of iOS Safari compatibility.

Every task handoff must report:

- task ID and outcome;
- files changed;
- shared consumers checked;
- workflows and viewports tested;
- QA records created/modified;
- lint/build result;
- accessibility and overflow result;
- known issues;
- commit/rollback reference.

Each GLM 5.2 coding prompt must contain this fixed envelope:

1. **Task ID and single objective.**
2. **Read scope:** named files plus directly imported dependencies only.
3. **Write scope:** explicit owned files; all other files are read-only.
4. **Do not touch:** business logic, calculations, APIs, schema, auth, autosave timing, send/PDF behaviour, and unrelated formatting.
5. **Required baseline:** screenshots/values/QA fixtures to compare.
6. **Implementation rules:** relevant mobile/design/dialog/editor-state rules from this plan.
7. **Acceptance criteria:** observable mobile and desktop outcomes.
8. **Validation commands and manual workflow checks.**
9. **Stop conditions:** two failed fixes, unexpected shared impact, calculation mismatch, or missing safe fixture.
10. **Required handoff:** files, consumers, tests, results, known issues, commit, rollback.

This envelope should be copied into each implementation task rather than asking GLM 5.2 to infer requirements from the full 1,000+ line master plan.

### 4.2 Checkpoint Packet

Required review points:

1. After Batch 1 foundation/navigation.
2. After Batch 2 discovery/list workflows.
3. After Quote Builder in Batch 3.
4. After Customer Quote Editor in Batch 3.
5. After Invoice Editor in Batch 3.
6. After Material Order Editor in Batch 3.
7. After final development deployment, before any merge to `main`.

At each checkpoint, stop implementation and provide:

- mobile screenshots at 320, 375, and 390px;
- tablet portrait/landscape screenshots where relevant;
- 1440×900 desktop comparison screenshots;
- workflows tested and results;
- files/shared components changed;
- QA records created or modified;
- `npm run lint` and `npm run build` results;
- accessibility findings and score where meaningful;
- page-level horizontal-overflow results;
- runtime-console errors checked;
- known issues ranked by severity;
- rollback commit.

### 4.3 Shared Editor State Contract

Do not add a blanket navigation warning. Each editor must expose or derive these states without changing its existing save timing:

- `clean`: loaded state equals the last confirmed saved state;
- `dirty-unsaved`: local changes exist and are not yet confirmed saved;
- `saving`: the existing save/autosave request is in progress;
- `saved`: the most recent change is confirmed persisted;
- `save-failed`: the most recent save failed and local changes remain at risk.

Warn only for `dirty-unsaved` or `save-failed`.

For every editor, verify warnings do not interfere with:

- successful autosave;
- internal navigation after save;
- browser Back;
- Edit/Preview switching;
- downloads;
- Send actions;
- payment/auth redirects;
- refresh after confirmed save.

Implement this state mapping locally in the first editor. Extract a shared hook only after two editors prove identical semantics; do not force unlike save systems into one abstraction.

### 4.4 Edit/Preview State Decision

For the first mobile pass, Edit/Preview mode stays in local component state.

Rationale:

- switching modes must never remount the editor;
- dirty local state must survive mode switching;
- URL/query changes add Back/refresh complexity during the highest-risk batch.

Expected behaviour:

- editor opens in Edit mode on phone;
- switching to Preview preserves all local state and scroll state where practical;
- refresh returns to Edit mode;
- desktop keeps the existing simultaneous-pane layout.

URL query state may be evaluated later as a separate task only if it can be proven not to remount, reset, or lose unsaved work.

### 4.5 Responsive Layout Rules

- Do not equate `md` with every tablet or `lg` with every desktop.
- Collapse split panes when the available container cannot preserve each pane's minimum usable width.
- Use responsive grid constraints and minimum column widths.
- Use container queries only for self-contained surfaces where browser support and Tailwind output are verified in isolation.
- Test phone portrait, phone landscape, tablet portrait, tablet landscape, and split-screen tablet widths.
- Never hide page overflow globally. Fix the source; use bounded scrollers only for intentional tables/documents.
- Preserve desktop density with mobile-scoped rules such as `text-base md:text-sm`.
- When responsive classes are assembled dynamically, verify Tailwind class precedence manually; this repository has no `cn()`/tailwind-merge helper.

### 4.6 Mobile Information Hierarchy

Before implementing quote, invoice, order, or Inbox cards, confirm the order against the real field task:

1. What record is this?
2. What state is it in?
3. What action is needed next?

Candidate fields include customer, job/site, value, status, last activity, next action, due date, and document number. Do not automatically lead with creation date or document number. Record the chosen hierarchy in the task handoff before styling.

Essential actions must be visible or available through a labelled 44×44px More button; they must never remain hover-only.

### 4.7 Dialog and Overlay Rules

Dialog migration is gradual:

1. Build the primitive.
2. Prove it on exactly two low-risk tutorial modals.
3. Test semantics, initial focus, focus trap, Escape, backdrop rules, focus return, body-scroll lock, nested popovers, mobile keyboard, orientation change, and long-content scrolling.
4. Migrate remaining dialogs only inside their owning workflow task.

Dialog selection:

- bottom sheet: short selections, simple actions, compact confirmations;
- full-screen mobile dialog or dedicated route: long forms, keyboard-heavy work, catalogue selection, component creation, multi-section editing;
- centred dialog: short confirmations where it remains usable.

Do not make bottom sheets the universal default.

Layer system (use tokens/classes, not arbitrary `z-[9999]` values):

1. page content;
2. sticky header;
3. sticky actions;
4. dropdowns/popovers;
5. Assistant launcher/panel;
6. modal backdrop;
7. modal/full-screen sheet;
8. toast notifications;
9. critical confirmation.

Test Assistant, cookie UI, bulk bars, mobile navigation, sticky Save/Send, sheets, dialogs, toasts, safe areas, and the virtual keyboard together. Use `dvh` with a safe fallback where appropriate.

### 4.8 Feature-Flag Decision

Do not introduce a new general feature-flag platform.

Default rollback is the development-only branch plus one commit per task. For Batch 3 only, a simple development-environment flag following the existing `NEXT_PUBLIC_*_V1` pattern may be added if it materially enables side-by-side QA or instant editor rollback. Any flag must:

- be scoped to one editor;
- default off outside development until approved;
- wrap presentation only, never business logic;
- have a removal task after approval.

### 4.9 Four Controlled Release Batches

#### Batch 1 — Foundation and Navigation

Goal: establish mobile rules and navigation without touching core commercial editors.

**B1-T01 — Baseline evidence and QA fixture inventory**

- Write scope: QA report/documentation only.
- Capture representative mobile/tablet/desktop screenshots and route-level Lighthouse baselines.
- Record workflow timings: navigation-to-ready, quote open, modal open, save latency, list scroll, and upload feedback.
- Confirm `[MOBILE-QA]` fixtures and controlled recipients.
- Commit: documentation baseline only.

**B1-T02 — Mobile design contract**

- Write scope: `docs/DESIGN_SYSTEM.md` only.
- Add mobile gutters, 44×44px touch targets, `text-base md:text-sm`, focus-visible, cards, action menus, dialog choices, safe areas, reduced motion, overlay layers, and desktop-preservation rules.
- No application code.

**B1-T03 — Viewport, safe-area, dynamic-height, and reduced-motion foundations**

- Write scope: `app/layout.tsx`, `app/globals.css` only.
- Add explicit viewport/theme settings only where required, safe-area utilities, `dvh` fallbacks, mobile gutter/overlay tokens, focus-visible baseline, and `prefers-reduced-motion` handling.
- Do not add global overflow hiding or globally enlarge desktop inputs.

**B1-T04 — Responsive workspace shell**

- Write scope: `app/(auth)/[workspaceSlug]/layout.tsx` plus one new shell component if required.
- Reduce mobile gutters/vertical whitespace, preserve desktop layout, reserve safe bottom space, and define sticky-header behaviour.
- No navigation-menu implementation in this task.

**B1-T05 — Mobile navigation**

- Write scope: `app/components/workspace/WorkspaceNav.tsx` plus one narrowly scoped mobile-menu component.
- Add accessible hamburger/menu using existing routes only.
- Keep alerts/inbox reachable and move secondary destinations/actions into the menu.
- Do not create Today/Jobs/Calendar routes or the future five-tab PWA navigation.

**B1-T06 — Overlay collision integration**

- Write scope: `AssistantWidget`, `HelpDrawer`, cookie/banner components, and shell CSS only.
- Make Help overlay on mobile, preserve desktop drawer behaviour, and verify Assistant/cookie/sticky/bulk offsets against the documented layer system.

**B1-T07 — Dialog primitive proof**

- Write scope: one new shared dialog primitive plus `TutorialModal.tsx` and `WelcomeModal.tsx` only.
- Prove the primitive on those two low-risk modals.
- Do not migrate `ConfirmModal` or editor modals yet.

**B1-T08 — Batch 1 checkpoint**

- Run the full checkpoint packet.
- Stop for review before Batch 2.

#### Batch 2 — Discovery and List Workflows

Goal: make finding and opening work practical on mobile before changing editors.

**B2-T01 — Dashboard mobile hierarchy**

- Write scope: workspace dashboard and directly owned dashboard components only.
- Stack header/actions/banners, preserve desktop cards, and verify every existing destination.

**B2-T02 — Small mobile record primitives**

- Write scope: new narrowly scoped `MobileRecordCard`, header/meta, and action-menu primitives.
- No domain logic and no universal mega-component.
- Prove keyboard/touch/destructive-action behaviour in isolation.

**B2-T03 — Quotes list**

- Write scope: `QuotesList.tsx` plus B2 primitives only.
- Confirm information hierarchy, implement mobile cards, visible actions, filters/search/sort, status controls, and safe bulk bar.
- Preserve desktop columns and density.

**B2-T04 — Invoices list**

- Write scope: `InvoiceList.tsx` plus B2 primitives only.
- Implement invoice-specific hierarchy including value/due/status/next action.
- Preserve all bulk/status behaviour.

**B2-T05 — Orders list**

- Write scope: `order-list.tsx` plus B2 primitives only.
- Implement supplier/job/status/next-action hierarchy and safe destructive actions.

**B2-T06 — Inbox**

- Write scope: `InboxList.tsx` and directly owned Inbox components only.
- Make search/filter/message rows and action states usable at all target widths.

**B2-T07 — Summary navigation and low-risk panels**

- Write scope: `SummaryTabs.tsx` and simple summary panels only.
- Make tab navigation and non-editor panels responsive.
- Defer complex communication/file/editor modals to their owning later task.

**B2-T08 — Batch 2 checkpoint**

- Run the full checkpoint packet, including real information-hierarchy review.
- Stop for review before any core editor work.

#### Batch 3 — Core Editing Workflows

Goal: make the main commercial editors usable on mobile without changing any business output. This is the highest-risk batch.

Each editor has its own commits and checkpoint. Do not work on two editors in the same task.

**Quote Builder**

- `B3-Q01`: mobile step indicator (`Step 1 of 4`, full phase name), optional compact step menu, Previous/Next controls, totals summary, and safe sticky actions.
- `B3-Q02`: Areas and `RoofAreaCard` mobile layout/touch controls.
- `B3-Q03`: Components, `ExpandableComponent`, component entries, and Add From Library layout.
- `B3-Q04`: Extras layout and extra-entry controls only.
- `B3-Q05`: Review tables/cards, totals, and margins only.
- `B3-Q06`: FilesManager, upload states, and builder-owned dialogs only.
- `B3-Q07`: quote calculation/persistence/status/send regression and Quote Builder checkpoint.

Quote Builder acceptance comparison: areas, measurements, quantities, waste, pitch, rates, margins, tax/VAT, subtotal, total, locks, persisted values after refresh, preview output, status, and send flow.

**Customer Quote Editor**

- `B3-CQ01`: local-state Edit/Preview modes, mobile header/action hierarchy, and state-preservation proof.
- `B3-CQ02`: read-only line-item mobile card hierarchy and touch targets.
- `B3-CQ03`: line editing, reordering, visibility, pricing, quantity, and margin controls.
- `B3-CQ04`: header/footer dialogs only.
- `B3-CQ05`: Add Line and catalogue-selection dialogs only.
- `B3-CQ06`: AI upload/text dialogs only.
- `B3-CQ07`: clean/dirty/saving/saved/save-failed mapping and targeted navigation protection.
- `B3-CQ08`: content/totals/PDF/download/send/persistence regression and Customer Quote Editor checkpoint.

**Invoice Editor**

- `B3-I01`: local-state Edit/Preview modes, complete mobile actions, tab behaviour, and state-preservation proof.
- `B3-I02`: Lines/Details/Activity tab layout and keyboard-safe scrolling.
- `B3-I03`: invoice-line mobile cards and touch-safe editing.
- `B3-I04`: Add Invoice Line, header, and other invoice-owned dialogs.
- `B3-I05`: clean/dirty/saving/saved/save-failed mapping and targeted navigation protection.
- `B3-I06`: quantities/rates/tax/dates/totals/status/preview/download/send/persistence regression and Invoice Editor checkpoint.

**Material Order Editor**

- `B3-O01`: local-state Details/Items/Preview modes and desktop split-layout preservation.
- `B3-O02`: order-line cards, quantities, and mobile sidebar replacement.
- `B3-O03`: Add Item full-screen mobile dialog only.
- `B3-O04`: A4 fit-width Preview mode only.
- `B3-O05`: supplier/delivery/template controls and mobile Save/Send actions.
- `B3-O06`: clean/dirty/saving/saved/save-failed mapping and targeted navigation protection.
- `B3-O07`: lines/status/supplier links/preview/download/send/persistence regression and Material Order Editor checkpoint.

#### Batch 4 — Supporting Workflows and Final Polish

Goal: complete supporting mobile operations, finish incremental migrations, and produce the final evidence pack.

**B4-SC01 — Smart Components list and actions**

- Write scope: list/header/library controls only.
- Stack mobile filters/actions, remove hover-only actions, and preserve desktop density.

**B4-SC02 — Smart Component create/edit forms**

- Write scope: creation/edit form and directly owned parts only.
- Single-column mobile flow, mobile-sized inputs, progressive disclosure for advanced fields, and full calculation regression when added to a quote.

**B4-SC03 — Smart Component regression**

- Create/edit each supported measurement and pricing strategy, add it to a quote, and compare calculations/persistence with baseline.

**B4-SET01 — Profile and company settings**

- Write scope: profile/company forms only.
- Preserve desktop density and existing save behaviour.

**B4-SET02 — Security and MFA**

- Write scope: password, recovery, security-question, and MFA surfaces only.
- Preserve authentication/session behaviour and verify mobile keyboard/QR layout.

**B4-SET03 — Billing**

- Write scope: billing surfaces only.
- Preserve payment redirects and desktop pricing density; do not change billing logic.

**B4-SET04 — Support**

- Write scope: support surfaces only.
- Preserve ticket/message behaviour and attachment handling.

**B4-R01 — Resource navigation and simple template lists**

- Reuse small card/action primitives and remove hover-only actions.

**B4-R02 — Attachments**

- Handle attachment upload/list actions, progress, retry, and touch-safe row actions.

**B4-R03 — Catalogues**

- Optimise catalogue list/access separately.
- Mark dense CSV import desktop-optimised if safe mobile editing cannot be delivered without scope expansion.

**B4-R04 — Template editors**

- Optimise simple forms; mark complex document/template design desktop-optimised rather than forcing unsafe mobile editing.

**B4-CAN01 — Desktop-recommended interstitial primitive**

- Build and test one reusable capability-aware interstitial without importing Fabric.

**B4-CAN02 — Takeoff mobile access**

- Allow safe results/measurements/totals/output download/share/return context where existing data supports it.
- Provide Open Anyway.
- Do not load Fabric before the user proceeds.

**B4-CAN03 — Drawings mobile access**

- Allow existing drawing records/output download/share/return context where safe.
- Provide Open Anyway and defer Fabric loading.

**B4-M01 — Remaining dialog inventory**

- Re-scan overlays, classify by workflow/dialog type, and produce the remaining migration list without code changes.

**B4-M02+ — Remaining dialog migrations**

- Convert the B4-M01 inventory into numbered workflow tasks (`B4-M02-A`, `B4-M02-B`, and so on), each with one workflow and one commit.
- Do not combine with unrelated layout changes.

**B4-P01 — Images and document previews**

- Add safe dimensions/thumbnails/lazy decoding and fit-width preview behaviour.

**B4-P02 — File and upload resilience**

- Add Take Photo/Choose File choices, progress, interruption, retry, and duplicate-upload protection.
- Preserve full-resolution rules and signed-URL security.

**B4-QA01 — Final accessibility matrix**

- Run keyboard, screen-reader naming, focus, contrast, reduced-motion, zoom/reflow, and dialog checks.

**B4-QA02 — Final performance/interruption matrix**

- Run browser/orientation/network/keyboard/destructive-action tests from Sections 6 and 7.
- Measure route/workflow performance before vs after.
- Rank unresolved issues by severity and document safe exceptions.

**B4-QA03 — Final development checkpoint**

- Deploy to development/preview only.
- Produce the complete final evidence pack.
- Stop and request approval before any merge to `main`.

## 5. Detailed Technical Workstream Notes

These notes describe affected surfaces and expected UI treatment. They are not standalone execution units. Section 4 task IDs, write scopes, checkpoints, and regression gates remain authoritative.

### Phase 0: Foundation (no visual changes)

Before UI changes, capture authenticated baseline screenshots and Lighthouse results on representative routes using the safe QA workspace. Record Accessibility and Performance per route rather than reporting one misleading app-wide score.

**4.0.1 Explicit viewport meta**
- Add `export const viewport: Viewport = { width: 'device-width', initialScale: 1 }` to `app/layout.tsx`.
- Ensures all browsers respect the viewport correctly.

**4.0.2 Global mobile CSS utilities**
- Add safe-area inset utilities for the iPhone notch/home bar.
- Add a shared mobile page gutter, sticky-action offset, and bounded-scroller pattern.
- Do **not** hide page overflow globally; fix each overflow source so clipped controls cannot be masked.

**4.0.3 Responsive behaviour contract**
- Use CSS breakpoints for layout and visibility.
- Use JavaScript media/capability checks only when behaviour genuinely differs and cannot be expressed safely in CSS.
- Do not use user-agent sniffing for responsive layout.

**4.0.4 Update DESIGN_SYSTEM.md**
- Add "Mobile Patterns" section documenting:
  - Touch target minimum (44×44px)
  - Mobile navigation pattern (hamburger/bottom bar)
  - Responsive row → card transformation
  - Bottom sheet modal pattern
  - Safe area handling
  - Mobile form layout rules

### Phase 1: App Shell & Navigation

**4.1.1 Responsive header**
- Below `md` (768px): collapse header to logo + hamburger + alert bell.
- Hamburger opens a slide-down or slide-in panel with: Account, Logout, Help, Inbox, Nav links.
- Above `md`: current header layout.

**4.1.2 Responsive WorkspaceNav**
- Below `md`: move nav into the hamburger menu OR add a horizontal scrollable nav strip below the header.
- Above `md`: current pill nav.

**4.1.3 Responsive main container**
- Below `md`: `px-4 py-4` (reduced from `px-6 py-10`).
- Add `pb-20` on mobile to clear the assistant widget.
- Above `md`: current `px-6 py-10`.

**4.1.4 Bottom-overlay collision management**
- Keep the Assistant launcher at least 44×44px.
- Define one safe-area-aware stack for Assistant, cookie banner, bulk bars, sticky actions, and future PWA navigation.
- Panel: `w-[calc(100vw-1.5rem)]` on mobile (already has `max-w-[calc(100vw-1rem)]`).

### Phase 2: List Pages (Quotes, Orders, Invoices, Inbox)

**4.2.1 QuotesList mobile cards**
- Below `md`: transform each quote row from a single-line flex into a stacked card:
  - Row 1: Customer name + quote number
  - Row 2: Status badge + job status dropdown
  - Row 3: Date + actions (ellipsis menu)
- Filter tabs: horizontal scroll on mobile (`overflow-x-auto` + `flex-nowrap`).
- Bulk select: keep checkbox but simplify action bar.

**4.2.2 InvoiceList mobile cards**
- Same pattern as QuotesList — stacked cards on mobile.
- Reuse the same card layout structure.

**4.2.3 OrderList mobile cards**
- Same pattern.

**4.2.4 InboxList mobile**
- Inbox items should already be list-based — verify they stack well.
- Add `overflow-x-auto` to any wide content.

### Phase 3: Quote Builder

**4.3.1 Phase tabs**
- Below `md`: horizontal scroll (`overflow-x-auto flex-nowrap`).
- Shorten labels on mobile (e.g. "1. Areas" → "Areas").

**4.3.2 Areas phase**
- `RoofAreaCard`: stack vertically, full width.
- Area entry inputs (width/length): `grid-cols-2` is fine on mobile, but ensure inputs are large enough.
- "Add Area" button: full width on mobile.

**4.3.3 Components phase**
- `ExpandableComponent`: full width, stack internal fields vertically on mobile.
- "Add from Library": full-width button; use a full-screen mobile selector if the workflow is long/search-heavy.
- Component entries: stack vertically, ensure inputs are touch-friendly.

**4.3.4 Extras phase**
- Same pattern as Components.

**4.3.5 Review phase**
- Summary layout: stack vertically on mobile.
- Totals panel: full width, not side-by-side.
- Margin controls: stack inputs vertically.

**4.3.6 Files Manager**
- File list: stack vertically.
- Upload button: full width on mobile.
- File rows: truncate long filenames, show size/date below name.

### Phase 4: Customer Quote Editor

**4.4.1 Layout**
- Preserve the current two-pane desktop layout at `lg`+.
- On phone, use a deliberate Edit/Preview switch rather than placing a full document preview below a long editor.
- Ensure neither mode creates page-level horizontal overflow.

**4.4.2 Line items on mobile**
- Each line item: transform from inline row to stacked card on mobile.
- Fields: text (full width), then qty + price + margin in a row, then toggles in a row.
- Action buttons: move to an ellipsis menu or show as icon row.

**4.4.3 Header/footer edit modals**
- Use the shared responsive dialog shell.
- Add keyboard-safe scrolling/footer, focus trapping, Escape handling, and focus return.

**4.4.4 Add line item modal**
- Use a full-height mobile sheet with contained scrolling and a sticky confirmation action.
- Preserve catalogue/custom-line behaviour and calculations.
- Add route-leave/browser-close protection when dirty while preserving autosave.

### Phase 5: Invoice Editor

**4.5.1 Layout**
- Preserve the existing two-pane desktop layout.
- Below `md`, show one mode at a time: Edit or Preview.
- Provide a complete mobile action menu for actions currently hidden below `sm`.

**4.5.2 Invoice lines on mobile**
- Same stacked card pattern as quote editor.
- Keep Save and Send prominent; move secondary actions into a visible mobile More menu.
- Verify dirty-state autosave and route-leave behaviour.

**4.5.3 Add invoice line modal**
- 18KB modal — add `max-h-[90vh] overflow-y-auto`.

### Phase 6: Material Order Editor

**4.6.1 Order create form**
- Replace the phone sidebar + A4 preview workspace with explicit Details / Items / Preview modes.
- Keep the existing desktop split workspace at `lg`+.
- Fit the A4 preview to the viewport; do not allow page-level overflow.

**4.6.2 Line-by-line editor**
- 35KB component — needs internal mobile review.
- Line items: stacked card pattern.
- Add item modal: full-screen mobile dialog because it is search-heavy and multi-step.

**4.6.3 Order preview**
- Add fit-width preview controls and safe sticky Save/Send actions.

### Phase 7: Component Creation Page

**4.7.1 Component list**
- `grid-cols-2` → `grid-cols-1` on mobile.
- Component cards: stack fields vertically.

**4.7.2 Component creation form**
- Many fields — use single-column form layout on mobile.
- Group related fields (rates, waste, pitch) in collapsible sections.
- Ensure all inputs are full width on mobile.

### Phase 8: Summary Pages

**4.8.1 Quote summary**
- 39KB page with multiple panels (tabs, files, notes, activity, sent messages).
- `SummaryTabs`: horizontal scroll on mobile.
- Panels: full width, stacked.

**4.8.2 Order preview**
- Already has responsive layout (`w-full`).
- Verify on mobile.

**4.8.3 Invoice public page**
- Already has some responsive patterns.
- Verify on mobile.

### Phase 9: Settings & Account

**4.9.1 Settings page**
- Form-based — ensure inputs are full width on mobile.
- `CompanySettingsForm` (18KB) — stack form fields.
- `MfaSection` (24KB) — verify modal/QR code fits on mobile.

**4.9.2 Account/Billing**
- `BillingPanel` (40KB) — pricing tables need `overflow-x-auto` or card transformation.
- Logo uploader — ensure drop zone is appropriately sized.

**4.9.3 Resources page**
- Multiple sub-pages — each needs review.
- Template editors: form layout, ensure inputs are full width.

### Phase 10: Takeoff & Drawings (Desktop-Recommended Access)

**4.10.1 Takeoff page**
- Use a responsive/capability interstitial to show a "Desktop Recommended" warning before Fabric loads.
- Display existing measurements/results in read-only mode if possible.
- Provide "Open anyway" and preserve the quote context.

**4.10.2 Drawings page**
- Same pattern — desktop-recommended warning plus safe record/output access.
- Show existing drawings list (read-only).

### Phase 11: General Mobile Polish

**4.11.1 Touch targets**
- Audit all interactive elements.
- Increase the interactive hit area to meet 44×44px minimum on mobile; the visible icon may remain smaller.
- Icon buttons: `p-2` minimum on mobile (was `p-1.5`).
- Remove hover-only access to essential actions.

**4.11.2 Form inputs**
- Form controls should normally use `text-base md:text-sm` to prevent iOS zoom without changing desktop density.
- Use `w-full` only where the field/layout benefits from full width; do not force every control to fill its container.
- Add `inputMode` attributes where appropriate (numeric, email, tel).
- Labels above inputs, not inline.
- Audit accessible names, error associations, focus order, visible focus, colour contrast, and focusable elements inside `aria-hidden` regions.
- Target authenticated-page Accessibility 95+ where practical and document any safe exceptions.

**4.11.3 Modals**
- Create a shared responsive dialog shell with semantics, labelled title/description, initial focus, focus trap, Escape/backdrop rules, focus return, body-scroll lock, and keyboard-safe scrolling.
- Use a bottom-sheet or full-screen variant for complex mobile forms.

**4.11.4 Tables**
- Wrap all tables in `overflow-x-auto` containers.
- Or transform to stacked cards on mobile.

**4.11.5 Unsaved work**
- Add consistent internal-navigation and `beforeunload` protection to dirty editors.
- Do not interrupt or alter existing autosave timing.

**4.11.6 Images, uploads, and mobile performance**
- Audit 41 raw `<img>` uses for dimensions, thumbnails, `loading="lazy"`, and `decoding="async"` where safe.
- Lazy-load heavy modal/preview code when it does not change behaviour.
- Keep takeoff dynamically imported and defer Fabric until the user chooses to proceed on mobile.
- Provide explicit Take Photo and Choose File options where appropriate; do not force camera capture.

**4.11.7 Banners & alerts**
- Stack vertically on mobile (`flex-col` → `flex-col sm:flex-row`).

**4.11.8 Sticky elements**
- Ensure sticky headers/footers don't obscure content.
- Add safe-area padding for iOS.

---

## 6. Risk Assessment

### 6.1 What Could Break

| Risk | Mitigation |
|---|---|
| Desktop layout regression | Capture desktop baselines and visually/functionally compare at 1440×900 after every phase. |
| Modal overflow/focus failure | Use one tested responsive dialog primitive instead of patching each modal independently. |
| Touch target issues | Test 320/375/390px by touch; enforce 44×44px mobile containers. |
| Form input zoom on iOS | Use `text-base` (16px) on all inputs. |
| Horizontal overflow | Fix the source; use bounded scrollers only for tables/documents and never mask it globally. |
| Assistant/widget/bulk-bar overlap | Use a shared safe-area-aware bottom-overlay offset system. |
| Calculation or status regression | Compare representative quote/order/invoice values before and after every editor phase. |
| Performance on mobile | Avoid new runtime dependencies where possible; measure route bundles, images, layout shift, and Lighthouse. |

### 6.2 What Must Remain Unchanged

- Quote, invoice, order, or component calculations.
- Pricing, margins, waste, pitch, tax, or VAT logic.
- API contracts, database schema, RLS, permissions, or authentication behaviour.
- Existing autosave timing or persistence semantics.
- Document generation/PDF output.
- Send, download, payment, or status-transition behaviour.
- Desktop information density unless required to fix a demonstrated regression.
- Existing reliable desktop workflows.
- Fabric canvas internals; Takeoff/Drawings receive a warning and safe mobile viewing/access layer only.

Any exception requires a separate written impact assessment and Shaun's approval before implementation.

### 6.3 Base Regression Testing Plan

After every meaningful workflow change, run the focused checks for that workflow. Before each phase is declared complete:
1. `npm run lint` and `npm run build` must pass before the phase is complete.
2. Test at 320px, 375px, and 390px.
3. Test tablet portrait/landscape where the editor mode changes.
4. Test at 1440×900 against the desktop baseline.
5. Test the changed workflow end-to-end with `[MOBILE-QA]` records.
6. Run Lighthouse on representative authenticated routes where meaningful.
7. Verify no page-level horizontal scroll; bounded document/table scrollers are allowed.
8. Verify touch-only, keyboard-only, focus order, visible focus, modal focus trap/return, and mobile keyboard behaviour.
9. Verify quote/order/invoice calculations, totals, statuses, and persistence are unchanged.

---

## 7. Required Real-World QA Matrix

### 7.1 Browser Matrix

Minimum coverage:

- iOS Safari;
- Android Chrome;
- desktop Chrome;
- desktop Safari;
- Microsoft Edge where relevant to business users.

Use physical devices or a reputable remote-device service for Safari/iOS coverage that cannot be reproduced on the Windows development host. Document browser/version/device and any unavailable combination.

Pay particular attention on iOS Safari to fixed/sticky positioning, file inputs, date inputs, safe areas, dynamic viewport height, and the virtual keyboard.

### 7.2 Orientation and Available-Width Matrix

Test:

- phone portrait;
- phone landscape;
- tablet portrait;
- tablet landscape;
- tablet split-screen/narrow container widths;
- orientation change while a menu, dialog, keyboard, or editor is open.

Verify editor mode transitions, focus retention, and no clipped actions.

### 7.3 Reduced Motion

- Respect `prefers-reduced-motion` in dialogs, sheets, page transitions, loading indicators, previews, carousels, and auto-advance behaviour.
- Motion reduction must not remove progress or state feedback.
- Confirm the existing shimmer/Assistant motion does not impair use or waste battery when reduced motion is requested.

### 7.4 Network and Interruption Testing

Test:

- slow network;
- temporary offline state;
- save failure and recovery;
- upload interruption and retry;
- session expiry while editing;
- app switching/backgrounding and return;
- refresh during `dirty-unsaved`, `saving`, and `saved` states;
- duplicate taps on Save or Send;
- server error and validation error messaging.

Failures must be visible and recoverable. Do not imply a server save/send/upload completed when it did not. Prevent duplicate records or messages from repeated taps.

### 7.5 Virtual Keyboard

Verify:

- focused fields scroll into view;
- sticky actions remain accessible and are not hidden behind the keyboard;
- full-screen dialogs/sheets resize correctly;
- numeric, decimal, email, telephone, and URL keyboards appear where appropriate;
- Enter/Next follows a sensible focus order;
- keyboard dismissal does not shift or break the layout;
- iOS input text remains at least 16px while desktop density remains compact.

### 7.6 Destructive-Action Safeguards

When actions move to More menus or mobile sheets:

- visually separate destructive actions;
- retain confirmation dialogs;
- keep Delete away from the primary action;
- use 44×44px targets to reduce accidental taps;
- prevent duplicate activation;
- return focus safely after cancellation;
- verify Back/Escape never silently confirms an action.

### 7.7 Workflow Performance Measures

Record before/after, route-level results for representative workflows:

- navigation-to-editor-ready time;
- quote open time;
- modal open time;
- add-line-item response time;
- save/autosave latency;
- Edit/Preview switch latency;
- long-list scroll smoothness;
- keyboard input responsiveness;
- upload start/progress/completion feedback;
- memory growth during an extended editing session.

Lighthouse remains useful for representative routes, but real workflow timings and responsiveness take priority. Do not report one app-wide performance score.

### 7.8 Shared-Component Isolation

Before changing a shared button, input, dialog, card, header, container, action menu, or overlay:

1. Search all consumers.
2. Classify them as authenticated, marketing, public, docs, or admin.
3. Confirm the task intends to affect each consumer.
4. Prefer an authenticated/mobile variant when a global change would alter unrelated surfaces.
5. Verify responsive class precedence and conditional class output.

For mobile action layouts, separate mobile and desktop action groups when that is safer than forcing one compromise layout.

### 7.9 Strong Regression Gate

Before any batch or editor checkpoint passes, require:

- `npm run lint` passes;
- `npm run build` passes with no TypeScript errors;
- no new runtime-console errors;
- 320×568, 375×667, 390×844, phone landscape, tablet portrait, tablet landscape, and 1440×900 tests;
- no page-level horizontal overflow;
- touch-only and keyboard-only tests;
- 200% zoom/reflow test;
- focus order and visible-focus test;
- dialog focus trap and return test where dialogs changed;
- virtual-keyboard test where forms changed;
- calculation/persistence/status comparison where commercial records changed;
- safe QA data confirmation;
- desktop screenshot comparison;
- changed-route smoke test;
- rollback commit recorded.

For quote, invoice, and order editors, compare before/after:

- quantities;
- rates;
- margins;
- waste/pitch where relevant;
- tax/VAT;
- subtotals and totals;
- status;
- autosave result;
- preview/PDF output;
- persisted values after refresh;
- download/send behaviour.

---

## 8. Deliverables (per Shaun's requirements)

| Deliverable | How |
|---|---|
| Pages and workflows tested | Documented per task, checkpoint, and final report |
| Viewport sizes tested | 320×568, 375×667, 390×844, 768×1024, 1024×768, 1440×900 |
| Before/after accessibility & performance | Route-level Lighthouse plus workflow timings before, at checkpoints, and final |
| Concise change log | Git commit messages + CHANGELOG-mobile.md |
| Regression-test results | Focused task checks plus the full checkpoint matrix |
| Remaining issues ranked by severity | Documented in final report |
| Confirmation no real data changed | Dedicated QA workspace, prefixed records, controlled recipients, no DB migrations |
| Rollback references | One commit per task and a named checkpoint rollback commit |
| Browser/device evidence | Browser, version, viewport/orientation, screenshot, and result |

---

## 9. Batch and Checkpoint Order

| Order | Scope | Stop/review gate |
|---|---|---|
| 1 | B1-T01 to B1-T07: foundations/navigation | B1-T08 checkpoint; stop for review |
| 2 | B2-T01 to B2-T07: dashboard/lists/discovery | B2-T08 checkpoint; stop for review |
| 3 | B3-Q01 to B3-Q06: Quote Builder | B3-Q07 checkpoint; stop for review |
| 4 | B3-CQ01 to B3-CQ07: Customer Quote Editor | B3-CQ08 checkpoint; stop for review |
| 5 | B3-I01 to B3-I05: Invoice Editor | B3-I06 checkpoint; stop for review |
| 6 | B3-O01 to B3-O06: Material Order Editor | B3-O07 checkpoint; stop for review |
| 7 | Batch 4 supporting task IDs and final QA | B4-QA03 final development checkpoint |
| 8 | Merge to `main` | Only after Shaun's explicit approval |

---

## 10. PWA Foundation Notes

This pass creates the responsive core (the brief's Phase 1). Later PWA work should follow the brief's order:
- Phase 2: manifest, icons, service worker, install page, QR flow, and standalone detection
- Phase 3: notifications and deep links
- Phase 4: selected offline data/actions, IndexedDB queue, sync states, and conflict handling
- Phase 5: recorded/streamed voice assistant with confirmations and audit trail
- Phase 6: review whether native apps are justified by measured use

No PWA infrastructure exists today. Authenticated caching must receive a separate security review covering signed URLs, account switching, logout cache clearing, and cross-account data leakage.

The brief's proposed Today / Jobs / Assistant / Calendar / More navigation should not be faked in this pass because Today, Jobs, and Calendar are not yet complete destinations. The responsive pass should expose existing routes through a mobile menu; the five-tab product navigation belongs with those product areas.

The mobile responsive work in this document is **prerequisite** to all PWA phases. The PWA itself is a separate future task.

---

## 11. Current State Summary

**The app is desktop-first with fragmented responsive treatment.** The good news:
- Tailwind 4 is configured with default breakpoints (sm/md/lg/xl).
- Roughly 50 authenticated/shared UI files already contain at least one responsive utility.
- The design system is well-documented for desktop patterns.
- Several surfaces already have useful starting points, including list-row breakpoints and editor column transitions.

**The bad news:**
- Responsive behaviour is inconsistent and not workflow-driven.
- Only six bounded horizontal scrollers exist despite many tables/document previews.
- No mobile navigation pattern.
- Touch targets are too small.
- Essential actions are hidden behind hover in multiple lists.
- Dialog semantics and focus handling are inconsistent across 61 overlay-bearing files.
- `inputMode` is almost absent from authenticated forms.
- No PWA infrastructure exists.
- Several large editor components will need careful mobile layout work.

**The plan is controlled:** mobile-first base styles plus explicit desktop overrides, phase-level desktop comparisons, separate commits, development-only deployment, and QA-only records keep `main` as the known-good fallback.

**Planning-phase confirmation:** no application code, database records, customer data, or production records were changed during this assessment.

---

## 12. Revision Suggestion Decisions

### Accepted

- Four independently testable release batches.
- Formal review after Batches 1 and 2, each core editor, and final development deployment.
- Explicit clean/dirty/saving/saved/save-failed editor-state model.
- No blanket `beforeunload`; warnings only when data is genuinely at risk.
- Gradual dialog migration, proven on two low-risk tutorial modals first.
- Dialog-type selection rather than making every modal a bottom sheet.
- Available-width/container constraints, phone landscape, tablet landscape, and split-screen testing.
- Mobile-only 16px input text while preserving compact desktop controls.
- Record-card information hierarchy based on identity, state, and next action.
- Quote Builder step indicator with full phase context and Previous/Next actions.
- Useful Takeoff/Drawings access rather than a mobile dead end.
- Route/workflow performance timings in addition to Lighthouse.
- Shared-component consumer audits and authenticated/public/marketing isolation.
- Documented z-index/overlay layers and `dvh`/safe-area handling.
- Small domain-aware primitives instead of a generic mega-component.
- Browser, orientation, reduced-motion, interruption, keyboard, destructive-action, and controlled-rollout considerations.
- Stronger regression gates and explicit immutable business behaviour.

### Accepted With Constraints

- **Container queries:** use only on isolated surfaces after a small compatibility test; CSS breakpoints and minimum pane widths remain the default.
- **Feature flags:** no new flag platform. A simple development-only, presentation-only `NEXT_PUBLIC_*_V1` flag is allowed for an individual Batch 3 editor only when it materially improves QA/rollback.
- **Send desktop link:** provide Copy/Share/Send options only through existing safe infrastructure. Do not add a new email/SMS subsystem during the responsive pass.

### Deliberately Deferred or Rejected for This Pass

- **URL query state for Edit/Preview:** deferred. Local state is safer for the first pass because query updates could remount or reset a dirty editor. It may be evaluated later in a separate state-preservation task.
- **Global overflow hiding:** rejected because it masks clipped controls and root layout defects.
- **Global input enlargement:** rejected because it would reduce established desktop density.
- **All-modal migration in one batch:** rejected as too risky.
- **Universal bottom sheets:** rejected; long forms and keyboard-heavy work use full-screen dialogs or dedicated routes.
- **Broad mobile feature-flag framework:** rejected as unnecessary scope.

No substantive recommendation was ignored; constrained items were narrowed to protect current desktop behaviour and keep GLM 5.2 tasks diagnosable.

## 13. Planning Revision Confirmation

- The master plan was revised; the suggestion file was not copied over as a replacement.
- No application code was written or changed.
- No database schema, API, configuration, feature flag, or business logic was changed.
- No test account, customer record, production record, email, SMS, quote, order, or invoice was created or modified.
- `main`, `development`, and local `HEAD` remain aligned at `a970aaf`; `main` remains the fallback.
