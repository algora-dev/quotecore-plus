# Validation and limitations

## Completed here

- 14 changed/new TS/TSX modules transpile without syntax diagnostics using installed TypeScript. This is **not** application typechecking.
- 104 local imports resolve. No added `any` tokens. Original source retention and boundary hashes checked against the actual received ZIP.
- 96 normalized-AST equality assertions: existing message controller/matrix, free canvas owner/branches, uploads, report helpers/conversion/save, component payload and catalogue/supplier actions; order renderer props remain equal.
- 65 isolated browser interaction assertions on actual changed components, with explicit mock services. The assertions and result names are in `validation/interaction-results.json`.
- 60 layout cases: 15 states × 1440/1024/390/320 pixels. No page-wide overflow, off-screen native dialogs/fixed footers or JavaScript errors in those fixtures.
- Six short-viewport checks at 320×380, 390×420 and 740×390 for the two fixed-action dialogs. These simulate small visual space; they are **not** real keyboard/device tests.
- Four browser-print fixtures: short roof (1 page), long roof (2 pages / 28 entries), cladding (1 page) and flooring (1 page). Verified entry counts, no action chrome, totals, and visually inspected rendered pages. Fixed a header-only leading page by allowing long groups to fragment while keeping each measurement row whole.

## Fixture provenance

`bundle-inventory.json` records actual source modules and stubs. The isolated host uses React 18.2.0 / ReactDOM 18.2.0-next from an available historical test runtime, whereas this application specifies React 18.3.1. CSS is the current production v2/feature source plus Tailwind 4.1.10 utilities; no external font is required. This is a compatibility fixture, **not a Next production build**. Page header/frame and sample records are scaffolding; the relevant editor/list/dialog/report components are actual implemented source.

Next router/Link, fetch mutations, notification actions, supplier/catalogue/order services and PDF helper are mocked; CSV parsing uses a small test-only stub (not Papa’s real parser). The saved OrderBody and Send controls are boundary placeholders; their application files remain unchanged. The report fixture uses actual existing pitch/waste and conversion helpers with example payloads. No real upload, canvas engine interaction, cloud service, email, record save, browser-account handoff or credit spending occurs.

Screenshots and print specimens are explicitly labelled sample/source review. They are not photographs of the deployed app or proof of live performance. New fixture/build scripts are intentionally **not included** in the return under Darren’s no-installers/no-new-scripts protocol; structured result logs, provenance and static images are supplied instead.

## Not executed here

Full TypeScript/Next build/scoped ESLint, roof regression suite, authenticated access/RLS, live mutation persistence, real images/PDF conversion, real canvas/touch and credits, actual exported customer/order PDF pipeline, signup continuation, OS keyboard and physical-phone Safari/PWA. Darren’s handoff explicitly assigns these gates to integration. No dependency changes or blocked npm-install workaround is required.
