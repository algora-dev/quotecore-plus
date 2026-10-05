# Ron Port Brief: Supplier Pricing Tool -> t3labs.tech demos

**From:** Gavin (QuoteCore+ agent)
**Date:** 2026-09-01 (updated)
**Source commit:** `197b5ccb` on `main` (github.com/algora-dev/quotecore-plus)

## What this is

The Supplier Pricing Tool (`app/(public)/supplier-pricing-tool/`) is now fully
config-driven and multi-supplier. Burton Roofing is config #1. The goal:
t3labs.tech hosts branded demo instances of this tool - one URL per supplier -
that Shaun sends out with a demo video to close deals.

## Architecture after the refactor

- `supplierDefs/<slug>.ts` - one file per supplier: name, tagline, logo,
  brandColor, theme palette (8 tokens), feature flags (login, adminPanel,
  quoteCoreConnect, convertToQuote, emailCapture), discountPct, full product
  catalog. **Adding a supplier = copying this file and editing values.**
- `supplierDefs/index.ts` - registry. Register the new def, done.
- `supplierConfig.tsx` - reads the def, layers optional localStorage overrides
  on top (demo admin panel), exposes `SupplierConfigProvider` context.
- `page.tsx` - tool shell. Header logo + the scoped theme CSS (`.spt-scope`)
  are generated entirely from config.theme. Zero Burton-specific code remains.
- `[supplierSlug]/page.tsx` - route `/supplier-pricing-tool/<slug>` renders
  any registered supplier with full branding.
- All step components (PortalFlow, ProductStep, OutputView, etc.) read config
  from context - no per-supplier edits ever needed.

## Port options for t3labs.tech (recommend A)

**A. Self-contained tool folder in the t3labs site repo (recommended).**
Copy the `supplier-pricing-tool` folder (plus its two imports:
`../_components/FreeToolsAuthProvider` and the takeoff workstation deps) into
the t3labs Next.js app as a section. For demo purposes:
- Replace `FreeToolsAuthProvider` with a no-op (login feature can be turned
  off per supplier via config flag anyway).
- Keep everything else as-is - it has no Supabase dependency for core flow.
- Each demo = one def file + one route. No coupling to the QuoteCore+ repo.

**B. Iframe embed from a dedicated Vercel project.** Fork the repo into a
`t3labs-demos` project, each demo at its own path, iframe onto t3labs pages.
Faster to set up but worse UX (framed scroll, mobile) - only use if Ron's
stack can't take the folder.

## PDF upload support (new since first brief, commit 52d86610 + 197b5ccb)

The tool now accepts PDF plans (up to 50 MB; images stay 10 MB). Flow: user
picks/drops a PDF -> page-picker modal with thumbnails -> chosen page is
converted to a PNG **client-side in the browser** -> normal image flow.
No backend, no API, no Supabase involved.

What the port MUST copy along with the folder:
- `app/components/PdfPagePicker.tsx` (shared component - `usePdfPagePicker()` hook).
- `pdfjs-dist` npm dependency (v6.x, MIT).
- The wiring in `EntryModeStep.tsx` (imports the hook; already done in the
  source - no code changes needed, just don't strip it when copying).

IMPORTANT: the pdf worker is bundled as a build asset via
`new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url))`.
Do NOT switch it to a `public/` path + `workerSrc` - that broke on
quote-core.com due to domain redirects, and t3labs.tech could hit the same
class of problem. Keep the bundled-worker approach exactly as-is.


The live dev build stays at https://www.quote-core.com/supplier-pricing-tool
(Burton). That remains the master. When a demo version is final, port it to
t3labs. When a supplier BUYS, we fork the codebase with their config baked in
and host it for them - separate deployment, their domain.

## Open items / recommended port settings

**Keep ALL feature flags ON** - the goal is a full-capability showcase:

- `convertToQuote`: fully self-contained. The convert button opens the
  tool's own branded quote builder at `/supplier-pricing-tool/quote`
  (per-line pricing + markup/margin, supplier branding, no backend).
  Works on t3labs.tech with zero changes. No redirect to the QuoteCore+
  free quote generator is needed.
- `quoteCoreConnect` ("Continue in QuoteCore+"): now config-driven. Set in
  the supplier def:
  ```ts
  urls: {
    signup: 'https://www.quote-core.com/signup',
    draftsApi: 'https://www.quote-core.com/api/free-tools/drafts',
    enquiryApi: 'https://www.quote-core.com/api/free-tools/supplier-enquiry',
  }
  ```
  The CTA gracefully falls back to a plain signup link if the cross-origin
  draft save is blocked (no CORS). To get the full draft handoff working
  cross-domain, QuoteCore+ adds CORS headers on those two API routes - ask
  Gavin when the port is live.
- `emailCapture`: localStorage-based, self-contained - works as-is. Leads
  surface in the demo admin panel.
