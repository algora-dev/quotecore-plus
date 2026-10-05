# T3 Labs Supplier Pricing Tool - Sync Prompt (2026-09-08)

Hand this to Ron. Master template = quotecore-plus repo, `app/(public)/supplier-pricing-tool/` + `app/(public)/_components/FreeToolsAuthProvider.tsx`. The T3 Labs port must be updated to match the master exactly.

## What changed today (sync these)

1. **ParentMeasureStep rework (bucket rows).** The cladding/flooring measure step is now row-based:
   - Buckets expand into a pre-seeded row list (Wall areas + flashings for cladding; Floor areas + trims for flooring). No "Measured by" dropdown, no component naming in the main path.
   - Row entry form STAYS OPEN on Add (fields clear, user rapid-fires entries); "Done" closes it.
   - Filled rows: solid border + white bg + shadow + green check. Empty rows: dashed, dimmed, "Nothing measured - leave empty if not needed".
   - Header copy is conditional on entry path (manual = "Add your buckets & wall areas"; plan takeoff = "Here's what you measured from your plans...").
   - "+ Add something not listed" escape hatch per bucket.
   - Canvas/takeoff-created components that match a row name+basis merge into that row; unmatched ones render as their own cards.
2. **Config fields** (copy the shapes exactly):
   - `bucketExamples: readonly string[]` - supplier-specific bucket name examples shown in the copy (Roofline cladding: Weatherboard, Corrugate, Roofdeck).
   - `bucketRows: BucketRow[]` (`{ name: string; basis: 'area' | 'lineal' | 'point' }`) - per-supplier row override; trade defaults live in `tradeConfig.ts`.
   - `bucketExamples` + `bucketRows` are optional on the supplier def and fall back to trade defaults.
3. **Roofline cladding def**: added Corrugate (Wall) 0.40g + Roofdeck (Wall) 0.40g wall coverings (same material price as the roofing versions, higher wall labour), plus its own `bucketRows` using its real product names. No penetration rows/products.
4. **Supplier-themed login modal.** `FreeToolsAuthProvider` now accepts `authTheme?: { accent, accentHover }`. Supplier routes pass their def theme so the "Log in for trade pricing" modal matches the supplier brand. QuoteCore+ free tools pass nothing and keep QC+ orange. Implement the same way if the T3 port has its own auth modal.

## CRITICAL: hover states must match EXACTLY

The T3 Labs versions currently have DIFFERENT on-hover effects on buttons/cards vs the master. Do not restyle or improvise. Copy the class strings verbatim from the master files, including:
- Primary buttons: `rounded-full bg-black ... hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)]` (theme-remapped by ThemeStyle to the supplier palette)
- List rows/cards: `hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)]`
- Secondary buttons: `rounded-full border border-slate-300 ... hover:border-slate-400`
- The scoped `.spt-scope` ThemeStyle remap in `ToolShell.tsx` drives all of this from `config.theme` - if the class remap CSS matches, the hovers match.
- Row cards in ParentMeasureStep: exact classes as shipped (solid/dashed filled/empty states above).

## Rules
- Master template is the source of truth. When in doubt, diff against quotecore-plus main.
- No em dashes in any UI text, comments, or commit messages (use short dashes).
- Do not add new GitHub Actions workflows.
- Commit author: dev.algora <dev.algora@gmail.com> - other author emails are silently blocked by Vercel (no build, no error).
