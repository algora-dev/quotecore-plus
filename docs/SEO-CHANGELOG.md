# SEO Change Log — quote-core.com

Lightweight change-control record so GSC movement can be compared against change dates.
GSC baseline data: export reviewed 30 Aug 2026 (35-day comparison window).

| Date | URL | Change | Reason | GSC baseline | Expected outcome | Review date |
|---|---|---|---|---|---|---|
| 2026-08-30 | /blog/how-to-follow-up-on-a-quote | Title → "How to Follow Up on a Quote: Timing + Message Examples"; meta description rewritten to lead with timing + examples; lastModified bumped | 254 impr, 0 clicks, pos 19.48 — searcher wants practical answers (when/what to say/examples), content already supports this | 254 impr / 0 clicks / 19.48 | CTR >1% within 4–6 weeks | 2026-10-11 |
| 2026-08-30 | /blog/how-to-measure-a-roof (content) | Added contextual link to /free-roof-square-metre-calculator in related-tools list (metric counterpart next to imperial calculator) | Square metre calc had only 1 inbound file link; 42 impr, pos 14.88 | calc: 42 impr / 0 clicks / 14.88 | Modest authority/ crawl support | 2026-10-11 |
| 2026-08-30 | /blog/best-roofing-quoting-software-uk-2026 (content) | Added contextual link to /blog/how-to-start-a-roofing-business-uk (UK roofing cluster) | Target had only 1 inbound file link; 27 impr, pos 7.11 | target: 27 impr / 0 clicks / 7.11 | Hold/improve pos 7 | 2026-10-11 |
| 2026-08-30 | /blog/best-quoting-software-us (content) | Added cross-link to /blog/best-quoting-software-nz | NZ comparison had only 1 inbound file link (AU page); 862 impr, 0.12% CTR, pos 18.85 | 862 impr / 1 click / 18.85 | Reinforce NZ ownership | 2026-10-11 |

## Audited — no change made

| URL | Finding | Why left unchanged |
|---|---|---|
| /blog/best-quoting-software-nz | Title/H1 already "Best Quoting Software NZ (2026): 6 Tools Compared"; opening quick-answer is NZ-specific; UK cross-link section at bottom | Brief assumed an outdated "NZ & UK" H1 — already fixed before this pass (lastModified 2026-08-28). Nothing to change. |
| /construction-quoting-software | Title "Construction Quoting Software for Contractors \| Free Trial", H1 "Quoting software for contractors who work from measurements." — already the brief's recommended form | Metadata/H1 already optimal per brief. 16 files already link into it with varied anchors. No second generic page created. |
| /blog/best-roofing-quoting-software-uk-2026 vs /blog/roofing-quoting-software-uk | UK overlap audit: first = comparison/list intent ("Best Roofing Quoting Software UK (2026)", 343 impr, 6 clicks, pos 21.63); second = workflow article "How UK Roofing Contractors Are Getting Quotes Out Faster" (24 impr, pos 6.17) | Distinct intents (comparison vs workflow/process). No merge, no redirect. UK-2026 already links to the workflow article. |
| /blog/how-to-price-a-roofing-job | 23 inbound file links | Already well-linked; preserved |
| /features/material-ordering | 13 inbound file links | Already well-linked; preserved |
| Homepage, /blog/how-to-do-a-roof-takeoff, /blog/quotecore-plus-reviews, /blog/can-chatgpt-create-a-quote, /free-trench-calculator | Performing (pos 4.5–9.3) | Protected — no rewrites |

## Technical hygiene (checked 2026-08-30)

- `http://quote-core.com/*`, `http://www.quote-core.com/*`, `https://www.quote-core.com/*` → all single-hop 308 to `https://quote-core.com/*`. No chains. ✅
- Canonical host = https non-www sitewide (dynamic canonicals via app/lib/seo.ts). ✅
- Dynamic sitemap (app/sitemap.ts) generates from page registries — no hardcoded stale URLs. ✅

## Pending / blocked

- **7 × Crawled–currently not indexed**: GSC API does not expose Coverage examples. Needs manual export from GSC UI (Indexing → Pages → Crawled – currently not indexed → examples). Owner: Shaun.
- 46 × Discovered–currently not indexed: per brief, conservative wait — no blanket intervention.
