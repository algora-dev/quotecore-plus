# Phase 4 | Desktop Digital Takeoff UX

**Status: implementation candidate for Gavin integration, real-app verification and owner preview. Not deployed or runtime-approved.**

Baseline: `quotecore-plus-phase3-integrated-2026-09-24(1).zip`, supplied on 24 September 2026. Root `INTEGRATION_UPDATE.md` identifies integrated commit `750db73a`; that root update supersedes older, inconsistent historical phase notes. Phase 1, 2AB and 3 are integrated/owner-approved. The owner approved this desktop implementation scope in the current conversation. That is not approval of its eventual browser result.

Read `INTEGRATION.md`, `CAPABILITY_PARITY.csv`, `PARITY_CHECKLIST.md`, `COMPONENT_CONTRACTS.md`, `STATIC_VALIDATION.md`, then the machine-readable change/invariant manifests. UX authority: complete companion standard v2.4, with unchanged palette/tokens and additive C52/C53/C54 contracts.

## Delivered

A fitted desktop host around the same workstation; compact identity and Finish & save; plan/calibration status and stable guidance; a solid areas/components working panel; separate component selection, disclosure and library access; grouped persistent drawing tools; history/view controls; Reset takeoff relocated to the panel footer; scoped standard dialogs and upload presentation. Existing drawing colours remain domain information. No right inspector, floating window manager, alternate canvas, browser fullscreen, saved-status fiction or new measurement wizard.

`fixtures/desktop-measured.html`, `desktop-library.html`, `desktop-calibration.html` and `desktop-upload.html` are **non-React static source references**. The plan is a frozen crop of the owner's screenshot. Sample data, illustrative shell, and responsive image sizing are fixture-only. They do not exercise Fabric, React state, routing, geometry or persistence. Never deploy these as the app.

## Boundaries

Engine/state/calculation/save code stays with the existing owner. No `app/lib`, APIs, actions, schema, permissions, configs, packages, tests, Smart Assistant or mobile module was changed. Quotes/Drafts, Job Spaces, Advanced Builder, one sidebar tab, `/q-mark.png` and notification polling are preserved. AI calibration's interactive review panel and controller are deliberately retained; it must not become an inert blocking modal. The dedicated mobile layout is not redesigned or restyled.

Shared desktop markup is still mounted beneath mobile, so mobile switching and pending-dialog regression tests remain a required integration gate. Source preservation is not a claim of runtime equivalence.
