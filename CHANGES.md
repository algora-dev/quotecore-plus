# QuoteCore+ reconciled marketing handoff changes

This file describes the source-level reconciliation performed after the previous handoff rendered differently from the approved previews.

- `HANDOFF-README.md` — replaced stale handoff instructions with the locked visual acceptance contract, current acquisition model, Done For You flow, email destination, and real-repo build warning.
- `README.md` — added a prominent note directing integrators to the locked marketing visual references.
- `docs/VISUAL-ACCEPTANCE.md` — added the visual source-of-truth contract for Homepage, Pricing, Free Workspace and Done For You.
- `docs/visual-references/` — bundles the exact approved standalone Homepage v14, Pricing v5, Free Workspace v1 and Done For You inquiry v3 HTML references so deployment QA can compare against the same artifacts the owner approved.
- `app/page.tsx` — mounts the same shared conversion modals on the root marketing homepage and removes homepage FAQ schema that no longer matches the locked composition.
- `app/(marketing)/layout.tsx` — mounts the shared Free Workspace and Done For You conversion modals once across marketing routes.
- `components/marketing/MarketingConversionModals.tsx` — added the shared conversion-modal mount point.
- `components/marketing/home/Homepage.tsx` — rebuilt the production homepage to the approved v14 composition while retaining later approved terminology, verified testimonials and the new Done For You enquiry action.
- `components/marketing/home/HomeLocked.module.css` — added preview-derived locked homepage styling with CSS-module scoping and accessibility fixes.
- `app/(marketing)/pricing/page.tsx` — replaced the generic `PageV2` translation with the approved bespoke pricing-page composition.
- `app/(marketing)/pricing/PricingLocked.module.css` — added preview-derived locked pricing styling.
- `app/(marketing)/free-trial/page.tsx` — replaced the generic `PageV2` translation with the approved bespoke Free Workspace composition at the stable `/free-trial` URL.
- `app/(marketing)/free-trial/FreeWorkspaceLocked.module.css` — added preview-derived locked Free Workspace styling.
- `components/marketing/DoneForYouInquiryModal.tsx` — added the approved two-route Done For You chooser and around-60-second six-screen enquiry flow, including safe fallback auto-open behavior.
- `components/marketing/DoneForYouInquiryModal.module.css` — added the approved responsive modal/form styling and accessibility states.
- `components/marketing/DoneForYouInquiryButton.tsx` — added the standard `Inquire about Done For You` production CTA with same-page modal behavior and page fallback.
- `components/marketing/DoneForYouInquiryLink.tsx` — added a style-neutral inquiry entry point for existing bespoke page designs.
- `app/api/done-for-you-inquiry/route.ts` — added the email-only Done For You enquiry endpoint; sends one structured email to `info@quote-core.com` with submitter Reply-To and no database persistence.
- `app/(marketing)/done-for-you-setup/page.tsx` — changed Done For You conversion actions from call-only entry to the shared enquiry chooser and aligned page copy with the dual call/no-call route.
- `components/marketing/home/DoneForYouSection.tsx` — changed the reusable homepage Done For You conversion to the shared inquiry CTA.
- `components/DoneForYouBanner.tsx` — changed the reusable Done For You banner to the shared inquiry CTA.
- `components/DfyCtaButton.tsx` — changed the legacy Done For You CTA wrapper to use the shared inquiry CTA.
- `components/marketing/DfyBookButton.tsx` — removed the obsolete call-only Done For You button component.
- `components/marketing/home/FaqSection.tsx` — updated the setup fallback destination so any future use auto-opens the shared inquiry chooser.
- `components/marketing/home/homepage-content.ts` — updated stale call-only Done For You FAQ/CTA wording to the approved dual-route model.
- `app/(marketing)/contact/page.tsx` — changed the Done For You setup route action to the inquiry chooser.
- `app/(marketing)/fastest-roofing-estimating-software/page.tsx` — changed Done For You setup conversion buttons to the inquiry chooser while retaining general Shaun sales-call CTAs.
- `app/(marketing)/construction-takeoff-software/page.tsx` — changed the Done For You action link from an informational call-to-action to `Inquire about Done For You` and the shared chooser.
- `app/(marketing)/construction-quoting-software/page.tsx` — changed the Done For You setup action link to `Inquire about Done For You` and the shared chooser.
- `app/(marketing)/careers/page.tsx` — updated stale internal/customer-journey Done For You wording and setup fallback route to the current dual-route model.
- `app/(auth)/paywall/page.tsx` — changed the Done For You fallback action to the inquiry route rather than a call-only path.

Navigation/editorial links whose purpose is to read about Done For You, including the main marketing navigation and affiliate education links, intentionally continue to navigate to `/done-for-you-setup` instead of auto-opening the enquiry modal.

## Final exact-source visual reconciliation

- Replaced the previous concept-vs-production preview process with `tools/render-marketing-source-previews.js`, which renders the actual handoff TSX/CSS into standalone acceptance HTML.
- Added `docs/visual-acceptance/html/` with exact-source previews for Homepage, Pricing, Free Workspace, Done For You, Done For You enquiry, and Free Workspace signup.
- Added Chromium screenshots at 1440, 1024 and 390 px under `docs/visual-acceptance/screenshots/`.
- Corrected the Done For You handover failure shown in QA: the handover section is a light surface and all nested light cards explicitly own dark heading/body/muted colours.
- Normalised locked marketing H1/H2 sizing and main explanatory copy to the current marketing typography contract.
- Strengthened mobile homepage hero wash so text contrast does not depend on the roof image underneath.
- Fixed the shared dark-header CTA foreground that had been overridden by a page-level `a { color: inherit }` rule.
- Updated touched marketing roots to use current semantic color roles and rely on the application root for Geist rather than redeclaring the page font.
- Moved shared SiteFooter, SocialIcons and YouTubeLite presentation to explicit CSS modules so preview and production no longer depend on a separate utility-style interpretation.
- Browser-checked all six acceptance surfaces at desktop, constrained desktop/tablet and mobile widths with no page-level horizontal overflow.
- Browser-checked all six Done For You questionnaire steps plus success state on desktop/mobile, including 44 px navigation targets and 16 px mobile inputs.


## Final runtime acceptance fixes

- Re-rendered the six locked acceptance surfaces directly from the production TSX/CSS after all visual fixes.
- Replaced the bundled acceptance HTML/screenshots with this final source-rendered set.
- Fixed the Done For You mixed light/dark island shown in owner QA by explicitly owning light-card heading/body/muted colours.
- Raised the header logo link, homepage proof CTA, WorkflowExplorer mobile tabs/scene buttons/arrows and mobile footer links to the 44 px touch-target contract.
- Normalised the WorkflowExplorer marketing H2 to the current 32–48 px marketing scale.
- Re-ran Chromium QA at 1440, 1024 and 390 px: zero horizontal overflow on all six surfaces; at 390 px, zero visible interactive targets below 44 px across all six surfaces and every Done For You form step.

- Expanded the exact-source acceptance renderer to include `app/globals.css` and Tailwind preflight, then fixed the production-only dark-OS input override this exposed. The shared dark modals now mark their independent root with `data-qc-theme="dark"`, and the legacy global force-light fallback explicitly preserves dark modal controls.
- Added the final 44 px minimum width to the small mobile footer attribution link after the global-aware browser audit exposed a 43.4 px hit target.
