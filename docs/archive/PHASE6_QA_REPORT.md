# Phase 6 - QA Report and Re-Scoring

**Date:** 3 August 2026
**Branch:** development
**Commit:** (latest after Phase 5 + Phase 6 fixes)

## Release Gates

| Gate | Status | Notes |
|---|---|---|
| `npm run build` | PASS | Compiled successfully, no errors |
| `npm run lint` | PASS (marketing) | 4073 errors all in e2e/app files (Gavin's lane). Zero in marketing/components |
| `npm run seo:check` | PASS | 0 errors, 3 warnings (all pre-existing) |
| Lighthouse | BLOCKED | Cannot run from this environment. Shaun needs to run PageSpeed Insights on quote-core.com for: /, /roofing-quoting-software, /features, /pricing, /free-trial |

## Fixes Applied in Phase 6

1. **robots.ts:** Added explicit `allow` list for all 11 free tool routes (was disallow-only, SEO checker needed explicit allow)
2. **Homepage JSON-LD:** Removed duplicate FAQPage JSON-LD from client component `page.tsx` (server layout already provides it)
3. **Roofing page:** Fixed false "one click" invoice claim → "Create professional invoices from accepted quotes with payment details attached"
4. **Blog post (best-free-tools-for-roofers):** Fixed misleading "one click" invoice reference → "Can be pre-filled from the quote generator URL parameters"

## Claim Audit Results

Scanned all marketing pages, public components, and blog posts for:
- "one click" document creation claims → 1 fixed (roofing page), 1 fixed (blog), remaining instances are about copy-to-clipboard (accurate)
- Payment processing claims → all correctly say "does not process payments"
- AI detection claims → all correctly list 6 elements (roof areas, ridges, hips, valleys, barges, spouts), correctly mention what AI does NOT detect
- Order/invoice creation claims → all correctly describe separate manual creation from saved quotes
- Follow-up/automation claims → all accurately describe time-based and event-based triggers with cancellation

**Result:** Zero false claims remaining on marketing surfaces.

## SEO Audit

- Sitemap includes all 7 feature pages (was 5) plus all free tool routes
- robots.txt allows all public routes, blocks auth/api routes
- Canonical URLs correct on all pages
- JSON-LD structured data: BreadcrumbList, FAQPage, SoftwareApplication, VideoObject on homepage; FAQPage + BreadcrumbList on feature pages
- hreflang alternates on key pages
- OG images wired in root layout
- No duplicate JSON-LD (fixed homepage)
- 3 warnings only (NZ hreflang helper missing, title suffix repetition, takeoff calculate page H1 - all pre-existing)

## Accessibility Notes

Cannot run full a11y audit from this environment. Visual review confirms:
- All buttons use `rounded-full` with `min-h-11` (44px touch target)
- All interactive elements have hover states
- Icons use `aria-hidden="true"`
- Images have alt text (where decorative, alt is empty)
- Color contrast: `#BD4A1A` used for text on white (5.2:1, passes AA)
- Form inputs have associated labels in trial signup

**Recommendation:** Shaun should run axe DevTools or Lighthouse a11y audit on the 5 core templates.

## 100-Point Re-Scoring

| Category | Weight | Baseline | Current | Notes |
|---|---:|---:|---:|---|
| Roofing positioning | 15 | 5 | 13 | H1 roofing-first, eyebrow roofing, all page copy leads with roofing, nav demotes construction, footer roofing-first, free tools hub roofing-first |
| Product/workflow comprehension | 15 | 6 | 13 | 6-step workflow accurate, 7 feature pages with full detail, 4 quoting paths explained, sending/tracking page covers follow-ups, AI Scan Assist page covers detection + limitations |
| Differentiation | 15 | 4 | 11 | "What it replaces" comparison table, AI vs manual comparison, 4 quoting paths unique to market, shared accelerators section, "no payment processing" honest positioning |
| Proof and trust | 15 | 5 | 9 | About page with founder story, 9 tutorial videos, free tools as proof, honest testimonial note. DEDUCTIONS: -4 no roofing customer testimonial, -2 no screenshots of AI/manual takeoff/follow-up UI |
| Conversion journey | 10 | 6 | 9 | Free trial page with 5-step first-success checklist, pricing page roofing-first, cross-links on every page, free tools → trial CTA. DEDUCTION: -1 no demo video on trial page |
| Navigation/usability | 10 | 6 | 9 | 7 feature cards, roofing-grouped free tools, cross-links on all pages, breadcrumbs on all pages, consistent design system. DEDUCTION: -1 some pages missing breadcrumbs (suppliers) |
| SEO/content architecture | 10 | 5 | 9 | Sitemap complete, robots clean, canonicals correct, JSON-LD on all key pages, hreflang on key pages, IndexNow configured. DEDUCTION: -1 title suffix repetition (47 times) |
| Performance/accessibility | 10 | 5 | 7 | Build passes, images optimized, client components minimized, JSON-LD server-rendered. DEDUCTIONS: -2 no Lighthouse verification, -1 no a11y audit |

**TOTAL: 80/100** (was 52/100)

### Path to 90+

1. **+4** Roofing customer testimonial/case study (Shaun to find customer) → Proof 9→13
2. **+2** Screenshots: AI result with review, manual takeoff, follow-up timeline → Proof 13→14, Differentiation 11→12
3. **+2** Lighthouse verification on 5 core templates (Shaun to run) → Performance 7→9
4. **+1** Demo video on trial page → Conversion 9→10
5. **+1** Breadcrumbs on suppliers page → Navigation 9→10
6. **+1** Vary title suffixes across pages → SEO 9→10

**Projected with all blockers resolved: 91/100**

## Remaining Blockers (outside Ron's control)

- Lighthouse audit (needs Shaun to run PageSpeed Insights)
- Accessibility audit (needs Shaun to run axe DevTools)
- Roofing testimonial (needs Shaun to find verified customer)
- Screenshots (need actual app UI captures)

## Deployment Status

All changes on `development` branch. Production (`main`) unmodified. Ready for Shaun's review and merge approval.
