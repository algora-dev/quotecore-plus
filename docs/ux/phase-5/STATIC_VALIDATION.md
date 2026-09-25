> Historical first Phase 5 style pass. Superseded by `../phase-5-final/README.md`; its tests and behavior descriptions are not final-pass evidence.

# Phase 5 — validation record (2026-09-25)

## Completed here

- **10 changed/new TSX files:** TypeScript 5.8.3 transpile/syntax diagnostics: zero errors. This is not a project typecheck or lint.
- **Four main editor source comparisons:** all 196 original event-handler expressions, disabled expressions, native value/checked/min/max/step bindings and guide selectors retained. Quote has three additional presentation bindings. Controller statements retained, with the documented Visual Order collapsed-panel initializer exception. See SOURCE_BINDING_AUDIT.json.
- **Input-byte comparison:** all 2,505 original files retained; 2,495 byte-unchanged. Nine existing presentation source files and the design changelog changed. Two source files added. Supporting-file exceptions separately checked: order-page outer class, AddItemModal v2 prop and QuotePreview's three pencil accessible names. All other original files, including Takeoff/mobile/Smart Assistant, app/lib, API/actions, configs, dependencies and shell, match the incoming ZIP. See BASELINE_BYTE_CHECK.json.
- **New scoped CSS:** no top-level parser errors; no undefined QuoteCore token references.
- **19 source-derived static specimens × 5 viewport widths = 95 measurements**, at 1440/1280/1024/800/390 pixels: no page-wide horizontal overflow. Long paper remains intentionally scrollable inside its preview region. See fixtures/layout-check.json.
- Static specimens cover Quote, collapsed/empty/full-size/line-edit/add-item states, Labour Sheet, Invoice Items/Details/paid/line-edit/add-item, Line Order, Visual single/double/collapsed/empty/add-item and the two-choice order picker.
- Representative primary-button normal/hover/keyboard-focus/pressed styles were measured in Chromium and differ visibly. See fixtures/control-state-check.json. Representative wide/narrow layouts and dialogs were visually reviewed; these are static captures.

## Not run here — required before release

Actual Next/React application build, locked-dependency typecheck/lint, hydration, authenticated routing, native dialog focus return, real event propagation, autosave timers, backend failure paths, document sending, payments/status transitions, print/PDF, production or Supabase writes, e2e and assistive-technology testing. Dependencies were absent and could not be installed in this isolated environment. No bundled Next guides were available; no new Next API was used.

The specimens evaluate TSX with inert hooks; they **do not mount React**. They use fictional data and an available offline Tailwind compiler (4.1.10), not a verified application CSS build. They omit external controllers rather than executing them. Supplied tools make that limitation explicit. The review screenshots are not evidence that the running product has passed.

## Next gate

Gavin: merge against the named input ZIP, preserve any newer branch work, build and follow PARITY_CHECKLIST.md with approved fixtures/recipients. Review all five formats together, including stored `double` orders and the Labour Sheet reuse. Address AGENT-TODO P5-SAVE-01, P5-PAY-01, P5-AUTO-01 and P5-TAX-01 through owned code as appropriate. Owner approval follows an actual preview deployment.
