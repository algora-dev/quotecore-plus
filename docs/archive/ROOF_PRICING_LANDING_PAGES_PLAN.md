# Roof Pricing Landing Pages - SEO Plan for AI Discovery

> Created: 2026-08-02 by Gavin
> Purpose: Two new dedicated pricing pages (one per site) to capture "roof cost" / "roof price" search intent that the current "roof takeoff builder" pages don't target.

---

## The Problem

ChatGPT and other AI assistants discover tools through **web search**, not by reading llms.txt directly. When a user asks "give me a roof price in New Zealand" or "how much does a roof cost", ChatGPT searches for terms like:

- "roof price calculator"
- "roof cost New Zealand"
- "roof material pricing"
- "how much does a roof cost"

Our current pages are titled "Free Roof Takeoff Builder" which targets the word "takeoff" - a trade term that everyday users and AI assistants don't search for when asking about roof **pricing**.

Competitors like TakeoffQS and BigEstimate currently rank for these queries. We don't appear at all.

---

## What Already Exists (do not duplicate or change)

### .com (quote-core.com)
- `/free-roofing-takeoff-builder` - The main tool (AI-accessible, has API, auto-resolves supplier pricing)
- `/free-roof-replacement-cost-calculator` - SEO slug page (generic calculator, not supplier-priced)
- `/free-roofing-calculator` - General roofing calculator
- 40+ other free calculator pages
- Blog posts: "How to price a roofing job", "How to do a roof takeoff", "How much roofing material"
- Resources hub with 7 topic pages
- Full llms.txt with API documentation
- Sitemap at `/sitemap.xml`

### .co.nz (quote-core.co.nz)
- `/free-roofing-takeoff-builder` - NZ-branded version (NZD pricing via Apex Roofing)
- `/free-roofing-calculator` - General roofing calculator
- 6 free calculator pages
- Marketing pages (features, pricing, about, services)
- llms.txt pointing to .com API endpoints
- Sitemap at `/sitemap.xml`

---

## The Plan: Two New Pages

### Page 1: .com - `/free-roof-pricing-calculator`

**URL:** `https://quote-core.com/free-roof-pricing-calculator`

**Type:** Standalone page (like the takeoff builder, not a blog post or slug page)

**Target keywords:**
- "roof pricing calculator"
- "roof cost calculator"
- "roof material prices"
- "how much does a roof cost"
- "roof price estimator"

**Metadata:**
- Title: "Free Roof Pricing Calculator - Get Instant Roof Material Prices | QuoteCore+"
- Description: "Free roof pricing calculator. Enter roof measurements and get instant material prices, labour costs, and totals in USD. No signup required."
- Canonical: `https://quote-core.com/free-roof-pricing-calculator`
- hreflang alternates: `en-NZ` → .co.nz version, `x-default` → .com version

**Page structure:**
1. **H1:** "Roof Pricing Calculator"
2. **Hero (100 words):** Explains you can get real roof material pricing instantly. Enter your roof measurements, select your country, get a complete priced breakdown.
3. **CTA button:** "Calculate Roof Price Now" - links to `/free-roofing-takeoff-builder?country=US&supplier=prime-roofing`
4. **Content section "How much does a roof cost?" (200 words):** General pricing guidance. Metal roofing $15-25/m² material, labour $4-8/m², total $20-35/m². Factors: roof size, pitch, complexity, material choice, location. Mention that prices vary by supplier and region.
5. **Content section "What affects roof pricing?" (150 words):** Pitch (steeper = more material), waste (5-15%), component count (hips, valleys, ridges, barges, spouting), material type (corrugate, tile, standing seam), labour rates by region.
6. **CTA button:** "Get Your Roof Price" - same link
7. **Content section "How this calculator works" (100 words):** Enter measurements from a roof plan or actual measurements. The tool adjusts for pitch, applies waste, looks up supplier pricing, and returns a full cost breakdown. Free, no signup. Links to the takeoff builder tool.
8. **Internal links:** To `/free-roofing-takeoff-builder`, `/free-roofing-calculator`, `/blog/how-to-price-a-roofing-job`
9. **For AI agents section (sr-only):** Same structured AI-accessible instructions as the takeoff builder page, pointing to the API endpoints

**Schema.org structured data:**
- `SoftwareApplication` - name, description, applicationCategory: CalculatorApplication, offers: price 0 USD
- `FAQPage` with 4-5 questions:
  - "How much does a roof cost?" (general answer with price ranges)
  - "Is this roof pricing calculator free?"
  - "How accurate are the prices?"
  - "What measurements do I need?"
  - "Does this work for my country?"
- `BreadcrumbList` - Free Tools > Roof Pricing Calculator

**Sitemap:** Add to `app/sitemap.ts` with priority 0.9

**Internal links from existing pages:**
- Add link from `/free-tools` hub page
- Add link from `/free-roofing-takeoff-builder` page (related tools section)
- Add link from `/free-roofing-calculator` page
- Blog post "How to price a roofing job" links to it

---

### Page 2: .co.nz - `/roof-cost-calculator-nz`

**URL:** `https://www.quote-core.co.nz/roof-cost-calculator-nz`

**Type:** New page on NZ site

**Target keywords:**
- "roof cost calculator NZ"
- "roof price New Zealand"
- "roofing prices NZ"
- "how much does a roof cost NZ"
- "corrugate roof cost NZ"
- "roof replacement cost Auckland"

**Metadata:**
- Title: "Roof Cost Calculator NZ - Free Roof Pricing Tool | QuoteCore+"
- Description: "Free NZ roof cost calculator. Enter roof measurements and get instant material prices in NZD including GST. Corrugate, long-run, flashings, spouting. No signup required."
- Canonical: `https://www.quote-core.co.nz/roof-cost-calculator-nz`
- hreflang alternates: `en-US` → .com version, `x-default` → .com version

**Page structure:**
1. **H1:** "Roof Cost Calculator NZ"
2. **Hero (100 words):** Get instant roof material pricing in NZD. Enter measurements from your roof plan, get a full cost breakdown including corrugate, ridging, hip capping, valleys, barges, spouting, underlay, and fixings. NZD pricing, GST-inclusive options.
3. **CTA button:** "Calculate Roof Cost Now" - links to `/free-roofing-takeoff-builder?supplier=apex-roofing`
4. **Content section "How much does a roof cost in New Zealand?" (250 words):** NZ-specific pricing. Corrugate .40g long run: ~$32.50/m² material + $8/m² labour. Roll top ridging: ~$28/m. Hip capping: ~$26/m. Valley flashing: ~$35/m. Barge flashing: ~$24/m. Spouting half-round: ~$42/m. Underlay: ~$4.50/m². Tek screws: ~$3.20/m². Mention that these are indicative prices from Apex Roofing (Christchurch) and actual prices vary by region (Auckland, Wellington, Christchurch) and supplier.
5. **Content section "Factors that affect roof cost in NZ" (150 words):** Roof pitch (common NZ pitches 15-35 degrees), waste (5-15%), roof complexity (hips, valleys, dormers), material choice (corrugate vs tile vs standing seam), access difficulty, region (Auckland tends higher, Christchurch mid-range).
6. **CTA button:** "Get Your NZ Roof Price" - same link
7. **Content section "About this calculator" (100 words):** Powered by QuoteCore+ with live supplier pricing from Apex Roofing (Christchurch). Calculates pitch-adjusted areas, waste, and full material takeoff. Free, no signup. Part of QuoteCore+ construction quoting software.
8. **Internal links:** To `/free-roofing-takeoff-builder`, `/roofing-quoting-software`, `/features/digital-roof-takeoff`, `/free-trial`

**Schema.org structured data:**
- `SoftwareApplication` - name, description, offers: price 0 NZD
- `FAQPage` with NZ-specific questions:
  - "How much does a corrugate roof cost in NZ?"
  - "How much does roof replacement cost in Auckland?"
  - "Is this roof calculator free to use?"
  - "Are the prices in NZD including GST?"
  - "What areas of New Zealand does this cover?"
- `BreadcrumbList` - Home > Roof Cost Calculator NZ

**Sitemap:** Add to `app/sitemap.ts` with priority 0.9

**Internal links from existing pages:**
- Add link from homepage (relevant section)
- Add link from `/free-roofing-takeoff-builder` page
- Add link from `/roofing-quoting-software` page
- Add link from `/features/digital-roof-takeoff` page

---

## What This Does NOT Do (protecting existing work)

- **No duplicate tool:** These are content/landing pages that LINK to the existing takeoff builder, not copies of it
- **No changing existing pages:** All existing page titles, metadata, URLs, and content stay untouched
- **No duplicate content:** Each page has unique, site-specific content (USD/general on .com, NZD/NZ-specific on .co.nz)
- **No new tools to maintain:** The pages are static content + CTA links, using the existing takeoff builder and API
- **No effect on existing sitemap entries:** Only adding new entries, not modifying existing ones

---

## Expected Impact

1. **ChatGPT/AI discovery:** New pages target the exact search queries users type when asking AI about roof pricing. Once Bing crawls them (24-48 hours after indexing request), ChatGPT's web search will find pages that match "roof cost" / "roof price" queries and cite them.

2. **Search ranking:** The .co.nz page targets low-competition NZ-specific terms ("roof cost calculator NZ", "corrugate roof cost NZ") where we can rank faster. The .com page targets broader terms with more competition but also more volume.

3. **Conversion:** Both pages funnel users to the existing takeoff builder tool with supplier pre-selected, so they immediately get priced results.

---

## Technical Implementation

- **Build time:** ~2-3 hours per page
- **No new dependencies:** Uses existing components (BlogHeader, SiteFooter, etc.)
- **No database changes:** Pure content pages
- **No API changes:** Links to existing API endpoints
- **Deploy:** Push to main on both repos, Vercel auto-deploys

## Files to create/modify

### .com (quotecore-plus)
- `app/(public)/free-roof-pricing-calculator/layout.tsx` - metadata + schema
- `app/(public)/free-roof-pricing-calculator/page.tsx` - page content
- `app/sitemap.ts` - add new URL entry
- `app/(public)/free-tools/page.tsx` - add internal link (if applicable)

### .co.nz (quotecore-nz)
- `app/roof-cost-calculator-nz/page.tsx` - page content + metadata
- `app/sitemap.ts` - add new URL entry
- `app/(home)/page.tsx` - add internal link (if applicable)

---

## Approval

Review this plan and let Gavin know:
1. Approve as-is → Gavin builds both pages
2. Changes needed → Gavin adjusts before building
3. Only build one page → Gavin builds the approved one first
