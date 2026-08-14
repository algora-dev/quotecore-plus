# Route Matrix and Feature Flag Behaviour

**Captured:** 2026-08-13 (Phase 0 baseline)
**Repo:** quotecore-plus
**Path prefix:** `app/(public)/free-roofing-takeoff-builder/`

## Routes

| Route | File | Purpose |
|---|---|---|
| `/free-roofing-takeoff-builder` | `page.tsx` | Generic builder. Parses query params into `PublicRoofTakeoffInput` via `parseQueryInput()`. Renders H1, SEO section, `RoofTakeoffBuilder`, AI/developer access section. |
| `/free-roofing-takeoff-builder/[supplierSlug]` | `[supplierSlug]/page.tsx` | Supplier-specific builder. Fetches supplier via `getPublicSupplier(slug)`. Renders supplier metadata, passes `initialSupplierSlug` to builder. 404s if supplier not visible. |
| `/free-roofing-takeoff-builder/calculate` | `calculate/page.tsx` | GET calculation endpoint (server-side redirect). Parses query params, validates, creates result token, redirects to `/free-roofing-takeoff-builder/result/[token]`. |
| `/free-roofing-takeoff-builder/result/[id]` | `result/[id]/page.tsx` | Server-rendered result page. Verifies token, renders calculation as HTML. No JS required. Public, cacheable. |

## API Routes

| Route | File | Purpose |
|---|---|---|
| `/api/public/roof-takeoff/schema` | `app/api/public/roof-takeoff/schema/route.ts` | Returns JSON schema for AI agents (parameters, workflow, examples). |
| `/api/public/roof-takeoff/calculate` | `app/api/public/roof-takeoff/calculate/route.ts` | REST API calculation endpoint. Returns JSON result. |
| `/api/public/roof-takeoff/openapi` | `app/api/public/roof-takeoff/openapi/route.ts` | OpenAPI specification. |
| `/mcp` | (global) | MCP server endpoint for AI tools. |

## Feature Flags

| Flag | File | Default | Effect when enabled |
|---|---|---|---|
| `SUPPLIER_TAKEOFF_V2` | `feature-flag.ts` | `false` | Enables Supplier Takeoff V2 features (currently unused - reserved for future phases). |

## Key Components

| Component | File | Role |
|---|---|---|
| `RoofTakeoffBuilder` | `RoofTakeoffBuilder.tsx` (~79KB) | Main client component. Manages all state: measure mode, unit system, supplier selection, sections, entries, results. |
| `EntryComponents` | `EntryComponents.tsx` | `AddEntryForm`, `EntryListItem`, `CustomComponentCreator`. Supports known-price entries and fixed-quantity components. |
| `ResultsModal` | `ResultsModal.tsx` | Results display with print/PDF, convert-to-quote, supplier enquiry. |
| `SupplierEnquiryModal` | `SupplierEnquiryModal.tsx` | Supplier enquiry form. Submits slug server-side, never sends email from client. |
| `ComponentGuideBox` | `ComponentGuideBox.tsx` | Visual guide diagrams for each component type. |
| `helpers` | `helpers.tsx` | `InfoIcon`, `ComponentSymbol`, unit/pitch helpers, `componentLabel`, `componentDescription`. |

## Calculation Files

| File | Role | Differs from platform repo |
|---|---|---|
| `types.ts` | Type definitions | Adds `knownPrice` on `Entry`, `fixed` on `CustomComponentDef.measurementType`, `roof_types` on `RoofComponentDef` |
| `calc.ts` | Calculation functions | Adds `isCustomFixed()`, `computeKnownPriceCost()`, `DEFAULT_COMPONENTS`, `registerCustomKind(id, isArea, isFixed?)` |
| `engine.ts` | Section totals engine | Handles fixed sections (rawTotal = quantity sum), known-price cost path |
| `public-contract.ts` | URL parsing, validation, result-token generation | QuoteCore+-specific: supplier params, result URLs, schema export |
| `snapshot.ts` | Takeoff snapshot serialization | QuoteCore+-specific |
| `schema.ts` | JSON schema for AI agents | QuoteCore+-specific |
| `result-token.ts` | Token signing/verification | QuoteCore+-specific (HMAC-based) |

## Supplier Integration

- Supplier list fetched from `/api/free-tools/supplier-libraries` (returns `SupplierInfo[]`)
- Supplier catalogue fetched from `/api/free-tools/supplier-library/[slug]/components`
- Supplier enquiry submitted to `/api/free-tools/supplier-enquiry` with `supplierSlug` only
- Preselected supplier via `initialSupplierSlug` prop (from `[supplierSlug]` route)
- Supplier context drives: currency, unit system, tax treatment, component catalogue, roofing types

## Session Persistence

- State persisted to `sessionStorage` under key `***` (redacted)
- Includes: measureMode, unitSystem, experience, masterPitch, masterRatio, sections, customSections
- Leave warning shown when unsaved changes exist

## Existing Tests (all passing, 34 total)

| File | Tests | Coverage |
|---|---|---|
| `baseline.test.ts` | 15 | Actual/plan mode, pitch factors, supplier pricing, imperial/squares units, grand totals, result token round-trip, country/supplier params, custom waste, result URLs, tampered token rejection |
| `public-contract.test.ts` | 6 | Acceptance fixture, documented measurements, plan mode pitch, query aliases, generated result queries, invalid pitch validation |
| `result-token.test.ts` | 8 | Token round-trip, URL encoding, comma-separated values, tracking params, determinism, tamper rejection, URL building |
| `supplier-pricing.test.ts` | 5 | Supplier components pricing, no-supplier warning, supplier param round-trip, stable result URL, email-safe URL |
