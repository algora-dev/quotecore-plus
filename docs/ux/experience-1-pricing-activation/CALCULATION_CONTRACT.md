# Single-component test / calculation contract

Source: `app/components/pricing/componentTest.ts`. Imports existing pure `applyPitchAndWaste`, `computeMaterialCostByStrategy`, `computePackCount` from `app/lib/pricing/engine.ts`, and existing input/display conversion helpers from `app/lib/measurements/conversions.ts`. Quote/manual-entry caller convention: `app/(auth)/[workspaceSlug]/quotes/actions.ts` (`addComponentEntry`, `recalcComponentFromEntries`). All these protected files are unchanged.

1. Validate sample and the active draft fields only. Blank costs are not assumed free; explicit zero unit/labour cost is accepted. This test-only strictness does not rewrite the existing component save validation. Inactive stale pack/pitch/waste fields do not invalidate unrelated tests.
2. Convert entered measurement to canonical units through current helpers. Preset length×height uses saved/draft height mm; preset-depth volume uses input area×depth mm. Freestyle area / true volume accept an already-calculated area/volume, matching manual-entry behaviour. Fixed cost uses one; time uses the entered count on the displayed unit basis.
3. Apply configured pitch only to an explicitly chosen plan measurement. Already measured/on-slope is the default; no double application. Require valid degrees when plan/pitch is selected. No pitch field for an unpitched component.
4. Apply the configured percentage or fixed waste via the existing engine. Multiple manual lengths each receive the existing manual-entry allowance. Fixed-per-segment is explicitly a *manual-entry fallback*, not simulated Takeoff geometry or segment history.
5. Sum adjusted quantities, then price purchased material through the existing strategy. Whole pack rounding is on the aggregate requirement. Existing coverage-per-pack records use coverage, not the numerical pack-size field, for purchased coverage.
6. Labour uses the adjusted measured quantity (after pitch/waste), not the rounded-up purchased coverage. This is the current quote caller convention. No new labour-waste policy.
7. Component cost = material+labour, before quote-level margins/tax/overrides. Effective cost is divided by the sum of entered test measurements in their selected unit, and is labelled *for this test*. It does not rewrite a saved rate.

## Worked isolated example (illustrative inputs, not recommended prices)

120 m², no additional pitch, 10% waste, 50 m²/pack, GBP200/pack, GBP4 labour/m²:
132 m² required; 3 packs; 150 m² purchased; 18 m² spare after allowance; GBP600 material; GBP528 labour; GBP1,128 component cost; GBP9.40 per entered m².

With plan measurement + configured rafter pitch at 25°, existing pitch helper applies before waste; exact engine arithmetic is retained. No rounded display value feeds back into calculation.

## Existing constraints made explicit

- Generic Trades controls remain flag-gated; stored pack data is still used read-only for testing when its editor controls are off.
- Whole-pack strategies exist for the supported length/area/volume classes, not arbitrary count-box units. Do not invent new quantity-pack pricing in UI alone.
- The current engine requires a positive pack price; a zero-cost pack test is rejected rather than claiming a free-material result. Explicit zero per-unit material or labour is supported.
- Hours/days display choice is not a persisted conversion policy. Rates and entered times must use the same basis; switching the label never invents hours-per-day.
- Imperial conversions preserve the repository's existing precision constants and output rounding. Do not substitute independent conversion arithmetic for cosmetic exactness.
- Component overrides on a quote, roof areas, quote margins, tax, job-specific pricing, Takeoff object geometry and historical quote repricing are not part of this sample.

A match between tester and helpers is not sufficient proof of end-to-end quote parity. Gavin must compare the sample against an actual quote in the runtime checklist.
