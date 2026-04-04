-- =====================================================================
-- SCHEMA SNAPSHOT: 2026-04-04 12:05 GMT+1
-- TAG: v2-templates-complete
-- COMMIT: 79db42b
-- 
-- This snapshot represents the database state BEFORE Digital Takeoff work.
-- Safe restore point for Template System completion.
-- =====================================================================

-- Applied Patches (in order):
-- ✅ quotecore_v2_schema.sql (base schema)
-- ✅ quotecore_v2_patch_008.sql (quote numbering)
-- ✅ quotecore_v2_patch_009.sql (quote management: delete, search, tabs)
-- ✅ quotecore_v2_patch_009_fix.sql (show_price column)
-- ✅ quotecore_v2_patch_010.sql (starter customer quote template)
-- ✅ quotecore_v2_patch_011.sql (component library display defaults)
-- ✅ quotecore_v2_patch_012.sql (quote branding columns)
-- ✅ quotecore_v2_patch_014_currency.sql (multi-currency support)
-- ✅ quotecore_v2_patch_015_onboarding.sql (company onboarding)
-- ✅ quotecore_v2_patch_016_storage.sql (file storage system)
-- ✅ quotecore_v2_patch_017_template_fields.sql (template customer_template_id + notes)

-- =====================================================================
-- KEY SCHEMA ELEMENTS (as of this snapshot)
-- =====================================================================

-- COMPANIES TABLE
-- - default_currency (text, default 'NZD')
-- - default_language (text, default 'en')
-- - default_measurement_system (measurement_system, default 'metric')
-- - default_tax_rate (numeric)
-- - onboarding_completed_at (timestamptz, NULL = needs onboarding)
-- - storage_used_bytes (bigint, default 0)
-- - storage_limit_bytes (bigint, default 1GB)

-- QUOTES TABLE
-- - quote_number (integer, auto-incrementing per company)
-- - status (quote_status: draft, confirmed, sent, accepted, declined, expired, archived)
-- - currency (text, nullable, defaults to company.default_currency)
-- - measurement_system (measurement_system: metric or imperial)
-- - Branding columns:
--   - cq_company_name (text)
--   - cq_company_address (text)
--   - cq_company_phone (text)
--   - cq_company_email (text)
--   - cq_company_logo_url (text)
--   - cq_footer_text (text)

-- TEMPLATES TABLE
-- - name (text, required)
-- - description (text)
-- - roofing_profile (text)
-- - customer_template_id (uuid, nullable, references customer_quote_templates)
-- - notes (text)
-- - is_active (boolean, default true)

-- TEMPLATE_ROOF_AREAS TABLE
-- - template_id (uuid, references templates)
-- - label (text)
-- - default_input_mode (input_mode: final or calculated)
-- - sort_order (integer)

-- TEMPLATE_COMPONENTS TABLE
-- - template_id (uuid, references templates)
-- - template_roof_area_id (uuid, nullable, references template_roof_areas)
-- - component_library_id (uuid, references component_library)
-- - component_type (component_type: main or extra)
-- - is_included_by_default (boolean)
-- - sort_order (integer)
-- - Override fields: material_rate, labour_rate, waste_type, waste_percent, waste_fixed, pitch_type

-- CUSTOMER_QUOTE_TEMPLATES TABLE
-- - name (text)
-- - is_starter_template (boolean, default false)
-- - company_name (text)
-- - company_address (text)
-- - company_phone (text)
-- - company_email (text)
-- - company_logo_url (text) -- Separate from company account logo
-- - footer_text (text)

-- COMPONENT_LIBRARY TABLE
-- - name (text)
-- - component_type (component_type: main or extra)
-- - measurement_type (measurement_type: area, lineal, quantity, fixed)
-- - show_price_default (boolean, default true)
-- - show_dimensions_default (boolean, default true)
-- - default_material_rate (numeric)
-- - default_labour_rate (numeric)
-- - default_waste_type (waste_type: percent, fixed, none)
-- - default_pitch_type (pitch_type: none, rafter, valley_hip)

-- CUSTOMER_QUOTE_LINES TABLE
-- - quote_id (uuid, references quotes)
-- - line_type (line_type: component, custom, roof_area_header)
-- - component_id (uuid, nullable)
-- - text (text)
-- - amount (numeric)
-- - show_price (boolean, default true)
-- - show_dimensions (boolean, default true)
-- - is_visible (boolean, default true)
-- - sort_order (integer)

-- QUOTE_FILES TABLE
-- - quote_id (uuid, references quotes)
-- - company_id (uuid, references companies)
-- - file_type (text: roof_plan, supporting_image, supporting_document)
-- - file_path (text) -- Path in Supabase Storage
-- - file_size_bytes (bigint)
-- - uploaded_at (timestamptz)

-- =====================================================================
-- STORAGE BUCKETS (created manually in Supabase)
-- =====================================================================

-- Bucket: company-logos (lowercase!)
-- - Public: YES
-- - Max size: 2MB
-- - Allowed types: image/jpeg, image/png, image/webp
-- - Paths:
--   - {company_id}/logo.{ext} (account default logo)
--   - {company_id}/template-{template_id}-logo.{ext} (customer template logos)

-- Bucket: quote-documents (lowercase!)
-- - Public: YES (changed from private to avoid metadata issues)
-- - Max size: 10MB
-- - Allowed types: image/*, application/pdf
-- - Paths:
--   - {company_id}/{quote_id}/plan-{timestamp}.{ext} (roof plans)
--   - {company_id}/{quote_id}/support-{timestamp}.{ext} (supporting files)

-- =====================================================================
-- ENUMS
-- =====================================================================

-- measurement_system: 'metric' | 'imperial'
-- quote_status: 'draft' | 'confirmed' | 'sent' | 'accepted' | 'declined' | 'expired' | 'archived'
-- component_type: 'main' | 'extra'
-- measurement_type: 'area' | 'lineal' | 'quantity' | 'fixed'
-- input_mode: 'final' | 'calculated'
-- waste_type: 'percent' | 'fixed' | 'none'
-- pitch_type: 'none' | 'rafter' | 'valley_hip'
-- line_type: 'component' | 'custom' | 'roof_area_header'

-- =====================================================================
-- KEY CONSTRAINTS & FEATURES
-- =====================================================================

-- 1. Quote numbering: Auto-incrementing per company (quote_number_seq trigger)
-- 2. Currency: Display-only (stored as ISO 4217 codes, no conversion)
-- 3. Measurement: Database stores METRIC, converts for display
-- 4. Onboarding: Required for new companies (onboarding_completed_at NULL check)
-- 5. File storage: 1GB default quota per company, tracked via storage_used_bytes
-- 6. Templates: Supports customer_template_id for default branding
-- 7. Customer templates: Can have separate logo from account default

-- =====================================================================
-- RESTORE INSTRUCTIONS
-- =====================================================================

-- This is a REFERENCE snapshot, not a full database dump.
-- 
-- To restore to this state:
-- 1. git checkout v2-templates-complete
-- 2. Apply all patches listed above in order (if starting fresh)
-- 3. Verify storage buckets exist: company-logos, quote-documents
-- 4. Run seed data if needed (starter customer template)
--
-- For data recovery from production:
-- 1. Use Supabase dashboard: Database > Backups
-- 2. Or run: pg_dump with --schema-only flag for structure
--
-- =====================================================================
-- END OF SNAPSHOT
-- =====================================================================
