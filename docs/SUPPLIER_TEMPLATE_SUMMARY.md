# Supplier Page Template — Implementation Summary

## What Was Built (5 Phases, 16 Files, ~2,600 lines)

### Phase 1: Catalogue Routes + Metadata Migration
- **Migration `20260808120000`:** Added `valid_from`, `valid_until`, `default_currency`, `uploaded_by`, `original_filename`, `catalogue_status` to `catalogs` table; `address_visibility`, `business_registration_number`, `verification_link` to `supplier_profiles`. Two public SECURITY DEFINER RPCs: `public_supplier_catalogue(slug, limit, offset)` and `public_supplier_catalogue_count(slug)`.
- **HTML catalogue page** (`/suppliers/{slug}/catalogue`): Server-rendered table, 50 rows/page, search via query params, sortable columns, pagination. BreadcrumbList + Dataset + DataDownload JSON-LD.
- **CSV route** (`/suppliers/{slug}/catalogue.csv`): redirects (301) to the HTML catalogue page; versioned downloads live at `/suppliers/{slug}/catalogues/{version}/catalogue.csv`.
- **JSON route** (`/suppliers/{slug}/catalogue.json`): redirects (301) to the HTML catalogue page; versioned downloads live at `/suppliers/{slug}/catalogues/{version}/catalogue.json`.

### Phase 2: Trust Panel + Page Layout Reorder
- Supplier page restructured to 11 sections per brief Section 14:
  1. Header (logo, name, location, verified badge)
  2. Trust panel (catalogue version, dates, currency, pricing notice)
  3. Calculator CTA
  4. Catalogue status (version, currency, dates, tax treatment)
  5. Business description
  6. Product types (roofing types, categories, brands)
  7. Catalogue link + 8. CSV/JSON downloads
  9. Service & delivery areas
  10. Address + contact
  11. Version history (when >1 version exists)

### Phase 3: Structured Data + Placeholder Validation
- **WebApplication JSON-LD** on supplier page (calculator)
- **ItemList + Product/Offer schema** on catalogue page (capped at 20 items)
- **`lib/supplier-validation.ts`:** Placeholder contact detection (test@, example@, 000000000, etc.) + catalogue row validation (missing names, invalid prices, duplicate codes, negative prices)
- **Expanded `checkPublicationReadiness`:** Now checks placeholder contacts, catalogue publication status, catalogue expiry, row-level data quality

### Phase 4: Dashboard Validation + Address Visibility + Delivery Areas
- **Address visibility** radio: Show full / City + country only / Hide (service-area business)
- **Delivery notes** + **Exclusions** + **National coverage** checkbox in Edit Profile
- Public supplier page respects `address_visibility` in both visible HTML and LocalBusiness JSON-LD schema
- Readiness checklist UI improved (detail on separate line, amber for warnings)

### Phase 5: Versioned Catalogue URLs + Permanent Calculation URLs
- **Migration `20260808150000`:** `public_supplier_catalogue_versions(slug)` + `public_supplier_catalogue_by_version(slug, version, limit, offset)`
- **Versioned routes:** `/suppliers/{slug}/catalogues/{version}` (HTML), `.csv`, `.json`
- **Version history table** on supplier page (appears when >1 version)
- **Sitemap:** Versioned URLs added (yearly, lower priority)
- **Permanent calculation URLs:** Already existed via HMAC-signed result tokens + immutable snapshots

## Migrations Applied to Live Database
Both migrations applied via Supabase Management API:
1. `20260808120000_supplier_catalogue_metadata.sql` ✅
2. `20260808150000_supplier_catalogue_versions.sql` ✅

## Branches
- `development`: All 5 phases + migration fixes (commit `c250baf5`)
- `main`: Merged from development (fast-forward, `601108d6..c250baf5`)
- Vercel production deploy triggered automatically

## Architecture Notes
- All catalogue data comes from one canonical source: the `catalogs` + `catalog_rows` tables in Supabase
- HTML catalogue rows are server-rendered (in HTML, not JS-only) for SEO crawlers
- All routes are `force-dynamic` (supplier data changes frequently)
- `SECURITY DEFINER` RPCs ensure only published/approved supplier data is exposed publicly
- No hard-coding to any country, industry, currency, or measurement system
- Column aliasing maps existing CSV headers (sku, name, cost) to canonical names (supplier_product_code, product_name, price)

## Deferred
- Banner image warping fix
- 28 test cases (Section 17 of brief)
