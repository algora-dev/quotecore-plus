# Gavin: Supplier Dashboard DB Migration Required

**Date:** 2026-08-05
**From:** Ron
**Priority:** Blocking ÔÇö can't build the UI until the DB columns exist and types are regen'd

## What I Need You To Do

### 1. Add new columns to `supplier_profiles`

```sql
ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS price_list_url text,
  ADD COLUMN IF NOT EXISTS price_list_filename text,
  ADD COLUMN IF NOT EXISTS price_list_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_list_content_type text;
```

These are all nullable ÔÇö no default values needed. Existing suppliers just have nulls.

### 2. Update the `public_supplier_read` RPC

The RPC needs to return the new columns so the public supplier page can render them. Add these fields to the SELECT inside the function:

- `banner_url`
- `price_list_url`
- `price_list_filename`
- `price_list_uploaded_at`
- `price_list_content_type`

**Important ÔÇö price list visibility:** The `price_list_url`, `price_list_filename`, `price_list_uploaded_at`, and `price_list_content_type` fields should only be returned when:
- `public_catalogue_enabled = true` AND
- `publication_state IN ('published', 'unlisted')`

If catalogue is disabled, return nulls for the price list fields (same pattern as how pricing visibility works). Banner URL can always be returned when the page is visible.

### 3. Create Supabase Storage bucket

Bucket name: `supplier-assets`
- Public bucket: yes (logos, banners, and price lists need public read access for the marketing site)
- File size limit: 10MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `text/csv`

RLS policies:
```sql
-- Public can read
CREATE POLICY "supplier-assets-public-read"
ON storage.objects FOR SELECT
USING (bucket_id = 'supplier-assets');

-- Authenticated suppliers can upload to their own path
-- Path format: {company_id}/{filename}
CREATE POLICY "supplier-assets-upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'supplier-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM users WHERE id = auth.uid()
  )
);

-- Suppliers can update/delete their own files
CREATE POLICY "supplier-assets-update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'supplier-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "supplier-assets-delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'supplier-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM users WHERE id = auth.uid()
  )
);
```

### 4. Regenerate TypeScript types

After applying the migration:
```bash
npx supabase gen types typescript --project-id aaavvfttkesdzblttmby > app/lib/supabase/database.types.ts
```

This gives me the typed columns so I can build the UI without `any` casts.

## Why

Shaun wants suppliers to be able to fully build their own public page from the dashboard: logo, banner, location, contact details, description, and a downloadable price list file (PDF/CSV). The public supplier page already renders most of this ÔÇö we just need the new columns for banner and price list, plus the storage bucket for file uploads.

## Timeline

This is blocking my build work. Once you've applied the migration and regen'd types, ping me and I'll start on the UI immediately.

Full plan doc: `docs/SUPPLIER_DASHBOARD_PLAN.md`
