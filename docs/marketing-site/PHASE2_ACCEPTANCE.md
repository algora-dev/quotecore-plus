# Phase 2 — Acceptance Criteria

## Required result

A user landing on the high-value commercial pages should understand, without needing the homepage, that QuoteCore+:

1. is built primarily for roofing and also works for construction/measured trades;
2. connects measurement, saved pricing logic and quoting;
3. works from phone/tablet/desktop where product truth supports it;
4. lets users operate the interface directly OR use Smart Assistant for supported tasks;
5. keeps the user in control of important Assistant actions;
6. offers downstream quote sending/tracking, orders and invoices without repositioning itself as a generic CRM/project-management suite.

## Copy tests

Every changed page must pass these questions:

- Is the page still obviously about its original search intent?
- Does mobile appear where it materially changes the workflow?
- Is Smart Assistant described as an easier interface rather than as the product itself?
- Are measurements -> pricing -> quote still connected clearly?
- Are claims specific and supportable?
- Did we avoid “all-in-one”, “revolutionary”, “AI-powered” repetition, “best”, “most accurate”, “one click”, and unsupported guarantees?
- Did we avoid claiming the future App Demo exists?
- Did we avoid implying existing free tools are newly mobile-optimised?

## SEO tests

- preserve canonical URLs
- no duplicate/new thin pages
- keep core keyword in each page title/H1/intro as appropriate
- update metadata/OG copy when page proposition materially changes
- update FAQs/schema if visible facts change
- preserve useful internal links
- do not create dead links to future Assistant/App Demo pages

## Code/scope tests

- no changes outside marketing writable surface
- no app/Smart Assistant implementation changes
- no pricing value changes
- no dependency changes
- no homepage changes, including accidental changes via shared components
- no free-tool calculation logic changes
- no Roofing Takeoff Demo functional rebuild

## Verification before return

Run, or clearly report why you could not run:

1. `npx tsc --noEmit`
2. `npm run build`
3. `node scripts/seo-check.mjs`
4. grep/search for new `App Demo` claims or links (there should be none)
5. grep/search changed files for stale `free trial`, `no card required`, desktop-only takeoff claims
6. inspect changed pages at desktop and mobile widths if browser tooling is available

## Return requirements

Return the full source tree, plus:

- root `START_HERE_RETURN.md`
- `docs/marketing-site/RETURN_NOTES_PHASE2.md`
- `docs/marketing-site/FILE_CHANGES_PHASE2.json`
- `docs/marketing-site/DESIGN_CHANGES_PHASE2.md`
- explicit owner/integration decisions still unresolved

The return notes must distinguish:

- copy/SEO changes
- structural/component changes
- anything intentionally left unchanged
- claims verified from product code/context versus claims omitted because support was unclear
