# Phase 7 decisions and boundaries

| ID | Decision / authority | Implementation |
|---|---|---|
| P7-D01 | Owner approved full Phase 7 plan and two template destinations. | Resources → Document Templates / Message Templates. No table consolidation. |
| P7-D02 | Owner approved current orange-gradient primary / near-black secondary / rectangular controls. | Reuse C01/C27/C53/C61–C63, add opt-in C64 and C65. No palette/core token changes. |
| P7-D03 | Actual source overrides the earlier approximate audit. | Invoice templates retain header/footer/payment/notes/terms. Quote structures remain estimating presets alongside quote headers. |
| P7-D04 | Message source kinds/defaults are protected contracts. | General (`custom`) supports cross-document wording; all company messages stay selectable in all existing Send flows. Purpose is not an eligibility restriction. Default stays company-wide. |
| P7-D05 | Mobile back sweep must not bypass stateful workspace exits. | Deterministic ordinary-page parents; protected editor routes opt out of the shell fallback. No history-only return, remount keys or polling refresh. |
| P7-D06 | Named library records keep their saved identity. | No automatic renaming, prefixes in storage, data migration or selector-ID changes. Type-qualified React keys prevent collisions between different stores. |
| P7-D07 | Successful template writes must become visible in a new aggregated route. | Explicit refresh after success or manager close; not periodic refresh. Existing actions/revalidation paths are not changed. Gavin verifies cache freshness. |
| P7-D08 | P6 carryovers are authorised, not a broad backend refactor. | Client/owned-loader error context, cancellation and tutorial URL only. Plan display consumes current inputs; signup uses existing pricing link. Guarantee wording retained because plan data contains no policy terms. |
| P7-D09 | The incoming copy-existing quote-header choice has no working handler. | Retained, explained and cannot silently behave as scratch. The working scratch route remains the default. `AGENT-TODO P7-TEMPLATE-01` for a real copy implementation. |
| P7-D10 | No duplicate feature where unsupported. | Library exposes existing create/edit/delete and header preview only. Full templates remain type-specific forms, not a new output renderer. |
| P7-D11 | REV 2 source verification here; Gavin owns release gates. | No install/build loop. Actual app compilation, runtime/device checks and deploy stay with Gavin. |

No builder-internal presentation exception is taken. C59/C60 recipient renderers, Takeoff and Smart Assistant remain unchanged. Mobile editor internals are neither redesigned nor claimed re-tested in these isolated specimens.
