# Pricing Activation return / integration instructions

Status: implemented source candidate. Not deployed; full app acceptance is Gavin's gate.
Baseline archive: `quotecore-plus-phase10-runtime-acceptance-return-2026-09-28.zip`
Baseline SHA-256: `abe445278468e356e508b5cd12ac893093b9efeb2e559960a56d528d2d4bedf7`
Baseline ledger reports commit `b5db9ab3`. Verify against your actual branch; the archive bytes, not a remembered commit, are this return's baseline.

## Start in an isolated clone

Follow `docs/ux/AGENT_RETURN_INTEGRATION_PLAYBOOK.md`. One agent per checkout. Do not replace the repository wholesale. Apply only `docs/ux/experience-1-pricing-activation/FILE_CHANGES.json` paths after checking raw and LF-normalized baseline/current/return hashes. Classify CLEAN / ALREADY / THREEWAY / ADD_NEW. Newer Gavin/Smart Assistant fixes always survive the merge.

The root `RETURN_NOTES.md` and `CHANGED_FILES.json` concern preceding Smart Assistant returns. The old `START_HERE_RETURN.md` also references a historical `FILE_CHANGES.json` that is not present in the supplied integrated baseline. These are not the pricing brief. They are intentionally retained byte-for-byte. **They are NOT the manifest for this work.** Start with `START_HERE_PRICING_ACTIVATION_RETURN.md` and this folder. The manifest lists itself as an added metadata path without a recursive self-hash. Every other listed after-hash must match.

## Production scope

7 modified production files; 5 new production files. No package/config/dependency or protected server changes.

- `app/(auth)/[workspaceSlug]/components/component-list.tsx`
- `app/(auth)/[workspaceSlug]/components/components/AddFromCatalogModal.tsx`
- `app/(auth)/[workspaceSlug]/components/page.tsx`
- `app/(auth)/[workspaceSlug]/page.tsx`
- `app/(auth)/[workspaceSlug]/tutorials/WelcomeModal.tsx`
- `app/components/workspace/HomeDashboard.tsx`
- `app/components/workspace/qc-home.css`
- `app/components/pricing/ComponentTestPanel.tsx`
- `app/components/pricing/PricingIntroduction.tsx`
- `app/components/pricing/SmartComponentEditor.tsx`
- `app/components/pricing/componentTest.ts`
- `app/components/pricing/pricing-activation.css`

## Merge attention

1. `component-list.tsx` contains the integration with existing library CRUD. Compare the two existing `input` and two `inputWithGenericTrades` initializers: AST comparison confirms their expressions are unchanged. Keep entitlement/active allowance, SKU, image, calculator-restore, warning, publication and library operations. Do not replace them with fixture mocks.
2. `SmartComponentEditor` owns draft text only; parent owns established save state and generic-trade payload. `componentTest.ts` is a read-only adapter around the existing engine, not a replacement pricing engine. Do not move it into server actions or save a test as a quote.
3. `?learn=1` is an explicit help link. `?reviewImport=1` clears the *current visit's* library filter after explicit importer close, without changing the remembered default library. This is not automatic navigation during component testing.
4. Legacy `per_pack_coverage` remains editable for compatible existing area records. The prior presentation could reset it because it is intentionally absent from the new-component dropdown. Only that local option-preservation condition changed; engine and stores did not.
5. Inline welcome/intro reuse existing personal dismissal actions. Do not reinterpret their existing progress keys as verified pricing. Welcome no longer blocks the user behind another modal/tour. Starter and shared-company data are not classified by fabricated flags.
6. Original CRLF line endings are preserved where present. Normalize LF for three-way comparison anyway. Reference fixtures are not application entry points.

## Required acceptance before fold/deployment

Run the actual project TypeScript and Next build, and changed-file lint **net-zero against this exact baseline**. The baseline runtime ledger reports existing type diagnostics (80), not a clean-zero TypeScript project. Do not suppress or rewrite protected code to chase an unrelated count. Record new diagnostics separately and resolve any introduced by this return.

Use `RUNTIME_CHECKLIST.md` with an approved disposable fixture company. Run a real 120 m² / 10% / 50 m² / pack 200 / labour 4 component through Test component AND a manual quote entry; the component-level result must agree before quote margins/tax. Also test pitch, fixed/segment waste, imperial input, existing coverage packs, zero labour, failed save, at-cap and subscription-off states. Test actual mobile browser behaviour, not just a resized page.

No env files, tokens, accounts or database migrations are supplied. The full UX standard v2.11 is a separate reference package; it is not deployed. Do not copy its old source snapshots over a newer code branch.

## Return report

Record applied/hand-merged paths, type/build/lint deltas, accepted scenarios, outstanding device/engine/provider cases, and owner review. Preserve the Phase10 residuals ledger: this return does not claim to resolve its Drawings, supplier-published-library or malformed catalogue-export follow-ups.
