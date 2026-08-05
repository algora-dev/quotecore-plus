# Phase 0: Product Truth Table, Claim Audit & Baseline

**Status:** Complete  
**Date:** 3 August 2026  
**Branch:** development  
**No code changed.**

---

## 1. Product Truth Table

Every feature claim the website can make, with the confirmed product behaviour.

### Core Engines

| Feature | What it does (confirmed) | What it does NOT do | Source |
|---|---|---|---|
| **Digital Roof Takeoff** | Upload a plan (PDF/image). Measure roof areas, lengths, pitch and geometry digitally. Manual digital takeoff is a first-class workflow, not a fallback. Measurements carry into pricing/quote without re-entry. | Does not automatically detect anything without AI Scan Assist. Manual measurement is the baseline. | Plan + Shaun audio 09:19 |
| **AI Scan Assist** | AI identifies one or more roof outlines/areas on a plan. Each area can be named and assigned different pitch, material system and Smart Components. AI detects: ridges/ridge capping, hips, valleys, barges, spouts. Detected elements are placeholders. User can swap any placeholder to any saved Smart Component via dropdown - quantities, labour, waste and pricing recalculate. User reviews, corrects and confirms. User can manually add any non-detected components (side flashings, change-of-pitch flashings, parapet caps, downpipes, etc). | AI does NOT detect: flashings, downpipes, parapet caps, change-of-pitch flashings, or anything beyond the 5 core element types. AI does not auto-send or auto-quote. AI is optional. | Shaun audio 09:19 + plan |
| **Smart Components** | Reusable roofing measurement and pricing rules. Store: materials, labour, waste, quantities, supplier products, costs, prices, markup, notes, drawings. Connect to measurements from plans, site measurements or manual entry. "QuoteCore+ remembers how you work." | Components do not auto-generate without measurement input. | Plan |

### Four Ways to Quote

| Path | Best for | Starting point | Workflow |
|---|---|---|---|
| 1. Plan + AI Scan Assist | Full reroofs, plan work | PDF/roof plan | AI identifies, roofer verifies, Smart Components calculate |
| 2. Plan + manual takeoff | Complex/unusual plans | PDF/roof plan | Roofer measures digitally, applies Smart Components |
| 3. Site measurements + Smart Components | Site-measured, repeat jobs | Measurements from site | Saved rules generate quantities, labour, price |
| 4. Custom/line-by-line quote | Repairs, variations, one-offs | Blank quote, CSV catalogue, supplier catalogue, component library or saved items | Add only what's needed; retains sending, automation and tracking |

**Shared accelerators (available across all paths):**
- CSV catalogue import
- Searchable supplier catalogues
- Supplier component libraries
- Saved catalogue items

### Connected Workflow

Measure > Price > Quote > Send > Track > Approve/Decline > Order > Complete > Invoice

| Capability | Confirmed behaviour | Source |
|---|---|---|
| **Sending documents** | Send quotes, orders and invoices directly from QuoteCore+ with attachments. | Shaun audio 09:03 |
| **Document tracking** | Opened/read tracking for quotes, orders AND invoices. Accepted/declined status for quotes (auto-updates when recipient acts). | Shaun audio 09:03 + 09:19 |
| **Quote statuses** | Partially automatic: sent, accepted, declined statuses update when recipient acts. | Shaun audio 09:03 |
| **Time-based follow-ups** | Configure automatic trigger: after X time, send a saved email template to recipient. Configurable cancellation conditions (e.g. if quote accepted/declined, cancel the follow-up). | Shaun audio 09:03 |
| **Event-based follow-ups** | Trigger on quote accepted or quote declined. Configurable delay (10 min, 2 days, etc). Can send templates with attachments (terms, deposit details, thank-you, forms). | Shaun audio 09:03 |
| **Follow-up cancellation** | Automatic when configured conditions are met (accept/decline cancels pending follow-up). | Shaun audio 09:03 |
| **Quote to order** | From a saved quote (past draft, at quote summary stage): go to Orders > Create order from quote > select the quote. Fully editable. NOT one-click. NOT auto-created. | Shaun audio 09:19 |
| **Quote to invoice** | From a saved quote: go to Invoices > Create invoice from quote > select the quote. Fully editable. NOT one-click. NOT auto-created. NOT created together with order. | Shaun audio 09:19 |
| **Order display formats** | Three formats: (1) line-by-line, (2) single-column with images/drawings, (3) double-column with images/drawings. | Shaun audio 09:19 |
| **Invoice payments** | QuoteCore+ does NOT process payments. Invoice templates present one or more payment methods: bank details (copy/paste), Stripe links (external), PayPal links (external). Recipient can mark invoice paid or dispute it. | Shaun audio 09:19 |
| **Header/layout templates** | Separate reusable templates for quotes, orders and invoices. Each can vary: business name, logo, contact person, email, layout/presentation. Order templates also vary display format. Invoice templates also vary payment methods. | Shaun audio 09:19 |
| **Message centre** | Exists. Central place to manage document activity. Still expanding. | Shaun audio 09:03 |
| **Alert centre** | Exists. Receives alerts for document events (accepted, declined, opened/read). Still expanding. | Shaun audio 09:03 |

### Catalogue and Supplier Discovery

| Capability | Confirmed behaviour |
|---|---|
| CSV catalogue import | Upload supplier price catalogues via CSV. Product code/SKU, product name/description, price are the minimum core fields. |
| Supplier catalogues | Searchable by area/keyword. Public catalogues uploaded by suppliers. |
| Supplier component libraries | Searchable Smart Component libraries published by suppliers. |
| Catalogue to component converter | Convert raw catalogue items into reusable Smart Components. |
| Use of imported items | Can be used in line-by-line quotes, Smart Components, material orders and invoices where supported. |
| Supplier pricing limitations | Indicative, sourced from publicly available supplier data. Region, currency, tax basis, retail/trade basis, update date and exclusions noted where relevant. |

---

## 2. Claim Audit - Current Website

### Homepage (`app/(marketing)/home/page.tsx`)

| Claim/Statement | Location | Verdict | Action |
|---|---|---|---|
| "Quoting and job software for trades" (eyebrow) | Hero | Too broad. Should lead with roofing. | Change to roofing-first eyebrow. |
| "Built for roofing. Powerful enough for every trade." (H1) | Hero | Correct. KEEP per Shaun. | No change. |
| "Turn measurements, materials, labour, pricing, and business rules into accurate professional quotes using Smart Components" | Hero body | Correct. | Light roofing focus. |
| "Plans from free to $59/month" | Hero | Correct. | Keep. |
| Step 01 Measure: "AI Scan Assist to identify roof areas, ridges, hips, valleys, and barges" | Workflow | Correct but missing spouts. Also missing "multiple roof areas" and naming. | Update to include spouts, multiple named areas. |
| Step 05 Order: "Turn an approved quote into a material order in one click" | Workflow | **FALSE.** Not one-click. User creates order from quote via Orders section. | Fix: remove "one click", describe accurate workflow. |
| Step 05 Order: "AI converts it into line items automatically" | Workflow | **CONFIRMED ACCURATE** (Shaun 09:48). AI line-item import works in line-by-line order editor. | Keep, ensure context is clear. |
| Step 07 Invoice: "AI converts it into an editable QuoteCore+ invoice" | Workflow | **CONFIRMED ACCURATE** (Shaun 09:48). AI line-item import works in invoice creator. | Keep, ensure context is clear. |
| "without the admin grind" | Workflow heading | Good flavour. Keep. | No change. |
| "QuoteCore+ remembers how you work" | Smart Components | Good. Keep. | No change. |
| "Build it once. Quote it forever." | Smart Components | Good. Keep. | No change. |
| Testimonials: Tony (AV), Tom (Flooring), Adam (Fencing) | Testimonials section | None are roofing. Plan says keep for now but don't imply they're roofing proof. | Add label/context. Replace when roofing proof available. |
| FAQ: "Can I use it for roofing and construction?" | FAQ | Correct but should be roofing-led. | Reword to lead with roofing. |
| FAQ: "Plans range from free to $59 per month" | FAQ | Correct. | Keep. |
| Supplier link at bottom | Bottom | Good. Keep. | No change. |

### Features Hub (`app/(marketing)/features/page.tsx`)

| Claim/Statement | Location | Verdict | Action |
|---|---|---|---|
| "Turn an accepted quote into a material order in seconds" | Feature card | **Misleading.** Not instant/seconds. User creates from quote manually. | Fix wording. |
| "Customer pays" | Invoicing step | **FALSE.** QuoteCore+ does not process payments. | Fix: "Customer pays via your configured payment methods." |
| "Generate an invoice" | Invoicing step | **Misleading.** Implies auto-generation. User creates from quote. | Fix: "Create an invoice from the quote." |
| "Five connected tools" | Feature table | Missing: AI Scan Assist, sending/tracking/automation, catalogue import. | Expand to cover all features. |
| "From measurement to invoice in one workflow" | Workflow overview | Correct. | Keep. |
| "Who it's for" section | Bottom | Good. Roofing first, then other trades. | Keep, light tightening. |
| No "four ways to quote" content | Missing | Plan requires this. | Add in Phase 3. |
| No AI Scan Assist page link | Missing | Plan requires standalone page. | Add in Phase 3. |
| No sending/tracking/automation page link | Missing | Plan requires this. | Add in Phase 3. |

### Roofing Quoting Software Page (`app/(marketing)/roofing-quoting-software/page.tsx`)

| Claim/Statement | Location | Verdict | Action |
|---|---|---|---|
| "AI traces it" (SiteAssistant says this) | SiteAssistant | Too vague. AI identifies specific elements. | Update SiteAssistant. |
| Steps are correct but missing: sending, tracking, follow-ups, separate order/invoice creation | Steps section | Incomplete. | Expand in Phase 3. |
| "Under 3 minutes" implied | Not directly stated here | OK as long as caveated. | Ensure caveat exists. |
| FAQ: "Is QuoteCore+ only for roofers?" | FAQ | Correct. | Keep. |

### Navigation (BlogHeader.tsx)

| Item | Current | Plan target | Action |
|---|---|---|---|
| Features | /features | /features | Keep. |
| Roofing Software | /roofing-quoting-software | /roofing-quoting-software | Keep. |
| Construction Software | /construction-quoting-software | Move to footer or "Other trades" | Demote in Phase 1. |
| Pricing | /pricing | /pricing | Keep. |
| Free Tools | /free-tools | /free-tools | Keep. |
| Blog | /blog | /blog | Keep. |
| Contact us | /contact | /contact | Keep. |
| Missing: Suppliers | Not in nav | /suppliers | Add in Phase 1. |
| Missing: Tutorials | Not in nav | /tutorials | Add in Phase 1. |
| Missing: AI Scan Assist | No standalone page | New page | Create in Phase 3. |
| Missing: Sending/automation | No page | New page | Create in Phase 3. |

### SiteAssistant (`components/SiteAssistant.tsx`)

| Claim | Verdict | Action |
|---|---|---|
| "AI traces it" | Too vague. AI identifies specific roof elements. | Update. |
| "From complex plan to quote in under 3 minutes for less than a dollar" | OK if caveated (preconfigured components). | Add caveat. |
| "20 AI scan points included" | Correct for trial. | Keep. |
| Does not mention: sending, tracking, follow-ups, separate order/invoice creation, header templates, three order formats, external payments | Incomplete. | Add answers for these topics. |

---

## 3. Page Inventory

### Marketing pages (current)

| Route | Type | Primary search intent | Primary conversion goal | Status |
|---|---|---|---|---|
| / (homepage) | Server-rendered client component | "roofing quoting software" | Start free trial | Needs Phase 2 rework |
| /features | Server component | "roofing estimating software features" | Explore features > trial | Needs Phase 3 rework |
| /features/digital-roof-takeoff | Server component | "roof takeoff software" | Try takeoff > trial | Needs Phase 3 review |
| /features/smart-components | Server component | "reusable quoting components" | Try components > trial | Needs Phase 3 review |
| /features/material-ordering | Server component | "material ordering software" | Try ordering > trial | Needs Phase 3 review |
| /features/invoicing | Server component | "contractor invoicing software" | Try invoicing > trial | Needs Phase 3 review |
| /features/supplier-resources | Server component | "supplier pricing catalogs" | Supplier onboarding | Needs Phase 3 review |
| /roofing-quoting-software | Server component | "roofing quoting software" | Start free trial | Needs Phase 3 expansion |
| /construction-quoting-software | Server component | "construction quoting software" | Start free trial | Demote in Phase 1, keep for SEO |
| /pricing | Server component | "roofing software pricing" | Start free trial | Needs Phase 4 review |
| /free-trial | Server component | "roofing software free trial" | Sign up | Needs Phase 4 rework |
| /free-tools | Server component | "free roofing tools" | Tool engagement > trial | Needs Phase 5 review |
| /free-calculators | Server component | "free roofing calculators" | Calculator use > trial | Needs Phase 5 review |
| /suppliers | Server component | "roofing supplier catalogs" | Supplier onboarding | Needs Phase 5 review |
| /blog | Server component | "roofing blog" | Read > trial | Keep, monitor |
| /blog/[slug] | Server component (MDX) | Various informational | Read > trial | Keep |
| /about | Server component | "QuoteCore+ company" | Trust > trial | Needs Phase 5 review |
| /company | Server component | "QuoteCore+ company" | Trust > trial | Review duplicate with /about |
| /contact | Server component | "contact QuoteCore+" | Contact form | Keep |
| /customer-stories | Server component | "QuoteCore+ reviews" | Trial | Placeholder - parked |
| /trust | Server component | "QuoteCore+ security" | Trust | Keep |
| /services | Server component | "QuoteCore+ services" | Contact | Keep |
| /tutorials | Server component | "QuoteCore+ tutorials" | Learn > trial | Needs Phase 5 review |
| /coffee-terms | Server component | Misc | - | Keep |

### Missing pages (required by plan)

| Route | Priority | Phase |
|---|---|---|
| /features/ai-scan-assist | High | Phase 3 |
| /features/sending-and-tracking | High | Phase 3 |

### Screenshots and assets inventory

| Asset | Exists? | Where used | Plan requirement |
|---|---|---|---|
| Roof plan before AI | Need to verify | - | Required for AI page |
| AI result with review/correction | Need to verify | - | Required for AI page |
| Manual digital takeoff | Need to verify | - | Required for takeoff page |
| Smart Component editor with roofing rules | /how-it-works-smart-components-editor.png | Homepage, features | OK |
| Material quantity result | Need to verify | - | Required for features |
| Customer-ready roofing quote | /how-it-works/how-it-works-2-2.png, 2-3.png | Homepage | OK |
| Accepted/declined status and alert | /how-it-works/how-it-works-3.png | Homepage | OK |
| Material order from the job | /how-it-works-order-form.png, how-it-works-4.png | Homepage | OK |
| Invoice from the same job | /how-it-works/how-it-works-5-2.png | Homepage | OK |
| Follow-up automation/activity timeline | Need to verify | - | Required for sending/automation page |

---

## 4. Baseline Score (100-Point Rubric)

### Current site assessment

| Category | Weight | Score | Notes |
|---|---:|---:|---|
| Roofing positioning | 15 | 8/15 | H1 is roofing-first but rest of homepage is generic "trades". Eyebrow says "trades" not "roofing". Features page says "roofing and construction" equally. No roofing-specific proof. |
| Product/workflow comprehension | 15 | 7/15 | Workflow steps exist but: missing spouts in AI detection, "one click" order claim is false, missing sending/tracking/automation entirely, missing four quoting paths, missing catalogue accelerators. |
| Differentiation | 15 | 6/15 | Smart Components well explained. But: no four-path comparison, no "what it replaces" comparison on homepage, AI Scan Assist not given standalone treatment, no separation of manual vs AI takeoff. |
| Proof and trust | 15 | 5/15 | Three testimonials but none roofing. No case study. No verified metrics. Founder story not on homepage. Product screenshots exist but not annotated or contextualised. |
| Conversion journey | 10 | 6/10 | Trial CTA present in hero, mid-page, bottom. But no first-success path on trial page. No demo video on trial page. Free tools not routed to features. |
| Navigation/usability | 10 | 6/10 | Navigation works but: Construction Software equal weight to Roofing, no Suppliers link, no Tutorials link, no AI Scan Assist link. Mobile menu is a flat list. |
| SEO/content architecture | 10 | 7/10 | Schema, canonicals, sitemap, hreflang all present. But: missing AI Scan Assist page, missing sending/automation page, some claims inaccurate (could be flagged by AI search). |
| Performance/accessibility | 10 | 7/10 | Images use lazy loading. YouTube lite embed. But: homepage is a large client component, FAQ uses clip trick, no reduced-motion handling on animations. Need Lighthouse run. |
| **TOTAL** | **100** | **52/100** | |

### Key gaps to reach 90+

1. **Roofing positioning (+7):** Roofing-first eyebrow, roofing context throughout, roofing proof when available.
2. **Product/workflow comprehension (+8):** Four quoting paths, three engines explained, sending/tracking/automation, accurate order/invoice workflow.
3. **Differentiation (+9):** Comparison tables, AI standalone page, manual vs AI separation, "what it replaces" section.
4. **Proof (+10):** Roofing testimonials (parked), founder story, annotated screenshots, labelled samples.
5. **Conversion (+4):** First-success trial page, demo video, free-tool to feature routing.
6. **Navigation (+4):** Add Suppliers, Tutorials, AI Scan Assist. Demote Construction. Reorganise mobile menu.
7. **SEO (+3):** New pages, accurate claims, AI-search-ready answer passages.
8. **Performance/accessibility (+3):** Reduce client JS, fix FAQ semantics, add reduced-motion.

---

## 5. Confirmed AI Line-Item Import Feature (Shaun, 09:48)

AI line-item import is a real feature available in:
- **Free tools:** Quote generator, Order generator, Invoice generator
- **Inside the app:** Line-by-line quote editor/creator, Line-by-line order editor/creator, Invoice creator (all modes since invoice from quote just pre-populates lines)

**How it works:** User uploads a photo, PDF or file. AI extracts item name, description, quantity and price, creates line items in a professional format. User can fully edit after AI input.

**NOT available in:** Smart Components takeoff flow or non-line-by-line order formats (single-column/double-column).

**Homepage Step 5 and Step 7 claims are CONFIRMED ACCURATE.** No fix needed on those specific claims.

## 6. Lighthouse Baseline

Cannot run Lighthouse from this environment. Shaun should run PageSpeed Insights on quote-core.com for: /, /features, /roofing-quoting-software, /pricing, /free-trial. Store results for Phase 6 comparison.

---

## 6. Phase 0 Acceptance Criteria Check

| Criterion | Met? |
|---|---|
| One source-of-truth matrix | Yes - Section 1 above |
| No unanswered claim published | 2 items flagged for Shaun (AI order/invoice conversion claims) |
| Baseline stored | Yes - Section 4 score: 52/100 |
| No code changed | Yes - documentation only |

**Phase 0 is complete. Ready for Phase 1 (Messaging and Navigation) when Shaun confirms.**
