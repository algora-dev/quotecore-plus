# Gavin integration | Phase 4

## Apply to the supplied integrated baseline only

This is the whole repository, not a patch. Keep the root `INTEGRATION_UPDATE.md` as the incoming baseline record. Compare the explicit changed/new source list before overlaying it onto any newer branch: if your integrated repository has advanced, port only reviewed presentation diffs; do not overwrite newer assistant/mobile/backend work with this archive. No merge to main until the existing owner-controlled programme allows it.

No dependencies, config, server actions, service credentials, schema or migrations are required. This pass did not start the app, install packages, call services, run a project build/typecheck/lint or execute e2e. Next's locally bundled guide was not supplied (no node_modules); no Next API was introduced, and existing imports/navigation semantics were retained.

## Review units

1. **Frame and tools:** TakeoffDesktopHost + route wrapper + Workstation presentation + C52 and additive icons. The host observes document chrome to set one CSS height variable. It never reads/writes Fabric. The protected inactive touch-shell 125% wrapper is corrected by a desktop-scoped direct-child rule, not edited. It stays mounted across desktop/touch switching. Existing shell hides navigation, and the existing orange tab controls it.
2. **Panel and dialogs:** areas/components views, two independent native actions for selection/disclosure, the library disclosure state, status/help copy, and C53. All legacy event callback expressions and disabled expressions are retained. C53 delegates to existing C27; no second dialog controller. Context is FALSE by default and for the hidden desktop owner beneath touch. PDF and billing modal adapters are shared but change appearance only inside this explicitly reviewed scope. Recheck nested top-layer order, Escape, submit and focus return.
3. **Acquisition:** MeasureJobModal opts into scoped dialog/button recipes and existing FileUploader v2. QuoteDetailsForm changes only FileUploader's appearance prop. FilesManager already uses v2 and is byte-unchanged. The no-plan server recovery branch remains byte-unchanged and still opens the quote to attach a plan. No satellite acquisition was invented.

Land these together for the preview: new CSS/components are required by the changed views. The units are for diff review, not permission to ship a half-styled route. C53 should not be enabled at the entire application root.

## Protected behaviour

The 104 existing Workstation JSX event expressions survive (two presentation handlers are added for the library disclosure and its focus retention). Every original pre-return executable statement survives; only one presentation `useState(false)` is added. All other migrated event/disabled expressions survive. This is a source-level invariant, not proof of event propagation or canvas accuracy.

The single `<canvas ref={canvasRef}>` and its immediate two JSX div ancestors remain in place. No key, conditional second canvas, router.refresh, refresh timer, canvas sizing transform, or imported pricing/geometry helper was added. Do not animate the canvas size during a gesture. The source's manual zoom, native canvas scrolling, auto-fit, pan, pending drawing and history contracts must pass the real tests below.

## Known pre-existing issue / AGENT-TODO

**P4-AI-COST-01:** introductory AI quality hints and the shared point-cost contract use 2/6/12; the existing local quality-choice affordability comparison uses 2/4/8. The visible hint, comparison and billing helper were deliberately not altered. A source AGENT-TODO marks the comparison. Reconcile this through the owned cost/guard implementation in a separate reviewed fix, and test balances around both thresholds. Do not silently relabel costs in UI to make the mismatch disappear.

No backend placeholder or new service requirement was introduced. Existing skip/recovery/feature-gated paths remain. Existing multi-line running-value formatting and measurement units were not 'corrected' cosmetically.

## Runtime gate before owner preview

Run the repository's established install/build/lint/typecheck/tests in your environment. The deployments share production Supabase: use owner-approved fixtures and controlled writes. Follow PARITY_CHECKLIST.md. Prioritise click-to-coordinate accuracy after resize/tab/help/dialog cycles; manual zoom preservation; multi-page ownership; undo/redo; failed save/retry; pending nested PDF upload; and desktop/touch switching while dirty. Compare a saved before/after measurement set and Advanced Builder totals without changing inputs.

Review 1440, 1280, 1024 and narrower desktop widths; sidebar hidden/expanded, notices present, Help Drawer open, keyboard-only dialogs, reduced motion, coarse pointer and forced colours. Narrow manual-desktop mode scrolls horizontally rather than pretending to be the separate mobile workflow. Verify required notices and header wrapping do not cover Finish & save.

A rollback is the explicit Phase-4 UI file set + new presentation files, not any of the protected baseline modules. Obtain owner preview approval and supply the next integrated archive before a new phase.
