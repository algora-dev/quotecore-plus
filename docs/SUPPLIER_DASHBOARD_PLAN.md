# Supplier Dashboard Enhancement Plan

**Created:** 2026-08-05
**Owner:** Ron (frontend/dashboard) + Gavin (DB migration + RPC)
**Status:** Planning

## Problem

The supplier dashboard currently has:
- An Edit Profile form with basic fields (website, email, phone, description, service areas, roofing types, custom pricing toggle)
- Visibility/publication toggle controls (the "Public Presence" tab)
- Component library and catalogue management
- Takeoff builder settings

**Missing:** Logo upload, banner upload, location fields (country/city/region ÔÇö exist in DB but not in the form), price list file upload (PDF/CSV), and a "Your Links" quick-copy section. The supplier cannot fully build their own public page from the dashboard.

## What We're Building

### 1. Expand Edit Profile Form (Ron)

Add the following fields to the existing Edit Profile section in `SupplierDashboard.tsx`:

| Field | DB Column | Type | Notes |
|-------|-----------|------|-------|
| Logo upload | `logo_url` | File upload (image) | Already in DB, just needs UI. Supabase Storage bucket: `supplier-assets` |
| Banner upload | `banner_url` (NEW) | File upload (image) | Needs new DB column. Recommended size: 1600├ù400px, max 2MB, JPG/PNG/WebP |
| Country | `branch_country` | Select dropdown | Already in DB. Pre-populated country list |
| City | `branch_city` | Text input | Already in DB |
| Region/State | `branch_region` | Text input | Already in DB |
| Postcode | `branch_postcode` | Text input | Already in DB (optional) |

The existing fields stay: website URL, contact email, phone number, description, service areas, roofing types, custom pricing toggle.

### 2. Banner Image Spec (Ron)

- **Recommended dimensions:** 1600├ù400px (4:1 aspect ratio)
- **Max file size:** 2MB
- **Accepted formats:** JPG, PNG, WebP
- **Display:** Hero banner on the public supplier page, positioned above the supplier name/logo area. Falls back gracefully if no banner uploaded.
- **DB column:** `banner_url` (text, nullable) on `supplier_profiles`

### 3. Price List File Upload (Ron + Gavin)

Supplier uploads a PDF or CSV of their full price list. This is displayed as a downloadable file on their public supplier page.

**Dashboard side (Ron):**
- Upload UI in the Edit Profile area (or a dedicated "Price List" card)
- Accepted formats: PDF, CSV
- Max file size: 10MB
- Shows current file name + upload date + "Replace" button
- "Remove" option

**Public page side (Ron):**
- New section on `/suppliers/[slug]`: "Download Price List"
- Shows file name, upload date, and a download button
- Only visible when `price_list_url` is set and supplier has enabled public catalogue

**DB columns needed (Gavin):**
- `price_list_url` (text, nullable) ÔÇö storage path or URL
- `price_list_filename` (text, nullable) ÔÇö original filename for display
- `price_list_uploaded_at` (timestamptz, nullable) ÔÇö last upload timestamp
- `price_list_content_type` (text, nullable) ÔÇö mime type for download headers

**Storage:** Supabase Storage bucket `supplier-assets`. If Storage 403s (known issue on some projects), fallback to storing as a base64 blob in a separate `supplier_files` table.

### 4. "Your Links" Section (Ron)

A card at the top of the supplier dashboard (above the Edit Profile card) showing:

- **Supplier Page URL:** `https://quote-core.com/suppliers/{slug}` (with copy button)
- **Takeoff Builder URL:** `https://quote-core.com/free-roofing-takeoff-builder/{slug}` (with copy button, shown when takeoff builder is enabled)

Each URL has a copy-to-clipboard button. Card is always visible when profile exists, regardless of publication state. If profile is not yet published, show a note: "Page is not yet published ÔÇö URL will work when you publish."

### 5. Public Supplier Page Updates (Ron)

Update `app/(marketing)/suppliers/[slug]/page.tsx` and `lib/supplier-directory.ts`:

- Render banner image as hero (if `banner_url` set)
- Logo already renders ÔÇö keep as is
- Add "Download Price List" section (if `price_list_url` set and catalogue is public)
- Ensure all new fields flow through the `public_supplier_read` RPC

## DB Migration Required (Gavin)

```sql
-- Add banner and price list columns to supplier_profiles
ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS price_list_url text,
  ADD COLUMN IF NOT EXISTS price_list_filename text,
  ADD COLUMN IF NOT EXISTS price_list_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_list_content_type text;

-- Update the public_supplier_read RPC to include new fields
-- Add banner_url, price_list_url, price_list_filename, price_list_uploaded_at, price_list_content_type
-- to the SELECT in the RPC function
```

**Note:** The RPC `public_supplier_read` is a SECURITY DEFINER function. Gavin needs to:
1. Add the new columns to the SELECT statement inside the RPC
2. Ensure the price_list_url field respects `public_catalogue_enabled` and `public_price_visibility` settings (don't expose the price list file if the supplier has disabled catalogue visibility)
3. Run `supabase gen types typescript` to regenerate `database.types.ts`

## File Upload Architecture

```
Supplier Dashboard
  ÔåÆ POST /api/supplier-upload (new API route, Ron builds)
    ÔåÆ Validates file type + size
    ÔåÆ Uploads to Supabase Storage bucket "supplier-assets"
    ÔåÆ Returns public URL
  ÔåÆ Dashboard saves URL to supplier_profiles via updateSupplierProfile action
```

**Bucket setup (Gavin or Ron with admin client):**
- Bucket name: `supplier-assets`
- Public: true (logos and banners need to be publicly viewable)
- File size limit: 10MB
- Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf, text/csv

**RLS policies:**
- SELECT: public (anyone can read ÔÇö these are public marketing assets)
- INSERT/UPDATE/DELETE: supplier can only manage their own company's assets (match on company_id via supplier_profiles join)

## Implementation Order

1. **Gavin:** Apply DB migration (add columns + update RPC + regen types)
2. **Ron:** Create storage bucket + upload API route
3. **Ron:** Build "Your Links" section (quick win, no deps)
4. **Ron:** Expand Edit Profile form (logo, banner, location fields)
5. **Ron:** Price list upload UI in dashboard
6. **Ron:** Update public supplier page (banner, price list download)
7. **Test:** Shaun tests full flow as RS Roofing supplier account
8. **Deploy:** Push to development ÔåÆ Shaun reviews ÔåÆ merge to main

## What's NOT in This Plan

- **Keywords** ÔÇö dropped per Shaun's decision (the existing roofing_types toggle chips are sufficient for now)
- **Business name editing** ÔÇö stays admin-only (supplier name is set during profile creation by admin)
- **Multi-file price lists** ÔÇö single file for now. Can expand to multiple files later if needed.
