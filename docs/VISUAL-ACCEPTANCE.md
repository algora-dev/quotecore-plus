# QuoteCore+ marketing visual acceptance — exact-source contract

This document is part of the implementation contract for the marketing handoff.

## The rule that prevents preview/deployment drift

The previews in `docs/visual-acceptance/html/` are **not independently designed mockups**. They are static browser snapshots generated from the same TSX components and CSS modules contained in this handoff by `tools/render-marketing-source-previews.js`. The renderer also includes the real global stylesheet and Tailwind preflight so global resets/overrides are part of acceptance rather than hidden from it.

The browser screenshots in `docs/visual-acceptance/screenshots/` were then captured from those exact-source HTML snapshots at 1440 px, 1024 px and 390 px widths.

Therefore an implementation agent must not recreate, reinterpret, translate or approximate the locked pages. Merge the supplied source files into the real repository. Do not rebuild them through `PageV2`, substitute a different card system, reorder sections, or rewrite the locked CSS from screenshots.

If the deployed route differs materially from the bundled exact-source preview after a clean build, treat that as an integration/build/CSS-loading problem and investigate the deployed bundle. Do not “fix” the preview by redesigning the page.

## Exact-source previews

| Surface | Production source | Exact-source HTML |
|---|---|---|
| Homepage `/` | `components/marketing/home/Homepage.tsx` + `HomeLocked.module.css` | `docs/visual-acceptance/html/homepage.html` |
| Pricing `/pricing` | `app/(marketing)/pricing/page.tsx` + `PricingLocked.module.css` | `docs/visual-acceptance/html/pricing.html` |
| Free Workspace `/free-trial` | `app/(marketing)/free-trial/page.tsx` + `FreeWorkspaceLocked.module.css` | `docs/visual-acceptance/html/free-workspace.html` |
| Done For You `/done-for-you-setup` | `app/(marketing)/done-for-you-setup/page.tsx` + `DoneForYouSetup.module.css` | `docs/visual-acceptance/html/done-for-you.html` |
| Done For You chooser/form | `components/marketing/DoneForYouInquiryModal.tsx` + its CSS module | `docs/visual-acceptance/html/done-for-you-inquiry.html` |
| Free Workspace signup modal | `components/marketing/FreeWorkspaceModal.tsx` + its CSS module | `docs/visual-acceptance/html/free-workspace-modal.html` |

The modal HTML snapshots show the initial open state. The Done For You form's six internal screens and success state were also browser-checked from the same component source during this handoff.

## Locked commercial behavior

### Homepage

The reconciled composition is:
1. roof-sunset hero with one Shaun call CTA and compact founder strip;
2. dark pricing bridge;
3. founder call section with founder media and three-step explanation;
4. dark Free Workspace section;
5. verified customer proof cards;
6. dark Done For You section;
7. the existing production `WorkflowExplorer` content and behavior, with only the current-design heading/touch-target normalization documented below;
8. founder call close.

### Pricing

Public pricing remains a bespoke page, not `PageV2`. It communicates the approximate US$29–US$259/month range and the try-first pricing philosophy. Exact plan construction remains inside authenticated Billing / Create Your Plan.

### Free Workspace

`/free-trial` remains the stable legacy URL for the bespoke Free Workspace information page. It explains the real indefinite Free Workspace and optional Guided Walkthrough. Primary creation actions open the shared Free Workspace modal.

### Done For You

A genuine Done For You conversion CTA says **Inquire about Done For You** and opens the shared chooser. The chooser offers:
- a 25-minute discovery call with Shaun using `NEXT_PUBLIC_DFU_BOOKING_URL`; or
- the around-60-second no-call questionnaire.

The questionnaire sends one structured email to `info@quote-core.com`, with the submitter as Reply-To. It is not persisted to `contact_enquiries` or another database table.

Navigation links whose purpose is only to explain/read about Done For You may still navigate to `/done-for-you-setup`.

## Visual QA performed for this handoff

The six exact-source surfaces above were rendered in Chromium at:
- desktop: 1440 × 900;
- constrained desktop/tablet: 1024 × 900;
- mobile: 390 × 844.

All six had zero page-level horizontal overflow at all three widths.

The Done For You questionnaire was additionally rendered at each of its six steps plus success state on desktop and mobile. A final 390 px Chromium target audit found zero visible interactive targets below 44 px across all six acceptance surfaces and every Done For You form step. Inputs render at 16 px on mobile, and long form states scroll inside the dialog rather than overflowing the viewport.

The automated contrast sweep found no normal explanatory-text failures on the locked surfaces. The only sub-4.5 results are the decorative orange `+` in the QuoteCore+ wordmark and the multicolour Google `G` brand mark, neither of which is explanatory body/control text.

The Done For You handover section specifically uses a light section plus self-contained light cards with explicit dark heading/body/muted colours. It must never inherit dark-section foreground colours into those cards.

### Touch-target and typography lock

The final source also normalises touched shared marketing controls to the current standard: the header logo link, homepage proof CTA, WorkflowExplorer mobile tabs/scene controls/arrows and mobile footer links meet the 44 px target contract. The WorkflowExplorer section heading uses the same 32–48 px marketing H2 scale as the rest of the locked page.

## Regenerating exact-source previews

From a complete repository with dependencies installed, use the bundled renderer. Example:

```bash
node tools/render-marketing-source-previews.js . components/marketing/home/Homepage.tsx /tmp/homepage.html page
node tools/render-marketing-source-previews.js . 'app/(marketing)/pricing/page.tsx' /tmp/pricing.html page
node tools/render-marketing-source-previews.js . 'app/(marketing)/free-trial/page.tsx' /tmp/free-workspace.html page
node tools/render-marketing-source-previews.js . 'app/(marketing)/done-for-you-setup/page.tsx' /tmp/done-for-you.html page
node tools/render-marketing-source-previews.js . components/marketing/DoneForYouInquiryModal.tsx /tmp/done-for-you-inquiry.html dfy-modal
node tools/render-marketing-source-previews.js . components/marketing/FreeWorkspaceModal.tsx /tmp/free-workspace-modal.html free-modal
```

The renderer is an acceptance/debugging aid. Production still runs through the normal Next.js application and shared runtime behavior.

## Shared conversion surfaces

`components/marketing/MarketingConversionModals.tsx` mounts the shared Free Workspace and Done For You conversion modals for marketing routes.

The root homepage is outside the `(marketing)` route-group layout, so `app/page.tsx` mounts the same shared conversion surfaces explicitly. Keep that behavior unless the routing architecture changes.

Done For You conversion links have a safe `/done-for-you-setup?inquire=1` fallback. If the shared listener is mounted, the click opens the chooser in place; otherwise the destination page loads and auto-opens it.

## Repository completeness warning

The originally supplied source export did not contain every path referenced by its own `package.json`, including the local roof-takeoff package and some `scripts/` / `e2e/` content. This handoff intentionally does not invent those missing repository files.

Merge this source into the real repository that contains those omitted dependencies, then run the normal clean install/build/lint/test pipeline there. If the runtime output differs from the bundled exact-source previews, compare the generated/deployed CSS and component versions before changing design code.
