# Runtime acceptance checklist | Gavin

Record browser/device/build, fixture IDs, results and before/after measurements. **Unchecked below = not run by the external agent.** All write tests require owner-approved fixtures because preview and production share Supabase. This document does not authorise a broad production harness.

## Entry and gates

- [ ] Enter via Measure a job, New Quote Digital, Advanced Builder Use/Edit Takeoff, and FilesManager; resume existing measurements and a new job.
- [ ] Required job/upload, company measurement default + irreversible-system confirmation, generic trade/collection, entitlement/monthly cap/storage cap, PDF selection/cancel/error, invalid formats/size, upload failure/retry, quote-created-but-plan-missing recovery.
- [ ] PDF picker above upload/entry modal; storage/upgrade above the owning prompt; all explicit Cancel/Close/Enter/Escape behaviour and focus return. No backdrop closes a modal. No lost selected PDF page or orphan loading state.

## Calibration and drawing

- [ ] Manual 1/2/3 references, meters/feet/roofing squares, known-distance validation, confirm/cancel/recalibrate draft and failed commit. Compare known measured geometry to baseline.
- [ ] AI flag off/on; chooser manual/AI/not-now; original interactive AI review permits marker editing on canvas; accept/reject/failed review/page switch. No modal scrim traps the review canvas.
- [ ] Polygon closure, rectangle drag/release/cancel, pitched roof prerequisite, generic area path, line Single/Multi and double-click Finish, point repeat, type-triggered tool changes, component selection separate from disclosure.
- [ ] Volume custom depth, LxH, multi-line LxH, freestyle and point prompts; confirm/cancel and minimums/units. Pitch photo modes/levelling/rotation/reset/apply and area pitch application timing. No round-trip differences in stored quantities.
- [ ] Add/switch/delete/hide areas; multiple polygons, multiple plans per area, page-specific scales, child page chips, cross-page measurements and in-flight work. Compare saved page/area ownership.
- [ ] Libraries, collection search/no matches/empty library/add first component/focus retention; selected-component tool; independent multi-open measurement disclosures; every measurement visible via panel/list scroll; row hover, eye and delete; component remove.
- [ ] Existing-area attachment: plan vs pitched basis and all selections. AI placeholder all real-component choices, already-active merge, no-real-library status; uncertain pink group inspect/delete/manual replacement.
- [ ] AI quality, affordability/billing and errors, outline/scan progress/results, unreadable image, names/pitch-all/acknowledgement, cancellation and timeout. Reconcile P4-AI-COST-01 independently before relying on its local affordability UI.

## State, canvas and persistence (release blockers)

- [ ] Instrument mount count and Fabric instance identity. Repeated sidebar tab cycles, Help Drawer, notification polling intervals, context updates and library disclosure do not remount/reset Takeoff.
- [ ] Exact click/vertex position at several zoom levels before/after window resize, side navigation, header notice, native dialog/body-lock and help-panel changes. Verify retained manual zoom and original initial auto-fit. Do not accept merely 'the canvas is visible'.
- [ ] Native horizontal/vertical canvas scroll, Alt-pan, area drag and multi-line banner dragging; no transparent overlay steals pointer input. No animation changes sizing during an active gesture.
- [ ] Undo/redo after every geometry/component/area type; saved vs fresh Reset restores/clears exactly as before, with the existing confirmation. Reset is not mistaken for Zoom fit.
- [ ] Finish & save success/failure/retry/double-click guard and existing route `build?step=roof-areas`; measured values and downstream pricing/totals unchanged for identical inputs.
- [ ] Save/upload another for existing and new area, chosen file/PDF, failure before/after save, retry/navigation and page image binding.
- [ ] Desktop -> mobile/touch -> desktop through both auto detection and manual choice, including dirty work, calibration, page switch, pending PDF/pitch/confirmation and save. Existing mobile acknowledgement/exit/bridge behaviour; no native desktop dialog leaks into the hidden mobile owner.

## Layout and accessibility

- [ ] 1440x900, 1280x800, 1024x768; supported narrower laptop/tablet desktop; navigation shown/hidden and Help Drawer/required notices. Finish & save, Reset, tools, units, area/page selectors and content remain reachable.
- [ ] Coarse-pointer targets; keyboard Tab/Shift+Tab/Space/Enter, native accessible labels/selected states, visible focus/hover/pressed feedback, disabled controls, no nested interactive elements, zoomed browser text and long labels.
- [ ] Reduced motion/transparency, high contrast/forced colours and a supported Safari/Chromium browser. Solid glass fallback; semantic measurement colours retained. Phone desktop fallback does not replace the separately owned phone layout.

Only after these pass: deploy controlled preview, owner reviews desktop experience, record approval, and return the new integrated baseline for the next phase.
