# QuoteCore+ Supplier Tool - Explainer & Handoff Brief

> Written 2026-08-30 by Gavin for handoff to any agent taking over the supplier tool workstream.
> Repo: `github.com/algora-dev/quotecore-plus` (workspace: `C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-plus`).
> Companion docs: `docs/SUPPLIER_TEMPLATE_SUMMARY.md`, `docs/SUPPLIER_DASHBOARD_PLAN.md`, `docs/GAVIN_SUPPLIER_MIGRATION.md`, `memory/2026-08-26.md`.

## 1. What the Supplier Tool Is (one paragraph)

The Supplier Tool is a white-label **supplier pricing and takeoff portal** that we (QuoteCore+) deploy per building-material supplier. A supplier gets their own branded mini-site where their customers upload or measure a roof plan, get quantities for standard roofing components (ridge, hip, valley, barge, spouting, downpipes, etc.), see prices **from the supplier's own catalogue**, and can request a formal quote or place an order request - all inside the supplier's brand instead of ours. The supplier captures leads, drives catalogue adoption, and we get a funnel into QuoteCore+ subscriptions. It is a template: ONE codebase, configured per supplier via flags/config - never forked.

## 2. The Pieces

| Piece | Where | What it does |
|---|---|---|
| Public tool | `app/(public)/supplier-pricing-tool/` | The customer-facing flow: upload/measure plan, assign products, see priced output, convert to quote, request supplier quote / order request |
| Takeoff station | `supplier-pricing-tool/TakeoffWorkstation.tsx` | In-tool digital takeoff (self-contained copy of the demo workstation, recoloured blue) - user uploads a plan, calibrates scale, measures lines/areas |
| Quote builder | `supplier-pricing-tool/quote/page.tsx` | Self-contained customer quote document builder (markup, margin, logo, tax, column strip) fed from the tool output |
| Demo admin | `supplier-pricing-tool/admin/page.tsx` | Per-supplier config: branding, discount, trade policy, per-product prices, feature flags, captured-leads table (currently localStorage; see Known Gaps) |
| Supplier directory (app side) | `app/(auth)/[workspaceSlug]/supplier-directory/`, `/suppliers/[slug]` public pages | Approved supplier profiles, catalogues, public catalogue pages (HTML/CSV/JSON, versioned) |
| Supplier dashboard (app side) | `app/(auth)/[workspaceSlug]/supplier/` | Where a logged-in supplier manages their profile, catalogue uploads, order requests, active-component allowance |
| DB | Supabase project `aaavvfttkesdzblttmby` | `supplier_profiles`, `catalogs` + `catalog_rows`, component collections, order/enquiry tables. Supplier tables isolated from core QC+ tables in the same DB (split later at volume) |

## 3. The Customer Flow (what it actually does)

1. **Landing**: branded header, "start measuring" or "I already have measurements".
2. **Measure**: either (a) upload a plan PDF/image into the in-tool takeoff station, calibrate scale, draw lines/areas (roof areas get a pitch), or (b) enter actual/site measurements directly. Guide mode = one component group per page with diagrams; Fast mode = everything stacked in accordions.
3. **Assign products**: each measurement group gets a product from the supplier catalogue. Per-entry roof-area attachment for linears; pitch conversion applied automatically (rafter factor for areas/barges, hip/valley factor for hips/valleys, none for ridges/spouting).
4. **Output**: named roof areas with pitch, pitched m2 sub-rows, waste folded into Purchase Qty, trade-vs-standard-vs-savings block.
5. **Actions**: convert to a customer quote (in-tool builder), request a formal quote from the supplier, send an order request, print/PDF.
6. **Persistence**: the whole flow survives refresh via sessionStorage (`qc-spt-flow-v1`); "Save to QuoteCore+" persists a server-side draft and routes to signup - the draft imports into the app on onboarding (same free-tools handoff machinery as our other tools).
7. **Lead capture**: delayed popup (Google one-click or email); login-gated trade pricing (blanket % off baseline, default 12%).

## 4. Why It's Useful (the pitch)

- **For suppliers**: their customers stop guessing quantities and calling - the tool does the takeoff maths with the supplier's own prices, driving stickiness and catalogue compliance. Leads land in the supplier's inbox/admin. No build cost to them; we deploy a configured copy.
- **For us (QuoteCore+)**: a lead-gen and signup funnel (free tool -> saved draft -> trial account), SEO surface (public supplier catalogue pages with structured data), and a demo asset we can re-skin to a prospect's real catalogue in ~10 minutes for pitch videos.

## 5. Who It Helps

Roofing/building material suppliers (starting with roofing: spouting, ridges, flashings etc.) who want an online quantity-and-price experience for their trade customers, without building software. Works for any trade with measurable quantities - config-driven components, no hard-coded units, currency, or country.

## 6. What It Can't Do (current limitations - be honest with prospects)

- **Admin is demo-grade**: per-supplier config lives in localStorage (`qc-spt-config-v1`, `qc-spt-leads`), not the DB. Production admin (QC-staff auth, DB-backed config/catalogue/leads) is the NEXT planned task - see Follow-Ups.
- No live stock/availability, no real-time pricing ERP integration, no payments - order requests are notifications, not transactions.
- Deep digital-takeoff automation (AI scans) is not wired into the supplier tool; the takeoff station is manual measurement only.
- One catalogue per supplier instance; multi-branch/multi-price-region not supported yet.
- The supplier-side "app dashboard" (profile, catalogue uploads) and the public white-label tool are two separate surfaces today; a supplier does not edit the white-label tool's config themselves.

## 7. Architecture Rules (LOCKED with Shaun - do not violate)

1. **Fully self-contained**: the tool never links out to our other free tools; code/logic is copied in. Measure-a-plan is an inline upload + in-tool station.
2. **Template, not fork**: this codebase is the master full-feature template. Supplier copies are config/flag-driven (`features{login, adminPanel, convertToQuote, quoteCoreConnect, emailCapture}` - each independent, off breaks nothing).
3. **One repo, one DB** for now; supplier tables isolated; split later at volume.
4. **Admin model**: us-first -> handover to supplier email -> our permanent override fallback.
5. **Scale target**: thousands of customer emails, 3-4 pricing tiers per supplier.
6. Blue colour scheme inside the tool (`#2563EB`/`#1D4ED8`, `spt-scope` focus ring) - deliberate, do not "fix" to orange.
7. Component-to-group mapping is NAME-based (semantic field was empty on placeholder rows - a past silent-drop bug).

## 8. Follow-Ups (the next agent's queue)

1. **Real server-backed admin panel** (priority 1): app-domain route, QC-staff admin auth, config + catalogue + leads in Supabase instead of localStorage.
2. Replace placeholder downpipe prices ($38.50/$9.20 ea) with the supplier's real ones when Shaun sends them.
3. Wire a real supplier pilot end-to-end (demo play: swap catalogue/branding to a target supplier for pitch videos).
4. Verify station component values are pitch-adjusted vs plan values (debug logging `[supplier-tool]` was left at the takeoff finish boundary - remove once verified).
5. Banner image warping fix + the 28 deferred test cases from the template brief.

## 9. Gotchas Learned the Hard Way

- PowerShell `-replace` on .tsx corrupts UTF-8 - use proper edit tools for files with unicode.
- Folders that exist only on `development` vanish when switching to `main` - keep a standalone copy.
- Free-tools drafts: `auth.admin.createUser` never sends emails - must fire `supabase.auth.resend({type:'signup'})`.
- Em dashes: never use in UI text (Shaun hard rule).

## 10. Key File Paths

- Tool root: `app/(public)/supplier-pricing-tool/`
- Workstation: `app/(public)/supplier-pricing-tool/TakeoffWorkstation.tsx`
- Output actions (continue-in-app, convert, enquiry): `app/(public)/supplier-pricing-tool/OutputActions.tsx`
- Quote builder: `app/(public)/supplier-pricing-tool/quote/page.tsx`
- Demo admin: `app/(public)/supplier-pricing-tool/admin/page.tsx`
- Draft save/handoff: `app/(public)/shared/SaveToAppButton.tsx`, `app/(auth)/[workspaceSlug]/DocDraftRestorer.tsx`
- Supplier profile/catalogue public pages: `app/(public)/suppliers/[slug]/` (HTML/CSV/JSON, versioned)
- Supplier app dashboard: `app/(auth)/[workspaceSlug]/supplier/SupplierDashboard.tsx`
