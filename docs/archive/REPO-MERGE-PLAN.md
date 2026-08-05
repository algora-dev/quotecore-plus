# Repo Merge Plan: quotecore-plus + quotecore-website → Single Repo

## Executive Summary

Merge the `quotecore-website` repo (quote-core.com marketing site) into the `quotecore-plus` repo (app.quote-core.com application). One repo, one codebase, one build — serving multiple domains via middleware routing. Two Vercel projects (dev + main) from the same repo, same as today.

## Current State

### Repo 1: quotecore-plus (the app)
- **GitHub:** `algora-dev/quotecore-plus`
- **Vercel:** `quotecore-plus-dev` (dev branch) + `quotecore-plus-main` (main branch)
- **Domain:** `app.quote-core.com`
- **Tech:** Next.js 16.2.6, React 18, Supabase (SSR + JS), Stripe, Fabric.js, jsPDF, OpenAI, Resend
- **Middleware:** ALREADY has domain-based routing (quote-core.com → public paths only, redirects everything else to app.quote-core.com)
- **Free tools:** Lives under `app/(public)/free-*/` route group (42 calculator slugs + 3 generators + hub page)
- **Auth on free tools:** Has `FreeToolsAuthProvider`, `FreeToolsAuthButton`, `useFreeToolsEmail` — but NO `FreeToolsAuthCard` or `FreeToolsHeader` (those only exist in website repo)

### Repo 2: quotecore-website (the marketing site)
- **GitHub:** `algora-dev/quotecore-website`
- **Vercel:** `quotecore-website`
- **Domain:** `quote-core.com`, `www.quote-core.com`
- **Tech:** Next.js 16.2.3, React 19, Supabase (JS only), @next/mdx, @vercel/analytics
- **Middleware:** Trivial (just passes everything through)
- **Free tools:** Lives under `app/free-*/` (same 42 calculator slugs + 3 generators + hub page)
- **Auth on free tools:** Has `FreeToolsAuthCard`, `FreeToolsHeader`, `FreeToolsAuthProvider`, `FreeToolsAuthButton`, `useFreeToolsEmail`

### What's duplicated
All 42 calculator slug pages + 3 generator pages + free-calculators shared engine + configs + hub page. Same code, two repos. Every change must be made twice.

### What's unique to quotecore-website (must be migrated)
**Marketing pages:**
- `app/page.tsx` — marketing homepage (~1650 lines, client component with video, pricing carousel, testimonials, FAQs)
- `app/about/page.tsx`
- `app/services/page.tsx`
- `app/construction-quoting-software/page.tsx`
- `app/roofing-quoting-software/page.tsx`
- `app/contact/page.tsx` + `contact/layout.tsx`
- `app/coffee-terms/page.tsx`
- `app/cookie-policy/page.tsx`
- `app/free-trial/page.tsx` + `client.tsx` + `FreeTrialFaqPanel.tsx`
- `app/privacy/page.tsx` (marketing version, different from app's /privacy)
- `app/terms/page.tsx` (marketing version, different from app's /terms)

**Blog system:**
- `app/blog/page.tsx` + `blog/layout.tsx` + `blog/HOW-TO-PUBLISH.md`
- `app/blog/[slug]/page.tsx`
- 10 blog content files (8 .tsx + 2 .mdx)

**Marketing components (top-level `components/`):**
- `AttributionTracker.tsx`
- `BlogHeader.tsx` (marketing nav header)
- `CoffeePopup.tsx`
- `CookieConsent.tsx`
- `EarlyAccessPopup.tsx`
- `ManageCookiesButton.tsx`
- `OpenCookiePrefButton.tsx`
- `QuoteCorePlusStyler.tsx`
- `ServicesHeader.tsx`
- `SiteAssistant.tsx`
- `SiteFooter.tsx`
- `SocialIcons.tsx`

**Marketing lib (top-level `lib/`):**
- `analytics.ts`
- `consent.ts`
- `faqs.ts`
- `pricing.ts`
- `schema.ts`
- `supabase.ts`

**Marketing API routes:**
- `app/api/assistant-contact/route.ts`
- `app/api/contact/route.ts`
- `app/api/currency/route.ts`
- `app/api/geo/route.ts` (app already has this)
- `app/api/leads/route.ts`

**Free tools components (unique to website):**
- `app/_components/FreeToolsAuthCard.tsx` (the card component we just fixed)
- `app/_components/FreeToolsHeader.tsx` (marketing-style header for free tools)

**Other unique files:**
- `app/lib/roofAngleCalculator.ts`
- `app/lib/types.ts`
- `app/lib/supabase/free-client.ts` (same as app's version, different path)
- `app/sitemap.ts` (marketing sitemap)
- `app/robots.ts` (marketing robots)
- `app/globals.css` (marketing-specific styles, different from app)

**Public assets (unique to website):**
- ~35 images (hero, how-it-works, FAQ, tutorials, shaun photos, etc.)
- 2 PDFs (qc-checklist.pdf, work-winning-checklist.pdf)
- 2 videos (qc-hero-laptop.mp4, kids-horizontal.mp4)
- `llms.txt`, `MainQCP.png`, `QuoteExample.png`, etc.

**Config differences:**
- Website uses `@next/mdx` for `.mdx` blog files
- Website uses `@tailwindcss/typography` (for blog prose)
- Website uses React 19, app uses React 18
- Website has `vercel.json` with domain aliases

## The Plan

### Phase 0: Branch & Prep (no risk to production)

**0.1 Create a migration branch**
- Branch from `development` in quotecore-plus: `git checkout -b feat/repo-merge`

**0.2 Reconcile dependencies**
- Add to `package.json`:
  - `@next/mdx` + `@mdx-js/loader` + `@mdx-js/react` (for blog .mdx support)
  - `@tailwindcss/typography` (for blog prose styling)
  - `@vercel/analytics` (for marketing site analytics)
- Keep React 18 (marketing pages are compatible — they don't use React 19-specific APIs)
- Add MDX support to `next.config.ts` (wrap with `createMDX`, add `pageExtensions: ['ts','tsx','md','mdx']`)
- Run `npm install`

**0.3 Plan the directory structure**
```
app/
├── layout.tsx                    ← ROOT layout (minimal HTML shell — shared by all domains)
├── page.tsx                      ← ROOT homepage (domain-aware: marketing vs app)
├── globals.css                   ← merged: app styles + marketing styles
├── (marketing)/                  ← route group for marketing pages
│   ├── layout.tsx                ← marketing shell (BlogHeader, SiteFooter, CookieConsent, analytics)
│   ├── home/                     ← marketing homepage component
│   │   └── page.tsx              ← serves /home (middleware rewrites quote-core.com/ → /home)
│   ├── about/page.tsx            ← /about
│   ├── services/page.tsx         ← /services
│   ├── contact/                  ← /contact
│   ├── blog/                     ← /blog + /blog/[slug]
│   ├── coffee-terms/page.tsx     ← /coffee-terms
│   ├── cookie-policy/page.tsx    ← /cookie-policy
│   ├── free-trial/               ← /free-trial
│   ├── construction-quoting-software/page.tsx
│   ├── roofing-quoting-software/page.tsx
│   └── ...
├── (public)/                     ← EXISTING free tools (no changes needed)
│   ├── free-roofing-calculator/
│   ├── free-quote-generator/
│   ├── _components/
│   │   ├── FreeToolsAuthProvider.tsx    ← existing
│   │   ├── FreeToolsAuthButton.tsx      ← existing
│   │   ├── FreeToolsAuthCard.tsx        ← NEW (copy from website repo)
│   │   ├── FreeToolsHeader.tsx          ← NEW (copy from website repo)
│   │   └── useFreeToolsEmail.ts         ← existing
│   └── ...
├── (auth)/                       ← EXISTING auth pages
├── login/                        ← EXISTING
├── signup/                       ← EXISTING
├── admin/                        ← EXISTING
├── api/                          ← EXISTING + merge marketing API routes
└── ...                           ← all other existing app routes

components/
├── (existing app components)
├── BlogHeader.tsx                ← NEW (marketing nav)
├── SiteFooter.tsx                ← NEW (marketing footer)
├── CookieConsent.tsx             ← NEW
├── AttributionTracker.tsx        ← NEW
├── SiteAssistant.tsx             ← NEW
├── CoffeePopup.tsx               ← NEW
├── EarlyAccessPopup.tsx          ← NEW
├── ...                           ← other marketing components

lib/
├── (existing app lib)
├── analytics.ts                  ← NEW (marketing analytics)
├── consent.ts                    ← NEW (cookie consent)
├── faqs.ts                       ← NEW
├── pricing.ts                    ← NEW
├── schema.ts                     ← NEW (SEO schema)

public/
├── (existing app assets)
├── MainQCP.png                   ← NEW (marketing logo)
├── how-it-works/                 ← NEW
├── tutorials/                    ← NEW
├── ...                           ← other marketing assets
```

### Phase 1: Copy Marketing Files (low risk)

**1.1 Copy marketing components**
- Copy all `components/*.tsx` from website repo → `components/` in quotecore-plus
- Fix any import path differences (e.g., `@/lib/analytics` should work if lib files are copied)

**1.2 Copy marketing lib files**
- Copy `lib/analytics.ts`, `lib/consent.ts`, `lib/faqs.ts`, `lib/pricing.ts`, `lib/schema.ts` from website repo
- Check for naming conflicts with existing app lib files (if any, rename with `marketing` prefix)

**1.3 Copy marketing public assets**
- Copy all unique images, PDFs, videos from website `public/` → app `public/`
- No conflicts expected (different filenames)

**1.4 Copy FreeToolsAuthCard + FreeToolsHeader**
- Copy from website `app/_components/` → app `(public)/_components/`
- These are the two components missing from the app repo
- Fix import paths (website uses `../_components/` vs app's `../_components/` — should be same since both are under a route group)

**1.5 Copy marketing pages**
- Create `app/(marketing)/` route group
- Copy all marketing pages into it:
  - `about/`, `services/`, `contact/`, `blog/`, `coffee-terms/`, `cookie-policy/`, `free-trial/`, `construction-quoting-software/`, `roofing-quoting-software/`
- Copy privacy/terms as `(marketing)/privacy` and `(marketing)/terms` (separate from app's existing privacy/terms if they differ)
- Fix import paths for components and lib

**1.6 Copy marketing API routes**
- Copy `api/assistant-contact/`, `api/contact/`, `api/leads/` into `app/api/`
- `api/geo/` and `api/currency/` already exist in app — compare and merge (keep the most complete version)

**1.7 Copy marketing homepage**
- Create `app/(marketing)/home/page.tsx`
- Copy the website's `app/page.tsx` content into it
- Fix imports (components, lib)

**1.8 Create marketing layout**
- Create `app/(marketing)/layout.tsx`
- Wraps children with: BlogHeader (nav), SiteFooter, CookieConsent, AttributionTracker, analytics scripts
- Based on website's root `layout.tsx` (the marketing-specific parts)

### Phase 2: Update Root Layout & Homepage (medium risk)

**2.1 Simplify root layout**
- The root `app/layout.tsx` stays as the HTML shell (fonts, body tag, minimal globals)
- Remove anything that's marketing-specific or app-specific from the root layout
- Marketing-specific stuff (CookieConsent, SiteAssistant, GA4 scripts) moves to `(marketing)/layout.tsx`
- App-specific stuff stays in app pages/layouts

**2.2 Domain-aware homepage**
- Update `app/page.tsx` to check hostname and render appropriate content:

```tsx
import { headers } from 'next/headers'
import MarketingHome from './(marketing)/home/page'

export const dynamic = 'force-dynamic'

export default function Page() {
  const host = headers().get('host') || ''
  const isMarketingDomain =
    host === 'quote-core.com' ||
    host === 'www.quote-core.com' ||
    host === 'www.quote-core.co.nz'

  if (isMarketingDomain) {
    return <MarketingHome />
  }
  // Existing app landing page content
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-slate-50">
      {/* ... existing app landing ... */}
    </div>
  )
}
```

**Why `force-dynamic`:** The homepage needs to read the host header. This only affects the `/` route — all other marketing pages remain statically rendered. This is acceptable for SEO (the marketing homepage content is still fully rendered server-side on every request).

**Alternative (if SEO is critical):** Use middleware to rewrite `quote-core.com/` → `/(marketing)/home` and have `app.quote-core.com/` serve the existing `page.tsx`. This allows both to be static. The trade-off is slightly more complex middleware. We can start with `force-dynamic` and optimize later if needed.

### Phase 3: Update Middleware (medium risk)

**3.1 Add marketing paths to public paths**
- Add to `PUBLIC_PATHS` in middleware:
  - `/about`, `/services`, `/contact`, `/blog`, `/coffee-terms`, `/cookie-policy`, `/free-trial`
  - `/construction-quoting-software`, `/roofing-quoting-software`
- These need to be accessible on `quote-core.com` (public domain) without auth
- They'll also be accessible on `app.quote-core.com` (harmless — marketing pages on the app domain)

**3.2 Update domain detection**
- Add `www.quote-core.co.nz` to the `isPublicDomain` check:
```ts
const isPublicDomain =
  hostname === 'quote-core.com' ||
  hostname === 'www.quote-core.com' ||
  hostname === 'www.quote-core.co.nz' ||
  hostname === 'quote-core.co.nz';
```

**3.3 Handle `/home` path**
- On `quote-core.com`: `/` is public (already handled)
- On `app.quote-core.com`: `/home` should redirect to `quote-core.com/` (optional, low priority)

### Phase 4: Merge globals.css (low risk)

**4.1 Combine CSS**
- Merge marketing-specific styles from website's `globals.css` into app's `globals.css`
- Check for conflicts (both use Tailwind, should be mostly compatible)
- Marketing-specific custom classes (pill-shimmer, etc.) go at the bottom with a comment

### Phase 5: Reconcile Free Tools Code (low risk)

**5.1 Sync FreeToolsAuthCard into app repo**
- Copy `FreeToolsAuthCard.tsx` and `FreeToolsHeader.tsx` from website → `app/(public)/_components/`
- Update the free tools pages in `(public)/` to use `FreeToolsAuthCard` (same fix we just applied to the website repo)

**5.2 Verify free tools work on both domains**
- On `quote-core.com/free-roofing-calculator` → uses TradeLayoutShell with marketing-style header
- On `app.quote-core.com/free-roofing-calculator` → same code, same behavior
- The free tools Supabase project (quote-core-free-tools) handles auth for both domains

### Phase 6: Vercel Configuration (low risk)

**6.1 Add domains to quotecore-plus-main Vercel project**
- Add `quote-core.com` and `www.quote-core.com` to the `quotecore-plus-main` Vercel project
- Add `www.quote-core.co.nz` and `quote-core.co.nz` (for future)
- Keep `app.quote-core.com` as existing

**6.2 Update vercel.json**
- Add domain aliases:
```json
{
  "alias": ["app.quote-core.com", "quote-core.com", "www.quote-core.com", "www.quote-core.co.nz"]
}
```

**6.3 Environment variables**
- Ensure `quotecore-plus-main` has all env vars needed:
  - App Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, etc. (already set)
  - Free tools Supabase: `NEXT_PUBLIC_FREE_SUPABASE_URL`, `NEXT_PUBLIC_FREE_SUPABASE_ANON_KEY`, `FREE_SUPABASE_SERVICE_ROLE_KEY` (already set)
  - Stripe, OpenAI, Resend, etc. (already set)
- Add any marketing-specific env vars if needed (none expected)

**6.4 Keep two Vercel projects**
- `quotecore-plus-dev` — connected to `development` branch (preview deployments)
  - Domains: Vercel preview URLs (no custom domains needed for dev)
  - Can test both marketing and app on preview URLs
- `quotecore-plus-main` — connected to `main` branch (production)
  - Domains: `app.quote-core.com`, `quote-core.com`, `www.quote-core.com`, `www.quote-core.co.nz` (future)

### Phase 7: Build & Test (must pass before cutover)

**7.1 Local build test**
- `npm run build` must pass
- Fix any TypeScript errors, import path issues, or JSX problems

**7.2 Preview deployment test**
- Push to `development` branch → Vercel auto-deploys preview
- Test on preview URL:
  - Marketing homepage renders
  - All marketing pages render (/about, /services, /blog, /contact, etc.)
  - All free tools work (/free-roofing-calculator, /free-quote-generator, etc.)
  - App login/dashboard works
  - Auth flows work (Google OAuth, email signup)
  - No console errors

**7.3 Domain routing test**
- On preview URL, simulate domain routing:
  - Marketing pages should be accessible
  - App pages should be accessible (with auth)
  - Middleware should redirect correctly

### Phase 8: DNS Cutover (requires Shaun's sign-off)

**8.1 Point quote-core.com to quotecore-plus-main Vercel project**
- Update DNS: `quote-core.com` A record / CNAME → Vercel
- Update DNS: `www.quote-core.com` CNAME → `cname.vercel-dns.com`
- Vercel will automatically pick up the domains and serve the merged app

**8.2 Verify live**
- `quote-core.com` → marketing homepage
- `quote-core.com/free-roofing-calculator` → free tools
- `quote-core.com/blog` → blog
- `app.quote-core.com` → app (unchanged)
- `app.quote-core.com/login` → login (unchanged)

**8.3 Archive quotecore-website repo**
- Add a README note: "Merged into quotecore-plus. This repo is archived."
- Don't delete it (keep history)

### Phase 9: Future NZ Domain

When ready to add `www.quote-core.co.nz`:
1. Add domain to `quotecore-plus-main` Vercel project
2. Update middleware `isPublicDomain` check (already done in Phase 3.2)
3. Update DNS: `www.quote-core.co.nz` CNAME → `cname.vercel-dns.com`
4. Optionally create NZ-specific content (pricing in NZD, NZ phone, etc.) via domain check in marketing components

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Build breaks on merge | Medium | Test locally before pushing. Fix all TS/import errors. |
| Marketing pages break on app domain | Low | They're public pages, no auth needed. Worst case: 404 on missing assets. |
| App pages accidentally served on quote-core.com | Low | Middleware already blocks this (redirects to app.quote-core.com) |
| SEO impact on quote-core.com | Low-Medium | Marketing pages remain static. Homepage goes force-dynamic (minor). Sitemap + robots need updating. |
| React 18 vs 19 compatibility | Low | Marketing pages don't use React 19-specific features. They use standard hooks. |
| CSS conflicts | Low | Both use Tailwind. Merge carefully, check for class name collisions. |
| Free tools auth breaks | Low | Same Supabase project, same auth flow. Both domains are in the redirect allow list. |

## What NOT to change
- Don't merge Supabase projects (app and free-tools stay separate)
- Don't change app authentication (Supabase SSR with cookies)
- Don't change the app's routing structure (all app routes stay where they are)
- Don't touch Stripe billing
- Don't change the free tools engine (configs, shared components, tabs)

## Estimated effort
- Phase 0-1 (copy files): 1-2 hours
- Phase 2-3 (layouts + middleware): 1 hour
- Phase 4-5 (CSS + free tools sync): 30 min
- Phase 6 (Vercel config): 15 min
- Phase 7 (build + test): 30-60 min
- Phase 8 (DNS cutover): 15 min + DNS propagation
- **Total: ~4-5 hours of focused work**

## Key Insight

The quotecore-plus repo ALREADY has domain-based routing middleware, and the `(public)` route group already houses all free tools. This means the merge is primarily about:
1. Copying marketing pages into a `(marketing)` route group
2. Copying shared components and assets
3. Making the homepage domain-aware
4. Adding marketing paths to the public paths list in middleware

The app and marketing site can coexist cleanly because:
- Marketing pages are public (no auth) → accessible on all domains
- App pages require auth → middleware blocks unauthenticated access on all domains
- Free tools are public → accessible on all domains
- The domain check in middleware determines which pages are "public" vs "gated"
