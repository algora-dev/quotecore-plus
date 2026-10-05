# Fixture tooling

`render-static-fixtures.cjs` requires TypeScript and Tailwind in the tool environment. Set QC_SOURCE_ROOT to the repository and QC_FIXTURE_OUT as needed. It renders actual TSX using **inert hooks**, fictional data and blocked action dependencies; never import it from the app. Generated HTML is static, not interactive.

The isolated interaction results are separate: local React 18.2/ReactDOM DOM events with original request/persistence/hydration effects disabled and local draft/focus effects enabled. They do not replace Playwright tests in Gavin's pinned Next app. The local environment's React distribution is not bundled into this repository.

Native browser-print files are only print-layout specimens. Run the production html2canvas/jsPDF path separately.
