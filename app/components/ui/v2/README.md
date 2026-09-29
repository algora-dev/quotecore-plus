# QuoteCore+ v2 shared presentation primitives

Use an explicit `data-qc-ui="v2"` scope. The latest integrated source, phase handoff and current standard supersede the old Phase1 candidate notes. Preserve native props, stable domain IDs, event owners and dirty/submit guards. Do not put pricing, provider calls or permissions in presentation components.

Current families include C01 buttons, field/surface primitives, C27 native dialogs, C53 hosted scopes, Document Studio selection/output adapters, C61/C63 journey composition, C64 libraries, C65 deterministic mobile returns and C66 persistent local operation feedback. Exact contracts live in each implementation and the relevant phase documentation.

Phase9 adds **C67 QcDrawingWorkspace** and **C68 QcToolHelp** in `QcDrawingWorkspace.tsx`, with opt-in `qc-drawings.css`. C67 is chrome around a fixed-coordinate drawing, not a new canvas controller. C68 is click/tap help reusing C27 rather than hover-only overflow. Neither owns geometry, history, requests or saves. Never apply drawing selectors to Takeoff/Smart Assistant globally.

`qc-tokens.css` remains unchanged. Dialog Escape/backdrop policy stays owned by the feature and existing shared controller. Error/result notices must describe actual outcomes, not inferred success or an unconfirmed server rollback. App typecheck/build and real-device/runtime parity remain the integration gate.

## Pricing Activation / standard v2.11

C69 `SmartComponentEditor`, C70 `ComponentTestPanel`, and C71 `PricingIntroduction` live under `app/components/pricing/`, scoped by `pricing-activation.css`. They reuse the v2 controls; no palette/token changes. C69 keeps existing library save ownership; C70 uses a read-only draft adapter around existing calculation helpers and never persists. Sample controls explicitly detach from the parent form. C71 is personal optional guidance, never a price-readiness classifier. Desktop side-by-side / mobile same-state Settings-Test view contract and exact runtime gates are in `docs/ux/experience-1-pricing-activation`.
