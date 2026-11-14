> **Historical v1/v2 handoff.** For the current fully priced v3 starter-library delivery, read `PRICING_SETUP_V3_AGENT_HANDOFF.md` first. The previous 45-item/unpriced descriptions are superseded.

> **NOVEMBER 14, 2026 REVISION:** This original handoff documents the first implementation. It is supplemented and partially superseded by [`PRICING_STARTER_REVISION_AGENT_HANDOFF.md`](PRICING_STARTER_REVISION_AGENT_HANDOFF.md). The updated name is **Pricing Setup Assistant** (not Advanced); the assistant includes **five editable roofing starter systems**, optional multi-select price context, dark entry cards and a public Quick Start page. Apply **both** additive migrations `20261114160000` then `20261114180000`. If using the **consolidated v2 patch**, do not also apply the earlier patch.

# QuoteCore+ — My Pricing Library + Advanced Setup Assistant
## Implementation and integration handoff for the repository agent

**Prepared:** 2026-11-14  
**Source baseline:** uploaded `quotecore-plus-handoff-2026-11-14.zip`, `development` at `15f458c9`  
**Delivery:** changed/new files only, with original repo-relative paths; do NOT replace the current repository with this ZIP wholesale.  
**Production state:** **NOT deployed, NOT production verified**. Build/run/Stripe/Supabase tests must be completed by the integrating agent.

### Executive summary

This is an actual implementation of the new setup choice, not just a specification. The existing `/[workspaceSlug]/components` editor, quote workflows, calculation engine, existing catalog converter and normal billing flow are preserved. It adds:

1. **My Pricing Library** navigation, with new four-option landing (`manual`, `Advanced Setup Assistant`, `$99 Quick Start`, `Full Done For You`) and a user-level preference to go directly to the old library page. The original editor retains an always-available setup-help link once the feature is enabled.
2. **Advanced Setup Assistant**: CSV/XLSX/TXT/PDF/PNG/JPEG/WebP, typing, or recorded speech; up to 100 extracted candidates; roofing-specific deterministic category/measurement/pitch suggestions; explicit material/labour/waste evidence; select up to 25 per review batch; existing component calculator; optional OpenAI field explanations; individually confirmed, safely bulk-saved components; resumable or deletable private drafts; no-price-list starter suggestions without fictitious costs.
3. **Quick Start**: one-time **US$99** Stripe Checkout for an intake package of **up to 15 Smart Components**, with customer notes and up to three private pricing files; verified webhook updates; admin work queue with signed file access and staff status changes. Separate from the broader **Done For You from US$499** link.
4. An **additive migration**, with private draft/session/preference/order/AI-usage tables, auth-backed quotas, and a unique `component_library.pricing_setup_draft_id` anchor to make component-save retries idempotent.
5. A **default-OFF rollout flag**: `NEXT_PUBLIC_PRICING_SETUP_ENABLED`. It is intentionally OFF until migration and end-to-end staging validation pass. Flag OFF leaves the old `/components` destination functioning; new API endpoints respond 404.

This code is intentionally not a general autonomous browser agent and does **not** search the web for unverified local prices. Public-price sourcing may be built later as a separate source-provenance feature. The customer-facing extraction/review/product path requested in the latest scope is implemented.

### Required integration sequence — do not skip or reorder

1. **Freeze the integration baseline.** Check out the **current** `origin/development` (not `main`), inspect `AGENTS.md` and `docs/ux/phase-9/DECISIONS.md`, compare against source commit `15f458c9`. This patch was authored from that commit. Resolve source drift line by line, especially in the five existing files changed here. Preserve all newer teammate edits. Work on `feature/pricing-setup-assistant`.
2. **Apply code files only as a feature branch.** Use this ZIP's `quotecore-plus/` directory paths. Read `CHANGES.md` and the machine-readable `FILE_CHANGES.json`. Do not copy any `node_modules`, build cache, production environment files, or the entire old repository over a newer branch.
3. **Review migration status READ ONLY.** Repository contains both `backend/supabase/migrations` and `supabase/migrations`. Consult the live migration ledger, `docs/db/MIGRATION_INVENTORY.md`, current database schema and owner-approved migration procedure. This patch adds only `backend/supabase/migrations/20261114160000_pricing_setup_assistant.sql`. It must be applied **once** in the correct environment and recorded according to repository practice; **never replay** historical migrations and **never assume** one migration directory is safe to apply end-to-end. Run it in staging first. It adds tables, policies, a limited RPC, a private Storage bucket, and a nullable idempotency column/index. Do not change old migrations.
4. **Refresh database metadata** as needed after staging migration. The new tables are accessed through narrowly scoped `SupabaseClient` casts because generated DB types are pinned. If regenerating `app/lib/supabase/database.types.ts`, use the repo's **approved UTF-16LE generation procedure**; do not hand-edit or accidentally re-encode that file. Refresh PostgREST schema cache if newly created relations/RPCs are initially unavailable.
5. **Set environment in STAGING (before build):**
   - `NEXT_PUBLIC_PRICING_SETUP_ENABLED=true` (build-time, OFF by default)
   - `OPENAI_API_KEY` (already used by the app; server-only)
   - `PRICING_SETUP_OPENAI_MODEL` (optional; default `gpt-4o`, must support Responses API vision + strict structured JSON outputs)
   - `PRICING_SETUP_EXPLAIN_MODEL` (optional; default `gpt-4o-mini`)
   - `PRICING_SETUP_APP_BASE_URL=https://<your-staging-app-host>`; must be HTTPS and trusted. If unset, the checkout uses the trusted `NEXT_PUBLIC_APP_URL` (never the request Host header). For live set `https://app.quote-core.com` if that is still canonical.
   - Existing Stripe secrets and mode-specific webhook secret(s) (`STRIPE_SECRET_KEY`, `STRIPE_MODE`, `STRIPE_WEBHOOK_SECRET_TEST` / `STRIPE_WEBHOOK_SECRET_LIVE`, as actually defined in `app/api/webhooks/stripe/route.ts`) and existing email provider configuration. Do not put any secrets in `NEXT_PUBLIC_*` keys.
6. **Run install and gates on an environment with registry/dependencies.** Follow the current `AGENTS.md`: `npm ci`; `npx tsc --noEmit`; scoped ESLint; `npm run build`; `npm run check:billing`; `npm run smoke:billing` for *every testing deployment*; existing takeoff/topology/calibration/precision tests. Compare TypeScript result against the documented existing baseline (~81 previous errors). `node --import tsx --test app/lib/pricing-setup/*.test.ts` is the new focused test command; if package scripts require a different TS loader, run the equivalent built-in test mechanism. Do not change the protected debt baseline just to make these tests green.
7. **Exercise the full feature in staging**, with both the flag ON and OFF, actual paid and free workspace test accounts and a nonproduction Stripe test account. Confirm RLS cross-tenant refusal, quota exhaustion, simultaneous/repeated saves, human review, and complete quote handoff. Pay particular attention to the 15-component entitlement problem below.
8. **Test the $99 flow end-to-end**: submission -> file storage -> Stripe hosted Checkout -> existing signed webhook -> order `paid` -> admin queue -> private signed downloads -> `in_progress` -> `ready_for_review` -> `completed`. Check `checkout.session.completed`, async-payment events, Stripe webhook retries, stale checkout sessions, failed payment and abandoned checkout. The existing verified webhook endpoint is reused; the new handler is dispatched ahead of the pre-existing custom-billing handler only when metadata explicitly marks the Quick Start product. Never call fulfillment on a success redirect alone.
9. **Obtain owner approval** for final package text, currency, refund/tax policy, scope, support turnaround and subscription-cap treatment. Verify Quick Start never accidentally promises the premium support/training offering or bypasses Stripe billing controls.
10. **Promote only after staging acceptance**, following the development/testing/main three-agent protocol. Leave `NEXT_PUBLIC_PRICING_SETUP_ENABLED` OFF in production until owner acceptance and production migration/configuration are complete; then rebuild/redeploy with the flag ON. Keep an easy feature-OFF rollback path. Never test payment flows with real customer charges as part of automated CI.

### Integration map

| Responsibility | Existing code preserved | New code |
|---|---|---|
| Navigation | `app/components/workspace/shell-config.ts` | `[workspaceSlug]/pricing/page.tsx`, `/setup/page.tsx` and `PricingSetupEntry.tsx` |
| Manual editor | `[workspaceSlug]/components/page.tsx`, `component-list.tsx`, `actions.ts` | Help return link; `pricing/assistant/actions.ts` creates only individually approved items through existing `createComponent` |
| Computation | `app/lib/pricing/engine.ts`, `quantityCalculations.ts`, `app/components/pricing/componentTest.ts` | `app/lib/pricing-setup/domain.ts`, `roofing-rules.ts`, `parse-spreadsheet.ts` |
| AI/provider | `OPENAI_API_KEY`; existing Smart Assistant infrastructure not modified | `extract.server.ts`; `api/pricing-setup/import`, `/explain`, `/transcribe` |
| Data | Existing Supabase `component_library`, `component_collections` | Migration + `storage.server.ts` + personal `preferences.ts` |
| Human service | Existing Stripe webhook, email sender | `api/pricing-setup/quick-start`, `quick-start-webhook.server.ts`, customer intake and `/admin/pricing-quick-start` |

### Review and correctness contracts

- Uploaded sources are **untrusted data**, not instructions; extraction has **no browser, database or arbitrary code tools**. OpenAI can suggest, but server-side deterministic rules classify roofing terms and calculate using existing QuoteCore+ pure functions.
- No invented supplier/labour prices, waste values or unknown units; unknown is distinct from zero. Source price basis may be `purchase`, `selling`, `mixed`, or `unknown`. Selling prices are not automatically substituted for purchase costs. Each draft records source/rule/inference/missing/user provenance.
- Roofing suggestions include rafter for roof coverings/underlay/rake/barge, hip-valley for conventional diagonal hips and valleys, none for typical horizontal ridge/eave/gutter and counted fixings. The original source's **plan vs slope measurement basis is not established by item name alone**; user must inspect the rule. The hip/valley factor assumes 45-degree plan diagonal geometry.
- Pack prices need explicit pack dimensions. For non-`per_unit` purchasing the existing engine calculates rounded pack count. Quantity spacing/cover width/supplementary units have explicit advanced fields. Confirmed items must pass the existing `ComponentTestPanel` logic (server-side test invocation), plus API and DB validation.
- Nothing enters `component_library` before individual review + checkbox confirmation. Bulk save only reads the current confirmed digest; source edits invalidate confirmation. Saved components use a unique `pricing_setup_draft_id`; an interrupted retry recognizes an existing saved component rather than inserting another.
- RLS covers read access; sensitive inserts/updates use the service-role client **only after** `requireCompanyContext()` / `requireUser()` and exact `user_id` + `company_id` predicates. Anonymous demo users are blocked from paid AI and payment entry. Daily AI quotas are enforced by authenticated SQL RPC.
- Saving is **partially successful**, not all-or-nothing. Display row-level errors; never claim success for rows that failed. New components remain subject to **existing component entitlement limits**.
- Customers may delete an import's draft rows and source excerpts; this does **not** delete previously saved Smart Components. The self-service importer does not keep original document bytes; Quick Start files are retained in a private Supabase Storage bucket for staff handling.
- Voice transcription uses the OpenAI speech API; files below 3.5MB. General import uploads <=4 MB per request (deployment body-limit constraint); Quick Start <=3 files, <=4MB total. XLSX reads up to 12 worksheets and takes up to100 candidates. If larger inputs are required later, add an authenticated direct-to-private-storage ingestion route with a retention schedule; do not simply raise request-body limits.

### Important owner decision: the component quota conflict

At source commit `15f458c9`, `createComponent` enforces component limits from purchased entitlements. The Free Workspace cap is **15 total** and first-time accounts can have **8 seeded starter components**. The proposed Quick Start package offers **up to 15 prepared components** and the self-service extractor may produce 100 draft candidates.

**This patch does not circumvent subscription quotas.** Choose an approved outcome before advertising the $99 service broadly: e.g. (a) replace starter components with the customer's chosen items **after explicit consent**, (b) raise free capacity via an approved entitlement change, or (c) sell Quick Start with clear disclosure of the available saved-component capacity. Do not quietly delete starter components or grant paid entitlements via an undocumented bypass. AI staging and review can be performed before any library-capacity change.

### Handoff limitations and follow-ups

- Source was a **lean archive**, not a writable Git checkout connected to your repository. Patch is against the specified baseline; agent must rebase/compare with latest branch before merging.
- **Registry/network unavailable** in preparation environment: `npm ci --offline` fails `ENOTCACHED zwitch`; online install timed out. Therefore this deliverable has NOT passed full type-check, ESLint, full build, real integration tests or browser visual review. It passed TypeScript **syntax parsing** and focused **offline tests on pure logic** only (see `TEST_EVIDENCE.md`). Treat it as **review-ready implementation requiring engineering acceptance**, not as production-ready verified code.
- Private Quick Start files currently have no automatic retention/expiry deletion job; define a storage retention policy and delete abandoned/unpaid uploads after an approved period. A checkout failure may leave an order and files pending; staff should use the admin queue until cleanup is automated.
- Automated Stripe refunds, taxes, invoice issuance, customer notification when an order is completed and remote-supplier price web lookup are not included. These require explicit legal/product decisions and can be follow-up features.
- No additional npm dependencies were introduced: existing `zod`, `papaparse`, `jszip`, `stripe`, `@supabase/supabase-js` are reused. OpenAI API is called via native server `fetch` with existing key.
- `app/(auth)/[workspaceSlug]/pricing/setup` is the help/choice page; `/pricing` is the preference-aware nav dispatcher; `/components` remains the existing direct editor. Existing quote `?collection` links continue working.

### Minimum manual acceptance matrix

| Scenario | Expected |
|---|---|
| Feature flag OFF | `/components` remains accessible, navigation still resolves to old editor; new AI API returns 404; no pricing setup link appears in old editor |
| Feature flag ON, first user | Four options available; “My Pricing Library” wording; manual link opens existing editor; help link works |
| Direct-to-library preference | User choice persists across devices, nav goes straight to `/components`, `/pricing/setup` remains available on demand |
| CSV, XLSX, typed, PDF/photo | Extract up to100, preserve recognizable SKUs/names, no fabricated prices/waste, warnings for ambiguous rates |
| Text/photo selling quote | Selling price must not become supplier purchase cost without user correction |
| Roof pitches | Barge/rake→rafter; hip/valley→hip/valley; area roof→rafter; horizontal ridge/gutter and counted fixings→none; ambiguous measurement flagged |
| Unit conversions | `$3/ft²` converts to canonical `$32.2917/m²`, roofing squares and ft/m rates also checked |
| Selection | Select <=25; cross-session/tenant IDs rejected; saved items cannot reselect |
| Review | Change pricing, waste, pitch, packs, spacing; source evidence available; test calculator works; unknown field blocks confirmation |
| Drafts | Save and resume, delete imports, recover after browser refresh; never modify old quotes |
| Save | Only digest-confirmed rows; partial errors displayed; quota respected; retries cannot duplicate component by draft ID |
| First quote | Handoff opens existing quote creation, library retains verified items |
| Quick Start checkout | $99 USD test payment, admin queue file links private, webhook retries safe, failed payments not fulfilled |
| Billing regression | Existing subscriptions/custom billing/webhook delivery reconciliations unchanged |
| Multi-tenant permissions | One company's imports, private files and preferences cannot be accessed by other companies |
| Accessibility and responsive | Touch targets, focus, error announcement, desktop/tablet/mobile, dark/light tokens, voice unsupported fallback |

### Rollback

**Fast disable:** Rebuild/redeploy with `NEXT_PUBLIC_PRICING_SETUP_ENABLED=false` (and keep existing `/components` editor). Do **not** revert/de-delete database tables or the `pricing_setup_draft_id` idempotency column on an active database; they are additive and may contain saved customer references and legitimate paid orders. Keep verified Stripe webhook handling enabled to reconcile in-flight payments. If orders have already been paid, fulfillment and refunds remain a human obligation even while new sales are disabled.

**Production checklist owner signatures:** database reviewed, new feature enabled only after staging pass, Stripe webhook test witnessed, invoice/tax position approved, pricing-cap treatment approved, quick-start fulfillment staffed, data retention approved, customer documentation/videos linked, no unexpected effect on existing components or takeoff.
