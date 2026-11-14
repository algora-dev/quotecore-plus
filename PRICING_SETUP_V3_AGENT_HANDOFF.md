# QuoteCore+ Pricing Setup Assistant v3 — full-source integration handoff

**Delivery date:** 14 November 2026  
**Authoritative file for this delivery:** `PRICING_SETUP_V3_AGENT_HANDOFF.md`  
**Owner-supplied baseline:** `quotecore-plus-handoff-2026-11-14.zip` / `development` at `15f458c9` (as reported in its handoff).  
**Delivery format:** **ONE entire source archive** plus this separate Markdown handoff; the same handoff is included at repository root.  
**Deployment target:** **testing branch and staging project ONLY**. No SQL has been applied remotely; no payment was charged; this archive has not been deployed or validated against a live Supabase database.

> **Read first:** `AGENTS.md`, `docs/DESIGN_SYSTEM.md`, `docs/ux/phase-9/` and this document. The older `PRICING_SETUP_INTEGRATION_HANDOFF.md` and `PRICING_STARTER_REVISION_AGENT_HANDOFF.md` describe previous unpriced versions and are retained as historical context. For v3 starter data, **this handoff supersedes both**. Do not merge earlier v1/v2 patches into this archive: they are already incorporated.

## 1. Executive summary — what the owner will see

The existing working Smart Component editor remains at `/{workspaceSlug}/components`. This delivery provides a simpler entry via **My Pricing Library** with four dark v2-themed choices: manual, **Pricing Setup Assistant**, US$99 Quick Start, and Full Done For You. First-visit / remembered-preference routing makes assistance accessible without forcing it on experienced users.

The assistant has two starting paths:

1. **Use my own prices**: upload spreadsheet/CSV, image, PDF, text or browser microphone recording, extract roofing pricing information, select up to 25 of 100 candidates, examine source evidence and roofing-rule suggestions, edit/test, individually approve and bulk-save only confirmed components.
2. **Start with ready-made roofing libraries**: choose one or more systems, inspect the component/rate/waste/pitch preview, stage a draft, explicitly acknowledge **practice prices**, and save up to 25 components per batch into separate normal customer-owned libraries *without pretending the example rates are verified*. Afterwards, users can open/test/edit Smart Components and create an internal **practice quote**. Each demo-priced component must be explicitly verified using their actual material, labour, pitch and waste basis before it becomes ordinary pricing. **Old practice quotes remain practice snapshots even if the component is later verified**; create a fresh quote for a real customer.

Five master libraries, **35 components** total:

| Published library slug | Name | Included items |
| --- | --- | ---: |
| `asphalt-shingles` | Asphalt Shingle Roofing | 7 |
| `long-run-metal` | Long-Run / Corrugated Metal Roofing | 7 |
| `concrete-tile` | Concrete Tile Roofing | 8 |
| `natural-slate` | Natural Slate Roofing | 8 |
| `low-slope-tpo` | Low-Slope TPO Membrane Roofing | 5 |

The previous generic `low-slope-membrane` library is hidden, **not deleted**. Unneeded v2 9-item rows remain in the admin catalogue but are set `included_by_default = false` for the updated roofs. The new 35 included definitions have worked-example material/labour costs and waste settings in separate master price tables.

### Practice pricing — essential owner-facing limitation

The figures are **fictional, research-informed 2026 US-dollar direct-cost allocations**, not current live supplier or subcontract prices; they exclude tax, margin, overhead, permit fees, freight, tear-off and job particulars. All practice components are marked. They are suitable only for testing, training and discovering the quote flow.

*For a non-USD workspace*, an additional opt-in is required: the **same example numeric values** will be used in the workspace currency **without foreign-exchange conversion**. These values are therefore **NOT local market estimates**. This is an intentionally simulated learning-price experience until verified regional price sets are developed. Never label these rates verified, or remove the opt-in silently.

The existing QuoteCore+ price engine applies waste to material **and** labour quantity. The assistant discloses this; v3 does **not** rewrite the canonical calculation engine or silently change existing customer quote totals. Revisit material-only waste as a separate pricing-engine product decision.

## 2. Feature map / code locations

| Area | Key files | Notes |
| --- | --- | --- |
| Navigation and setup route | `app/components/workspace/shell-config.ts`, `app/(auth)/[workspaceSlug]/pricing/page.tsx`, `pricing/setup/*`, `pricing/setup.css` | Default-OFF flag; deep links to legacy editor retained |
| The v2 styled assistant | `app/(auth)/[workspaceSlug]/pricing/assistant/PricingAssistantClient.tsx`, `assistant.css`, `page.tsx` | File/text/voice entry; optional multi-select price context; five-system picker; evidence, review/test, practice import, first quote |
| Assistant server actions | `app/(auth)/[workspaceSlug]/pricing/assistant/actions.ts` | Auth-scoped drafts, batch selections, per-item approval, idempotent grouped save, practice quick import |
| Roofing intelligence | `app/lib/pricing-setup/roofing-rules.ts`, `domain.ts`, `extract.server.ts`, `parse-spreadsheet.ts` | Existing calculation engine is authoritative, not AI-computed math |
| Master template data/service | `app/lib/pricing-setup/starter-catalog.json`, `starter-practice-examples.json`, `starter-libraries.server.ts` | Static copies for traceability/testing; **database master rows are authoritative at runtime** |
| Private session & templates | `app/lib/pricing-setup/storage.server.ts`, `preferences.ts`, `app/api/pricing-setup/*` | Draft stage and identity boundaries |
| Component practice flag/verification | `app/(auth)/[workspaceSlug]/components/practice-actions.ts`, `component-list.tsx` | Explicit verification of actual business rates; sample provenance stored in component rows |
| Quote safety | `app/lib/pricing-setup/practice-guard.server.ts`, `app/(auth)/[workspaceSlug]/quotes/actions.ts`, `app/lib/send-document/orchestrator.ts`, `app/lib/messages/send.ts` | Blocks normal external quote send and token creation; backed by database triggers |
| Quote safety UI | `app/(auth)/[workspaceSlug]/quotes/[id]/summary/*`, `customer-edit/page.tsx`, `CustomerQuoteEditor.tsx`, `QuotePreview.tsx` | Summary PDF disabled; customer editor and printable preview prominently say PRACTICE — NOT FOR CUSTOMER USE |
| Quick Start $99 | `app/(marketing)/quick-start-pricing/*`, `app/(auth)/[workspaceSlug]/pricing/quick-start/*`, `app/api/pricing-setup/quick-start/route.ts`, `app/lib/pricing-setup/quick-start-webhook.server.ts`, `app/api/webhooks/stripe/route.ts` | Existing Stripe flow extended; test-mode checkout/webhook must be verified |
| Staff fulfillment | `app/admin/(dashboard)/pricing-quick-start/*`, `AdminNav.tsx` | Staff order management, role test required |
| Offline fixture validation | `scripts/check-pricing-starters.mjs` | 35 costs/waste/pitch/units and seed checks, quote-send route source assertions |
| Detailed baseline changes | `PRICING_SETUP_V3_FILE_MANIFEST.json` | Hash-compared full delivery vs owner-supplied source |

The design uses existing `QcButton`, `QcField`, `QcSelect`, v2 colours and responsive CSS. **Do not replace or rewrite** the existing Smart Component editor, takeoff engine, imported catalog converter, quote calculation formula or quote data model beyond the additive fields here.

## 3. Exactly three database migrations — staging first, in this order

**Database:** use the **existing Supabase project** for the target environment. No new Supabase project and no new Postgres instance are needed. Staging must have its own approved database/Stripe TEST mode. The repository contains **two historical migration roots**; never run all migrations or assume a ledger is complete. Check `AGENTS.md`, `docs/db/MIGRATION_INVENTORY.md` and actual database schema first. Apply these **three new SQL files**, one at a time, recording them using your approved migration procedure:

1. `backend/supabase/migrations/20261114160000_pricing_setup_assistant.sql` — private `pricing_setup_preferences`, `pricing_setup_sessions`, `pricing_setup_drafts`, `pricing_setup_api_usage`, `pricing_quick_start_orders`, `pricing_setup_reserve_call()`; private Quick Start file storage bucket; unique `component_library.pricing_setup_draft_id` for retry-safe imports. Authenticated RLS; server actions also verify tenant/user.
2. `backend/supabase/migrations/20261114180000_pricing_starter_libraries.sql` — editable master `pricing_starter_libraries`, `pricing_starter_items`, `pricing_starter_price_sets`, `pricing_starter_price_values`; customer destination mapping table; optional intake context; initially seeds v2 9-item definitions as a baseline.
3. `backend/supabase/migrations/20261114190000_pricing_starter_practice_prices.sql` — **v3 authoritative transition**: five published 7/7/8/8/5-item master systems; 35 priced cost/waste rows; published demonstration-only USD cost set; `component_library` practice/provenance/verification columns; immutable `quote_components.pricing_setup_practice_snapshot`; trigger preventing practice component insertion into an already shared quote; trigger preventing customer acceptance-token activation or sent status on practice quotes. Old generic membrane template unpublished. **Do not stop at migration 2**: without migration 3 the v3 server code will not work.

### Read-only post-migration checks

```sql
SELECT slug, name, version, published
  FROM public.pricing_starter_libraries WHERE published ORDER BY sort_order;
-- Expected: asphalt-shingles, long-run-metal, concrete-tile, natural-slate, low-slope-tpo; version 3.

SELECT library_slug, COUNT(*)
  FROM public.pricing_starter_items
  WHERE included_by_default
  GROUP BY library_slug ORDER BY library_slug;
-- Expected: five groups with counts 7,7,8,8,5.

SELECT ps.id, ps.currency_code, ps.illustrative_only, ps.demo_only,
       ps.published, COUNT(pv.item_code) AS example_components
  FROM public.pricing_starter_price_sets ps
  JOIN public.pricing_starter_price_values pv ON pv.price_set_id=ps.id
  WHERE ps.id='1b7b2933-867c-43af-a99b-9fc56b93a3c2'
  GROUP BY ps.id;
-- Expected: USD, true, true, true, 35.

SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='component_library'
 AND column_name LIKE 'pricing_setup_%' ORDER BY column_name;

SELECT tgname FROM pg_trigger
 WHERE tgrelid='public.quotes'::regclass
 AND tgname='pricing_setup_practice_quote_send_guard';
```

No migration was actually executed by the author. The SQL requires **staging execution and review**, particularly the quote-component trigger under all existing quote/takeoff RPC variants. **Do not import the whole source ZIP directly into a live Supabase project.** Never roll back by dropping tables containing customer data. Some migration seeds upsert current v3 master rows: apply **once**, then edit staff-owned masters in Supabase Table Editor; do not replay a seed onto manually maintained records.

## 4. Editable master data and customer ownership

The values shown in the assistant come from the **master database tables**, not compiled UI constants. Staff can revise names, notes, active items, pitch, units, material and labour rates, waste, version metadata and the price set in **Supabase Table Editor**. A dedicated in-app template administrator UI is **not** included here; add that later only if needed.

A customer selecting a template creates a *draft session*; an explicit import copies selected components into `component_library` under their own `company_id` and per-roof `component_collections`. Their imported rows have `pricing_setup_practice=true` with template code/version, source USD currency, demo-price-set ID and unique draft ID. These are fully normal, **editable, deletable customer copies**, not master references that update automatically. Updating the master affects **future** imports, not existing customer costs. Customers may delete their copied library and import a newly published template; do not delete customer content on master update.

**Verification**: from My Pricing Library open the practice component, check/replace the material and labour values, waste and pitch for real products; use **Verify real costs** and affirm the explicit checklist. `verifyPracticeComponent` server action records who verified and when. This is a **human attestation**, not independent market verification. Existing quote snapshots remain practice; create a new quote after verifying components.

**Quota:** existing `createComponent()` is the authoritative individual component limit. `getPricingComponentCapacity()` preflights remaining space; each insert also performs the existing limit check. Free typically has a **15 total component** cap, potentially with seeded starter components already occupying slots. Thus *two entire starter libraries may not fit*; the picker supports choosing subsets and resume. The $99 Quick Start package says “up to 15 prepared components” and may exceed free live capacity; agent/owner must approve packaging/cap handling separately. **No new cap bypass, arbitrary subscription upgrade or automatic deletion is included.**

## 5. Configuration and external integrations

### Required for the testing-feature rollout

- `NEXT_PUBLIC_PRICING_SETUP_ENABLED=true` **only in staging after migration**; Next.js build-time public flag. Default/unset keeps legacy `/components` and disables new pricing setup APIs. To turn off, redeploy with false. Database triggers still protect existing practice quotes after flag is turned off.
- Existing Supabase app credentials, service-role credentials, storage policies and authentication configuration. Confirm staging has a functioning **private Quick Start storage bucket** from migration 1.
- Existing `OPENAI_API_KEY` for file/photo/PDF extraction and explanatory help (not needed to instantiate predefined practice libraries, which are deterministic). Optional `PRICING_SETUP_OPENAI_MODEL` (document parser) and `PRICING_SETUP_EXPLAIN_MODEL` (explanations); defaults defined in `app/lib/pricing-setup/extract.server.ts` and explain route. Ensure selected models support configured JSON responses/vision.
- For the $99 service, existing Stripe **TEST mode** `STRIPE_SECRET_KEY`, `STRIPE_MODE` and appropriate `STRIPE_WEBHOOK_SECRET_TEST` or `STRIPE_WEBHOOK_SECRET_LIVE` configuration in `app/api/webhooks/stripe/route.ts`. Point the staging webhook to the correct test endpoint and replay a signed **test** checkout event before enabling marketing. No live charges during QA.
- `PRICING_SETUP_APP_BASE_URL` should be the trusted HTTPS URL of the staging app for checkout returns; if unset, code falls back to `NEXT_PUBLIC_APP_URL`. Domain `quote-core.com/quick-start-pricing` is intended for the marketing side, `app.quote-core.com` for the app. Verify actual route/domains in staging.

### Not required for starter-library demonstration

- No new npm dependencies beyond the existing project lockfile.
- No newly purchased AI model, no external suppliers, no separate catalog import platform, no scheduled background job.
- No additional Supabase project.
- No region-specific pricing API. The USD practice numbers are static master rows, clearly labelled.

**Don't upload secrets in the delivery ZIP**. Use the staging environment's existing secret management.

## 6. Quote safety implementation and mandatory staging verification

**This implementation is deliberately fail-safe for normal quote egress, but it has NOT been end-to-end security certified.** Do not treat warnings alone as a protection mechanism.

- Quote components acquire `pricing_setup_practice_snapshot=true` through a database trigger when built from a practice library component. The trigger refuses adding practice components to already shared quotes.
- The quote update trigger blocks minting a live acceptance link or marking the quote `sent`/`viewed`/`accepted` when any component snapshot is practice.
- Server guards run during normal token generation, unified quote sending and outbound-message sends with associated quotes.
- Quote summary shows a **PRACTICE** warning and disables its normal PDF download/send controls. Customer Quote Editor shows a warning and puts **PRACTICE — NOT FOR CUSTOMER USE** *inside* the printable quote preview.
- Practice quotes remain practice when corresponding library items are verified. Users must create a fresh quote with verified components to send for real.

**Required audit:** confirm every alternate quote/public/PDF/print/export/send path obeys the snapshot and cannot silently omit the warning, including all quote copying/takeoff RPC overloads, customer preview, sending a message with a related quote, preview email and acceptance URLs. The UI and SQL/code guards are not a substitute for this full application egress review. Verify a simulated client PDF download cannot produce an unmarked ordinary quote. If any undocumented egress bypass remains, **do not enable in production**.

## 7. Exact build and testing procedure for agent

Start from the **latest** `origin/development` on a separate integration branch, and compare against base `15f458c9`. **DO NOT blindly overwrite newer GitHub work with this archive**. The ZIP is a complete source snapshot without `.git`; inspect `PRICING_SETUP_V3_FILE_MANIFEST.json` for new/modified files. Preserve original takeoff tarball and nested package tarball; both are live dependencies. Do not modify protected fixtures or `database.types.ts` without the official procedure (UTF-16LE by design).

```bash
# After careful code integration and installing project dependencies:
npm ci
node scripts/check-pricing-starters.mjs
node --import tsx --test app/lib/pricing-setup/*.test.ts
npx tsc --noEmit
npx eslint 'app/(auth)/[workspaceSlug]/pricing' app/lib/pricing-setup app/api/pricing-setup
npm run check:billing
npm run build
npm run test:roof-takeoff
npm run test:topology
npm run test:calibration
npm run test:precision
npm run smoke:billing       # REQUIRED on every testing deployment
```

**Known pre-existing debt:** `AGENTS.md` reports about **81 existing TypeScript errors** and substantial ESLint findings. Compare the precise changed-file diagnostics against the current upstream baseline; do not claim a clean type check merely because of these historical issues. Stop on new type errors or failures in changed routes.

### Test matrix for the release checklist

1. **Flag OFF:** new routes fail closed, existing `/components` creation, editing and quotes work; old customers see no redirect regression.
2. **Entry/onboarding:** dark four-card page, My Pricing Library label, preference persists across devices, helper link always available, correct marketing URLs; mobile layout at 320/375/768px and desktop; accessibility/keyboard/dark mode.
3. **Starter picker:** five options, previews show 7/7/8/8/5, true example values and sample waste, no source data needed, no OpenAI tokens; select several roof types, keep separate customer-owned libraries and names.
4. **Currency:** USD workspace straightforward; NZD/AUD/GBP explicit opt-in to intentionally **nonconverted practice numbers**, verify clear non-local warning; never imply FX rates.
5. **Capacity:** Free workspace with only 7 spots available; import 7/8-component libraries in whole/subsets, 0 capacity, paid plan, error on billing read, two concurrent saves, retry after intermittent DB error; no duplicate Smart Components.
6. **Practice component:** correctly labelled in library; default material/labour/waste/rule/notes/pitch copied, test calculated pricing using existing engine; practice verification requires active user + company ownership and explicit checkbox; customer copies remain independent of master updates/deletes.
7. **Quote safety:** create practice quote from both manual and takeoff flows; check `quote_components` snapshots; attempt Send Quote, copy customer link, send via Message Center, status transition, customer editor and PDF, direct legacy token actions. **All egress blocked or visibly marked**. Then verify component: old quote still practice, new quote from verified component can be sent normally.
8. **Own-price extraction:** upload CSV/XLSX/PDF/image, voice and text; 100 candidate cap, choose 25, preserve existing multi-select price context, examine source confidence, real prices/waste not guessed, individual confirmation and safe save.
9. **Quick Start:** $99 test-mode checkout, private source files, webhook signatures, staff order list, role enforcement, idempotent order status changes, no accidental real payments; Full Done For You unchanged.
10. **Security:** other-tenant RLS denied on drafts/orders/collections, role authorization on staff pages, source text not treated as instructions, quota RPC and storage caps respected; rate limit and retry safety.

### Offline evidence from delivery environment

- `node scripts/check-pricing-starters.mjs` passed on the delivered source: **5 libraries / 35 items** with valid costs, units, waste, distinct codes, SQL seed reconciliation and send-guard structural assertions.
- The edited TypeScript/TSX files passed a **syntax-only** parse via the globally available TypeScript parser. This is **not** `tsc --noEmit`, `next build`, SQL execution or functional browser testing.
- Dependency installation/full Next.js build were **not runnable** in this environment; use a normal registry-connected agent runner.
- No deployment, database migration, Stripe charge or external API execution was performed.

## 8. Recommended staging deployment plan

1. Make a separate branch from current `origin/development`; compare new v3 files by manifest and reconcile collisions with other agents' recent work, **preserving all newer commits**.
2. Run base checks and spot-check `docs/DESIGN_SYSTEM.md`; install dependencies and resolve introduced errors without rewriting core pricing/takeoff.
3. Confirm staging database schema and authorized migration process, **apply all three new migrations in order**, refresh PostgREST schema if needed, run the SQL read-only checks above. Capture migration logs.
4. Run feature-off smoke and legacy pricing/takeoff tests.
5. Configure staging `OPENAI_API_KEY`, Supabase env, Stripe TEST mode and `PRICING_SETUP_APP_BASE_URL`; rebuild with feature flag on **in staging only**.
6. Deploy to `quotecore-plus-testing` using the repository's CLI deployment procedure. Per `AGENTS.md`, pushing a branch alone **does not deploy testing** because its Git link is disconnected. Run `npm run smoke:billing` as a hard requirement for testing deploy.
7. Exercise all functional, mobile, quote-safety and Stripe tests; record screenshots, defects, SQL checks and any drift from owner-supplied base.
8. Ask owner to test on staging. Iterate there. **Do not merge to `main` or enable production** until owner approval and the same gates pass for production.

### Rollback and data safety

Rebuild/redeploy with `NEXT_PUBLIC_PRICING_SETUP_ENABLED=false` to disable the new UI and APIs. The **database triggers remain active** to protect previously created practice quotes. Do not drop draft, price, customer component or order tables; they can contain user/paid data. Stop new $99 purchases in the marketing route separately if checkout is at issue; fulfill/refund existing test or real orders according to the approved process. Do not overwrite customer price copies when master examples are updated.

## 9. Known constraints / product questions to resolve after first staging test

- **Practice quote export audit:** current safeguards cover normal quote sends, acceptance links, summary PDF and marked customer preview. The integrating agent must validate *all* legacy export paths and close any alternative bypass before release. This is the highest security/UX priority.
- **Quote calculation waste:** existing engine applies waste to labour as well as materials. Changing this needs a separate domain/engine decision and regression tests. v3 deliberately leaves pricing mathematics untouched.
- **Template rate provenance:** all numeric figures are practice allocations, not supplier quotes or region-specific unit costs. Regional price sets, real FX handling and supplier verification are future work. Never silently promote demonstration costs to verified.
- **User attestation, not external verification:** app records an explicit human affirmation; it cannot know whether they obtained accurate current supplier prices.
- **Current workspace capacity:** 15-total Free cap with potentially preseeded components means a whole starter library might not fit. Owner must approve any new starter entitlement policy separately.
- **Master editing** is through Supabase Table Editor in v3; no in-app staff editor. Publishing a new version should be managed deliberately without mutating existing customer copies.
- **The $99 Quick Start** offers up to 15 prepared components, but customer entitlement, taxation, refund/fulfillment policy and marketing content should be owner-approved before production.
- **Upstream branch drift:** full source is pinned to a 14 Nov snapshot; the agent must reconcile newer work from `development` rather than force-replace it.

## 10. Acceptance outcome

The user can: open **My Pricing Library** → **Pricing Setup Assistant** → **Ready-made roofing libraries** → choose **Long-Run Metal** → see its 7 complete practice-priced components → acknowledge fictitious reference costs → **Import for practice** → open their own **Long-Run** component library → edit and test any component → create a practice quote with the existing calculator/takeoff. The quote and printable preview clearly state PRACTICE, and normal customer sends are blocked. After the owner verifies actual pricing and creates a new quote, normal customer sending works again.

This is the targeted **testing-branch acceptance journey**, not a claim that production has already passed it.
