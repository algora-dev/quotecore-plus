# Final marketing visual QA — 2 November 2026

This report covers the exact source packaged in this handoff.

## Release-critical visual correction

The earlier handoff allowed a dark parent foreground to bleed into light Done For You cards. That produced nearly invisible headings and founder metadata in the handover section. The reconciled source no longer relies on that inheritance: the handover section is light, and its nested light cards explicitly set heading, body, muted, border and surface colours.

The other root process failure was separate preview code. That has been removed from the acceptance process. `docs/visual-acceptance/html/` is generated from the actual TSX/CSS in this package using `tools/render-marketing-source-previews.js`.

## Browser-rendered acceptance surfaces

Checked in Chromium at 1440 × 900, 1024 × 900 and 390 × 844:

- Homepage
- Pricing
- Free Workspace
- Done For You
- Done For You chooser / enquiry modal
- Free Workspace signup modal

Result: **zero page-level horizontal overflow on all six surfaces at all three widths.**

The Done For You enquiry component was additionally rendered in all six form steps plus success state on desktop and mobile. Back/close controls are 44 px minimum; option buttons are at least 46 px high; mobile inputs are 16 px and 48 px high; long form states scroll within the dialog.

## Readability / contrast

Automated rendered-text contrast scanning found no normal explanatory-text failures on the locked surfaces. The only sub-4.5 detections were:

- the decorative orange `+` in the QuoteCore+ logo wordmark;
- the multicolour Google `G` brand mark in the Google auth button.

Neither is explanatory body/control text. The Done For You chooser itself produced zero contrast flags.

## Typography / layout contract

- marketing H1: 43–60 px on the locked pages;
- main marketing H2s: 32–48 px, including the production WorkflowExplorer heading;
- main explanatory body copy: 15–17 px;
- card/support copy uses the approved smaller marketing-card scale;
- primary CTAs use the orange gradient with dark text;
- standard control radius remains 12 px;
- locked content width remains 1280 px with 24 px desktop inline padding;
- mobile/coarse interactive targets across the six acceptance surfaces and every Done For You form step are at least 44 px.

## Static code validation

- TypeScript/TSX files parser-checked: **1,838**
- parser errors: **0**
- executable local imports checked: **6,005**
- missing local imports: **0**
- CSS-module pairs checked on the locked pages/shared surfaces: **8**
- missing CSS-module class references: **0**
- locked Homepage/Pricing/Free Workspace/Done For You routes using `PageV2`: **0**
- accidental `Sean`, `QuoteCall`, `Quotable Plus`, or `Quote Core+` hits in live marketing/public TS/TSX/CSS: **0**

## Done For You delivery contract

- genuine conversion CTA: `Inquire about Done For You`;
- option 1: configured 25-minute Shaun booking URL;
- option 2: around-60-second enquiry questionnaire;
- destination email: `info@quote-core.com`;
- submitter email is Reply-To;
- email includes contact details plus every questionnaire question and selected answer;
- no `contact_enquiries` or other database persistence in the Done For You enquiry endpoint.

## Build limitation inherited from the original export

A dependency-backed full Next.js production build cannot be truthfully certified from this standalone export because the originally supplied bundle omitted repository paths referenced by its own `package.json`, including a local roof-takeoff package and some scripts/e2e content. Those files were not recreated here.

After merging this handoff into the complete repository, run the normal clean build/lint/test pipeline and compare the deployed routes against `docs/visual-acceptance/`. If they differ, treat that as an integration/build/CSS-loading problem rather than redesigning the pages.


## Final runtime recheck after source fixes

A fresh Chromium pass was run after the final source edits, not before them. At 390 px wide, the Homepage, Pricing, Free Workspace, Done For You, both modal entry states, and all six Done For You form steps contained **zero visible interactive targets below 44 px**. The same regenerated set retained **zero horizontal overflow** at 1440, 1024 and 390 px.

The shared Homepage WorkflowExplorer was also normalised to the current marketing heading scale and 44 px mobile tab/arrow/scene controls. The header logo link, homepage proof CTA and mobile footer links were brought up to the same touch-target contract.


## Global stylesheet interaction audit

The acceptance renderer now includes the real `app/globals.css` plus Tailwind preflight, not only feature CSS modules. This exposed and fixed a production-only dark-OS conflict: the legacy global forced-light input fallback could override the dark Free Workspace and Done For You dialog fields. Both dialogs now mark themselves as deliberate dark theme roots and the global fallback preserves their dark control contract. The fix was verified in Chromium with both light and dark OS colour preferences.


## Keyboard focus runtime audit

Keyboard Tab traversal was checked against the final exact-source HTML for the Homepage, Pricing, Free Workspace, Done For You, both modal entry states and the final Done For You contact step. Every sampled visible focusable control had a visible outline and/or focus shadow; zero sampled controls relied on hover to become discoverable.
