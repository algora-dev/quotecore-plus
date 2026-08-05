# Gerald Audit Brief — Trade Calculators + Free Quote Generator

**Date:** 2026-07-11
**Scope:** All work shipped to `development` branch from `720d55b` through `c789c0a` (19 commits ahead of `main` baseline `1a80228`)
**Branch:** `development` (commit `c789c0a`)
**Request:** Full audit of the trade calculator engine, SEO slug pages, free quote generator, and AI document parsing pipeline. Review for security, correctness, performance, UX consistency, and improvement opportunities.

---

## 1. What Was Built

### 1A. Trade Calculator Engine (commits `720d55b` → `f758775`)

**Config-driven calculator system** at `app/(public)/free-calculators/`. One shared engine, N trade pages. Adding a trade = one config file + thin layout/page pair.

**5 live calculator pages:**
1. `/free-roofing-calculator` — Roof Area, Rafter/Hip&Valley, Batten, Smart Component, Angle Finder
2. `/free-construction-calculator` — Area & Materials, Timber & Stud Lengths (incl. Bird's Mouth), Smart Component, Angle Finder
3. `/free-concrete-calculator` — Slab & Footing Volume, Area & Formwork, Smart Component, Falls & Gradients
4. `/free-landscaping-calculator` — Garden & Lawn Area, Slope & Gradient, Smart Component, Angle Finder
5. `/free-birds-mouth-calculator` — dedicated Bird's Mouth, Smart Component, Angle Finder

**42 SEO slug pages** (all static prerendered): 26 roofing + 5 concrete + 4 construction + 2 slope + 3 free tools + 2 existing. Each has unique H1/hero/tips/FAQs/formulas/worked examples/assumptions. Config files: `roofingSlugs1-4.ts`, `concreteSlugs.ts`, `constructionSlugs.ts`, `slopeSlugs.ts`.

**Shared engine files:** `types.ts`, `TradeCalculator.tsx`, 7 tab components (incl. `BattenTab.tsx`), `TradePage.tsx`, `TradeLayoutShell.tsx`, `AngleDiagram.tsx`, `CalcResultPopup.tsx`

**Hub page** at `/free-calculators` — registry-driven cards, sections for each trade + free tools.

**Middleware:** `if (pathname.startsWith('/free-')) return true;` — all current+future free routes public without updating PUBLIC_PATHES.

**Key components to audit:**
- `app/(public)/free-calculators/_shared/TradeCalculator.tsx` — main engine
- `app/(public)/free-calculators/_shared/AngleDiagram.tsx` — bird's mouth SVG (recently recomposed to detail view)
- `app/(public)/free-calculators/_shared/CalcResultPopup.tsx` — conversion popup system
- `app/(public)/free-calculators/configs/registry.ts` — trade registry
- `app/(public)/free-calculators/configs/*.ts` — individual trade configs

### 1B. Bird's Mouth Diagram (commits `ee25a99`, `d8cd593`)

The `AngleDiagram.tsx` component was recomposed from a full-rafter overview to a **zoomed detail view** of the notch. Key changes:
- viewBox now frames ONLY the notch (C, P_high, P_low)
- Asymmetric padding zones for each label (Heel left, A right, Seat width top, B bottom)
- Blue angle arcs at both cut corners
- White text halos (paintOrder stroke) for legibility
- Removed grey perpendicular heel indicator; depth folded into caption

**Audit focus:** Verify the SVG geometry is correct at extreme pitches (5°, 75°). Check that the zoom framing never clips labels at any pitch.

### 1C. 3 Free Tool Generators (commit `3e3d58a`)

- `/free-quote-generator` — quote builder with PDF output (print-to-PDF)
- `/free-invoice-generator` — invoice builder
- `/free-purchase-order-generator` — PO builder

All three: pre-fill from URL params, no signup required, print-to-PDF output, conversion popups.

### 1D. AI Image Upload + Text Parsing (commits `7427d0c`, `26e829c`)

**API Route:** `app/api/free-tools/parse-document/route.ts`
- Accepts `{ type: 'quote'|'order'|'invoice', mode: 'text'|'image', content?, image?, imageMime? }`
- Uses **GPT-4o-mini** (cheapest vision model, ~$0.15/1M input tokens)
- Returns structured JSON: `{ companyName, clientName, clientEmail, clientAddress, quoteDate, validDays, notes, lines: [{description, qty, unit, rate}], confidence, warnings }`
- IP-based rate limiting: 5 scans/day (in-memory Map, resets every 24h)
- Low temperature (0.1), `response_format: json_object`
- System prompt tuned for construction/trades documents, handles handwritten text

**ImageUpload component:** `app/(public)/free-quote-generator/ImageUpload.tsx`
- Drag-and-drop or click upload
- Camera capture on mobile (`capture="environment"`)
- Client-side compression: max 2000px, JPEG 0.8 quality
- PDF support (base64)
- Max 10MB file size

**PromptBox component:** `app/(public)/free-quote-generator/PromptBox.tsx`
- Textarea for pasting/typing quote details
- Same API endpoint, `mode: 'text'`
- Shares rate limit pool with image upload

### 1E. Free Quote Generator Feature Set (commits `1aaa5a5` → `c789c0a`)

**Document Settings:**
- Imperial/Metric toggle (updates default unit for new lines, auto-converts existing default-unit lines)
- Measurement type dropdown per line: Unit (pieces), M/Ft, mm/in, m²/ft², m³/ft² — with blank option
- Currency selector: GBP, USD, EUR, AUD, CAD, NZD
- Editable tax rate (%) and tax name

**Business section:**
- Logo upload (client-side compressed to 300px, shown top-right of generated quote)

**Output:**
- Footer section with Normal/Italic toggle
- Dynamic currency symbol throughout (form, totals, generated output, popup)
- Logo displayed in top-right of generated quote
- Tax label uses custom name + rate

---

## 2. Security Audit Priorities

### 2A. API Route Security (`/api/free-tools/parse-document`)
- **Rate limiting is in-memory** (Map on the Node.js process). This does NOT work across multiple Vercel serverless instances. Each instance has its own Map. A user could bypass the 5/day limit by hitting different instances. **Needs proper rate limiting** (Upstash Redis, Vercel KV, or Supabase table).
- **Input validation:** The route accepts base64 image data and forwards it to OpenAI. Verify:
  - File size is validated server-side (not just client-side)
  - The base64 is actually a valid image/PDF (not arbitrary data)
  - The `imageMime` field can't be spoofed to send non-image content to OpenAI
- **API key exposure:** `OPENAI_API_KEY` is server-side only (good). Verify it's not leaked in any client bundles or error messages.
- **Error handling:** OpenAI errors are caught but the error message could leak internal details. Check the catch block.

### 2B. Public Path Access
- Middleware allows all `/free-*` paths without auth. Verify no sensitive routes accidentally match this pattern.
- The free tools Supabase project (`quote-core-free-tools`) has its own RLS policies. Audit those.

### 2C. SEO Slug Pages
- 42 static pages generated from config files. Check for any user-input-derived content (should be none — all static).
- Verify `generateStaticParams` is used for SSG, not SSR.

---

## 3. Correctness Audit Priorities

### 3A. Calculator Maths
- **Roof Area:** pitch multiplier, plan area → actual roof area
- **Rafter/Hip&Valley:** rafter length, hip/valley length formulas
- **Batten Calculator:** batten spacing, count, waste factor
- **Bird's Mouth:** seat cut, heel height, notch depth, angles A/B
- **Volume (WxHxD):** volume calculation, preset depth bypass
- **Angle Finder:** arbitrary angle calculations
- **Concrete:** slab/footing volume, formwork area, falls/gradients
- **Timber:** stud lengths, bird's mouth cut

Verify all formulas against industry standards. Check edge cases: 0°, 90°, negative inputs, very large numbers.

### 3B. Bird's Mouth SVG Geometry
- Verify the zoom framing produces correct visual results at pitches: 5°, 15°, 22.5°, 30°, 45°, 60°, 75°
- Verify angle arcs are drawn in the correct direction (sweep flag)
- Verify labels never overlap lines or each other at any pitch
- Verify the orange timber edges correctly frame the notch when clipped to the viewBox

### 3C. AI Parsing Accuracy
- Test with various document types: printed quote, handwritten quote, PDF screenshot, supplier invoice
- Verify the system prompt handles: missing fields, ambiguous line items, multiple tax rates, different currencies
- Check that `response_format: json_object` reliably returns valid JSON (GPT-4o-mini can sometimes wrap in markdown fences despite this)

### 3D. Measurement System Conversion
- When switching Metric ↔ Imperial, verify existing lines with the old default unit are correctly converted
- Verify lines with custom units (typed manually) are NOT converted
- Verify the per-line dropdown correctly shows the current system's units

---

## 4. Performance Audit

- **42 static slug pages** — verify build times are reasonable, no OOM during SSG
- **Client-side image compression** — check it doesn't block the main thread on large images (consider Web Worker)
- **API route cold starts** — GPT-4o-mini call takes 3-8s; verify Vercel's 30s timeout is sufficient
- **Bundle size** — the free quote generator page imports ImageUpload and PromptBox; verify no unnecessary client-side deps

---

## 5. UX Consistency

- Verify all buttons use `rounded-full` (Design System)
- Verify all list rows use `rounded-xl border bg-white hover:bg-orange-50/40`
- Verify inputs use `rounded-lg focus:border-orange-500 focus:outline-none`
- Verify modals use `backdrop-blur-sm bg-black/40`
- Check icon usage is consistent (Heroicons outline 24×24)
- Verify the free tools pages match the app's visual language

---

## 6. Improvement Opportunities to Flag

- **Rate limiting:** Move to persistent storage (Upstash Redis or Supabase table)
- **PDF support in image upload:** Currently sent as base64 to OpenAI — verify GPT-4o-mini handles PDF pages correctly (it may only see the first page)
- **Prompt box examples:** Could add "Load example" button that fills the textarea with a sample quote
- **Currency formatting:** Currently uses symbol prefix only (£25.00). Some currencies use suffix or different decimal separators (€25,00 in some locales)
- **Tax:** Only supports a single tax rate. Some jurisdictions need compound tax or multiple tax lines
- **SEO:** The slug pages could benefit from internal linking between related calculators
- **Conversion funnel:** The popup triggers after 1.5s delay — verify this doesn't feel intrusive
- **Accessibility:** Check that the drag-and-drop upload has keyboard fallback, and that the color contrast on all text meets WCAG AA

---

## 7. Files to Review

### Calculator engine
- `app/(public)/free-calculators/_shared/TradeCalculator.tsx`
- `app/(public)/free-calculators/_shared/TradePage.tsx`
- `app/(public)/free-calculators/_shared/TradeLayoutShell.tsx`
- `app/(public)/free-calculators/_shared/AngleDiagram.tsx`
- `app/(public)/free-calculators/_shared/CalcResultPopup.tsx`
- `app/(public)/free-calculators/_shared/types.ts`
- `app/(public)/free-calculators/_shared/BattenTab.tsx`
- `app/(public)/free-calculators/configs/registry.ts`
- `app/(public)/free-calculators/configs/roofing.ts`
- `app/(public)/free-calculators/configs/construction.ts`
- `app/(public)/free-calculators/configs/concrete.ts`
- `app/(public)/free-calculators/configs/landscaping.ts`
- `app/(public)/free-calculators/configs/birdsmouth.ts`
- `app/(public)/free-calculators/configs/roofingSlugs1-4.ts`
- `app/(public)/free-calculators/configs/roofingSlugRegistry.ts`
- `app/(public)/free-calculators/configs/concreteSlugs.ts`
- `app/(public)/free-calculators/configs/constructionSlugs.ts`
- `app/(public)/free-calculators/configs/slopeSlugs.ts`

### Free quote generator
- `app/(public)/free-quote-generator/page.tsx`
- `app/(public)/free-quote-generator/ImageUpload.tsx`
- `app/(public)/free-quote-generator/PromptBox.tsx`
- `app/(public)/free-quote-generator/layout.tsx`

### API route
- `app/api/free-tools/parse-document/route.ts`

### Other free tools
- `app/(public)/free-invoice-generator/page.tsx`
- `app/(public)/free-purchase-order-generator/page.tsx`
- `app/(public)/free-calculators/page.tsx` (hub page)

### Middleware
- `middleware.ts` (public path access for `/free-*`)

### Smoke tests
- `docs/smoke-tests/CHECKLIST.md` (items L, M, N)

### Plan docs
- `docs/FREE-TOOLS-MASTER-PLAN.md`
- `docs/free-tools-plan.md`

---

## 8. Known Issues & TODOs

1. **Rate limiting is in-memory** — does not work across Vercel serverless instances. High priority to fix.
2. **Gerald audit fixes from previous round** (C-01, H-01, H-03) were applied. Verify they're still holding.
3. **Invoice/PO generators do NOT have image upload or prompt box yet** — only the quote generator does. Phase 4 reuse pending.
4. **Logo upload** uses FileReader + canvas — no server-side validation that the uploaded file is actually an image.
5. **Bird's mouth diagram** was visually verified at 22.5°, 40°, 60° via headless Chrome. Not tested at extreme pitches (5°, 75°).
6. **Tax is single-rate only** — no support for compound tax, multiple tax lines, or tax-inclusive pricing.

---

## 9. Bundle HEAD

`development` branch at commit `c789c0a`. 

```
git checkout development
git pull origin development
# Review from c789c0a
```

Baseline on `main`: `1a80228` (2026-07-08).
