# Phase 7 verification — precise scope

## Executed here

| Check | Result | What it does not establish |
|---|---|---|
| Original archive inventory | All 2,954 original paths retained | Newer Gavin branch drift still needs merge review |
| Protected SHA-256 comparisons | 965 protected source/config/dependency paths; zero changes | Not runtime correctness of the underlying baseline |
| TS/TSX parsing/transpilation | 59 changed/new source modules; zero syntax diagnostics | Not dependency-complete semantic TypeScript or Next build |
| Relative/alias import and local exported-name resolution | Zero missing imports/exports | Does not verify package APIs, component prop types or server/client runtime boundaries |
| Named non-JSX function/body comparison | 205 original bodies identical; nine reviewed changes; no missing bodies or removed literal form names | Not every inline callback, effect or semantic behaviour; inspect handler-diffs.json |
| Pure view/controller checks | 11 passed: library filters/name search/create chooser, independent store keys, partial errors, message purpose/text/default shape, attachment failure guard, parent routes/protected exits, plan display | Custom deterministic JSX evaluator; not mounted React, hooks scheduling, hydration or backend E2E |
| Source-derived specimen rendering | 40 states, 61 source modules loaded, mocks listed in render-report.json | Sample data; effects and all write/HTTP/router/auth/payment actions forbidden |
| Chromium layout | 160 checks: 40 states at 1440×1000, 390×844, 320×720 and 844×390; no page-wide overflow or uncontained off-viewport elements | Full shell/device keyboard and safe-area behaviour not simulated |
| CSS interaction feedback | Distinct default, hover, focused outline, and pressed gradient/inset on shared primary library control | Not every control/state, real nested modal focus or accessibility audit |
| Route inventory | 65 authenticated page entries mapped to their parent/exit owner | Source routing check only, not 65 live page visits |

Wide catalogue data intentionally stays inside labelled keyboard-focusable scroll regions. This is not hidden body overflow. Native supplier time controls stack on narrow phones. Screenshots depict static source views, not the deployed app. Icons from external packages may use fixture placeholders; in-app icons remain the existing packages.

## Not performed

No `npm install`, `npx tsc`, `npm run build`, dependency-complete lint, live browser login, database writes, saved-template tests, Send/PDF/Stripe flows, real soft-keyboard tests or deployment. This follows Gavin's REV 2 instruction, not a missing prerequisite request. Gavin must perform all release gates before owner acceptance.

## Reproduce source evidence

Scripts are in `validation/tools`; they use existing TypeScript/Tailwind packages only. Set `QC_ROOT` to the repository and `QC_VALIDATION` / `QC_FIXTURES` to an output directory. For original-handler comparison set `QC_BASELINE_DIR` to an extracted baseline source tree. The included SHA inventory is enough for protected file comparison; missing baseline source is explicitly reported and must not be interpreted as a handler pass.

`check-source.cjs` → `exports.cjs` → `invariants.cjs` → `interaction-checks.cjs` → `mobile-audit.cjs`. Layout: `render-fixtures.cjs`, `build-css.cjs`, then `browser-checks.py` (Python Playwright and Chromium). No web server or external fetch is required. These tools are review aids, not substitutes for the app's own test commands.

Reports are exact completed-run evidence; package checks and before/after hashes are in the manifest. Complete release acceptance is `RUNTIME_CHECKLIST.md`.
