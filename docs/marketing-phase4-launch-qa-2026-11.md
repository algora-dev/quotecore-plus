# QuoteCore+ Marketing / Acquisition Phase 4 Launch QA

**Date:** 1 November 2026  
**Baseline:** frozen Phase 3 source  
**Purpose:** final launch QA after the Free Workspace / Shaun-call migration. This phase is a consistency and behavior pass, not another marketing redesign.

## Canonical acquisition model

Public commercial surfaces should resolve to two paths:

1. **Book 25 minutes with Shaun** - tell Shaun how you currently work, see where QuoteCore+ could make measuring/pricing/quoting faster or easier, and take away Shaun's #1 tip for winning more of the jobs you already quote.
2. **Create my Free Workspace** - Google OAuth or email magic link, no card, no plan selection, no expiry. The optional Guided Walkthrough is available after the user has a real QuoteCore+ account.

The public exact subscription configurator is retired. Exact configuration belongs in authenticated Billing / Create Your Plan.

## Phase 4 fixes

### Free Workspace modal reliability and accessibility
- The marketing layout mounts one shared Free Workspace modal for all marketing routes.
- `FreeWorkspaceButton` opens the shared modal when present and safely falls back to `/signup` when a standalone public route has no modal shell.
- `/signup` mounts and auto-opens the same modal.
- The modal now traps keyboard focus, closes on Escape, restores focus to the opener, locks body scroll and includes `aria-describedby`.
- Added reduced-transparency and forced-colors fallbacks in line with the current UX standard.

### Guided Walkthrough entry contract
- `/demo` is no longer a public anonymous acquisition entry.
- `/demo` now requires a verified non-anonymous QuoteCore+ account/company before it can launch the isolated fictional walkthrough environment.
- Unauthenticated visitors are redirected to the Free Workspace signup path.
- The underlying anonymous demo identity/session remains isolated internally. This is intentional security architecture, not an acquisition model.
- Visible launcher, status and reset wording now says Guided Walkthrough / walkthrough rather than selling a public demo.
- `/demo` is `noindex`, disallowed in `robots.txt`, and absent from the sitemap.
- `/takeoff-demo` remains the indexable public sample roof-takeoff experience with no sign-in.

### Signup/onboarding regression cleanup
- Retired unused legacy onboarding form/action files that still implemented company-name, password, security-question and template-seeding signup flows.
- Retired the unused legacy `app/signup/actions.ts` email/password/company signup action.
- `/onboarding` remains only as a compatibility/recovery route and provisions/returns the user to a Free Workspace.

### Public pricing migration cleanup
- Retired the unused `MarketingCalculator` wrapper that still represented the old public pricing-builder/paywall funnel.
- The authenticated Billing calculator remains intact.

### CTA/navigation cleanup
- Conversion helpers no longer automatically open external commercial CTAs in new tabs.
- 25-minute Shaun call CTAs remain same-tab unless a non-conversion resource explicitly opts into a new tab.
- One supplier sample takeoff back-link that still pointed to `/demo` now returns to `/takeoff-demo` and uses sample/Free Workspace wording.

### Cross-channel copy cleanup
- Contact confirmation email now offers a free 25-minute call with Shaun and includes the workflow + #1-tip value proposition.
- Feature-request route comments and remaining source comments were aligned with the 25-minute / Free Workspace model.

## Intentional exceptions

Do not globally replace the following:

- Internal `demo_*` event names, demo session tables, security namespaces, anonymous sandbox identity, or demo route guards.
- Safety wording that identifies a customer quote/email as fictional/demo content.
- Authenticated Billing language such as "pick a paid plan" when the user is deliberately switching from Free to a paid plan.
- Article facts that mention another vendor's free trial.
- Genuine durations such as a takeoff taking 10-20 minutes.
- Educational/resource links that open external sources, YouTube, PDFs, terms/privacy, or screenshots in a new tab.
- `/free-trial` as a stable legacy URL for the customer-facing **Free Workspace information page**. Primary creation buttons should use the Free Workspace modal; editorial "See the Free Workspace" links may navigate to this page.
- `/takeoff-demo` as the public sample takeoff. It is not the Guided Walkthrough.

## Validation status

- Full dependency-backed Next.js build cannot be run from this source package because `node_modules` is not included.
- `tsc --noEmit` was run only as a parser sanity check; dependency/type-resolution errors are expected in this stripped source tree.
- No TypeScript parser-class diagnostics were found.
- Whole-source local-import resolution was checked after file retirements.
- Final legacy acquisition scans should remain clean except for the intentional exceptions above and historical audit documentation.
