# Marketing V3 return notes: competitor pages

**Date:** 27 September 2026. **Status:** implemented source; integration and deployment pending.

## Baseline and scope

This return builds on the most recent agent-returned archive, not the earlier Phase 1A/Phase 2 instruction packages:

- Input: `quotecore-plus-marketing-competitor-handoff-2026-09-27.zip`
- Input SHA-256: `5ecbfa5a5ed8575387fdcbd3e15583b3a51558c4430bd66eefb4f1b75e9906df`
- Input root handoff identifies packaged commit `1b90d9d6` and source baseline `a9c7bcf4`. There is no Git history in the ZIP, so drift is checked against the actual input bytes.
- Original regular files: 2,970, including 2,969 under `quotecore-plus/`.
- Production files modified: **73**. Of these, **8** are substantive (seven routes and the shared renderer) and **65** contain punctuation-only replacements.
- Original production files deleted: **0**. New production source files: **0**. The six added return/documentation files are declared separately in the manifest.
- All original files not in the modified manifest are unchanged byte-for-byte. That includes the app, dependencies, route/security configuration, prices, homepage, and Phase 2 component and commercial-page work.

## What changed on each page

Existing URL paths, canonical destinations, comparison row topics, section ordering and alternative-search intent remain intact. New mobile/Assistant copy is adapted to each comparison rather than presented as a generic AI superiority claim.

| Existing route | Substantive change |
|---|---|
| `/roofr-alternative` | Separate DIY measurement, report purchasing and roofing CRM workflows. Retain Roofr mobile, proposal, invoice and payment capabilities; distinguish its customer-call AI Receptionist from supported QuoteCore+ account actions. Show paid/billing conditions rather than an unqualified low headline price. |
| `/eagleview-alternative` | Compare self-service takeoff with supplied property reports, not two identical software subscriptions. Acknowledge Eagleview One subscription access and qualify Horizon as announced/coming soon in the reviewed source. Keep imagery, models and report-service limitations explicit. |
| `/planswift-alternative` | Lead with Windows takeoff versus the paid QuoteCore+ phone/tablet/browser workflow. Preserve US$2,000 per seat per year, now identified as Essential; include the separate Core tier and published AI tools. Remove unsupported extra support/training surcharges. |
| `/hover-alternative` | Acknowledge phone/tablet estimating, custom estimating logic, agreements, supplier-connected ordering and 3D visualization. Separate annual subscriptions from per-project charges. Do not imply QuoteCore+ recreates a photo-derived 3D property model. |
| `/roofsnap-alternative` | Acknowledge DIY measurement on multiple devices, blueprints, connected estimating and ordered reports. Explain the team-size and annual-billing conditions behind the advertised annual per-user rates, rather than applying a ten-user price to a solo contractor. |
| `/bluebeam-alternative-for-roofing` | Compare the roofing customer-quote workflow with PDF collaboration, formulas and Excel links. Acknowledge web/mobile measurement and Max AI document actions. Do not claim QuoteCore+ replaces Studio/CAD or is cheaper than every Bluebeam tier. |
| `/stack-alternative-for-roofing` | Acknowledge connected takeoff, estimating, assemblies and proposals, plus STACK IQ and its authorized external-AI-client workflow. Do not claim QuoteCore+ uniquely has conversational actions or permission controls. Separate field collaboration from unverified full phone takeoff equivalence. |

## Shared competitor-page improvements

The renderer reuses the existing `ThreeWaysToWork` component with route-specific copy. The visible FAQs and FAQ schema read the same `pageData.faqs` array. Each page has a current review date and an explicit source/method note, with links beside competitor claims in both desktop and mobile comparison layouts.

Pricing scenarios now have mobile cards as well as the desktop table. Price tier headings and prices stack at narrow widths. Source links use visible focus styling, descriptive labels and 44-pixel minimum height. Redundant nested main markup was removed, and FAQ question headings are semantic h3 elements. These are source-level accessibility/layout improvements, not a completed browser or accessibility audit.

Paid QuoteCore+ plan values are unchanged: Starter $19/month, Pro $39/month, Pro Plus $59/month and their original quote/AI-point allowances. Free tools are explained separately rather than shown as a free paid-app tier. AI Scan points are not presented as unlimited Smart Assistant use. Primary CTAs go to paid plans; free-tool CTAs remain genuinely free-tool entries.

The shared competitor page no longer mounts the ambiguous general demo cards. It has one explicit link to the **Roofing Takeoff Demo**, with copy distinguishing that existing demo from the paid app's device support. The shared homepage demo component itself is unchanged. The future **App Demo** is not claimed, linked or built.

Existing videos and screenshots were retained, with wording that they illustrate the existing workflow rather than prove a new mobile/Assistant demo. No new recordings or fabricated UI screenshots were introduced.

### Where active data now lives

The brief authorized route files and the shared renderer, not `lib/competitor-pages/*.ts`. Each of the seven routes now contains typed `pageData`, `threeWays` and `research` objects. The protected old data modules remain unchanged, but are no longer imported at runtime by these routes. The shared types remain the contract. All future edits to these seven pages should use the active route-local objects unless a separate refactor is authorized.

## Verification completed

| Check | Result and limit |
|---|---|
| SHA-256 drift against input | 73 declared production modifications; zero undeclared source changes or deletions. |
| TypeScript parser across changed source | 73 files parsed, zero syntax errors. This is not a full-project type check. |
| Isolated content contracts | Zero errors using the real comparison-content types and the extracted component prop contracts. No Next.js runtime dependency resolution. |
| Canonicals and comparison topics | All seven original canonicals and original row topics preserved. |
| FAQs and structured data | Seven FAQs on Roofr, eight on each other route; visible content and schema use one array. |
| Local links | 129 internal references resolve to source routes or known blog slugs. This is not a deployed HTTP crawl. |
| Referenced screenshot assets | All referenced files exist in the source package. |
| Added-line guard | Zero added source-line matches for banned dash characters, free-trial/no-card claims, or future App Demo wording. |
| Punctuation-only reconstruction | 65 files match the original bytes plus exactly 542 dash replacements. |
| SEO checker | Before: zero errors, 66 warnings. After: zero errors, 66 warnings. |
| Full project TypeScript, lint, build | Not run here. Gavin's integration gate, as required by the latest brief. |
| Browser/device/voice tests | Not performed. Required before release. |

The SEO logs are not identical: the title-suffix warning counter moves from 33 to 26 because these seven metadata objects now use quoted keys that the checker does not count in the same way. Warning categories/counts are unchanged; do not interpret that text-counter difference as a verified SEO improvement. Existing missing-H1 warnings also reflect route/shared-renderer detection, not a rendered-browser audit.

Reproduction in the integration environment starts with `node scripts/seo-check.mjs` from the `quotecore-plus/` working directory, then the project's usual TypeScript/lint/build and browser checks. Use exact-baseline parity for pre-existing project errors, not an invented clean baseline. `VALIDATION_COMPETITOR.json` contains the completed source-check results and explicit unperformed checks.

## Dash hygiene: exact per-file counts

These are replacement counts, not changed-line counts. Punctuation-only means original bytes were reconstructed with only the recorded dash characters replaced by a hyphen or spaced hyphen, with no other edits to those files. There are **439 replacements across 46 marketing files** and **103 replacements across 19 public/free-tool files**. The existing Roofing Takeoff Demo accounts for 12 of the marketing replacements across two files. All functional logic and device branches remain intact.

| Punctuation-only file, relative to `quotecore-plus/` | Replacements |
|---|---:|
| `app/(marketing)/about/page.tsx` | 2 |
| `app/(marketing)/affiliate-program/DistributorApplicationForm.tsx` | 3 |
| `app/(marketing)/affiliate-program/page.tsx` | 7 |
| `app/(marketing)/affiliate-program-terms/page.tsx` | 2 |
| `app/(marketing)/blog/[slug]/content/best-quoting-software-au.tsx` | 8 |
| `app/(marketing)/blog/[slug]/content/best-quoting-software-nz.tsx` | 11 |
| `app/(marketing)/blog/[slug]/content/best-quoting-software-us.tsx` | 8 |
| `app/(marketing)/blog/[slug]/content/chrome-roof-pitch-calculator-extension.tsx` | 14 |
| `app/(marketing)/blog/[slug]/content/construction-estimating-spreadsheet-alternative.tsx` | 18 |
| `app/(marketing)/blog/[slug]/content/convert-spreadsheet-to-quote.tsx` | 28 |
| `app/(marketing)/blog/[slug]/content/custom-roofing-quoting-software.tsx` | 21 |
| `app/(marketing)/blog/[slug]/content/how-much-roofing-material.tsx` | 2 |
| `app/(marketing)/blog/[slug]/content/how-to-calculate-roof-pitch.tsx` | 2 |
| `app/(marketing)/blog/[slug]/content/how-to-do-a-roof-takeoff.tsx` | 2 |
| `app/(marketing)/blog/[slug]/content/how-to-do-cladding-takeoff.tsx` | 27 |
| `app/(marketing)/blog/[slug]/content/how-to-estimate-roofing-materials.tsx` | 2 |
| `app/(marketing)/blog/[slug]/content/how-to-measure-a-roof-from-a-pdf-plan.tsx` | 36 |
| `app/(marketing)/blog/[slug]/content/how-to-measure-a-roof-online.tsx` | 2 |
| `app/(marketing)/blog/[slug]/content/how-to-measure-a-roof.tsx` | 3 |
| `app/(marketing)/blog/[slug]/content/how-to-measure-pdf-plans.tsx` | 24 |
| `app/(marketing)/blog/[slug]/content/how-to-measure-walls-cladding-from-plans.tsx` | 24 |
| `app/(marketing)/blog/[slug]/content/how-to-price-a-roofing-job.tsx` | 2 |
| `app/(marketing)/blog/[slug]/content/how-to-quote-a-roof-from-plans.tsx` | 2 |
| `app/(marketing)/blog/[slug]/content/how-to-reduce-roofing-waste.tsx` | 11 |
| `app/(marketing)/blog/[slug]/content/import-price-list-csv-to-components.tsx` | 14 |
| `app/(marketing)/blog/[slug]/content/manual-vs-digital-roof-takeoff.tsx` | 7 |
| `app/(marketing)/blog/[slug]/content/price-a-job-from-measurements.tsx` | 22 |
| `app/(marketing)/blog/[slug]/content/quotecore-plus-reviews.tsx` | 1 |
| `app/(marketing)/blog/[slug]/content/quoting-from-plans-vs-site-visits.tsx` | 18 |
| `app/(marketing)/blog/[slug]/content/roof-measurements-to-quote.tsx` | 18 |
| `app/(marketing)/blog/[slug]/content/roofing-estimating-spreadsheet-vs-software.tsx` | 11 |
| `app/(marketing)/blog/[slug]/content/roofing-estimating-vs-quoting.tsx` | 2 |
| `app/(marketing)/blog/[slug]/content/roofing-quoting-software-uk.tsx` | 1 |
| `app/(marketing)/blog/[slug]/content/roofing-quoting-software-vs-spreadsheets.tsx` | 16 |
| `app/(marketing)/blog/[slug]/content/simple-roofing-estimating-software.tsx` | 1 |
| `app/(marketing)/blog/[slug]/content/takeoff-to-quote-workflow.tsx` | 17 |
| `app/(marketing)/custom-solutions/page.tsx` | 6 |
| `app/(marketing)/customer-stories/page.tsx` | 2 |
| `app/(marketing)/done-for-you-setup/page.tsx` | 13 |
| `app/(marketing)/roof-measurement-cost-comparison/page.tsx` | 7 |
| `app/(marketing)/supplier-partnership/SupplierApplicationModal.tsx` | 2 |
| `app/(marketing)/suppliers/[slug]/catalogue/page.tsx` | 2 |
| `app/(marketing)/suppliers/[slug]/page.tsx` | 5 |
| `app/(marketing)/suppliers/page.tsx` | 1 |
| `app/(marketing)/takeoff-demo/DemoQuoteView.tsx` | 2 |
| `app/(marketing)/takeoff-demo/page.tsx` | 10 |
| `app/(public)/free-cladding-takeoff/CladdingTakeoff.tsx` | 1 |
| `app/(public)/free-cladding-takeoff/page.tsx` | 24 |
| `app/(public)/free-construction-takeoff-tools/page.tsx` | 3 |
| `app/(public)/free-flooring-takeoff/FlooringTakeoff.tsx` | 1 |
| `app/(public)/free-flooring-takeoff/page.tsx` | 19 |
| `app/(public)/free-invoice-generator/page.tsx` | 1 |
| `app/(public)/free-purchase-order-generator/layout.tsx` | 4 |
| `app/(public)/free-purchase-order-generator/page.tsx` | 11 |
| `app/(public)/free-quote-generator/page.tsx` | 1 |
| `app/(public)/free-roof-pricing-calculator/layout.tsx` | 3 |
| `app/(public)/free-roof-takeoff/FreeRoofTakeoff.tsx` | 1 |
| `app/(public)/free-roof-takeoff/page.tsx` | 2 |
| `app/(public)/free-roofing-takeoff-builder/[supplierSlug]/page.tsx` | 13 |
| `app/(public)/free-roofing-takeoff-calculator/page.tsx` | 3 |
| `app/(public)/free-tools/TaskAccordions.tsx` | 4 |
| `app/(public)/free-tools/ToolSections.tsx` | 6 |
| `app/(public)/free-tools/page.tsx` | 1 |
| `app/(public)/measurement-to-quote-tool/layout.tsx` | 1 |
| `app/(public)/measurement-to-quote-tool/page.tsx` | 4 |
| **Total: 65 files** | **542** |

Punctuation removal within the eight substantive files is included in those rewrites, not this separately reconstructed 542 count. The affiliate form uses its audience-range display strings as submitted text too; see the owner note about historical exact-string reporting.

### Frozen exceptions

These visible strings retain their original dashes because changing them would touch the frozen homepage or its shared dependencies:

| File | Original line(s) | Reason |
|---|---|---|
| `app/page.tsx` | 28, 35, 44 | Frozen root homepage metadata. |
| `app/(marketing)/home/page.tsx` | 284 | Separate homepage surface kept frozen. |
| `components/DoneForYouBanner.tsx` | 21 | Homepage dependency. |
| `components/FreeTakeoffCTACard.tsx` | 69 | Homepage dependency. |
| `components/VideoShowcase.tsx` | 21 | Homepage dependency. |
| `components/hero/AnimatedHero.tsx` | 221 | Homepage dependency, accessible label. |

The scanner also reports an AnimatedHero CSS comment at line 560; it is not visible copy and was left alone. Protected app/library content outside this scope was not declared dash-clean. This is deliberately **not** an app-wide or whole-site zero-dash certification.

## Integration handoff

Read `OWNER_DECISIONS_COMPETITOR.md`, especially the inherited homepage offer/schema contradictions, unverified competitor equivalents, release availability, active-data location and demo-CTA event change. The next step is for Gavin to integrate and test this implementation. Do not send it back through another planning-only phase.

Use `FILE_CHANGES_COMPETITOR.json` as the complete change allowlist. Copying the whole return over a newer development checkout can overwrite unrelated work done after the input ZIP. Merge the declared changes onto that checkout instead, keeping the full ZIP as the reproducible source baseline and return.
