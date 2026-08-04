# Supplier AI Discovery and Authoritative Quote Platform

Status: High-level roadmap for Shaun approval  
Planning model: GPT-5.6  
Implementation model: GLM 5.2, one approved phase at a time  
Primary owner: Ron for public web, SEO, public tool UI, and orchestration  
Backend dependency owner: Gavin; see `docs/GAVIN_SUPPLIER_AI_PLATFORM_HANDOFF.md`

## 1. Outcome

Build a repeatable system in which a human or external AI agent can:

1. Discover a relevant approved supplier on QuoteCore+.
2. Understand the supplier's real locations, service areas, delivery coverage, catalogue scope, price provenance, and freshness.
3. Open the correct supplier calculator with the correct published library selected.
4. Submit unambiguous roof measurements without guessing whether each measurement is plan or actual.
5. Receive a QuoteCore+-authoritative calculation, supplier match disclosure, and immutable result URL.
6. Open a permanent human-readable result page and, later, contact the supplier.

The scalable operating model is:

`supplier dashboard record -> approved public read model -> supplier page -> calculator/library -> authoritative result -> analytics/enquiry`

No supplier page should require manual development. Publishing and unpublishing must be controlled by structured data and permissions.

## 2. Why this is worth doing

- Creates an AI-discovery channel before supplier and contractor searches fully shift from traditional search to answer engines and agents.
- Gives every supplier an indexable acquisition asset and a reason to maintain catalogue quality.
- Makes QuoteCore+ the authoritative calculation and pricing-provenance layer rather than a page an agent merely cites.
- Creates a distribution loop: supplier pages lead to calculators, calculators create shareable QuoteCore+ results, and results create supplier enquiries and QuoteCore+ signups.
- Scales to hundreds of suppliers because one validated data contract drives every page and workflow.

## 3. Current foundation to preserve

The external document was directionally correct but did not know how much already exists. Do not rebuild:

- Approved supplier profiles, catalogue collections, publication state, searchable tags, locations, delivery rules, pricing metadata, and supplier slugs.
- Supplier calculator routes at `/free-roofing-takeoff-builder/[supplierSlug]`.
- Published supplier library loading and library version fields.
- Ranked supplier search at `/api/public/suppliers/search` with local, regional, national, freight, indicative, and quantity-only match types.
- Public calculation API, OpenAPI document, schema endpoint, documentation, and MCP surface.
- Agent guidance covering supplier selection, location ranking, plan versus actual measurements, and exact result URL return.
- Signed result pages at `/free-roofing-takeoff-builder/result/[token]`.
- Existing supplier dashboard, catalogue publishing, enquiry flow, and public-tool test coverage.

Important limitations:

- `/suppliers` is a supplier-partnership marketing page, not a public directory.
- No canonical public supplier detail route exists at `/suppliers/[slug]`.
- Supplier calculator pages expose little supplier-specific server-rendered content.
- Public visibility and indexing permissions are not yet a complete supplier-controlled contract.
- Result reconstruction can still depend on mutable current pricing rather than an immutable published-price snapshot.
- The public contract uses a global `plan` or `actual` mode; it does not safely support mixed measurement basis per component.
- Calculation responses need a stricter status, clarification, next-action, location-match, and authoritative-completion envelope.

## 4. Scope principles

1. Additive changes only; preserve existing calculator URLs, API clients, MCP actions, result URLs, and database relationships.
2. Keep the existing result path canonical. Do not migrate to `/results/[token]` merely to match the external document.
3. Separate supplier location, service area, delivery area, pricing coverage, and fallback pricing. Never infer one from another.
4. Never index test, suspended, unapproved, unready, or explicitly unlisted suppliers.
5. Never expose hidden catalogue prices through HTML, structured data, API, result payloads, or agent instructions.
6. External agents must return QuoteCore+ results unchanged and must not replace a successful calculation with their own maths.
7. Supplier enquiry automation is a later conversion track. It must not block the core discovery-to-result loop.

## 5. Ownership and pause gates

Ron owns:

- Public supplier directory and supplier detail pages.
- Public calculator presentation, server-rendered supplier guidance, metadata, structured data, and accessible UX.
- Public result presentation once Gavin supplies the authoritative result contract.
- Sitemap, canonicals, robots/noindex behavior, `llms.txt`, public docs, analytics instrumentation, Lighthouse, and SEO checks.
- Cross-phase coordination, acceptance review, and rollout reporting.

Gavin owns:

- Database schema, migrations, RLS, server actions, authenticated supplier dashboard, and admin workflow.
- Public API contracts and routes, supplier read model, calculation engine, measurement normalization, result snapshots, and MCP behavior.
- Backend analytics events or aggregation needed by the supplier dashboard.

Pause rule:

- Ron completes all unblocked work in the active phase.
- At a Gavin gate, Ron gives Shaun the linked handoff section and pauses dependent implementation only.
- Ron resumes after Gavin provides the documented contract, migrations, tests, and sample payloads.
- No temporary frontend workaround may duplicate backend logic while waiting.

## 6. Phased implementation

### Phase 0 - Confirm product and publication rules

Goal: remove decisions that could invalidate routes, schema, or visibility behavior.

- Approve the decisions in section 9.
- Freeze route strategy, publication states, price visibility semantics, result retention, and V1 measurement-basis scope.
- Agree versioned public contracts between Ron and Gavin.
- Define baseline success metrics and the first rollout supplier.

Exit: Shaun has answered the decision list and both owners have agreed sample supplier and calculation payloads.

### Phase 1 - Characterize and protect the platform

Owner: Ron for public UI tests; Gavin for API/backend tests if changes are required.

Goal: prevent the discovery layer from breaking working calculator and result behavior.

- Inventory existing supplier, library, API, MCP, result, sitemap, and dashboard paths.
- Cover supplier preselection, plan mode, actual mode, search ranking, location fallback, pricing provenance, result-token reproduction, and old URL compatibility.
- Snapshot current schema and OpenAPI responses.
- Add a disabled rollout flag for public supplier pages if no suitable flag exists.

Exit: existing tests and build pass, contracts are recorded, and one-supplier rollout is possible.

### Phase 2 - Gavin gate: public supplier contract

Owner: Gavin. Ron pauses dependent page implementation.

Goal: create one safe source of truth for public supplier pages and calculator context.

Required outputs:

- Visibility fields and readiness rules for public page, indexing, catalogue, webpage prices, agent/API prices, contact details, and calculator availability.
- A server-side public supplier read model returning only approved and permitted fields.
- Library identity/version, price freshness, currency, tax, locations, service areas, delivery coverage, pricing coverage, and contact visibility.
- Explicit `published`, `unlisted`, `noindex`, `suspended`, and `unready` behavior.
- Supplier dashboard actions and validation for those controls.
- Tests proving hidden fields cannot leak through public APIs.

Gate: Ron receives typed payloads for directory cards, supplier detail, and calculator context; one supplier can be public while another remains inaccessible and unindexed.

### Phase 3 - Public supplier discovery pages

Owner: Ron.

Goal: make approved suppliers useful to humans, search engines, and AI agents.

- Convert `/suppliers` into the directory while preserving a supplier-partnership CTA to `/supplier-partnership`.
- Add `/suppliers/[supplierSlug]` as the canonical supplier detail page.
- Server-render identity, descriptions, locations, actual service areas, delivery coverage, catalogue categories, permitted products/prices, pricing freshness, tax/delivery notes, and contact guidance.
- Add a normal HTML link to `/free-roofing-takeoff-builder/[supplierSlug]`.
- Add concise visible agent guidance; keep the full calculation manual on calculator/docs surfaces.
- Add accurate Organization/LocalBusiness, Product/Offer, WebPage, and Breadcrumb structured data only where permitted.
- Generate dynamic metadata, canonicals, Open Graph data, sitemap entries, and correct noindex/404 behavior.
- Avoid thin filter pages and programmatic catalogue permutations.

Exit: pages work without JavaScript; hidden data is absent from HTML/JSON-LD; only eligible suppliers appear in directory/sitemap; SEO checks, build, and Lighthouse pass.

### Phase 4 - Supplier calculator agent layer

Owner: Ron, using the Phase 2 payload.

Goal: make every supplier calculator self-describing when an agent needs to calculate.

- Server-resolve supplier and default published library before rendering.
- Add supplier-specific title, canonical, pricing freshness, coverage disclosure, and link back to the supplier page.
- Embed a machine-readable application payload with supplier/library identity, version, pricing permission, endpoints, workflow, recovery, and result rules.
- Keep one generic instruction template with dynamic supplier data.
- Explain plan versus actual rules and require clarification when basis is ambiguous.
- Preserve existing interactive behavior and supplier URLs.
- Update public docs and `llms.txt` with the preferred workflow.

Exit: a browsing agent can identify the selected supplier/library and next endpoint from server-rendered content, with no calculator or Core Web Vitals regression.

### Phase 5 - Gavin gate: authoritative calculation and results

Owner: Gavin. Ron pauses dependent result presentation changes.

Goal: make agent completion unambiguous and historical results reproducible.

Required outputs:

- Additive per-component measurement basis with global mode retained for compatibility.
- `needs_clarification` responses with `requiredField` and machine-readable `nextAction` for unknown or contradictory basis.
- Location fallback policy plus requested and matched pricing location, match type, warning, and provenance.
- Immutable published-library or result snapshots so later price changes cannot alter old results.
- A consistent envelope for validation failure, clarification, calculation complete, and authoritative completion.
- Exact `resultUrl`, `authoritative: true`, and `nextAction: null` only on genuine completion.
- API, OpenAPI, schema, MCP, result-token, and compatibility tests.

Gate: the same result reproduces after catalogue updates, mixed basis avoids double pitch adjustment, and old global-mode clients remain unchanged.

### Phase 6 - Authoritative result experience

Owner: Ron.

Goal: make the result verifiable, understandable, and shareable.

- Render supplier, library, version, price date, requested/matched location, fallback warning, currency, tax, delivery assumptions, exclusions, and authoritative status.
- Present basis and geometry assumptions per component where supplied.
- Keep the existing canonical route and exact-copy behavior.
- Add stale/new-version disclosure and explicit recalculation without changing the historical result.
- Ensure machine-readable result data respects supplier visibility settings.
- Preserve print, PDF, signup, and edit flows.

Exit: humans can verify every price/assumption and agents can return the exact result without interpreting client UI.

### Phase 7 - Gavin gate: supplier dashboard controls

Owner: Gavin. Ron supplies UX requirements but does not modify authenticated app internals.

Goal: let suppliers manage the system without SQL or developer intervention.

Required outputs:

- Public presence section with all visibility controls.
- Public readiness checklist and validation errors.
- Preview supplier page, preview calculator, and copy URL actions.
- Publish flow selecting the immutable library version used publicly.
- Audit trail for publication/visibility changes.
- Safe analytics read model for page views, calculator opens, completed results, and later enquiries.

Gate: a supplier can preview/publish valid data, invalid data cannot go public, and supplier isolation is tested.

### Phase 8 - Analytics, operations, and rollout

Owner: Ron for public instrumentation/rollout; Gavin for backend aggregation where required.

Goal: launch safely and prove acquisition value.

- Track supplier page view, calculator click/start, calculation completion, result view, signup click, and enquiry start/send without analytics PII.
- Add admin readiness and broken-page checks.
- Roll out to one approved supplier, then a cohort, then all ready suppliers.
- Monitor zero-result searches, stale pricing, failures, result verification, index coverage, Core Web Vitals, and conversion.
- Document rollback and unpublish behavior.

Exit: one supplier completes dashboard-to-page-to-calculator-to-result; build, tests, SEO, Lighthouse, and preview verification pass; rollout can be disabled without breaking existing clients/results.

### Phase 9 - Supplier enquiry and lead conversion

Owner: split. Gavin owns persistence, security, API, email/outbox, and dashboard records; Ron owns public enquiry UX and conversion presentation.

Goal: turn results into supplier leads after the core loop is stable.

- Continue the detailed enquiry work in `docs/SUPPLIER_FREE_TAKEOFF_PLATFORM_BUILD_PLAN.md`.
- Preserve explicit sharing choices, separate marketing consent, server-resolved recipients, private files, idempotency, retry, and audit requirements.
- Do not allow autonomous AI enquiry submission in V1; require human review and consent.

Exit: the supplier receives a durable, consented, attributable enquiry tied to an immutable result, and delivery failure cannot lose it.

## 7. GLM 5.2 execution protocol

For each approved phase:

1. Switch back to GLM 5.2 before implementation.
2. Read only the phase, scoped files, applicable AGENTS instructions, and `docs/DESIGN_SYSTEM.md` for UI work.
3. Confirm the active branch is `development`.
4. Create a focused checklist and acceptance tests.
5. Make additive changes and preserve compatibility contracts.
6. Run narrow tests, lint, SEO checks where relevant, then `npm run build`.
7. Stop after two failed fixes and re-plan.
8. Commit one logical phase and push once to `development` after pulling `origin development`.
9. Report files, tests, migrations, risks, rollout state, and the next dependency gate.

## 8. Minimum end-to-end acceptance matrix

- Approved/indexable supplier appears in directory, supplier page, sitemap, and calculator.
- Approved/unlisted supplier follows the agreed direct-link behavior but is absent from directory/sitemap.
- Suspended/unready supplier is inaccessible or noindexed according to the agreed state model.
- Public-price-hidden supplier exposes no prices in HTML, JSON-LD, API, agent payload, or result page.
- Agent-price-hidden supplier cannot receive prices through public API/MCP even if webpage prices are allowed.
- Supplier page links to the correct calculator and back.
- Global actual, global plan, and mixed per-component basis calculate correctly.
- Ambiguous measurement returns a precise clarification action.
- Exact, regional, national, freight, and indicative fallback disclose requested/matched locations.
- Catalogue republish does not change an old result.
- Existing calculator/result URLs and API/MCP clients remain compatible.
- Desktop/mobile accessibility, SEO, build, and Core Web Vitals remain healthy.

## 9. Decisions Shaun needs to confirm

Recommended defaults are stated first.

1. **Directory route:** Move current `/suppliers` partnership content to `/suppliers-info`. Keep `/supplier-partnership` as-is. Use `/suppliers` for the new public supplier directory. **Confirmed by Shaun, 2026-08-04.**
2. **Public catalogue depth:** Show takeoff-ready public products/prices only, not every raw catalogue row. **Confirmed by Shaun, 2026-08-04.**
3. **Publication approval:** Supplier controls visibility after initial admin approval; material identity/status changes can require reapproval. **Confirmed by Shaun, 2026-08-04.**
4. **Price permissions:** Separate public webpage prices from agent/API prices. Both off until approved. **Confirmed by Shaun, 2026-08-04.**
5. **Indexed pages with hidden prices:** Allow useful supplier pages to index when prices are hidden, as long as unique supplier/location/catalogue content remains substantial. **Confirmed by Shaun, 2026-08-04.**
6. **Measurement basis:** Support per-component basis in V1 API while keeping the global UI mode as default. **Confirmed by Shaun, 2026-08-04.**
7. **Result route:** Keep `/free-roofing-takeoff-builder/result/[token]` canonical. **Confirmed by Shaun, 2026-08-04.**
8. **Historical results:** Preserve immutable non-PII calculation snapshots indefinitely. **Confirmed by Shaun, 2026-08-04.**
9. **Multiple libraries:** One default takeoff library per supplier in V1. Optional multi-library URLs later. **Confirmed by Shaun, 2026-08-04.**
10. **AI enquiry authority:** AI may discover, calculate, and return results but cannot send enquiries without human confirmation in V1. **Confirmed by Shaun, 2026-08-04.**

All 10 decisions confirmed by Shaun on 2026-08-04. Implementation may proceed.
