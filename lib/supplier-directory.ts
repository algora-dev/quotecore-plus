import { supabase } from "@/lib/supabase";

/**
 * Public supplier data layer.
 * Uses the SECURITY DEFINER RPCs created in migration 20260804203000.
 * These functions strip disallowed fields server-side ÔÇö hidden prices
 * and contacts cannot leak through this layer.
 */

export interface SupplierDirectoryEntry {
  id: string;
  slug: string;
  supplier_name: string;
  description: string | null;
  logo_url: string | null;
  service_areas: string[] | null;
  roofing_types: string[] | null;
  product_categories: string[] | null;
  brands: string[] | null;
  branch_city: string | null;
  branch_region: string | null;
  branch_country: string | null;
  national_coverage: boolean | null;
  currency: string | null;
  takeoff_builder_enabled: boolean | null;
  calculator_available: boolean;
}

export interface SupplierLibraryInfo {
  collection_id: string;
  name: string | null;
  description: string | null;
  published_version: number | null;
  published_at: string | null;
  roofing_types: string[] | null;
  product_categories: string[] | null;
  brands: string[] | null;
}

export interface SupplierEligibility {
  directory_visible: boolean;
  page_visible: boolean;
  indexable: boolean;
  calculator_available: boolean;
  prices_on_page: boolean;
  prices_via_api: boolean;
  contacts_visible: boolean;
}

export interface SupplierDetail {
  supplier: {
    id: string;
    slug: string;
    supplier_name: string;
    description: string | null;
    logo_url: string | null;
    website_url: string | null;
    contact_email: string | null;
    phone_number: string | null;
    enquiry_email: string | null;
    service_areas: string[] | null;
    roofing_types: string[] | null;
    product_categories: string[] | null;
    brands: string[] | null;
    branch_city: string | null;
    branch_region: string | null;
    branch_country: string | null;
    branch_postcode: string | null;
    national_coverage: boolean | null;
    delivery_coverage: string[] | null;
    freight_available: boolean | null;
    pickup_available: boolean | null;
    currency: string | null;
    tax_treatment: string | null;
    tax_name: string | null;
    tax_rate: number | null;
    delivery_assumptions: string | null;
    exclusions: string | null;
    instant_pricing_available: boolean | null;
    pricing_updated_at: string | null;
    price_valid_until: string | null;
    price_type: string | null;
    takeoff_builder_enabled: boolean | null;
    brand_primary_color: string | null;
    brand_accent_color: string | null;
    banner_url: string | null;
    price_list_url: string | null;
    price_list_filename: string | null;
    price_list_uploaded_at: string | null;
    price_list_content_type: string | null;
    price_list_includes_tax: boolean | null;
    takeoff_library_includes_tax: boolean | null;
    branch_latitude: number | null;
    branch_longitude: number | null;
    opening_hours: unknown | null;
    price_range: string | null;
    publication_state: string;
    public_price_visibility: string;
    public_contact_visibility: string;
    public_catalogue_enabled: boolean;
    search_indexing_enabled: boolean;
    publication_updated_at: string | null;
  };
  eligibility: SupplierEligibility;
  library: SupplierLibraryInfo | null;
}

/**
 * Fetch all published suppliers for the public directory.
 * Returns empty array if RPC fails or no suppliers published.
 */
export async function getSupplierDirectory(): Promise<SupplierDirectoryEntry[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("public_supplier_directory");

  if (error || !data) {
    console.error("[supplier-directory] Failed to fetch directory:", error?.message);
    return [];
  }

  return (data as unknown) as SupplierDirectoryEntry[];
}

/**
 * Fetch a single supplier's public read model by slug.
 * Returns null if supplier not found, not approved, or not published/unlisted.
 */
export async function getPublicSupplier(slug: string): Promise<SupplierDetail | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("public_supplier_read", { p_slug: slug });

  if (error || !data) {
    console.error(`[supplier-directory] Failed to fetch supplier "${slug}":`, error?.message);
    return null;
  }

  return (data as unknown) as SupplierDetail;
}
