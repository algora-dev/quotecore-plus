# Shared Roof Takeoff Migration Plan

**Status:** Planning complete; implementation not started  
**Target:** Replace QuoteCore+'s duplicated public roof takeoff UI with the shared Guided/Fast system from `customer-website-tool-platform`, while preserving QuoteCore+-specific supplier, pricing, persistence and public-result capabilities.  
**Repositories:**

- `customer-website-tool-platform` (`roof-takeoff-platform`) - canonical shared takeoff implementation
- `quotecore-plus` - migration target and owner of supplier/result infrastructure

## 1. Outcome

QuoteCore+ will use the same calculation core, Guided layout, Fast layout, field order, reports and interaction patterns as ACT Roofing and the reusable customer base.

QuoteCore+ adds one optional runtime layer on top:

1. Select or preselect a supplier.
2. Load that supplier's catalogue, currency, units and pricing context.
3. Build the takeoff in Guided or Fast mode.
4. Generate the existing QuoteCore+ result/snapshot contract.
5. Send an enquiry using the selected supplier slug; the server resolves the destination email.

Static customer websites continue using local `theme.config.ts` and `components.config.ts` with no supplier step.

## 2. Corrections to the Previous Plan

The previous plan had the right migration direction but missed several architectural constraints:

1. **Cross-repository delivery is a blocker.** The shared packages are private source workspaces and cannot be imported directly by QuoteCore+ in a separate repository or Vercel project.
2. **Supplier support does not belong in `ThemeConfig`.** Branding and static defaults must remain separate from runtime supplier data.
3. **Callbacks are preferable to configurable API URLs.** Shared UI should call typed adapters, not know QuoteCore API paths.
4. **Supplier email must not come from the browser.** Multi-supplier enquiries send a supplier slug; the server resolves and validates the email destination.
5. **Result/snapshot compatibility must be designed before UI replacement.** The current public result URLs, agent API and pricing provenance cannot be retrofitted safely at the end.
6. **The migration needs a parallel, reversible cutover.** Do not delete the existing builder until parity is proven on preview.
7. **Line-count estimates are not useful acceptance criteria.** Completion is defined by contract and E2E parity, not the amount of code added or removed.

## 3. Architecture Decisions

### 3.1 Canonical ownership

The platform repository remains authoritative for:

- takeoff types and calculations
- Guided and Fast layouts
- shared icons, guide diagrams and results UI
- generic flow orchestration
- static single-customer configuration

QuoteCore+ remains authoritative for:

- supplier directory and catalogue APIs
- supplier pricing provenance and visibility rules
- supplier enquiry submission
- saved drafts and immutable result URLs
- public calculation schema, AI/agent API and MCP routes
- QuoteCore+ page chrome, analytics and feature flags

### 3.2 Package distribution

Before feature work, create a publishable compiled facade package from the platform repository, provisionally named `@quote-core/roof-takeoff`.

Requirements:

- compiled ESM and TypeScript declarations in `dist/`
- React and Next.js as peer dependencies
- exports for core, flow, layouts and shared UI
- no imports from customer folders
- exact semantic versions and changelog
- QuoteCore+ pins an exact released version; never use `*` or a floating Git branch
- previous package version remains available for rollback

Default distribution choice: private GitHub Packages. If deployment-token overhead is rejected, obtain approval before using public npm. Do not vendor copied source into QuoteCore+ as the permanent solution.

### 3.3 Runtime adapters

Add optional typed adapters to the shared flow rather than QuoteCore-specific API knowledge:

```ts
interface SupplierAdapter {
  listSuppliers(input: SupplierSearchInput): Promise<SupplierSummary[]>;
  loadCatalogue(slug: string): Promise<SupplierCatalogue>;
}

interface EnquiryAdapter {
  submit(input: SharedSupplierEnquiry): Promise<{ ok: true }>;
}

interface ResultAdapter {
  createResult(input: SharedTakeoffSnapshot): Promise<{ id: string; url: string }>;
}
```

Static customer sites omit these adapters and retain current behaviour.

### 3.4 Runtime supplier context

Supplier selection produces one normalized context:

```ts
interface SupplierContext {
  slug: string;
  name: string;
  currency: string;
  currencySymbol: string;
  unitSystem: UnitSystem;
  taxMode?: string;
  catalogueVersion?: string;
}
```

The client does not receive or submit the supplier's destination email. QuoteCore+ resolves the email server-side from `supplierSlug`.

### 3.5 Capability flags

QuoteCore-only behaviour is exposed through typed capabilities, not hardcoded brand checks:

- `knownPriceEntries`
- `fixedQuantityComponents`
- `resultUrls`
- `draftPersistence`
- `leaveWarning`
- `supplierSelection`

Capabilities default to false so existing customer sites do not change.

### 3.6 Canonical snapshot contract

Define the shared snapshot before migration. It must preserve:

- measurement mode and unit system
- pricing mode and roof type
- supplier slug, catalogue version and product provenance
- all sections, entries, quantities, labels and waste percentages
- selected component IDs or known prices
- material, labour and grand totals
- warnings and calculation version

QuoteCore+'s existing result-token, public-contract and agent-facing outputs must be generated from this snapshot without breaking their URLs or schemas.

## 4. Implementation Phases

### Phase 0 - Baseline and contract freeze

1. Record the current QuoteCore+ route matrix and feature flag behaviour.
2. Capture fixtures for supplier list, supplier catalogue, known-price entry, fixed component, result creation and supplier enquiry.
3. Add or confirm tests for existing public-contract, result-token, supplier-pricing and baseline calculations.
4. Write an explicit parity checklist for desktop and mobile.
5. Make no UI replacement in this phase.

**Gate:** Existing QuoteCore+ behaviour is reproducible by tests and fixtures.

### Phase 1 - Distribution spike

1. Add the compiled facade package and package build pipeline in the platform repository.
2. Verify tree-shaking, Tailwind class inclusion, `styled-jsx`, Next 16 compilation and React 18 peer compatibility.
3. Publish a prerelease version.
4. Install the prerelease in a throwaway QuoteCore+ branch/page.
5. Build both repositories in CI-equivalent local commands.

**Gate:** QuoteCore+ can consume the package on Vercel preview without source copying or workspace-path assumptions.

### Phase 2 - Shared contracts and supplier extension

1. Add normalized supplier, catalogue, enquiry and snapshot types to the shared core.
2. Add the optional supplier step to `TakeoffFlow`.
3. Support preselected suppliers for `/free-roofing-takeoff-builder/[supplierSlug]`.
4. Add loading, empty, unavailable and retry states.
5. Derive effective currency and units from selected supplier context.
6. Reset incompatible entries if the supplier changes after data entry; require confirmation before clearing.
7. Keep static customer behaviour unchanged when no adapter is supplied.

**Gate:** Shared package tests cover static flow, supplier flow, preselection, catalogue failure and supplier change.

### Phase 3 - QuoteCore feature parity in shared core/layouts

1. Add known-price entry support behind `knownPriceEntries`.
2. Add fixed-quantity component support behind `fixedQuantityComponents`.
3. Implement both capabilities in Guided and Fast layouts.
4. Preserve the field order: measurement, product/known price, optional label, quantity, add entry.
5. Add calculation tests for known prices, fixed quantities, waste, packs and labour inclusion.
6. Confirm layout switching preserves all entered state.

**Gate:** The shared layouts can represent every entry supported by the existing QuoteCore+ builder.

### Phase 4 - QuoteCore adapters and wrapper

1. Create a QuoteCore-branded client wrapper around the shared flow.
2. Implement `SupplierAdapter` using the existing supplier-libraries and supplier-library routes.
3. Normalize API responses into shared component and supplier types without changing the database schema.
4. Implement `EnquiryAdapter` using `/api/free-tools/supplier-enquiry` and `supplierSlug`.
5. Implement `ResultAdapter` using the current result URL/snapshot infrastructure.
6. Use QuoteCore+ `BlogHeader`, `SiteFooter`, fonts, colours and analytics around the shared builder.
7. Preserve supplier-specific currency, unit and tax display.

**Gate:** The wrapper works with no changes to ACT, ABX or `demo-default`.

### Phase 5 - Route integration behind a feature flag

1. Keep the existing builder as the default.
2. Add the shared builder behind the existing free-tool feature-flag system.
3. Support a tester-only query/cookie override on preview.
4. Route both the generic page and `[supplierSlug]` page through the same wrapper contract.
5. Keep calculate, result, AI/agent and MCP routes unchanged unless a contract test requires an adapter.

**Gate:** Old and new implementations can be switched without a deployment rollback.

### Phase 6 - Parity validation

Run the following matrix in both Guided and Fast layouts:

- actual and plan measurements
- material-only and material-plus-install pricing
- new-roof and re-roof catalogues where enabled
- metric, imperial and squares suppliers where available
- component pricing, known price and fixed quantity
- waste, pack pricing and labour calculations
- supplier search, preselection and unavailable supplier
- result URL creation and result-page rendering
- enquiry reaches the selected supplier resolved server-side
- supplier change after entering data
- layout switching without lost entries
- print/PDF and mobile interaction
- anonymous limits, draft behaviour and leave warning

Required automation:

- shared package unit tests
- QuoteCore adapter contract tests with fixtures
- calculation parity tests against current QuoteCore outputs
- Playwright happy paths for generic and preselected supplier routes
- build of `demo-default`, ACT Roofing and QuoteCore+

**Gate:** No P0/P1 parity failures and Shaun approves the preview.

### Phase 7 - Cutover and observation

1. Enable the shared builder on development/preview first.
2. Obtain explicit production approval.
3. Enable production through the feature flag without deleting old code.
4. Observe errors, result creation and enquiry delivery through an agreed monitoring window.
5. Roll back by flag if supplier loading, calculations, results or enquiries regress.

**Gate:** Stable production behaviour through the observation window.

### Phase 8 - Cleanup

Only after the cutover gate:

1. Remove duplicated QuoteCore UI and calculation files proven unused.
2. Retain public-contract, result-token, snapshot and API code that remains QuoteCore-owned.
3. Remove the old feature flag after one stable release.
4. Update domain authority and architecture documentation.
5. Publish the final shared package version and pin it in QuoteCore+.

## 5. Files Expected to Change

### Platform repository

- package/build configuration for the publishable facade
- `packages/core` supplier, capability and snapshot contracts
- `packages/flow` optional supplier orchestration
- `packages/layouts/forms` known-price/fixed support
- `packages/layouts/classic` known-price/fixed support
- `packages/ui` adapter-aware results/enquiry actions
- tests and release documentation

### QuoteCore+ repository

- new shared-builder wrapper and adapters under the public free-tool route
- generic and supplier-slug route composition
- feature-flag wiring
- adapter and E2E tests
- package dependency and Next/Tailwind configuration
- architecture/domain authority documentation

Do not change production database schemas unless a proven contract gap requires it and Shaun approves it separately.

## 6. Non-Goals

- Rewriting the supplier directory or pricing service
- Changing existing public result URLs
- Changing AI/agent or MCP schemas without a compatibility requirement
- Adding supplier email addresses to client payloads
- Moving ACT or customer website branding into QuoteCore+
- Deleting the current builder before preview parity and rollback are proven

## 7. Principal Risks and Controls

| Risk | Control |
|---|---|
| Cross-repo package cannot deploy | Distribution spike before feature work |
| Supplier email can be tampered with | Submit slug only; resolve recipient server-side |
| Catalogue switch corrupts entries | Confirmation and deterministic state reset |
| Known-price/fixed behaviour regresses | Core parity fixtures and layout matrix |
| Result/agent contracts break | Snapshot contract first; retain existing routes |
| Tailwind omits package classes | Compiled-package preview build and visual checks |
| Shared change breaks customer sites | Build demo-default and ACT on every shared release |
| One-shot migration is hard to reverse | Feature-flagged parallel implementation |

## 8. Completion Criteria

The migration is complete only when:

1. QuoteCore+ imports a pinned compiled shared package, not copied source.
2. Generic and supplier-specific routes use the shared Guided/Fast flow.
3. Supplier selection controls catalogue, currency, units and server-routed enquiry delivery.
4. Known prices, fixed quantities, snapshots, public results and agent contracts retain parity.
5. Static customer sites behave exactly as before when adapters/capabilities are absent.
6. All unit, contract, E2E and production builds pass.
7. Shaun approves preview and separately approves production cutover.
8. Rollback is verified before old code is removed.

## 9. Recommended Execution Order

Start with Phase 0 and Phase 1 only. Re-estimate the remaining work after the distribution spike proves the package can be consumed safely by QuoteCore+ and deployed by Vercel. Do not begin UI migration before that gate.
