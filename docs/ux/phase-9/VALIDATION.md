# Validation summary

These are source/callback/specimen checks, not the live application.

| Evidence | Result | Limitation |
|---|---|---|
| TypeScript parser, relative imports, duplicate JSX props, CSS token definitions | Passed in `validation/source-report.json` | Not full semantic tsc or Next build |
| API/outcome contracts | 29 passed | Supabase, guard and responses substituted; real RLS/provider behaviour not executed |
| Actual-source callbacks | 48 passed | Named state/ref evaluator, effects and React scheduler disabled |
| Invariants | 33 passed | Raw protected hashes, LF-canonical AST statement tokens, route existence; not behavioural equivalence proof |
| Native source fixtures | 20 rendered | Sample records/state, labelled placeholder canvas, no Fabric rendering |
| Chromium | 105 passed | 100 layout checks + 3 native-dialog background-focus + 2 tutorial-footer checks |
| Workspace mapping | 4 passed; 62 page routes inventoried | Pure mapping, not 62 actual mobile sessions |
| Package/hash audit | See standalone QuoteCore-Phase-9-Package-Checks.json | Does not establish runtime quality |

Twenty layouts cover drawing library/empty/upload/deletion/view/load-error, workstation/load/edit-value/point-confirm/select-all, angle error/result/modal/help, tutorial library/long/intro, Inbox partial outcome and quote-header failure. Viewports: 320×640, 390×844, 768×900, 1280×800 and 1440×1000.

The first test run found three selectors/setup assumptions and a native dialog test that incorrectly treated browser-chrome focus as background-control focus. These test defects were corrected, then the complete checks were rerun. The final report still records every focus step; the assertion now checks that background controls cannot receive focus while permitting native browser-chrome cycling. This is not a React focus-restoration test.

Source-only syntax checks here do not resolve all library types. No full Next build was attempted in this pass, per Gavin's explicit Phase9 loop. No real credentials, database writes, sends, checkout, installed PWA, canvas gestures or production PDF operations were tested.
