# Phase 4 source-derived static references

Open `desktop-measured.html`, `desktop-library.html`, `desktop-calibration.html` or `desktop-upload.html` beside `fixture.css` and the PNG assets. These are non-React source fixtures, not the application. Sample job/component data and a frozen crop of the owner-provided plan replace live state and Fabric. The surrounding shell is illustrative; it does not exercise the production sidebar, Help Drawer or notices. No event callbacks are executed; disclosure states are separate documents.

The Workstation return JSX and the actual QcButton/QcIcon/QcCanvasChrome/QcSurface source produce the main markup. C53 is represented with a native dialog, not its React lifecycle. The CSS is compiled from the returned styles with a preinstalled Tailwind 4.1.10 utility compiler. The canvas image has fixture-only sizing; this is NOT a CSS transform applied to the production canvas. Original measurement calculations and coordinates were not rendered or validated here.

`source-provenance.json`, `css-provenance.json`, `browser-layout-checks.json` and `browser-feedback-checks.json` describe the boundaries. Screenshots are static Chromium captures at desktop widths 1440, 1280, 1024 and 800; 800 is manually selected desktop, not the dedicated mobile layout. The 800 canvas can scroll locally. It is not a promise of full phone support.

The optional generators in `../static-tools/` need existing TypeScript/Tailwind and Python Playwright/Chromium. Do not install/start services merely to reproduce these. They use `page.set_content` with inline assets and blocked requests, never the application URL. Their output is layout/CSS feedback evidence only. Consult `../PARITY_CHECKLIST.md` for actual release gates.
