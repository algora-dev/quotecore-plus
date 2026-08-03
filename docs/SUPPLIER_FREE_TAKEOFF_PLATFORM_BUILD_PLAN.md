# Supplier-Powered Free Roof Takeoff Platform

Status: Planning draft for Shaun approval  
Planning model: GPT-5.6  
Implementation model: GLM 5.2, one phase at a time  
Target: QuoteCore+ (`quote-core.com`)

## 1. Product outcome

Turn the existing free roof takeoff builder into a supplier-powered lead and enquiry platform:

1. Visitors search approved suppliers and published component libraries by business, location, roofing type, product category, or brand.
2. They select a supplier library and complete the existing takeoff using that library's products and prices.
3. Every ready supplier has a stable, shareable, indexable URL that opens the tool with its default library selected.
4. Suppliers share that URL from their website, email, QR code, or sales material.
5. At the result, the visitor can contact the selected supplier from QuoteCore+.
6. The visitor controls whether the supplier receives quantities, indicative pricing, uploaded plans, and their message.
7. The supplier receives the enquiry at a configured inbox with the visitor's email as `Reply-To`.
8. QuoteCore+ records the enquiry as a product lead. Marketing use requires separate explicit opt-in.

The hosted tool remains QuoteCore+ with light supplier co-branding. Full white-labelling is outside this scope.

## 2. Existing foundations to reuse

Do not rebuild these systems:

- `supplier_profiles`: approvals, slugs, contacts, location, service areas, product tags, branding, pricing metadata, delivery rules.
- `component_collections`: supplier libraries, publication state, public metadata, versioning, tags, full-text search.
- `component_library`: products, SKUs, takeoff slots, pricing strategies, pack/labour pricing, waste, collection membership.
- `/api/public/suppliers/search`: ranked local/regional/national/freight/benchmark matches.
- Public calculation API: supplier input and pricing provenance.
- Signed result URLs at `/free-roofing-takeoff-builder/result/[token]`.
- Resend email infrastructure: `Reply-To`, attachments, tags, verified sender, size guard.
- Existing supplier admin/dashboard and distributed public API rate limiter.

## 3. Current gaps and risks

1. Interactive builder still loads legacy `free_tool_roof_components` and ignores supplier URL input.
2. Pricing is supplier-level, collapses all supplier products, and keeps only the first product per takeoff slot.
3. Search lacks free text, product type, brand, and collection-level results.
4. Query-string supplier links are not proper supplier SEO/landing pages.
5. Result tokens do not pin an immutable published library version; later pricing can change an old result.
6. No public supplier enquiry domain, queue, audit, attachment retention, or consent model exists.
7. Live data is inconsistent: Apex/Prime have mapped products but no published collection; RS Roofing has a published collection but no takeoff mappings.
8. Supplier login/contact emails must not automatically become order destinations.

## 4. Architecture decisions

### Library-level selection

The pricing unit is a published `component_collections` library. A supplier may later have different libraries for systems, regions, brands, or customer groups.

- Supplier URL opens its default takeoff library.
- Specific library URL opens that library.
- Builder shows all valid products per takeoff slot, not only the first.
- One explicit default product may be configured per library and slot.

### Canonical URLs

- Generic: `/free-roofing-takeoff-builder`
- Supplier default: `/free-roofing-takeoff-builder/[supplierSlug]`
- Specific library: `/free-roofing-takeoff-builder/[supplierSlug]/[librarySlug]`
- Existing `?supplier=` links redirect to canonical supplier URLs.

Reserve `calculate`, `result`, `api`, and `supplier` from supplier slugs.

### Selection behavior

- Generic visitor selects mode and units, then a supplier library before the builder.
- Country is required for ranked pricing search; city/region/postcode are optional ranking inputs.
- Global search remains available without location.
- If no priced library fits, allow quantity-only mode with clear disclosure.
- Supplier URL preselects supplier/default library but still lets the visitor change it.
- Changing library preserves measurements but clears incompatible selected products after confirmation.

### Co-branding

- QuoteCore+ shell and design system remain unchanged.
- Show supplier logo/name/location/product types and a compact "Pricing supplied by" banner.
- Optional colours are limited to safe accents; core buttons remain QuoteCore+ standard.

### Enquiry delivery

- Send from a verified QuoteCore+ domain with supplier-friendly display name.
- `Reply-To` is the visitor email.
- Resolve recipient server-side from dedicated `enquiry_email`; the browser never supplies it.
- Never use `master_email` automatically. `contact_email` is copied only by explicit admin action.
- Email is MVP delivery; records are stored for a later supplier inbox.

### Sharing controls

Separate options:

- Include takeoff quantities.
- Include indicative pricing.
- Include canonical result link.
- Include uploaded plans/files.
- Add message.
- Intent: detailed quote, order request, pricing question, general enquiry.

Pricing cannot be shared without quantities. Message/files-only enquiry is valid.

### Lead consent

- Name/email are required for enquiry fulfilment.
- Required disclosure covers sharing with supplier and QuoteCore+ storage.
- Marketing consent is separate and unchecked.
- Transactional confirmation does not require marketing consent.
- Only opted-in leads enter nurture/export workflows.

### File safety and retention

- MVP: PDF, JPG, PNG, WebP only.
- Maximum 5 files, 10 MB each, 20 MB combined raw size.
- Validate extension, MIME, magic bytes, filename, and size server-side.
- Store privately; attach within provider limits or send expiring signed links.
- Delete file bytes after 30 days while retaining enquiry metadata.

### Delivery reliability

Persist enquiry before delivery. Use a small DB-backed outbox with retries so email failure never loses the enquiry.

## 5. Target data model

All migrations are additive and nullable/defaulted until enabled.

### Supplier profile additions

- `enquiry_email text`
- `enquiries_enabled boolean not null default false`
- `enquiry_cc_emails text[] default '{}'`
- `brand_primary_color text`
- `brand_accent_color text`
- `default_takeoff_collection_id uuid`

### Component collection additions

- `public_slug text`
- `takeoff_enabled boolean not null default false`
- `currency text`
- `is_default_takeoff_library boolean not null default false`

Add unique `(supplier_profile_id, public_slug)` and one-default-library partial indexes.

### Component additions

- `is_takeoff_default boolean not null default false`

Add one-default-component partial index per `(collection_id, takeoff_slot)`.

### Published library snapshots

Create `supplier_takeoff_library_snapshots` with supplier, collection, published version, currency/pricing metadata, immutable active component JSON, and unique `(collection_id, published_version)`. Publishing a takeoff library creates its snapshot. Result tokens reference collection and version.

### Enquiries

Create `supplier_takeoff_enquiries` with supplier/collection/version, sender details, intent/message, sharing toggles, immutable result snapshot, canonical URL, totals/currency, attribution, privacy/marketing consent versions, delivery status, provider ID, errors/retries/timestamps, and hashed abuse-control identifiers.

Create `supplier_takeoff_enquiry_files` and `supplier_takeoff_enquiry_attempts` for private attachments and delivery audit.

RLS: no anonymous reads; public create only through service-role server route; admin reads all; approved supplier users may later read only their own supplier enquiries.

## 6. Phased build plan

Each phase gets one focused commit, narrow tests, lint of changed files, and `npm run build`. Do not continue if acceptance fails.

### Phase 0 - Baseline and characterization tests

Goal: protect the working calculator before changing data sources.

Work:

- Capture current actual/plan, pitch, waste, units, pack pricing, labour, custom component, print, and result-token behavior in tests.
- Add Playwright smoke coverage for mode -> units -> builder -> results.
- Snapshot current public API/OpenAPI response contracts.
- Add a disabled Supplier Takeoff V2 feature flag.

Acceptance:

- Existing generic builder is unchanged with flag off.
- Unit, API, and smoke baselines pass.
- Production build passes.

### Phase 1 - Library readiness schema and data cleanup

Goal: establish a valid collection-level pricing contract.

Work:

- Add collection slugs/default flag/takeoff flag, explicit component defaults, enquiry settings, and snapshot table.
- Add DB readiness validation: approved supplier, published collection, currency, active components, valid slots, non-negative pricing, one default per slot, valid default collection, and inbox when enquiries enabled.
- Update publish actions to reject invalid takeoff publication and create version snapshots.
- Create published collections for Apex and Prime and attach their current mapped products.
- Keep RS Roofing unready until its 13 products have explicit slots/defaults.
- Keep legacy tables/routes intact.

Acceptance:

- Apex and Prime each have one valid default takeoff collection and snapshot.
- Invalid libraries cannot advertise live pricing.
- Existing private/user libraries behave identically.
- Migration is transaction-tested and rollback documented.

### Phase 2 - Collection-aware service and search API

Goal: expose searchable, ready supplier libraries without changing the UI.

Work:

- Implement `loadPublishedTakeoffLibrary(collectionId, version?)` returning all slot options and explicit defaults.
- Add collection-level search results: supplier, library, location, products, brands, pricing freshness, delivery disclosure, readiness, canonical URLs, enquiry availability.
- Extend `/api/public/suppliers/search` with `q`, `roofingType`, `productCategory`, `brand`, `country`, `city`, `region`, `postcode`, `capability`, `page`, `limit`.
- Search profile fields and collection `search_tsv`; rank text relevance after location/delivery eligibility.
- Preserve current API fields or version the contract if a breaking shape is unavoidable.
- Add caching and invalidation on publish/status changes.

Acceptance:

- Supplier, location, product, category, and brand searches return only approved/ready libraries.
- Global search works without location.
- Location improves ranking without incorrectly hiding useful results.
- Suspended suppliers and archived/unready libraries never appear.

### Phase 3 - Builder supplier/library selection

Goal: use selected supplier library data in the interactive builder.

Work:

- Add selected supplier/library to builder state and session persistence.
- Add supplier/library selection after units for generic visitors.
- Build searchable result cards with filters, delivery/pricing disclosure, logo, location, and product tags.
- Load every product option from selected library grouped by `takeoff_slot`.
- Apply explicit defaults while retaining existing section dropdowns.
- Use supplier/library currency instead of hardcoded `$`.
- Add quantity-only mode.
- Confirm library changes when data exists; preserve measurements and reset incompatible products.
- Retain legacy endpoint until rollout completes.

Acceptance:

- Generic visitor can select Apex/Prime and see correct prices/currency.
- Dropdowns contain only the selected library's products and slots.
- Refresh/back preserves supplier and measurements.
- Products from different libraries can never be silently mixed.
- Existing calculation tests remain green.

### Phase 4 - Supplier URLs, co-branding, SEO, AI discovery

Goal: give each supplier a distributable landing URL.

Work:

- Add supplier and supplier-library dynamic routes.
- Server-load/validate supplier and library before rendering the builder.
- Redirect legacy query links while preserving measurements and UTM attribution.
- Add supplier metadata, canonical, Open Graph data, Organization/WebApplication JSON-LD, breadcrumbs, and visible descriptive content.
- Add only approved/ready pages to sitemap; `noindex` test/suspended/unready/unlisted pages.
- Add URL copy controls to admin and supplier dashboard.
- Update supplier API, schema, OpenAPI, docs, and `llms.txt`.

Acceptance:

- Supplier URL preselects correct data before hydration.
- Visitor still completes mode and units.
- Page has useful server HTML, canonical, and structured data.
- No route collision with `calculate` or `result`, duplicate H1, or duplicate canonical.

### Phase 5 - Immutable result provenance

Goal: ensure the price sent is the price the visitor saw.

Work:

- Extend result input/token with supplier, collection, and published version.
- Recompute result pages from immutable snapshots, not mutable current prices.
- Display supplier, library, version, currency, price date, tax, delivery assumptions, and exclusions in modal and server result.
- Add stale/new-version disclosure and explicit recalculation.
- Build one shared serializable result model for UI, email, API, and tests.

Acceptance:

- Publishing new prices does not alter an old signed result.
- Editing an old result upgrades only after disclosure.
- Tampered supplier/library/version fails verification.

### Phase 6 - Supplier enquiry backend and email delivery

Goal: securely accept and deliver public enquiries.

Work:

- Add enquiry/file/attempt/outbox tables and private storage policies.
- Add `/api/public/supplier-enquiries` create/status endpoints.
- Resolve recipient only from approved supplier configuration.
- Verify result token and snapshot server-side before sharing takeoff/pricing.
- Validate visitor fields, intent, toggles, message, and attachments.
- Add IP/email/supplier rate limits, honeypot, minimum completion time, duplicate suppression, and fail-closed DB behavior.
- Upload validated files privately and queue delivery.
- Build supplier email with visitor reply-to, optional quantities/pricing/result link/files, and QuoteCore+ attribution.
- Send transactional visitor confirmation.
- Add retry/backoff, terminal failure, and attachment-expiry cron.

Acceptance:

- Browser cannot choose arbitrary recipient.
- Suspended/disabled/missing-inbox suppliers cannot receive enquiries.
- Share toggles are enforced server-side.
- Email failure leaves a durable retryable record.
- Supplier can reply directly to visitor.
- Oversized, invalid, duplicate, and abusive submissions fail safely.

### Phase 7 - Result-stage enquiry UI and lead capture

Goal: complete the visitor flow.

Work:

- Add `Contact supplier` as primary supplier-context result action; retain Print/PDF, Convert to Quote, and Save to QuoteCore+.
- Build steps: intent -> details/message -> sharing/files -> review -> send/result.
- Preselect sensible sharing defaults; never preselect marketing consent.
- Show destination supplier identity without exposing private inbox.
- Add file picker, limits, upload progress, recovery, and accessible mobile states.
- Poll status or show accepted/pending reference.
- Record UTM/referrer/supplier-link attribution and non-PII analytics.
- Store marketing opt-in separately; nurture only opted-in leads.

Acceptance:

- Supports message-only, plans-only, takeoff without pricing, and full takeoff/pricing/plans.
- Review accurately previews supplier content.
- Double-click cannot duplicate enquiry.
- Success/failure states are clear.
- Existing result actions still work.

### Phase 8 - Supplier/admin operations and reporting

Goal: onboard and support suppliers without SQL.

Work:

- Extend admin supplier editor with enquiry inbox/enable/CC, accents, default library, readiness checklist.
- Extend supplier dashboard with takeoff-slot/default mapping and URL copy controls.
- Add supplier enquiry list/detail with status, visitor, intent, shared data, safe file links.
- Add admin reporting for search, selection, calculation, enquiry start/send/failure, opt-in.
- Add admin-only retry tools.
- Enforce cross-supplier isolation in RLS and server actions.

Acceptance:

- Admin can onboard without SQL.
- Supplier cannot enable incomplete library.
- Supplier sees only own enquiries.
- Admin diagnoses delivery failures without raw infrastructure logs.

### Phase 9 - QA, rollout, and legacy cleanup

Goal: release without breaking the free tool or public API.

Work:

- Run unit, API contract, RLS/security, Playwright desktop/mobile, lint, and production build suites.
- Test generic/supplier/quantity-only flows, every share combination, file errors, stale prices, suspended supplier, missing inbox, retries, consent.
- Seed controlled supplier/inbox and run real Resend test.
- Enable preview, then one approved supplier, then all ready suppliers.
- Monitor latency, search zero-results, delivery failures, spam, and conversion.
- Keep legacy read path through rollback window.
- Remove legacy `free_tool_roof_components` usage only after parity and archive.

Acceptance:

- `npm run build` passes.
- Public calculator/API remain compatible.
- No calculator error increase or Core Web Vitals regression.
- Real supplier receives and replies to production enquiry.
- V2 can be disabled without losing enquiries or supplier data.

## 7. GLM 5.2 execution protocol

For every phase:

1. Read this plan, `docs/DESIGN_SYSTEM.md`, applicable AGENTS instructions, and phase files only.
2. Inspect live schema before migrations; never trust generated types alone.
3. Create one focused phase plan.
4. Make additive minimal changes behind the feature flag until rollout.
5. Add tests with behavior.
6. Run narrow tests, changed-file lint, then `npm run build`.
7. Apply additive migrations and verify transactionally.
8. Commit and push one descriptive commit to `development`.
9. Never merge `main` without Shaun's confirmation.
10. Report criteria, tests, migration state, risks, next phase.

Stop and re-plan after two failed fixes. Never patch around schema/contract mismatches.

## 8. Minimum test matrix

- Unit: search ranking/text filters, library mapping/defaults, currency, snapshot reconstruction, result-token verification, share rules, file validation, consent separation.
- Database: readiness function, default uniqueness, snapshot immutability, enquiry transitions, cross-supplier RLS isolation.
- API: backwards-compatible search, pagination, disabled supplier, invalid token, recipient override, rate limit, duplicate request, attachment limits, retry.
- E2E desktop/mobile:
  - Generic search -> select -> calculate -> result.
  - Supplier URL -> preselected library -> calculate -> result.
  - Switch supplier with measurements.
  - Quantity-only fallback.
  - Message-only enquiry.
  - Takeoff without pricing.
  - Full takeoff/pricing/plans.
  - Marketing consent off/on.
  - Mock email in CI and controlled real inbox in preview.
- SEO: canonical, metadata, sitemap eligibility, structured data, noindex states, server-rendered supplier content.

## 9. Observability and success metrics

Track without PII in analytics:

- Supplier page visits and attribution.
- Normalized searches, filters, zero-result rate, selected library.
- Calculator starts/completions by library.
- Result views, enquiry starts/sends/failures/retries.
- Marketing opt-ins and QuoteCore+ account conversions.

Initial targets:

- Delivery success above 99%.
- Supplier URL -> completed takeoff conversion.
- Completed takeoff -> enquiry conversion.
- Search zero-result rate by country/product.
- QuoteCore+ opt-in and signup conversion.

## 10. Decisions to confirm before Phase 1

Recommended defaults already used in this plan:

1. Light co-branding, not full white-label theming.
2. One default takeoff library per supplier plus optional library URLs.
3. One primary supplier location for MVP; radius/geocoding and multi-branch wait for real demand.
4. Dedicated `enquiry_email`, never automatic login email use.
5. Separate unchecked marketing consent.
6. PDF/images only, 20 MB combined, file bytes deleted after 30 days.
7. Supplier email plus durable record before full supplier inbox workflow.
8. AI/MCP may discover suppliers and create result URLs but cannot autonomously send enquiries in V1.

If Shaun approves these defaults, Phase 0 can begin without further product questions.

