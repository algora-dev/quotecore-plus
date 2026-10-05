# Measure a Job - Dashboard Entry Spec

**Status:** SPEC - approved direction by Shaun 2026-09-10. Implement on go.
**Decision:** Option 1 - dedicated button + modal that creates a digital-takeoff quote directly and lands the user at the plan upload step.

## UX
1. Dashboard gets a prominent "Measure a job" primary button (above the six cards). Copy: title "Measure a job", description "Measure any type of job using our digital canvas. Upload your own plan or image and measure over the top of it to get quantities and pricing."
2. Click opens a modal with the same steps as new-quote, minus the entry-mode pills:
   - Job name (required)
   - Customer name (optional at this stage - measure-first, customer can be added later)
   - Measurement system radio (metric / imperial ft / roofing squares), pre-selected from company default
   - Trade + collection pickers when GENERIC_TRADES_V1 is on (same as new-quote form)
   - Plan/image upload (reuse FileUploader + PdfPagePicker + signed-upload path from QuoteDetailsForm)
   - Primary CTA: "Start measuring"
3. On submit: create quote via existing `createQuoteWithDetails` with entryMode='digital', then attach uploaded plan to the new quote, then redirect into the existing takeoff flow at the canvas step (same destination the new-quote digital path uses).
4. From there, 100% existing flow - canvas, components, quantities, pricing, then the draft/saved quote.
5. Existing "New Quote" entry stays exactly as is. Quotes-page button is a later follow-up, out of scope here.

## Technical
- New component `MeasureJobModal.tsx` (dashboard-scoped). Reuses: `createQuoteWithDetails` (app/(auth)/[workspaceSlug]/quotes/new/actions.ts), `mintQuoteDocumentUploadUrl`, `saveFileMetadata`, `usePdfPagePicker`, `FileUploader`.
- Entry mode is hardcoded 'digital' - no template selector, no manual/blank pills.
- Billing handling identical to QuoteDetailsForm: structured error results render inline; feature_gated (no digital_takeoff on plan) and quote_limit_reached open the existing UpgradeModal with measure-specific copy; storage_quota_exceeded blocks upload; isOverStorage disables upload.
- Upload ordering: create quote first (get quoteId), then upload plan into quote prefix - same order as the current digital flow to preserve quota/ownership checks.
- Dashboard page passes existing entitlement props (already loaded there for cards/banners).
- Design system: DESIGN_SYSTEM.md rules - rounded-full button, rounded-xl modal card, backdrop-blur-sm bg-black/40 overlay, Heroicons outline.

## Files touched
- NEW `app/(auth)/[workspaceSlug]/MeasureJobModal.tsx` (or dashboard components dir)
- EDIT dashboard page (button + modal mount)
- Possibly small extract of shared upload logic from QuoteDetailsForm if duplication is ugly (keep minimal).

## Verification
- `next build` passes.
- Manual flow: dashboard -> Measure a job -> name/units/upload -> lands on canvas with plan loaded.
- Feature-gated plan user sees upgrade modal, cap user sees upgrade modal.
- Smoke test checklist item added.
