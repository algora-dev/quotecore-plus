# Phase 2 — Core Commercial Repositioning

## Purpose

Phase 1A corrected a small set of stale offer claims. Phase 2 is the first substantive marketing implementation pass.

Do not turn the site into an “AI software” site. QuoteCore+ is still best described as easy-to-use measurement, pricing and quoting software for roofing and construction. Mobile and Smart Assistant make that workflow easier and available from more places.

## The new hierarchy

### Level 1 — what QuoteCore+ does

**Measure -> Price -> Quote**

The important product relationship is that measurements can feed saved pricing logic and become customer quotes without rebuilding the same job in multiple tools.

### Level 2 — where users can work

**Phone, tablet or desktop.**

The full measurement-to-quote direction is no longer desktop-centric. Relevant pages should clearly state that contractors can work from site or office.

Do not describe mobile as a companion, reduced or “mobile-friendly” version where the product truth supports full mobile workflow. Prefer language such as:

- work from site or office
- measure, price and quote from phone, tablet or desktop
- digital takeoff on mobile and desktop
- use the app directly when you want full manual control

### Level 3 — how users can interact

There are three high-level paths to a result:

1. **Measure it in QuoteCore+.** Use digital takeoff from plans/images on phone, tablet or desktop, with AI Scan Assist where relevant.
2. **Enter measurements you already have.** Site measurements, third-party reports, aerial/satellite measurements or dimensions from another source can feed the same saved pricing logic.
3. **Ask Smart Assistant.** Use text or voice to find account information and perform supported tasks without manually navigating every screen.

This is a mental model, not mandatory identical copy on every page.

## Safe shared wording

A reusable section may use a variation of:

### Three ways to get from measurements to a quote

**Measure in QuoteCore+**  
Measure from plans or images with digital takeoff on phone, tablet or desktop. Use AI Scan Assist where it helps, then review the result before pricing.

**Enter measurements**  
Already measured on site or have a report? Enter the dimensions and let Smart Components apply your saved materials, labour/labor, waste and pricing rules.

**Ask Smart Assistant**  
Use text or voice to find information and carry out supported tasks in your account. Smart Assistant works with the data and permissions you give it, while you stay in control of important changes.

Do not force this verbatim onto every page. Adapt it to page intent.

## Smart Assistant messaging rules

### Lead with the workflow benefit

Good:

- Ask QuoteCore+ instead of navigating through multiple screens.
- Find a job, quote or invoice conversationally.
- Use text or voice when that is faster than operating the interface manually.
- Let Smart Assistant work with the measurements, components, pricing and records already in your account.
- Review/confirm important changes where the product requires confirmation.

Avoid:

- “AI does everything for you”
- “fully autonomous”
- “replaces estimators”
- “unlimited access to everything”
- “one click”
- “instant” as a blanket performance guarantee
- calling QuoteCore+ primarily an AI platform

### Permissions and trust

Where Assistant capability is explained in depth, reinforce that its usefulness comes with user control. Product truth supports propose-then-confirm actions. Never imply destructive or consequential actions occur unpredictably.

If a specific Assistant action is not clearly supported by current product code/context, either verify it by inspecting protected code read-only or omit the claim. Do not invent capabilities.

## Mobile messaging rules

Relevant pages should stop being desktop-centric.

Strong messages:

- measure roofs/plans from a phone or tablet on site
- enter site measurements directly into the same workflow
- review pricing and quotes away from the office
- use Smart Assistant by text or voice when screen-by-screen interaction would be slower

Do not claim every public free tool is mobile-optimised. Free-tool mobile recoding is a separate project.

## Search/SEO rules

1. Preserve every existing canonical URL.
2. Preserve the primary search intent of each page. A Roofing Estimating page must still primarily be about roofing estimating, not Smart Assistant.
3. Keep core keyword language in title/H1/intro where it already aligns with intent.
4. Add mobile/Assistant language naturally in descriptions, sections, FAQs and supporting headings where it strengthens the answer.
5. Do not create country-specific pages in this phase.
6. Do not keyword-stuff UK/NZ/AU and US variants into a single sentence. Use natural global terminology.
7. Update embedded FAQs/schema when visible factual copy changes so structured data does not contradict the page.
8. Do not create new Assistant or App Demo URLs in Phase 2.

## CTA architecture for Phase 2

The future App Demo is not live. Therefore:

- do NOT add “Try the App Demo” yet
- do NOT relabel the Roofing Takeoff Demo as the App Demo
- the existing `/takeoff-demo` may remain as the Roofing Takeoff Demo
- free tools may remain useful secondary CTAs where directly relevant
- paid-app CTAs must not claim a free trial

`/free-trial` is a stale legacy slug whose page has already been partially reworked into a paid-offer/get-started experience. Its final redirect/rename remains an owner/integration decision. Do not silently change routing in this phase unless explicitly approved.

## Design direction

Use the existing marketing design language. Do not import the product app design system wholesale.

Aim for:

- simple hierarchy
- generous spacing
- quiet neutral surfaces
- orange as an accent/primary action, not decorative saturation
- readable mobile layouts
- progressive disclosure rather than feature dumping
- actual workflow examples rather than generic SaaS claims

## Shared implementation opportunity

It is acceptable to create one or two reusable marketing-only components if they reduce duplication, for example:

- a configurable “three ways to work” section
- a configurable mobile + Assistant workflow callout

If shared components are introduced, they must accept page-specific copy/links rather than forcing duplicate SEO prose across many pages.

Do not change a shared component if that would unintentionally alter the frozen homepage. Check every import before editing shared marketing components.
