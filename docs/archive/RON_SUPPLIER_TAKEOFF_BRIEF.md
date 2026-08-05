# Ron Handoff Brief: Supplier Takeoff Builder Integration

**From:** Gavin  
**Date:** 2026-08-04  
**Commit:** `07963de5` on `main`  
**Status:** Supplier dashboard tab shipped. Ron needs to wire up the free-tools side.

---

## What I Built

### 1. Supplier Dashboard - New "Takeoff Builder" Tab

File: `app/(auth)/[workspaceSlug]/supplier/SupplierDashboard.tsx`

Three tabs now exist in the supplier dashboard:
1. **Component Libraries** (existing - unchanged)
2. **Catalogues** (existing - unchanged)
3. **Takeoff Builder** (NEW)

The Takeoff Builder tab gives suppliers:
- **Opt-in toggle** - `takeoff_builder_enabled` on `supplier_profiles` (default: false)
- **Component library selector** - picks which `component_collections` row powers their builder
- **Enquiry email + enquiries enabled toggle**
- **Instant pricing toggle**
- **Auto-generated branded URL** displayed with copy button: `https://quote-core.com/free-roofing-takeoff-builder/{slug}`

The URL is derived from the supplier's `slug` field on `supplier_profiles`. It's shown as soon as they enable the builder - no admin involvement needed.

### 2. Server Action

File: `app/(auth)/[workspaceSlug]/supplier/actions.ts`

`updateTakeoffBuilderSettings(input)` - supplier-side server action that:
- Toggles `takeoff_builder_enabled`
- Sets `default_takeoff_collection_id` (validates ownership)
- Updates enquiry email, enquiries enabled, instant pricing
- Updates `is_default_takeoff_library` flag on `component_collections`
- Only works for approved suppliers

### 3. Admin Panel - Stripped Back

File: `app/admin/(dashboard)/suppliers/SuppliersPanel.tsx`

Removed: create supplier form, edit supplier form, user search, collection management, all editing controls.

Kept: searchable list, approve/suspend/revoke, read-only builder URL display, status badges.

Suppliers now manage their own details. Admin uses user impersonation to edit on their behalf.

### 4. Migration

File: `backend/supabase/migrations/20260804160000_supplier_takeoff_builder_enabled.sql`

```sql
ALTER TABLE supplier_profiles
  ADD COLUMN IF NOT EXISTS takeoff_builder_enabled boolean NOT NULL DEFAULT false;
```

Applied to live DB. Types regenerated.

---

## What Ron Needs To Do

### The Route Already Exists

The dynamic route at `app/(public)/free-roofing-takeoff-builder/[supplierSlug]/page.tsx` already works. It renders `RoofTakeoffBuilder` with `initialSupplierSlug` set. When a supplier enables the builder from their dashboard and shares their URL, visitors land on this page.

### Ron's Tasks

1. **Verify the supplier slug route loads the correct component library.** The route currently passes `supplierSlug` to `RoofTakeoffBuilder`. Check that `RoofTakeoffBuilder` (or the `supplier-context.tsx` / `public-contract.ts` files) correctly:
   - Looks up `supplier_profiles` by `slug` WHERE `takeoff_builder_enabled = true`
   - Loads the `default_takeoff_collection_id` library
   - Falls back gracefully if the supplier hasn't selected a library

2. **Gate the route on `takeoff_builder_enabled`.** If a supplier has NOT enabled the builder, their `/free-roofing-takeoff-builder/{slug}` URL should show a generic builder (no supplier branding) or redirect to the main builder page. Don't expose supplier-specific data if they haven't opted in.

3. **Supplier branding on the builder page.** The builder should show the supplier's name (and optionally logo, brand colors) when a valid enabled supplier slug is in the URL. The `supplier_profiles` table has `brand_primary_color` and `brand_accent_color` columns available.

4. **Enquiry flow.** When `enquiries_enabled = true` on the supplier profile, the builder should show an enquiry CTA that sends to `enquiry_email`. The existing `SupplierEnquiryForm` component may already handle this - verify it reads from the right fields.

5. **Free Roof Takeoff Builder admin tab.** The admin panel at `/admin/roof-components` manages roof component definitions. If suppliers need their own component management within the builder context, that's Ron's domain now.

---

## Schema Reference

Key columns on `supplier_profiles` for the takeoff builder:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `slug` | text | (from supplier_name) | URL slug for builder route |
| `takeoff_builder_enabled` | boolean | false | Opt-in flag |
| `default_takeoff_collection_id` | uuid | null | Which component library to use |
| `enquiry_email` | text | null | Where enquiries go |
| `enquiries_enabled` | boolean | false | Whether to show enquiry CTA |
| `instant_pricing_available` | boolean | false | Show real-time prices |
| `allow_custom_pricing` | boolean | false | Users can enter own prices |
| `brand_primary_color` | text | null | For branded builder page |
| `brand_accent_color` | text | null | For branded builder page |
| `currency` | text | 'NZD' | Display currency |
| `branch_city`, `branch_region`, `branch_country` | text | null | Location info |

The `component_collections` table has `is_default_takeoff_library` boolean - this is set to true on the collection the supplier selected as their takeoff default.

---

## Cross-Domain Rules

- **Schema changes:** Ron writes the SQL, gives it to Gavin (or Shaun coordinates) to apply. Ron does NOT create migrations directly.
- **Deploy pipeline:** Ron pushes to `development` like everyone else. Gavin owns Vercel project config.
- **Bugs in the core app that touch supplier data** (RLS policies, FK constraints, pricing integration): still Gavin's domain.
- **Supplier-facing UI, flows, and API endpoints in the free tools layer:** Ron's domain.

---

## Questions? 

Ping Shaun or Gavin. The schema is the integration contract - if Ron needs new columns or tables, that goes through Gavin.
