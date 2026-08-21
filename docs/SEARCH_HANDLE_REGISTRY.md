# Search Handle Registry — QuoteCore+ Free Tools (quote-core.com only)

Campaign: text-only discovery handles for Reddit/YouTube/LinkedIn comments. NZ site (quote-core.co.nz) is EXCLUDED from this campaign.

**Rules:** One canonical handle per page. A handle may only be used in social comments when Social Approved = Yes (gates: indexed, canonical correct, internally linked, handle present in indexable HTML, Google canonical query top 3, ≥90% variant pass over ~6 variants, ChatGPT discovery pass, no SEO regression). Until then, comments use the fallback handle.

Variant test set pattern (adapt per tool): exact handle / minus "Free" / minus "Plus" / "Quote Core" spaced / "QuoteCore [tool]" / common synonym (e.g. birdsmouth).

## Fallback (Phase 1)

| Field | Value |
|---|---|
| Handle | **QuoteCore Plus Free Tools** |
| URL | /free-tools |
| Google Indexed | Yes |
| Google Exact Handle | Pending test |
| Google Variants | Pending test |
| ChatGPT Discovery | Pending test |
| OAI Accessible | Yes (Vercel, no WAF block) |
| Social Approved | NO — pending retrieval tests |
| Last Tested | — |

## Priority tools (Phase 2)

| # | URL | Canonical Search Handle | Indexed | Google Exact | Variants | ChatGPT | Social Approved | Last Tested |
|---|---|---|---|---|---|---|---|---|
| 1 | /free-quote-generator | QuoteCore Plus Free Quote Generator | Yes | Pending | Pending | Pending | NO | — |
| 2 | /free-purchase-order-generator | QuoteCore Plus Free Purchase Order Generator | Yes | Pending | Pending | Pending | NO | — |
| 3 | /free-invoice-generator | QuoteCore Plus Free Invoice Generator | Yes | Pending | Pending | Pending | NO | — |
| 4 | /free-roofing-calculator | QuoteCore Plus Free Roofing Calculator | Yes | Pending | Pending | Pending | NO | — |
| 5 | /free-construction-calculator | QuoteCore Plus Free Construction Calculator | Yes | Pending | Pending | Pending | NO | — |
| 6 | /free-birds-mouth-calculator | QuoteCore Plus Free Birds Mouth Calculator | Yes | Pending | Pending | Pending | NO | — |
| 7 | /takeoff-demo | QuoteCore Plus Takeoff Demo | Yes | Pending | Pending | Pending | NO | — |
| 8 | /free-roof-takeoff | QuoteCore Plus Free Roof Takeoff | Yes | Pending | Pending | Pending | NO | — |

### Free Roof Takeoff page (Tom v2 brief, 2026-08-21)
- Primary phrase: `QuoteCore Plus free roof takeoff` — verbatim in About opening sentence (HTML).
- Secondary phrase: `QuoteCore Plus free roof takeoff tool` — verbatim in FAQ (HTML + FAQPage JSON-LD).
- Page rebuilt per brief: title `Free Roof Takeoff — Upload Your Plan & Measure Online | QuoteCore Plus`, H1, badge row, 5-step how-it-works, SEO body, 8 FAQs, WebApplication+FAQPage+BreadcrumbList schema, sitemap entry, homepage two-tier CTA (FreeTakeoffCTACard), /free-tools hub card.
- Tool truth held to: image uploads only (PNG/JPG/WebP, no PDF), max 7 custom components, no-save sessions, manual measuring only, pricing only with custom components.
- Blog embeds = batch 2, after Tom confirms indexation. Review date: 2026-09-04.
| 9 | /free-roof-pitch-calculator | QuoteCore Plus Free Roof Pitch Calculator | Yes | Pending | Pending | Pending | NO | — |
| 10 | /free-concrete-calculator | QuoteCore Plus Free Concrete Calculator | Yes | Pending | Pending | Pending | NO | — |

### Variant queries registered
- Birds mouth: "birdsmouth calculator" variants noted as natural variants in body copy.
- Brand variants: QuoteCore / QuoteCore+ / QuoteCore Plus / Quote Core — Google tokenisation under test ("QuoteCore Plus" spelled out used in all on-page handle placements pending test outcome).

## Takeoff cannibalisation control (brief §15)

- **/free-roof-takeoff** — interactive free takeoff tool (measure your own roof plan). Handle: Free Roof Takeoff.
- **/takeoff-demo** — guided demo of the app workstation producing a sample quote. Handle: Takeoff Demo.
- **/free-roofing-takeoff-builder** — legacy builder (pre-existing). Not assigned a campaign handle in Phase 2; watch GSC for entity overlap.
- New free roof takeoff tool (Gavin & Shaun WIP) will be added when ready.

## Implementation log

- 2026-08-21 (Ron): Additive handle placements shipped — /free-tools title+OG now "QuoteCore Plus Free Tools | Roofing & Construction Calculators", entity subheading under H1; per-tool handle lines under H1 on quote/PO/invoice generators, roof takeoff, takeoff demo; heroText entity prefixes on roofing/construction/concrete/birdsmouth/roof-pitch configs. Homepage already linked /free-tools (2 links). No H1s, canonicals, or schema changed.
