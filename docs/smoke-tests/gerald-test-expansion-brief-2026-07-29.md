# Gerald - Test Coverage Expansion Brief
**Date:** 2026-07-29
**Author:** Gavin
**Purpose:** Expand the e2e test harness to cover all features shipped since Phase 1, plus new features not yet tested. Review for gaps, missing edge cases, and prioritisation.

---

## Current State

### What exists
- **Playwright e2e harness** in `e2e/` with 30+ specs across 15 files
- **Phase 1 complete** - auth, routing, access boundaries, basic quote/takeoff smoke
- **Phase 2-5 plan** exists (`docs/plans/phase-2-5-e2e-test-expansion-plan.md`) with 52 planned tests across quote builder, takeoff, document lifecycle, and edge cases
- **Smoke test checklist** (`docs/smoke-tests/CHECKLIST.md`) - manual checklist, living file

### What's NOT tested yet (features shipped since Phase 1)
These features have been shipped to development/main but have zero automated e2e coverage:

1. **Supplier Component System** (10 phases, shipped 2026-07-27)
2. **Catalogue Converter** (shipped 2026-07-24, updated 2026-07-29)
3. **Add from Catalog modal** (shipped 2026-07-29)
4. **Column mapping v2** - 4 fields, multi-map, 60 char name limit (shipped 2026-07-29)
5. **AI Takeoff V3** - 3-scan pipeline, quality selector, 1-step flow (shipped 2026-07-22)
6. **AI Scan Queue** - durable jobs, points, refunds (shipped 2026-07-24)
7. **Inbox/notifications system** (shipped 2026-07-23)
8. **Free Roof Takeoff Builder** (public tool, shipped 2026-07-25)
9. **Supplier directory + public catalog search** (shipped 2026-07-27)
10. **Catalogue-to-component converter** (shipped 2026-07-27)

---

## Proposed Test Categories

### A. Supplier Component System (8-10 tests)

| # | Test | What it catches | Priority |
|---|------|-----------------|----------|
| A1 | Supplier uploads CSV catalog - verify catalog appears in list with correct row count | Upload silently fails or row count wrong | P0 |
| A2 | Upload CSV with auto-detected headers - verify column mapping auto-populates | Auto-mapping broken, user must manually map everything | P1 |
| A3 | Upload CSV with no headers (Column A/B/C) - verify synthesised headers work | Header detection fails on headerless CSVs | P1 |
| A4 | Map one CSV column to multiple fields (e.g. Description -> Name + Notes) - verify both fields populate | Multi-mapping only populates first field | P0 |
| A5 | Convert catalog rows to components - verify components created with correct name (60 char limit), price, SKU, notes | Component creation drops fields or doesn't truncate name | P0 |
| A6 | Convert 20 rows (max) - verify all 20 create successfully | Row cap enforced too aggressively or not at all | P1 |
| A7 | Convert 21 rows - verify blocked with error message | No cap = user can create hundreds, performance issues | P1 |
| A8 | Supplier publishes library - verify it appears in public directory | Publishing doesn't update visibility or directory is stale | P1 |
| A9 | Non-supplier user searches supplier directory - verify published catalogs appear | Search returns empty or shows private catalogs | P1 |
| A10 | Supplier updates published library - verify change notifications created for importers | Update notifications not generated or sent to wrong users | P2 |

### B. Add from Catalog Modal (5-6 tests)

| # | Test | What it catches | Priority |
|---|------|-----------------|----------|
| B1 | Open Add from Catalog modal - verify two tabs (My Catalogs / Supplier Catalogs) | Modal doesn't open or tabs missing | P0 |
| B2 | My Catalogs tab - verify user's uploaded catalogs listed | Empty list when catalogs exist | P0 |
| B3 | Supplier Catalogs tab - search by keyword - verify filtered results | Search returns everything or nothing | P1 |
| B4 | Click catalog - verify rows load with search/filter and column mapping | Rows don't load or mapping UI broken | P0 |
| B5 | Select rows + create components in existing library - verify components appear | Creation fails silently or components go to wrong library | P0 |
| B6 | Create components in new library - verify new library created with components | New library creation fails, components orphaned | P1 |

### C. AI Takeoff V3 (6-8 tests)

| # | Test | What it catches | Priority |
|---|------|-----------------|----------|
| C1 | Upload plan - calibrate scale - click AI Assist - verify 3-scan pipeline runs continuously | Pipeline stalls between scans or modal doesn't appear | P0 |
| C2 | AI scan completes - verify AiResultsModal shows area name + pitch inputs | Results modal broken or missing fields | P0 |
| C3 | Quality selector (Low/Medium/High) - verify quality param passed to API | Quality selector doesn't affect API call | P1 |
| C4 | Apply AI results to canvas - verify Fabric objects created (areas + component lines) | Apply fails or creates wrong object types | P0 |
| C5 | AI Assist only visible for roofing companies - verify hidden for non-roofing | Non-roofing users see AI controls | P1 |
| C6 | Insufficient points - verify 402 error + upgrade message (no OpenAI call) | Points not checked, user gets generic error | P1 |
| C7 | Scan failure - verify points refunded | Points deducted but not refunded on failure | P1 |
| C8 | Page refresh mid-scan - verify no duplicate job or double charge | Idempotency broken, user charged twice | P0 |

### D. Component Library Management (5-6 tests)

| # | Test | What it catches | Priority |
|---|------|-----------------|----------|
| D1 | Create component manually - verify it appears in library with all fields | Component creation drops fields | P0 |
| D2 | Edit existing component - verify changes persist after reload | Edit doesn't save or saves partial fields | P0 |
| D3 | Delete component - verify removed from library and not orphaned in quotes | Delete leaves ghost references in existing quotes | P1 |
| D4 | Import supplier components into own library - verify imported with correct pricing | Import drops price or SKU | P1 |
| D5 | Supplier updates source component - verify pending updates banner appears for importers | Change notifications not generated or banner doesn't show | P2 |
| D6 | Accept pending update - verify local component updated to new version | Update doesn't apply or overwrites local customisations | P2 |

### E. Inbox/Notifications (3-4 tests)

| # | Test | What it catches | Priority |
|---|------|-----------------|----------|
| E1 | Supplier publishes update - verify inbox notification appears for affected users | Notifications not generated or not delivered | P1 |
| E2 | Click inbox notification - verify navigates to correct context | Notification links to wrong page or does nothing | P1 |
| E3 | Inbox badge clears on click - verify unread count updates | Badge stays unread after click | P2 |
| E4 | Multiple notifications - verify sorted by date, most recent first | Notifications in random order | P2 |

### F. Free Roof Takeoff Builder (4-5 tests)

| # | Test | What it catches | Priority |
|---|------|-----------------|----------|
| F1 | Open free takeoff builder (public, no auth) - verify page loads | Public page 500s or redirects to login | P0 |
| F2 | Draw roof area - verify area calculation correct | Area math wrong on public tool | P0 |
| F3 | Add components - verify material quantities calculated | Component math wrong on public tool | P1 |
| F4 | Submit form - verify lead capture works (email stored) | Lead capture silently fails | P1 |
| F5 | Mobile viewport - verify responsive layout works | Public tool broken on mobile | P1 |

### G. Column Mapping Edge Cases (4-5 tests)

| # | Test | What it catches | Priority |
|---|------|-----------------|----------|
| G1 | CSV with only 3 columns (SKU, Description, Price) - map Description to both Name and Notes - verify both populate | Multi-mapping with minimal columns fails | P0 |
| G2 | CSV row with description > 60 chars - verify name truncated at 60, notes has full text | Truncation off by one or doesn't apply | P0 |
| G3 | CSV row with description < 60 chars - verify name and notes both get full text (identical) | Short text only goes to one field | P0 |
| G4 | CSV with special characters in cells (commas, quotes, newlines) - verify parsed correctly | CSV parsing breaks on quoted fields with commas | P1 |
| G5 | CSV with empty cells in mapped columns - verify handled gracefully (empty string, not crash) | Empty cell causes NaN or crash | P1 |

### H. Quote Builder (from Phase 2 plan, still untested)

These are from the existing Phase 2 plan - still relevant, still untested:

| # | Test | What it catches | Priority |
|---|------|-----------------|----------|
| H1 | Create quote - add standard line item - verify subtotal/tax/total | Calculation engine returns wrong numbers | P0 |
| H2 | Quote with multiple line items - save - reload - verify ALL persist | Partial save, some fields lost | P0 |
| H3 | Quote - apply discount (percentage) - verify discounted total | Discount math wrong | P1 |
| H4 | Quote - change tax rate - verify all items reflect new rate | Tax only applies to some items | P1 |
| H5 | Quote - exceed Starter plan quote limit - verify paywall | Quota not enforced | P1 |

### I. Takeoff Persistence (from Phase 3 plan, still untested)

| # | Test | What it catches | Priority |
|---|------|-----------------|----------|
| I1 | Save takeoff - reload - verify all areas, measurements, components persist | Takeoff save is partial (known bug pattern) | P0 |
| I2 | Switch between multiple pages - verify each page keeps its own areas | Page switching corrupts or loses areas | P0 |
| I3 | Add pitch to area - verify pitched area calculation correct | Pitch math wrong | P1 |
| I4 | Delete roof area - verify its components also removed | Orphaned components left behind | P1 |

---

## Summary

| Category | Tests | P0 | P1 | P2 |
|----------|-------|----|----|----|
| A. Supplier Component System | 10 | 4 | 5 | 1 |
| B. Add from Catalog Modal | 6 | 4 | 2 | 0 |
| C. AI Takeoff V3 | 8 | 4 | 4 | 0 |
| D. Component Library Management | 6 | 2 | 2 | 2 |
| E. Inbox/Notifications | 4 | 0 | 2 | 2 |
| F. Free Roof Takeoff Builder | 5 | 2 | 3 | 0 |
| G. Column Mapping Edge Cases | 5 | 3 | 2 | 0 |
| H. Quote Builder | 5 | 2 | 3 | 0 |
| I. Takeoff Persistence | 4 | 2 | 2 | 0 |
| **Total** | **53** | **23** | **25** | **5** |

---

## What I want Gerald to review

1. **Gap analysis** - What features or edge cases am I missing? Are there user flows that could break but aren't covered above?
2. **Priority calibration** - Are the P0/P1/P2 assignments correct? Should anything be re-prioritised?
3. **Testability** - Can each test actually be automated in Playwright? Are any too fragile or flaky?
4. **Ordering** - What should we build first? I'm thinking P0 tests across all categories, then P1, then P2.
5. **Missing categories** - Should we add tests for:
   - Stripe billing flows (subscription create/upgrade/cancel)?
   - RLS/security (cross-company data isolation)?
   - PDF generation correctness?
   - Email sending?
   - Performance/load?
6. **AI takeoff testing** - Real AI scans cost ~$0.20-0.25 each. Should we mock the OpenAI responses, or use a small budget for real integration tests?
7. **Multi-tenant isolation** - Should we test that company A literally cannot see company B's data (quotes, components, catalogs)?

---

## Technical context for Gerald

- **Test framework:** Playwright with TypeScript
- **Test accounts:** Configured in `e2e/config/accounts.ts` (Starter + Professional tiers)
- **Page objects:** `e2e/pages/` (login, quotes, quote-builder, takeoff)
- **Fixtures:** `e2e/fixtures/` (auth, base, evidence, run-context)
- **Test data:** `e2e/test-data/` (roof plan sample image)
- **Local run:** `npx playwright test` (needs dev server on localhost:3000)
- **CI:** Not yet configured - tests run locally for now

### Concurrency considerations for tests
- Catalog row reads are read-only during selection (no locking needed)
- Component creation is batch insert (atomic)
- Two users importing from same catalog simultaneously = no conflict (separate component_library rows)
- AI scan jobs use idempotency keys to prevent double-charge on retry
- Takeoff saves use page-scoped deletes to avoid cross-page interference
