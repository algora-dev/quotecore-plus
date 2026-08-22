# Free Margin Calculator — Implementation Brief

> Version 1.0 — 2026-08-22. Written for external review. Status: PLANNED, not yet built.

## 1. Purpose

QuoteCore+ has 50+ free tools and calculators but no margin calculator. This is both:

1. A genuinely useful tool (margin vs markup is a common trap for trades).
2. An SEO/education play — the page targets people searching "what margin should a builder charge", "margin vs markup", "safe margin for roofing" etc., not just calculator keywords.

The calculator must be dead simple at entry level, but scale up to line-by-line margin control identical in behaviour to the customer quote editor inside the main app.

## 2. Placement

- Route: `app/(public)/free-margin-calculator/page.tsx` (repo root: `C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-plus`)
- Follows the established `free-*` SEO page naming convention (50+ existing pages).
- Must be added to: free tools hub page listing, sitemap, and internal links from related tools.

## 3. Reference code (read before building)

| What | File |
|---|---|
| Page structure, SEO FAQ pattern, session persistence, currency/geo pattern | `app/(public)/free-quote-generator/page.tsx` |
| Cross-tool prefill (lines via URL params) | `app/(public)/shared/convertLines.ts` (`buildConvertUrl` / `parseConvertLines`) |
| Per-line margin + labor margin override UX (the model to replicate) | `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/LineEditForm.tsx` |
| Post-generation popup / cross-sell | `app/(public)/shared/PostGenerationModal.tsx` |
| Auth wrapper + signup banner | `app/(public)/_components/FreeToolsAuthProvider.tsx`, `FreeToolsSignupBanner.tsx` |
| Footer | `app/components/PublicFooter.tsx` |

## 4. Calculator UX — three modes (tabs)

Tab bar in filter-tab style: `rounded-full border text-xs`, active = `bg-slate-900`.

### Mode 1: Quick (default)

- Two inputs: **Total cost**, **Margin %**.
- Live output: sell price, profit amount, and a visual cost/profit split.
- **Margin vs Markup toggle** — a prominent explainer that 20% margin on £100 = £125 sell, while 20% markup = £120. Include a small conversion table (margin ↔ markup) inline.
- Nothing else. Zero friction.

### Mode 2: Line-by-line (mirrors customer quote editor)

- Global **default margin %** field at top (like the quote Review-step default).
- "+ Add line" rows. Each line:
  - Description
  - Cost type: Material / Labour / Sundry / Other
  - Cost entry:
    - Material/Sundry/Other: flat cost
    - Labour: **flat rate OR hourly rate × hours** (auto-multiplies)
  - Own **Margin %** per line — blank = inherit global default (same null-means-inherit pattern as `LineEditForm.tsx`)
- Live totals panel: total cost, total profit, total sell price, effective blended margin %.
- Labour lines also support a separate labour margin value, matching the app's dual material/labour margin model.
- SessionStorage persistence (same pattern as quote generator).

### Mode 3: Prefilled from Quote Generator

- Same UI as Mode 2 but pre-populated via URL: `parseConvertLines()` reads the `lines` param.
- Integration on the quote generator side:
  - "Check your margin" button in the post-generation action row + link inside `PostGenerationModal`
  - Uses existing `buildConvertUrl({ targetPath: '/free-margin-calculator', lines, ref: 'free-quote-generator' })`
- Quote lines arrive as **sell prices** (rate), so the tool reverse-engineers margin per line if user supplies cost, OR user enters costs and sees what margin their quoted price actually gives them. Each line's margin stays individually adjustable (+/-).
- After adjusting: **"Send prices back to quote"** button that round-trips the adjusted sell prices into the quote generator via the same lines param.
- Reverse prompt: quote generator shows "Have you added margin?" nudge when lines have rate ≈ 0 or no margin applied.

## 5. Content section (the SEO engine)

Below the calculator, matching the `<details>` FAQ accordion pattern of the free quote generator:

- **Margin vs markup** — full explainer + conversion table.
- **Safe margin ranges by trade** — roofing, general construction, landscaping, concrete benchmarks (well-researched, cite sources in content).
- **Do's and don'ts of margin** — e.g. don't apply margin to subtotal and forget tax/overheads; do build overhead recovery into labour rate; don't discount margin to win jobs without knowing break-even.
- **When to raise/lower margin** — job complexity, risk, material volatility, competition.
- **Common mistakes** — margin-on-subtotal vs total, forgetting overheads, quoting cost+markup and calling it margin, undercutting break-even.
- FAQ blocks targeting long-tail queries ("what margin should a roofer make UK", "difference between margin and markup", etc.).
- Cross-links to: free quote generator, roofing calculator, takeoff builder, signup CTA.

## 6. Style & compliance

- Design system: `rounded-xl border bg-white` cards, `rounded-full` buttons (primary `bg-black` + orange hover glow, accent `#FF6B35` bg), inputs `rounded-lg focus:border-orange-500 focus:outline-none`, Heroicons outline 24px, `backdrop-blur-sm bg-black/40` if any modal.
- Text contrast: `#BD4A1A` (not `#FF6B35`) for text/labels on white.
- NO em dashes anywhere in UI text, comments, or commit messages.
- Geo currency default via `/api/geo` (same COUNTRY_CURRENCY map), NZ domain → NZD/GST.
- `FreeToolsAuthProvider` + `FreeToolsSignupBanner` + `PublicFooter`.
- Pure client-side: no AI calls, no doc-limit API — no daily limits apply.
- Metadata: unique title/description, OpenGraph, canonical; add page to sitemap.

## 7. Build order

1. `free-margin-calculator/page.tsx` with 3 modes + shared state
2. SEO content section
3. Quote generator integration (button + PostGenerationModal link + reverse round-trip)
4. Hub listing + sitemap + smoke-test checklist entry

## 8. Out of scope (v1)

- No save-to-app / account persistence
- No PDF export (calculator, not a document)
- No AI features
