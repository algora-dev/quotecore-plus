> **Historical v1/v2 handoff.** For the current fully priced v3 starter-library delivery, read `PRICING_SETUP_V3_AGENT_HANDOFF.md` first. The previous 45-item/unpriced descriptions are superseded.

# QuoteCore+ Pricing Setup Assistant — starter-library revision, implementation and integration handoff

**Date:** 14 November 2026  
**Source:** owner-supplied `quotecore-plus-handoff-2026-11-14.zip`, `development` baseline `15f458c9`  
**Delivery:** **CONSOLIDATED PATCH v2** contains **both** the original Pricing Setup implementation and this revision. **Do not apply the older Pricing Setup patch first** when using this consolidated patch.  
**Status:** implementation authored and static/offline checks performed; **NOT integrated, built, migrated, browser-tested or deployed**. The integrating repository agent owns these gates.

## 1. Scope delivered

The feature is a new front door and assisted import path for the existing `My Pricing Library`. Existing `/[workspaceSlug]/components`, its working editor and the calculation engine are preserved. Navigation is feature-gated by `NEXT_PUBLIC_PRICING_SETUP_ENABLED` (OFF unless explicitly set to `true`). The new four-card page uses the v2 design system (`docs/DESIGN_SYSTEM.md`, `docs/ux/phase-9`): dark contrasting cards for self-service and paid-service routes, orange accent, keyboard focus and narrow-screen stacking. It offers:

1. **Manual setup** → existing component editor.
2. **Pricing Setup Assistant** → own pricing **or** ready-made roofing libraries.
3. **US$99 Quick Start** → a new public marketing page `/quick-start-pricing`, connecting into the existing authenticated $99 intake / checkout path.
4. **Full Done For You** → the existing `/done-for-you-setup` marketing page.

The assistant accepts CSV/XLSX/TXT/PDF/photographs, typed text and browser-recorded voice. The pricing context question is **optional**, **multi-select**, allowing `purchase`, `selling`, `labour` or exclusive `mixed`; omitted means `unknown`. A user can extract up to 100 rows, select up to 25 for review, inspect them and their original excerpts, test them via the existing calculation adapter, edit and approve them one by one, and bulk-save only valid confirmed rows.

The five ready-made systems are **Asphalt Shingle**, **Long-Run / Corrugated Metal**, **Concrete Tile**, **Natural Slate**, and **Low-Slope Membrane**. There are **45 seeded component definitions** (9 per roof). The user can select 1–5 systems together, inspect their components *before* creating drafts, and then review/save chosen items. The save action creates **separate named customer libraries per selected roofing system**; it does not mix all roofs in one collection. The existing server-side component entitlement checks are still authoritative.

**Deliberate limitation:** the templates **do not provide fictitious material prices, labour prices or waste**. Those fields remain unknown until the user enters/verifies them and intentionally confirms the waste rule. This means choosing a template does **not** instantly create a live, quoteable library with fake prices. It creates a resumable **private draft session**, with an on-screen preview before and during review. Once approved, items appear in ordinary editable Smart Component libraries. This avoids putting misleading zero/fictional rates into real quotes. Region-specific research-backed example price tables are scaffolded but **not populated or enabled**.

## 2. Architecture and files worth reading

| Area | Integration point |
|---|---|
| Navigation | `app/components/workspace/shell-config.ts`; new `/[workspaceSlug]/pricing`, `/pricing/setup` |
| New dark cards | `app/(auth)/[workspaceSlug]/pricing/setup/PricingSetupEntry.tsx`, `app/(auth)/[workspaceSlug]/pricing/setup.css` |
| Two-path assistant, checkbox context, selection/review | `app/(auth)/[workspaceSlug]/pricing/assistant/PricingAssistantClient.tsx`, `assistant.css`, `page.tsx` |
| Template creation, grouped save | `app/(auth)/[workspaceSlug]/pricing/assistant/actions.ts` |
| Server-managed template reads, staging, capacity check | `app/lib/pricing-setup/starter-libraries.server.ts` |
| JSON template reference (audit/testing, SQL is DB source of truth after migration) | `app/lib/pricing-setup/starter-catalog.json` |
| Draft schema/provenance and source staging | `app/lib/pricing-setup/domain.ts`, `storage.server.ts`, `roofing-rules.ts` |
| Multi-select intake | `app/api/pricing-setup/import/route.ts`, `app/lib/pricing-setup/extract.server.ts` |
| Manual UI discoverability | `app/(auth)/[workspaceSlug]/components/component-list.tsx` |
| Public Quick Start marketing page | `app/(marketing)/quick-start-pricing/page.tsx`, `page.module.css` |
| Offline integrity check | `scripts/check-pricing-starters.mjs` |
| Original pricing setup migration, **first** | `backend/supabase/migrations/20261114160000_pricing_setup_assistant.sql` |
| New editable template migration, **second** | `backend/supabase/migrations/20261114180000_pricing_starter_libraries.sql` |
| Original broader contract/handoff | `PRICING_SETUP_INTEGRATION_HANDOFF.md` (read alongside this revision) |

There is a separate clickable preview outside the repository patch: `QuoteCore_Pricing_Setup_Assistant_Starter_Libraries_Preview_v2.html`. It contains mock data, does not execute the real backend and is not deployed.

## 3. Database migration order — mandatory

This repository has **two historical migration roots** (`backend/supabase/migrations/` and `supabase/migrations/`) and unknown live migration-ledger history. **Do not run every migration in either directory.** Follow `AGENTS.md` and the database inventory; inspect staging/prod schema state. Apply only the two **new additive** migrations, in order, through the owner's approved migration workflow:

1. `20261114160000_pricing_setup_assistant.sql` — source of pricing setup session, draft, preference and Quick Start order schemas, quota RPC, private storage bucket, and `component_library.pricing_setup_draft_id` unique idempotency anchor.
2. `20261114180000_pricing_starter_libraries.sql` — new global editable `pricing_starter_libraries` and `pricing_starter_items` with 5 seeded templates and 45 items; unpublished region-specific illustrative price set/value tables for later; `pricing_setup_starter_destinations` mapping for idempotent customer-library destinations; `context_types` column in `pricing_setup_sessions`.

The template seed uses `ON CONFLICT DO NOTHING`: subsequent deployments **do not overwrite operator edits** made in Supabase Table Editor. Template reads require `published=true`, and only global master definitions are read. RLS is enabled. Users cannot modify these global templates through the public assistant; service-role writes are scoped by the authenticated user's company and identity.

**After applying:** verify counts (5 libraries, 45 items); check RLS including other-tenant denial; verify the idempotency unique index and destination mappings; refresh PostgREST schema cache if needed. Do not regenerate `app/lib/supabase/database.types.ts` without preserving its intentional UTF-16LE encoding per `AGENTS.md`.

Example read-only verification:

```sql
SELECT slug, name, published FROM public.pricing_starter_libraries ORDER BY sort_order;
SELECT library_slug, count(*) FROM public.pricing_starter_items GROUP BY library_slug ORDER BY library_slug;
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='pricing_setup_sessions' AND column_name='context_types';
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='component_library' AND indexname LIKE 'component_library_pricing_setup%';
```

**One subtle point:** `pricing_starter_price_sets` and `pricing_starter_price_values` are editorial tables for future researched local example costs. **No price examples are active or seeded in v2**, and no admin UI for price-set publishing is included; edit the master catalogue through Supabase's Table Editor after reviewing correct schema and permissions. The JSON file is a code audit reference and is not automatically synchronized back from the live database.

## 4. Configuration and external services

- `NEXT_PUBLIC_PRICING_SETUP_ENABLED=true` in **staging only** after migration. It is a **build-time** Next.js public variable; changing it requires rebuild/redeploy. Default/OFF: original pricing library path stays accessible, and new setup APIs are unavailable.
- Existing server-side `OPENAI_API_KEY`; optional `PRICING_SETUP_OPENAI_MODEL` / `PRICING_SETUP_EXPLAIN_MODEL` as in original handoff. Model must support the existing structured multimodal extraction contract.
- Existing private Supabase service role environment and storage; don't create a second Supabase project.
- Stripe **test mode** secret/webhook and configured trusted app URL (`PRICING_SETUP_APP_BASE_URL`) for Quick Start. Live webhook must sign-verify and match the intended item metadata before marking orders paid. Public marketing URL should be verified as `https://quote-core.com/quick-start-pricing`. Its return-to-app host defaults to `https://app.quote-core.com`.
- Check `$99` package copy, region/currency, scope, refund/tax, turnaround, staff operations and subscription-cap policy with owner before production launch.

The `$99` marketing page is part of the code package; it is not a live public page until deployed. The premium Done For You content remains separate.

## 5. Component capacity and Free Workspace

The current implementation counts **components, not libraries**. The existing `createComponent` action checks an entitlement in `company_custom_billing.purchased_entitlements.componentLimit`, commonly 15 for Free Workspace. Existing starter/bootstrap components may consume places. **Do not promise that a Free Workspace can save one or two complete nine-item roofing libraries.** The user can stage any of the five systems and save only as many approved components as their entitlement allows; additional items stay in the draft session. The grouped save preflights capacity and refuses to create empty destinations when the cap is reached, then each insert also calls `createComponent`, preserving the authoritative cap.

Check edge cases: 0 free places, fewer places than selected items, missing legacy billing row (possibly uncapped), quota-read DB failure (starter save fails closed), and two concurrent saves. The original component-creation action has pre-existing fail-open behaviour on billing resolution failures; that remains an integration risk and should be examined separately before production certification.

## 6. Roofing rules and safety boundaries

- `rafter` pitch is for projected-plan roof surface and sloping rakes/barges; `valley_hip` is for conventional 45-degree-plan-diagonal hip/valley lengths; `none` for conventional horizontal eaves and ridges and counted fixings.
- A roof surface or diagonal length **already measured along the slope must not have pitch applied a second time**. Irregular hips and valleys need geometrical confirmation. Do not assume a combined ridge/hip item can share a single pitch formula.
- Source text is untrusted. Extraction may suggest only; server-side Zod and existing `calculateComponentTest` validate and calculate. AI cannot write directly to the component table.
- Unknown costs/waste remain `null` or explicit unknown. Zero cost means a human deliberately entered zero; waste `none` must be confirmed, not silently inferred. Captured selling price is not a material purchase cost. Rates are canonical metric where the engine requires them; source units and regional taxes require human checking.
- A template draft includes immutable `starterLibrarySlug`/`starterLibraryName` metadata. Client editing is restricted to `editableDraftSchema` and cannot switch a row into another system. A verified hash prevents a changed draft from being saved without confirmation; `pricing_setup_draft_id` prevents duplicate live rows on retries.
- Selected items are reviewed in groups of at most 25. Each final save processes only individually confirmed items; the session and remaining candidates persist.

## 7. Required tests before any deploy

Run after `npm ci` on a machine with package registry access. `AGENTS.md` is authoritative and may have changed on origin:

```bash
node scripts/check-pricing-starters.mjs
node --import tsx --test 'app/lib/pricing-setup/'*.test.ts
npx tsc --noEmit
npx eslint 'app/(auth)/[workspaceSlug]/pricing' 'app/lib/pricing-setup' 'app/api/pricing-setup' 'app/(marketing)/quick-start-pricing'
npm run build
npm run check:billing
npm run test:roof-takeoff && npm run test:topology && npm run test:calibration && npm run test:precision
npm run smoke:billing  # mandatory on every testing deployment
```

`tsc` has a known repository baseline of legacy errors: compare **new** diagnostic paths and counts against source branch; fix regressions, do not opportunistically rewrite unrelated systems. Full npm install/build could **not** be completed in this offline authoring environment; a required npm package (`zwitch`) was not cached. These checks are outstanding, not green.

Manual staging matrix (test on phone-sized viewport, tablet, desktop, light/dark themes, keyboard/tab controls):

1. Feature OFF: old direct `/components`, quotes, billing and catalog converter work unchanged; setup endpoints inaccessible.
2. Feature ON: `My Pricing Library` nav opens new four-card gate; personal preference bypasses it next time; permanent help link returns to gate; manual editor still works.
3. Cards 3 and 4 open public marketing site; Quick Start public page goes to the appropriate authenticated intake or signup; Stripe paid checkout can be reconciled by verified webhook.
4. Assistant accepts files, text, voice and *no selection* of context options; all valid checkbox combinations and exclusive `mixed`; never automatically assigns selling price to supplier cost.
5. Template chooser shows **exactly five roof systems**, 9 items each, source note/pitch/measurement in accordion previews. Select 1, 2, or all 5; stage 45 items without AI call; no price/waste defaults; select up to 25; resume later; review every item.
6. Test each rule: underlay/covering → rafter; rake → rafter; conventional diagonal hip/valley → hip/valley; horizontal ridge → none; eaves → none; nails/screws → none. Verify actual pitch is applied only for plan measurement and never twice.
7. Approving an item requires non-null material, labour and resolved waste rule; test and confirmed-hash checks; editing a confirmed component requires reconfirmation.
8. Save 1–25 verified items into separate named customer collections; follow returned links to the ordinary Smart Component editor; confirm the correct company and collection, name, SKU, notes, rates, rules and quotation calculations.
9. Re-save, retry after one insert succeeds and draft status update fails, race two save requests, and test pre-existing same-name collection. No duplicate components or silently dropped drafts.
10. Free Workspace with 7 or fewer places left: save allowed subset, other rows retained with clear cap error; no unwanted empty collections; upgrade path works. Test paid tiers and legacy uncapped company.
11. Migration/DB unavailable: clear error without user-priced data loss; repeated deployments don't overwrite master template edits.
12. Browser/mobile visual checks: 375px-wide cards stack, template list scrolls without horizontal overflow, inputs and selection are accessible, `prefers-reduced-motion` honored.

## 8. Packaging / branching rules

- **Choose ONE**: `QuoteCore_Pricing_Setup_Consolidated_PATCH_v2_2026-11-14.zip` against the owner's original Nov 14 ZIP / development `15f458c9` **OR** `QuoteCore_Pricing_Setup_Revision_PATCH_v2_2026-11-14.zip` if the **previous first implementation** was already merged unchanged. **Do not apply both**.
- Each patch contains a `quotecore-plus/` root; extract to a temporary directory, inspect manifest and diff, then copy/git-apply changed files on a feature branch. **Never replace a newer `development` checkout with the full archive**. If branch differs, merge deliberately.
- Current repo docs may lock baseline fixture hashes. Read `AGENTS.md` and inspect protected files. The original migration/DB type file, design standards, takeoff package, billing internals and existing pricing calculator should not be overwritten by this feature.
- Feature branch → testing deploy and billing smoke → owner review → production merge on explicit approval. No automatic production push, no unattended production migration, no live Stripe charge during tests.
- Rollback: disable `NEXT_PUBLIC_PRICING_SETUP_ENABLED`, rebuild and redeploy; keep additive tables and existing customer component rows intact. DB rollback/drop should **not** be the first response to a UI issue.

## 9. Known deferred work / product decisions

- Price example research **not populated**: starter master templates contain configurable geometry and named products, not regional price evidence. Future rate sets must identify country/currency/unit/date/tax and verified supplier or labour source and be marked illustrative; do not silently promote to user-approved costs.
- For true one-click *practice-only* library rows visible **inside** the normal editor, the application needs a separate practice/draft/read-only state spanning both takeoff and quote resolution; the current architecture intentionally does not insert unpriced rows into active `component_library`. The preview and staged review are available now.
- No dedicated admin template-management UI in this patch: editable `pricing_starter_*` tables are the source of truth; Supabase Table Editor is the temporary operator workflow. A dedicated, permission-controlled admin screen can be added later.
- Quick Start amount ($99) and component count (15) versus Free Workspace 15 total is a commercial constraint to resolve explicitly before production.

**Agent acceptance:** provide branch/commit, full test outputs (including failures), staging URLs/screenshots, migration execution evidence, simulated sample quote totals, RLS cross-tenant checks, Stripe test-mode evidence and list of any outstanding blockers before requesting owner's release approval.
