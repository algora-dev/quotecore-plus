# Phase 1 parity and owner acceptance

Every row is a test to perform, not a claim of runtime verification. See PARITY_LEDGER.csv for the machine-readable version. Source actions/expressions were statically compared; only Gavin can exercise services and the actual app.

## Preview acceptance protocol

1. Capture a pinned baseline from commit20b3f54c (or reconcile against the current main) and a separate UX preview using equivalent disposable fixtures.
2. Use the full existing application, not the HTML specimen. Keep preview DB, storage, mail, background follow-ups, payment and integration credentials isolated from production.
3. Run the existing build/typecheck/lint/test workflow. Do not edit protected application logic to silence failures as part of this presentation patch.
4. Exercise the critical rows below before owner review. Store before/after screenshots at the same viewport/data state with capability IDs.
5. Owner reviews the running Areas, Components, Extras and Review on desktop and phone. No Phase2 begins until approval; no direct upload to live.

A capability may move or be relabeled, but it must not silently disappear. Mark each record PASS/FAIL/BASELINE_ISSUE only after actual comparison and attach evidence. A static screenshot is not evidence that a mutation, price, gate or PDF is correct.

### P01 | Critical | Manual and digital entry routes

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/page.tsx; app/(auth)/[workspaceSlug]/quotes/[id]/build/page.tsx`.

Presentation: Same original loaders and original wrapper; no route or entry-mode changes.

Verify: Open manual and digital quotes; compare the same populated fixtures. Blank/Standard Quote still routes to blank-build.

Status: **RUNTIME_PENDING**.

### P02 | Critical | Phase navigation/history

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/build/QuoteBuilderV2Wrapper.tsx`.

Presentation: Native stepper calls original setPhase; wrapper is byte-identical.

Verify: Open deep links for all four steps; move steps, refresh, back/forward, wait after initial load; no stale-phase reset.

Status: **RUNTIME_PENDING**.

### P03 | High | Names and job reference

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/QuoteNameEditor.tsx`.

Presentation: Same header location; fields/controls restyled.

Verify: Edit, cancel, Enter, Escape, failed save and reload. Long names wrap.

Status: **RUNTIME_PENDING**.

### P04 | Critical | Currency warning and inheritance

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/CurrencySelector.tsx`.

Presentation: Header selector; app confirmation instead of browser confirm.

Verify: Cancel foreign-currency warning makes no mutation; accept retains display-only behavior; select company currency persists null inheritance.

Status: **RUNTIME_PENDING**.

### P05 | Critical | Plans and takeoff link

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx`.

Presentation: Compact row under identity; same condition and URLs.

Verify: Existing plan, no plan, multiple plans, takeoff-present/no-takeoff, thumbnails, view links all reachable.

Status: **RUNTIME_PENDING**.

### P06 | Critical | File upload / PDF selection

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx; app/components/FileUploader.tsx`.

Presentation: Same expanded files region; new drop-zone styling.

Verify: Plan image10MB/PDF50MB; supporting10MB; drag/drop, file chooser, conversion cancellation, unsupported/large files, retry, upload failure.

Status: **RUNTIME_PENDING**.

### P07 | Critical | Storage quotas and signed access

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx`.

Presentation: Storage/PDF logic unchanged.

Verify: Over-limit account stays blocked on both routes; signed links work. Check digital isOverStorage baseline issue separately.

Status: **RUNTIME_PENDING**.

### P08 | Critical | Delete supporting file

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx`.

Presentation: Same row action, frosted confirmation.

Verify: Cancel/backdrop/Escape/pending/success/failure; no unintended deletion or double request.

Status: **RUNTIME_PENDING**.

### P09 | High | Add another roof area

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/RoofAreaCard.tsx`.

Presentation: Same Areas step; labeled inline row.

Verify: Whitespace guard, Enter and click, duplicate names if permitted, correct area IDs, empty state.

Status: **RUNTIME_PENDING**.

### P10 | Critical | Area width/length auto-submit

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/RoofAreaCard.tsx`.

Presentation: Labeled field pair and touch-sized actions.

Verify: Type W/L, blur each, Enter, Done and rapid clicks; exactly one entry; original focus restoration and clearing; no duplicate blur save.

Status: **RUNTIME_PENDING**.

### P11 | Critical | Area pitch representations

Source: `app/components/PitchInput.tsx`.

Presentation: Same setting with v2 native controls.

Verify: Degrees, ratio, gradient, persisted mode, empty/null, high angle warning, custom quotes; callbacks still receive degrees.

Status: **RUNTIME_PENDING**.

### P12 | Critical | Confirm/edit area and Next guard

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/RoofAreaCard.tsx`.

Presentation: Confirmed badge + original lock controls.

Verify: Lock/unlock, edit, allAreasLocked guard, zero-area quotes and generic optional areas behave identically.

Status: **RUNTIME_PENDING**.

### P13 | Critical | Cascade area deletion

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx`.

Presentation: Same area action; frosted confirmation with full warning.

Verify: Confirm/cancel/pending/error; associated component/entry/document rows match original delete behavior.

Status: **RUNTIME_PENDING**.

### P14 | High | Library selection and new-component sentinel

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/AddFromLibrary.tsx`.

Presentation: Labeled selector + Add component.

Verify: Same list filtering/order/collections; selected component adds to correct area/type; immediate clear semantics retained.

Status: **RUNTIME_PENDING**.

### P15 | Critical | Mid-quote Smart Component creation

Source: `app/components/CreateSmartComponentModal.tsx`.

Presentation: Native dialog frame around the same form.

Verify: Main/Extra defaults, measurement types, rates, waste, pitch, generic-trade flags, packs, images, notes, collections and inactive subscription responses.

Status: **RUNTIME_PENDING**.

### P16 | Critical | New component result wiring

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx`.

Presentation: Existing onCreated handler unchanged.

Verify: Created row enters local library and attaches to the intended area/phase; creation failure does not add a fake row.

Status: **RUNTIME_PENDING**.

### P17 | Critical | Component expansion identity

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Accessible native button; existing expanded state remains.

Verify: Expand several cards; edit fields; wait for refresh and mobile resize; no unintended remount/collapse. Recheck the known baseline issue.

Status: **RUNTIME_PENDING**.

### P18 | High | Separate component removal

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Same removal callback, separate red named target.

Verify: Removing a component must not also toggle another card or change original confirmation policy.

Status: **RUNTIME_PENDING**.

### P19 | Critical | Plan versus Actual input

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Same controls with aria-pressed.

Verify: Plan/Actual must produce the same quantities, pitch/waste application and requests as baseline.

Status: **RUNTIME_PENDING**.

### P20 | Critical | Area assignment/custom pitch

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Same settings rows.

Verify: Multiple areas, None, inherited/custom pitch, no-pitch component; exact component IDs and payload keys.

Status: **RUNTIME_PENDING**.

### P21 | Critical | Use roof area total

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Same contextual action.

Verify: Only appears under existing predicate; passes identical area total and component ID.

Status: **RUNTIME_PENDING**.

### P22 | Critical | Area/direct/dimensions modes

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Same entry form, labeled native inputs.

Verify: Direct area, width x length, Add/Done/Enter; intermediate numeric strings and unit conversion parity.

Status: **RUNTIME_PENDING**.

### P23 | Critical | Volume modes

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Same direct/preset/3D/area-depth controls.

Verify: Preset depth, direct volume, L/W/D, area+depth, per-entry depth snapshots; exact existing payloads and results.

Status: **RUNTIME_PENDING**.

### P24 | Critical | Height/multi-length/time/count/fixed modes

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Same alternatives; stable freestyle keys.

Verify: Preset height, freestyle length-height, multi-length variants, hours/days, quantity and fixed fees; all source-supported options.

Status: **RUNTIME_PENDING**.

### P25 | Critical | Metric and Imperial display

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Existing conversions/formatters retained.

Verify: Metric, imperial_ft and imperial_rs; stored values/purchase quantities/final amounts identical. Review baseline preview-unit quirks separately.

Status: **RUNTIME_PENDING**.

### P26 | Critical | Purchase-unit rounding and actual fraction

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx`.

Presentation: Header/review retain priced_quantity and fractional actual.

Verify: Whole packs/rolls, numeric-string DB values, null priced quantity and non-pack items match baseline exactly.

Status: **RUNTIME_PENDING**.

### P27 | Critical | Entry remove/combine/split

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx`.

Presentation: Same actions with readable labels.

Verify: Preserve eligibility guards, combined source counts, waste rules, split reconstruction and non-removable combined entry policy.

Status: **RUNTIME_PENDING**.

### P28 | High | Extras and no-area component paths

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx`.

Presentation: Same separate phase, no new workflow.

Verify: Main/extra filtering, all no-area components, generic trades; no disappearing items in Review.

Status: **RUNTIME_PENDING**.

### P29 | High | Review columns and override dot

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx`.

Presentation: Solid tables with named bounded scroll regions.

Verify: Every quantity/cost/entry/override retained; keyboard horizontal scroll on narrow screens; long labels and amounts.

Status: **RUNTIME_PENDING**.

### P30 | Critical | Margins/tax/total and confirmation

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx; app/(auth)/[workspaceSlug]/quotes/[id]/ConfirmQuoteButton.tsx`.

Presentation: Same numeric expressions and bound actions; clearer saved/preview labels.

Verify: Disabled/enabled margins, blank/invalid/out-of-range, saved/unsaved values, failed save and confirmation. Gavin must decide baseline failure continuation before release.

Status: **RUNTIME_PENDING**.

### P31 | Critical | Draft confirm versus confirmed save

Source: `app/(auth)/[workspaceSlug]/quotes/[id]/ConfirmQuoteButton.tsx`.

Presentation: Same native form/bound action with QcButton.

Verify: Both quote statuses, pending, callback, action redirects and duplicate submission behavior compared to original.

Status: **RUNTIME_PENDING**.

### P32 | High | Modals, focus and explicit dismissal

Source: `app/components/ui/v2/QcDialog.tsx`.

Presentation: Frosted native modal with existing facades.

Verify: Keyboard focus, nested creator error, Escape, pending, explicit close, backdrop no-op, tab containment, route unmount and scroll restoration in actual React app.

Status: **RUNTIME_PENDING**.

### P33 | High | Legacy shared-component consumers

Source: `app/components/ConfirmModal.tsx; app/components/AlertModal.tsx; app/components/PitchInput.tsx; app/components/FileUploader.tsx; app/components/ui/ScrollIndicator.tsx`.

Presentation: Default presentation not opted in.

Verify: Visit at least one unmigrated caller of each shared file. Old modals, uploads and pitch controls stay usable and unchanged visually.

Status: **RUNTIME_PENDING**.

### P34 | High | Responsive/reduced effects

Source: `app/components/ui/v2/qc.css; app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/quote-builder.css`.

Presentation: Single form tree, touch targets, fallback glass.

Verify: 320/390/768/1024/1440, phone landscape/keyboard, 200% zoom, long text, reduced motion/transparency and forced colours. No assistant overlaps primary actions.

Status: **RUNTIME_PENDING**.

### P35 | Critical | Protected services and gates

Source: `app/api/**; app/lib/**; actions; backend; config`.

Presentation: Byte-identical in return.

Verify: Compare protected hashes; preview must not use live DB/email/payments/storage/jobs. Test current entitlements rather than inventing permissions.

Status: **RUNTIME_PENDING**.

### P36 | Critical | Later-phase boundaries

Source: `takeoff/**; summary/**; customer-edit/**; layouts`.

Presentation: No changes.

Verify: Mobile takeoff and AI scan handoff remain functional; no canvas geometry/state changes; no new Sidebar/Guided/Fast/Job Space routing.

Status: **RUNTIME_PENDING**.

