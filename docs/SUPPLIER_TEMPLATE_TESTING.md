# Supplier Page Template — Testing Checklist

## Prerequisites
- Deploy must be live on quote-core.com (check Vercel dashboard for build completion)
- At least one published supplier with a catalogue (e.g. RS Roofing or a dummy supplier)

## 1. Supplier Directory
- [ ] Visit `quote-core.com/suppliers` — directory loads, supplier cards visible
- [ ] Click a supplier — lands on `/suppliers/{slug}`

## 2. Supplier Page Layout (Phase 2)
- [ ] Header shows: logo, supplier name, location, "Verified supplier" badge
- [ ] Trust panel visible with "Supplier-managed page" text
- [ ] Catalogue status section shows version, currency, dates (if catalogue exists)
- [ ] Business description section visible
- [ ] Product types section (roofing types, categories, brands) — if set
- [ ] "Product catalogue" card with "View catalogue" button + CSV/JSON download links
- [ ] Takeoff library section (if supplier has one)
- [ ] Service & delivery areas section
- [ ] Address + Contact section (two columns)
- [ ] "Platform: QuoteCore+" footer text in contact card

## 3. Catalogue HTML Page (Phase 1)
- [ ] Visit `quote-core.com/suppliers/{slug}/catalogue` — table loads with product rows
- [ ] Rows are in HTML source (View Source, not just JS-rendered)
- [ ] Search bar works — type a product name, results filter
- [ ] Sort by clicking column headers — URL changes, rows re-order
- [ ] Pagination works (if >50 products) — Previous/Next buttons
- [ ] Breadcrumb shows: Suppliers > {Name} > Catalogue
- [ ] Pricing notice visible: "Pricing is indicative..."

## 4. Catalogue CSV Download (Phase 1)
- [ ] Click "Download CSV" or visit `/suppliers/{slug}/catalogue.csv`
- [ ] File downloads with correct filename: `{supplier-name}-catalogue-v{version}-{date}.csv`
- [ ] File opens in Excel/Sheets with proper columns
- [ ] UTF-8 BOM present (accented characters display correctly)

## 5. Catalogue JSON Download (Phase 1)
- [ ] Click "Download JSON" or visit `/suppliers/{slug}/catalogue.json`
- [ ] Returns valid JSON with `supplier`, `catalogue`, `items` structure
- [ ] Each item has `supplier_product_code`, `product_name`, `price` (or aliases mapped)
- [ ] Unknown columns appear in `additional_attributes`

## 6. Structured Data (Phase 3)
- [ ] On supplier page: View Source, find `application/ld+json` scripts
- [ ] LocalBusiness schema present with name, address, telephone
- [ ] BreadcrumbList schema present
- [ ] WebApplication schema present (for calculator)
- [ ] On catalogue page: Dataset + DataDownload schema present
- [ ] On catalogue page: ItemList with Product/Offer schema (up to 20 items)

## 7. Dashboard — Edit Profile (Phase 4)
- [ ] Log in as a supplier, go to Supplier Dashboard
- [ ] Edit Profile tab: Address Visibility radio (3 options) visible
- [ ] Delivery notes field visible
- [ ] Exclusions field visible
- [ ] National coverage checkbox visible
- [ ] Save profile — all 4 new fields persist after page reload

## 8. Address Visibility (Phase 4)
- [ ] Set to "Show full address" → public page shows full address (city, region, postcode, country)
- [ ] Set to "City and country only" → public page shows only city + country
- [ ] Set to "Hide address" → public page shows "Address not publicly available"
- [ ] Check LocalBusiness schema in View Source — address fields match visibility setting

## 9. Dashboard — Publication Readiness (Phase 3+4)
- [ ] Publication Readiness checklist shows all checks
- [ ] Each check has green checkmark (✓) or red X with detail message
- [ ] Detail messages appear on separate line (not inline)
- [ ] Warning items (e.g. "expiring in 30 days") show in amber
- [ ] Click "Re-check" button — checklist refreshes

## 10. Placeholder Validation (Phase 3)
- [ ] Set contact email to `test@example.com` → readiness check fails with "looks like a placeholder"
- [ ] Set phone to `0000000000` → readiness check fails
- [ ] Set supplier name to `Test Supplier` → readiness check fails
- [ ] Fix all placeholders → readiness checks pass

## 11. Versioned Catalogue URLs (Phase 5)
- [ ] If supplier has multiple catalogue versions, version history table appears on supplier page
- [ ] Click a version number → lands on `/suppliers/{slug}/catalogues/{version}`
- [ ] Amber banner shows "This is version X (historical)" when not latest
- [ ] "Back to latest catalogue" link works
- [ ] Versioned CSV: `/suppliers/{slug}/catalogues/{version}/catalogue.csv` downloads
- [ ] Versioned JSON: `/suppliers/{slug}/catalogues/{version}/catalogue.json` returns data
- [ ] If only one version exists, version history table is hidden

## 12. Sitemap (Phase 1+5)
- [ ] Visit `quote-core.com/sitemap.xml` — supplier catalogue URLs present
- [ ] Versioned catalogue URLs present (if multiple versions exist)
- [ ] CSV and JSON routes in sitemap

## 13. Permanent Calculation URLs (existing)
- [ ] Use the roof takeoff builder, calculate a result
- [ ] Copy the result URL — it should be a permanent `/free-roofing-takeoff-builder/result/{token}` URL
- [ ] Reload the URL — same result loads (immutable snapshot)
- [ ] Share the URL in an incognito window — loads without auth

## 14. 404 / Edge Cases
- [ ] Visit `/suppliers/nonexistent-slug` — 404 page
- [ ] Visit `/suppliers/{slug}/catalogue` for supplier without catalogue — "No published catalogue" message
- [ ] Visit `/suppliers/{slug}/catalogues/999` (non-existent version) — 404
- [ ] Visit `/suppliers/{slug}/catalogues/abc` (invalid version) — 404
