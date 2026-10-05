# Phase 1 UI implementation contracts

Status: implemented candidate, statically reviewed, app runtime acceptance pending. Scope is the existing quote builder only.

The full-repo AGENT_BRIEF.md takes precedence over historical handoff phase ordering. The approved visual authority is QuoteCore-Plus-UX-Handoff-v2.0, not its earlier AI-generated posters. This is a partial implementation of that registry, not a claim that all 46 components exist.

## Reuse rules

Use `app/components/ui/v2` on an explicit `data-qc-ui="v2"` root. Apply the marker to modal roots too. Do not apply it to the global app shell yet. A legacy component without the marker or an explicit appearance prop must keep its existing presentation.

Use native buttons for actions and real links for navigation. `QcButton` forwards type, name, value, formAction, disabled, event handlers and refs. A Next Link uses the same `qc-button` / `data-qc-variant` recipe, retaining its original href and navigation behavior. No requests belong inside a button, badge, card or total renderer.

`QcInput` forwards intermediate numeric strings and all original events. It does not clamp, parse, convert units or alter validation. `QcSelect` is native and keeps the complete original options. `QcMoneySummary` receives a required explicit audience and already-formatted rows; its caller remains the pricing authority.

`QcWorkflowStepper` is controlled. The current step comes from the original builder/wrapper; the stepper only calls its onSelect. Step numbers are navigation, not a completion status. Do not add router.push, substitute progress gates, or replace the wrapper's history/popstate handling.

`QcDialog` uses a native modal top layer. The feature owns open, close, confirmation and pending. A backdrop click never dismisses. Escape follows the caller's existing pending policy. Cancel is initially focused for destructive confirmations. Nested feedback is opened above the creator. Test the actual React focus/cleanup behavior in the app preview before release.

`appearance="v2"` is an opt-in adapter for ConfirmModal, AlertModal, PitchInput, FileUploader and CreateSmartComponentModal. Do not turn it on globally without a separately approved phase. The creator retains one form tree and its existing field names. Its library and trade features are not reimplemented.

## Recipes, not independent lookalikes

| Registry ID | Implementation in this phase | Status |
|---|---|---|
| C01 / C02 | QcButton / QcLinkButton; matching native link recipe where Next Link is retained | Implemented |
| C03 | QcButton with labeled icon, qc-icon-button and 40/44px target | Adapter recipe |
| C04 / C05 / C06 | QcField / QcInput / QcSelect | Implemented |
| C09 / C10 | Native existing choice buttons with aria-pressed and qc-choice; original state retained | Adapter recipe |
| C13 | QcStatusBadge | Implemented, display-only |
| C15 | Existing review tables, qb-review-table and named ScrollIndicator | Adapter recipe |
| C18 | QcSurface or matching qc-surface wrapper | Implemented |
| C20 | ExpandableComponent native controlled disclosure; original expanded state retained | Domain adapter |
| C27 / C29 | QcDialog with G-A native backdrop; existing confirm/alert facade | Implemented |
| C30 | QcNotice | Implemented |
| C34 | QcWorkflowStepper | Implemented |
| C35 | QcMoneySummary | Implemented |
| C36 / C37 | Existing FilesManager / FileUploader, opted-in styles | Domain adapters |
| C43 | Existing area/component entry modes using shared native inputs | Domain adapter |
| Remaining contracts | Global shell, Job Space, customer editor, canvas and other pages | Deferred |

## Example

```tsx
<section data-qc-ui="v2">
  <QcInput value={existingText} onChange={existingChange} onBlur={existingBlur} />
  <QcButton type="button" variant="primary" disabled={existingGuard} onClick={existingAction}>
    Next: Review
  </QcButton>
  <QcMoneySummary audience="internal" title="Current quote" rows={formattedRows}
    totalLabel="Quote total" total={formattedTotal} />
</section>
```

These variable names are illustrative, not new application state. Do not introduce new business handlers to make this example compile.

## Scope exceptions that must remain explicit

The single `main:has(> [data-qc-ui='v2'][data-qc-page='quote-builder'])` selector allows the existing parent main to grow to the approved 1440px wide pattern without editing authenticated layout.tsx. It cannot match another route's main unless that exact builder root is present. Its literal width is necessary because child-scoped custom properties do not inherit up to the parent. Without :has support the old width remains usable.

Some legacy Tailwind utility classes remain inside preserved review tables and creation fields. Their v2 adapters override only this migrated subtree. Do not bulk-reformat unrelated JSX just to remove old classes. Existing PDF-picker and storage-quota dialogs remain legacy; they require their own integration/stacking tests.
