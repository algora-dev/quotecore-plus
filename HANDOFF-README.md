# QuoteCore+ Marketing Website Handoff

This package is the reconciled marketing source. It supersedes the earlier marketing handoff that produced visual differences from the approved previews.

## Start here

Read `docs/VISUAL-ACCEPTANCE.md` before integrating anything. The locked marketing routes are not design suggestions. The exact-source previews under `docs/visual-acceptance/` are generated from the same TSX/CSS in this package and are the visual acceptance references.

The key rule is simple: **do not rebuild the locked pages through `PageV2`, substitute a different card/section system, reorder the sections, or reinterpret the layouts.** The real Next.js source in this package has already been reconciled to the approved designs.

## Locked visual routes

- `/` — approved homepage v14 composition, with later owner-approved messaging/CTA changes only.
- `/pricing` — approved pricing v5 bespoke layout.
- `/free-trial` — approved Free Workspace bespoke layout at the stable legacy URL.
- `/done-for-you-setup` — current Done For You page with the shared enquiry flow.
- Shared Free Workspace and Done For You modals are mounted through `components/marketing/MarketingConversionModals.tsx`.

See `docs/VISUAL-ACCEPTANCE.md` for the exact source-to-preview mapping, viewport QA, and regeneration commands.

## Done For You conversion contract

A genuine Done For You conversion CTA should say **Inquire about Done For You** and open the shared chooser.

The chooser offers:
1. a 25-minute discovery call with Shaun, using the existing `NEXT_PUBLIC_DFU_BOOKING_URL` configuration; or
2. the around-60-second no-call questionnaire.

The form sends one structured email to **info@quote-core.com** through the existing email client. The submitter's email is used as Reply-To. The enquiry is not written to `contact_enquiries` or another database table.

Navigation links whose purpose is simply to explain/read about Done For You may still navigate to `/done-for-you-setup`. Do not convert the main site-navigation item into an auto-opening modal.

## Current commercial model

- Free Workspace is a real account with no card, no plan selection and no expiry.
- The optional Guided Walkthrough is available from the authenticated Free Workspace and uses isolated fictional data.
- `/demo` is the authenticated/noindex Guided Walkthrough launcher, not a public acquisition demo.
- `/takeoff-demo` remains a separate public sample takeoff.
- Public pricing communicates the US$29–US$259/month range and pricing philosophy. Exact plan construction belongs inside authenticated Billing / Create Your Plan.
- Done For You starts from US$499 and is scoped to the business.

## Design rules that still apply

- Use the existing QuoteCore+ brand assets and Geist.
- Primary orange gradient: `linear-gradient(135deg, #FF641F 0%, #FF8A3D 55%, #FFB36B 100%)` with dark text.
- Buttons use 12px radius; do not turn controls into universal pills.
- Marketing max width is 1280px with 24px inline padding.
- Keep light/dark theming complete and accessible.
- Do not add visible em dashes to marketing copy.
- Commercial CTA navigation is same-tab unless an external resource explicitly needs a new tab.

## Integration / build warning

The original source bundle supplied for this redesign excluded repository paths that `package.json` references, including `scripts/`, `e2e/`, and `packages/quote-core-roof-takeoff-0.1.0-prerelease.1.tgz`. Those files were already absent before this reconciliation.

Therefore, **merge this package into the real repository that contains those omitted dependencies**, then run the normal clean install/build/lint/test process there. Do not invent or replace the missing local package to make this standalone export install.

Recommended deployment verification after merge:

1. Run the production build and lint/tests in the real repository.
2. Compare `/`, `/pricing`, `/free-trial` and `/done-for-you-setup` against the exact-source HTML/screenshots in `docs/visual-acceptance/` at desktop and mobile widths.
3. Verify `NEXT_PUBLIC_DFU_BOOKING_URL` opens the intended Calendly booking page from option 1 of the Done For You chooser.
4. Submit one test Done For You enquiry and confirm a single structured email reaches `info@quote-core.com` with Reply-To set to the submitter.
5. Verify Free Workspace signup, Google/email auth callbacks and `/demo` authenticated Guided Walkthrough behavior.
6. Verify `/takeoff-demo` remains public and indexable while `/demo` remains noindex/robots-disallowed.

## Important implementation note

The previous mismatch was in the supplied source, not something the deployment agent should compensate for. In particular, Pricing and Free Workspace had been translated into generic page components and the homepage composition had drifted from the approved preview. Those source-level mismatches are corrected here.
