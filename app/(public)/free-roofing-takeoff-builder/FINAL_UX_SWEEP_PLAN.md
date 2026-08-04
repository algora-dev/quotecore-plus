# Free Roofing Takeoff Builder - Final UX Sweep Plan

**Status:** Proposed - implementation requires Shaun's approval  
**Prepared:** 4 August 2026  
**Scope:** Setup controls, supplier provenance, result actions, and supplier enquiry  
**Non-goal:** Redesigning approved roof-area and component-entry modules

## Outcome

Make the final builder quieter, keep the pricing supplier unmistakable, and make every result action predictable without losing the user's takeoff.

## Confirmed Findings

1. The setup bar gives mode, units, supplier, guidance, unit changes, and restart equal weight, competing with the calculator.
2. Supplier provenance is the only setup detail that must remain visible while calculating.
3. `Send to supplier` and its modal already exist with contact, message, quantity/pricing/result-link, and attachment controls.
4. The missing Apex action has a confirmed contract cause: the list returns `enquiriesEnabled: true`, the supplier-specific library omits it, and the slug-based builder defaults it to `false`.
5. Convert replaces the builder tab; Open QuoteCore+ leaves the results modal open; Print uses the current modal.
6. Changing supplier can leave old product IDs attached to the new library and produce missing or inconsistent prices.

## UX Direction

### Compact supplier strip

```text
Pricing from  Apex Roofing     Change supplier                 Settings  v
```

- Keep **Pricing from**, the orange supplier name, **Change supplier**, and **Settings** visible.
- Show **QuoteCore+ test pricing** for the virtual supplier.
- Remove `Back to unit selection`; Settings replaces that duplicate path.
- Stack supplier context above controls on mobile.

### Expandable Settings

| Setting | Value | Action |
|---|---|---|
| Measurement method | Actual / Plan + pitch | Change method |
| Measurement units | Metric / Imperial / Roofing squares | Change units |
| Guidance | Guided / Fast | Segmented control |
| Supplier | Current source | Change supplier |

- Put **Start over** in a separated destructive footer.
- Default collapsed; use `aria-expanded`/`aria-controls`; Escape closes and restores focus.
- Keep confirmation for incompatible mode/unit changes.
- Supplier changes preserve dimensions and labels, then remap products to each new component default. Never retain stale pricing.
- On load/remap failure, retain current state and show an inline error.

### Primary Send action

1. **Send to Apex Roofing** - orange-emphasis top item
2. **Print / Save as PDF**
3. **Convert to Quote**
4. **Open QuoteCore+**

- Send opens `SupplierEnquiryModal` directly without redundant confirmation.
- Keep the report behind the enquiry modal.
- Show a disabled explanation when a real supplier cannot receive enquiries; do not silently hide it due to incomplete data.
- QuoteCore+ test pricing has no send action.

### New-tab non-send actions

- Print, Convert, and Open QuoteCore+ open with `_blank` and `noopener,noreferrer` from the click.
- After a successful open, close the results modal in the original tab and preserve all builder state.
- If blocked, keep the modal open and show a fallback link.
- Print opens the canonical result in `?print=1` mode with a Print / Save PDF CTA; do not clone modal HTML.
- Disable Print with `Preparing report...` until the signed result URL exists; show retry on failure.

## Technical Plan

- Add `enquiriesEnabled` to `PublishedTakeoffLibrary`, select `enquiries_enabled`, and return it for latest/versioned responses.
- Remove the silent UI `false` fallback while retaining a safe disabled state.
- Extract `BuilderSettingsPanel.tsx`; keep calculation state in `RoofTakeoffBuilder.tsx`.
- Add one atomic supplier-change path for loading, product remapping, and rollback.
- Replace generic `pendingAction` branching with explicit handlers; only close results after a new window opens.
- Track menu/send/print/quote/signup/popup-blocked events.
- Remove enquiry debug logging and add dialog labelling, Escape, focus containment/restoration, and double-send prevention.
- Verify pricing opt-out removes pricing from every submitted representation.
- Add a print client control to the canonical signed result page.

## Expected Files

- `app/(public)/free-roofing-takeoff-builder/RoofTakeoffBuilder.tsx`
- `app/(public)/free-roofing-takeoff-builder/BuilderSettingsPanel.tsx` (new)
- `app/(public)/free-roofing-takeoff-builder/ResultsModal.tsx`
- `app/(public)/free-roofing-takeoff-builder/SupplierEnquiryModal.tsx`
- `app/(public)/free-roofing-takeoff-builder/result/[id]/page.tsx`
- `app/lib/supplier-pricing/publishedTakeoffLibrary.ts`
- focused unit/component tests and one Playwright public-flow spec

No database migration is expected. Apex already has enquiries enabled in the live supplier profile.

## Validation Matrix

### Layout and settings

- Supplier context remains readable at 320px, 768px, and desktop widths.
- Settings has no overlap or horizontal scroll; long supplier names truncate safely.
- Component modules and calculation layout remain unchanged.
- Actual/plan, all unit labels, and Guided/Fast display and behave correctly.
- Cancelled destructive changes preserve the full takeoff.
- Supplier change preserves measurements and prices only from the new supplier.
- Start over clears mode, supplier, units, pitch defaults, custom components, and entries.

### Result actions

- Apex shows **Send to Apex Roofing** first on direct and picker routes.
- Send opens the enquiry form without confirmation.
- Print, Convert, and Open QuoteCore+ each open one new tab, close results in the original tab, and preserve builder state.
- Popup-blocked behaviour provides a fallback link.
- Print is disabled until the signed result URL is ready.

### Enquiry

- Quantity, pricing, and result-link toggles alter the payload correctly; pricing can be excluded completely.
- Valid PDF/JPG/PNG/WebP files upload; invalid type, over-10MB files, and more than five files fail clearly.
- Loading, success, API error, upload error, and double-click cases behave correctly.

### Accessibility and quality

- Keyboard operation and focus return work across Settings, Actions, and enquiry.
- Escape closes the topmost open surface.
- No debug logging remains in the touched flow.
- Existing roof-takeoff tests and focused Playwright action-flow tests pass.
- `npm run lint` passes for touched files.
- `npm run build` passes before any commit or push.

## Delivery Sequence

1. Fix and test the supplier-library enquiry contract.
2. Build the compact supplier strip and Settings disclosure.
3. Preserve measurements and safely remap pricing on supplier changes.
4. Refactor actions and restore Send to Supplier.
5. Add canonical print-tab mode.
6. Harden enquiry accessibility and payload behaviour.
7. Run focused tests, responsive checks, lint, and production build.
8. Review locally with Shaun before committing or pushing.

## Definition of Done

- The collapsed top area shows only supplier provenance and two clear controls.
- Apex always has a working **Send to Apex Roofing** action first.
- Send opens the full pricing/attachment enquiry modal.
- Every other action opens a new tab and returns the original tab to the intact builder.
- Supplier changes cannot retain stale pricing.
- The touched flow is responsive, accessible, tested, lint-clean, and build-clean.
