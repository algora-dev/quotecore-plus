# Gavin Handoff: Supplier AI Discovery Platform

Audience: Gavin  
Purpose: backend and authenticated-app work required before Ron can complete the public supplier/agent system  
Related roadmap: `docs/SUPPLIER_AI_DISCOVERY_PHASE_PLAN.md`

## 1. Context

QuoteCore+ already has supplier profiles, published libraries, ranked supplier search, public roof-takeoff calculation, schema/OpenAPI guidance, MCP, and signed result URLs. This is not a rebuild. The next work makes those foundations safe and authoritative enough to drive public supplier pages and external AI-agent workflows.

Ron will build the public directory, supplier pages, calculator presentation, result presentation, SEO, structured data, and analytics instrumentation. Gavin owns the database, authenticated supplier dashboard, public API/server contracts, calculation behavior, immutable result provenance, and RLS.

## 2. Delivery sequence

Please deliver these packages independently. Ron will pause at each gate and resume against the documented output.

### Package G1 - Public supplier publication contract

Needed before Ron Phase 3.

Deliver:

- Additive visibility/publication fields for public page, indexing, catalogue, webpage prices, agent/API prices, contact details, and calculator availability.
- A readiness/status contract covering approved, ready, published, unlisted, noindex, suspended, and unready suppliers.
- A typed server-side public supplier read model that strips disallowed fields before returning data.
- Directory-card, supplier-detail, and calculator-context projections from the same source of truth.
- Published library identity/version, currency, tax, pricing date/validity, locations, service areas, delivery areas, pricing coverage, delivery assumptions, and exclusions.
- Dashboard/server actions for saving controls with company ownership checks and audit metadata.
- Cache invalidation when profile, catalogue, price, approval, or visibility state changes.

Required tests:

- Suspended, unapproved, and unready suppliers never appear publicly.
- Unlisted suppliers are excluded from directory/sitemap eligibility and follow the agreed direct-link behavior.
- Hidden prices and contacts cannot leak through any public projection.
- Agent/API price permission is enforced server-side, not only hidden in UI.
- Cross-company mutation and read attempts fail.

Provide Ron:

- TypeScript type or versioned JSON schema.
- One complete visible sample payload.
- One hidden-price/unlisted sample payload.
- Eligibility booleans for directory, sitemap, page, calculator, and price rendering.

### Package G2 - Authoritative calculation contract

Needed before Ron Phase 6.

Deliver:

- Backward-compatible per-component measurement basis, for example:

```json
{
  "measurementBasis": {
    "area": "plan",
    "hips": "actual",
    "barges": "actual",
    "ridges": "actual",
    "valleys": "unknown"
  }
}
```

- Retain global `mode: plan | actual` for existing clients. Per-component values override only their own component.
- Reject or clarify contradictory/unknown basis rather than guessing.
- Return a consistent state envelope, for example:

```json
{
  "status": "needs_clarification",
  "authoritative": false,
  "question": "Are the valley measurements actual sloping lengths or horizontal plan lengths?",
  "requiredField": "measurementBasis.valleys",
  "nextAction": { "type": "ask_user" }
}
```

- On completion return `status: complete`, `authoritative: true`, `nextAction: null`, and the exact server-generated `resultUrl`.
- Accept an explicit location/fallback policy or document the fixed server policy.
- Return requested location, matched pricing location, match type, warning, provenance, currency, tax, delivery treatment, assumptions, and exclusions.
- Preserve geometry assumptions and normalized inputs in the result.
- Keep the existing POST API and GET/browser workflow. Update schema, OpenAPI, docs, and MCP after the response contract is stable.

Required tests:

- Global actual mode remains unchanged.
- Global plan mode remains unchanged.
- Mixed component bases avoid double pitch conversion.
- Unknown or contradictory basis returns clarification, not a guessed result.
- Every fallback tier returns requested/matched locations and disclosure.
- Old request payloads and clients remain valid.

Provide Ron:

- Input/output TypeScript types.
- Examples for complete, clarification, validation failure, quantity-only, exact match, and same-country fallback.
- A version field or compatibility policy for the response envelope.

### Package G3 - Immutable result provenance

Needed with G2 before Ron Phase 6.

Current signed URLs protect token integrity, but historical pages must not silently pick up later mutable prices.

Deliver one of these, in preference order:

1. Immutable published-library snapshots referenced by collection ID and published version; or
2. An immutable normalized calculation/result snapshot referenced by the signed token.

The result must pin:

- supplier and library identity;
- published version;
- normalized inputs and component basis;
- formulas and geometry assumptions;
- selected product IDs, SKUs, names, units, quantities, and prices;
- requested and matched pricing location;
- currency, tax, delivery treatment, warnings, exclusions, and totals;
- calculation contract version.

Required behavior:

- Republishing a catalogue never changes an existing result URL.
- Editing/recalculating from an old result explicitly upgrades to current data and creates a new URL.
- Tampered supplier/library/version data fails verification.
- Existing result URLs continue to resolve through the compatibility window.
- Result snapshots contain no unnecessary PII.

Provide Ron:

- Serializable result-page view model.
- Stale/current version indicators.
- Explicit recalculate/upgrade contract.
- Retention and deletion behavior.

### Package G4 - Supplier dashboard public-presence controls

Needed before Ron Phase 8 rollout.

Build inside the authenticated supplier dashboard:

- Public presence section with all G1 visibility controls.
- Readiness checklist for profile, approval, location, coverage, default library, pricing freshness, mappings/defaults, and contacts.
- Preview supplier page and calculator actions.
- Copy public supplier and calculator URLs.
- Publish/unpublish flow with validation and confirmation.
- Clear distinction between webpage prices and agent/API price access.
- Audit history for publication and visibility changes.
- Later: supplier-owned analytics for page views, calculator starts, completed results, and enquiries.

Required tests:

- Suppliers can edit only their own settings.
- Invalid libraries cannot be published as calculator-ready.
- Unpublish and suspension revoke public eligibility immediately.
- Preview does not accidentally index unapproved content.

Provide Ron:

- Final state names and visibility semantics.
- Preview URL contract.
- Public cache/revalidation behavior.
- Analytics event names and aggregation shape when available.

## 3. Recommended schema semantics

Exact column names are Gavin's decision, but avoid one ambiguous `is_public` flag. Independent policy decisions are required.

Recommended logical fields:

- `public_page_enabled`
- `search_indexing_enabled`
- `public_catalogue_enabled`
- `public_price_visibility`
- `agent_price_visibility`
- `public_contact_visibility`
- `calculator_enabled`
- `default_takeoff_collection_id`
- publication/readiness state plus audit timestamps/user IDs

Prefer enums where more than boolean semantics are needed, especially price and contact visibility.

## 4. Compatibility constraints

- Do not remove or rename existing calculator, result, API, schema, OpenAPI, MCP, or supplier-library routes.
- Do not force existing global `mode` clients to adopt per-component basis immediately.
- Do not infer supplier service area from pricing fallback or delivery availability.
- Do not let the browser choose a supplier email recipient.
- Do not expose service-role data directly to clients.
- Do not change old result calculations silently.
- Keep changes additive and feature-gated through initial rollout.

## 5. Decisions needed from Shaun before G1/G2

1. `/suppliers` becomes the public directory. Current `/suppliers` content moves to `/suppliers-info`. `/supplier-partnership` remains unchanged. **Confirmed.**
2. Supplier pages may be indexed when prices are hidden if unique content remains. **Confirmed.**
3. Agent/API prices are controlled separately from webpage prices. **Confirmed.**
4. Hybrid approval: supplier self-controls after initial admin approval; material changes can require reapproval. **Confirmed.**
5. Per-component measurement basis supported in V1 API. **Confirmed.**
6. Immutable non-PII result snapshots retained indefinitely. **Confirmed.**
7. One default takeoff library per supplier in V1. **Confirmed.**

All decisions confirmed by Shaun on 2026-08-04. See `docs/SUPPLIER_AI_DISCOVERY_PHASE_PLAN.md` section 9.

## 6. Definition of handoff complete

Each package is complete only when:

- migrations and RLS are applied and tested in the agreed environment;
- TypeScript types or versioned schemas are committed;
- unit, API, security, and compatibility tests pass;
- `npm run build` passes;
- sample request/response payloads are supplied;
- feature flag and rollback behavior are documented;
- changes are committed and pushed to `development`, never directly to `main`.
