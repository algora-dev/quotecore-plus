# Mobile evidence and boundaries

## What was checked here

Source inventory covers all 62 `app/(auth)/[workspaceSlug]/**/page.*` routes. `validation/mobile-routes.csv` classifies the inherited deterministic return route vs a feature-owned exit. This is source review, not 62 executed mobile journeys.

Twenty actual JSX/CSS specimens were rendered with sample hook state at 320×640, 390×844, 768×900, 1280×800 and 1440×1000. All 100 fit checks passed. Measured checks: document scrollWidth, horizontal visibility of ordinary controls, and dialog/floating-panel bounds. Canvas-internal overflow is explicitly permitted inside its focusable local scrollport. It is not page-wide overflow.

Additional real Chromium checks covered native dialog background inertness over repeated Tab navigation (browser-chrome/BODY cycles allowed) and the long tutorial footer after body scroll at 320×844 and 320×480. React focus restoration, soft-keyboard changes and pointer gestures were not exercised by those static specimens.

## Applied rules

- Ordinary page controls wrap and remain labelled; library actions never depend on hover.
- Drawing names/fields stack on phones. The same canvas retains intrinsic dimensions with local scrolling rather than CSS scaling coordinates.
- Measurement panel follows the canvas on narrow screens. This is not a replacement for the separate protected mobile Takeoff interface.
- Floating angle controls constrain themselves to the visual viewport; header/footer are outside the body scroll area. Desktop drag/resize remains available.
- Tutorial header/footer stay reachable; long content scrolls inside the dialog. Image help has a tap/click entry and explicit Close.
- Existing shell return pattern and workspace exit exceptions are unchanged; drawing detail and tutorial pages have explicit return targets.

## Device acceptance still required

On the owner's real phone: keyboard open/close, orientation changes, pinch/browser zoom, PWA standalone safe areas, nested help Escape/Back and focus restore, File picker/camera behaviour, actual download/print support, slow/failing requests, long names, and repeated drawing save/edit. Verify 320px where supported, plus the real desktop/laptop layout. No CSS `overflow-x:hidden` mask has been used to hide lost controls.
