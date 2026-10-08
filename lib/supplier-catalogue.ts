import { supabase } from "@/lib/supabase";

/**
 * Public supplier catalogue data layer.
 * Uses SECURITY DEFINER RPCs to fetch published catalogue data.
 */

export interface CatalogueItem {
  row_index: number;
  raw_row: Record<string, string>;
}

export interface SupplierCatalogueData {
  supplier: {
    id: string;
    slug: string;
    name: string;
    verification_status: string;
    website: string | null;
    country: string | null;
    service_areas: string[] | null;
    delivery_areas: string[] | null;
  };
  catalogue: {
    id: string;
    version: number;
    status: string;
    currency: string | null;
    uploaded_at: string | null;
    updated_at: string | null;
    valid_from: string | null;
    valid_until: string | null;
    original_filename: string | null;
    public_title: string | null;
    public_description: string | null;
    total_items: number;
  };
  items: CatalogueItem[];
}

/**
 * Fetch a supplier's published catalogue with pagination.
 */
export async function getPublicSupplierCatalogue(
  slug: string,
  limit = 50,
  offset = 0,
): Promise<SupplierCatalogueData | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("public_supplier_catalogue", {
    p_slug: slug,
    p_limit: limit,
    p_offset: offset,
  });

  if (error || !data) {
    console.error(`[supplier-catalogue] Failed to fetch catalogue for "${slug}":`, error?.message);
    return null;
  }

  return data as unknown as SupplierCatalogueData;
}

/**
 * Fetch total item count for a supplier's published catalogue.
 */
export async function getPublicSupplierCatalogueCount(slug: string): Promise<number> {
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc("public_supplier_catalogue_count", {
    p_slug: slug,
  });

  if (error || data == null) {
    console.error(`[supplier-catalogue] Failed to fetch count for "${slug}":`, error?.message);
    return 0;
  }

  return data as number;
}

/**
 * Fetch ALL items for a supplier's published catalogue (for CSV/JSON export).
 * No pagination — returns everything.
 */
export async function getAllPublicSupplierCatalogueItems(
  slug: string,
): Promise<SupplierCatalogueData | null> {
  if (!supabase) return null;

  // Fetch with a large limit to get all rows
  const { data, error } = await supabase.rpc("public_supplier_catalogue", {
    p_slug: slug,
    p_limit: 100000,
    p_offset: 0,
  });

  if (error || !data) {
    console.error(`[supplier-catalogue] Failed to fetch all items for "${slug}":`, error?.message);
    return null;
  }

  return data as unknown as SupplierCatalogueData;
}

/**
 * Extract column headers from catalogue items (raw_row keys).
 * Returns a stable, deduplicated list.
 */
export function extractCatalogueColumns(items: CatalogueItem[]): string[] {
  const seen = new Set<string>();
  const columns: string[] = [];

  for (const item of items) {
    const keys = Object.keys(item.raw_row);
    for (const key of keys) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  return columns;
}

/**
 * Standard column display order matching the brief's recommended schema.
 * Unknown columns are appended at the end.
 */
const PREFERRED_COLUMN_ORDER = [
  "supplier_product_code",
  "product_name",
  "description",
  "manufacturer",
  "material",
  "thickness",
  "effective_cover",
  "price",
  "currency",
];

// Alternative header names that map to the preferred columns
const COLUMN_ALIASES: Record<string, string> = {
  sku: "supplier_product_code",
  code: "supplier_product_code",
  product_code: "supplier_product_code",
  name: "product_name",
  product: "product_name",
  cost: "price",
  rate: "price",
  unit_price: "price",
};

export function normalizeColumn(key: string): string {
  const lower = key.toLowerCase().trim();
  return COLUMN_ALIASES[lower] ?? key;
}

/**
 * Get ordered columns with preferred order applied.
 */
export function getOrderedColumns(items: CatalogueItem[]): string[] {
  const rawColumns = extractCatalogueColumns(items);
  const normalized = rawColumns.map(normalizeColumn);
  const seen = new Set<string>();
  const ordered: string[] = [];

  // Add preferred columns first (if they exist)
  for (const preferred of PREFERRED_COLUMN_ORDER) {
    const idx = normalized.indexOf(preferred);
    if (idx !== -1 && !seen.has(preferred)) {
      seen.add(preferred);
      ordered.push(rawColumns[idx]); // Keep original key for data lookup
    }
  }

  // Add remaining columns
  for (let i = 0; i < rawColumns.length; i++) {
    const norm = normalized[i];
    if (!seen.has(norm)) {
      seen.add(norm);
      ordered.push(rawColumns[i]);
    }
  }

  return ordered;
}

/**
 * Human-readable header label for a column key.
 */
export function columnLabel(key: string): string {
  const norm = normalizeColumn(key);
  const labels: Record<string, string> = {
    supplier_product_code: "Product Code",
    product_name: "Product Name",
    description: "Description",
    manufacturer: "Manufacturer",
    material: "Material",
    thickness: "Thickness",
    effective_cover: "Effective Cover",
    price: "Price",
    currency: "Currency",
  };
  return labels[norm] ?? key;
}

// =============================================================
// Version history + version-specific fetch
// =============================================================

export interface CatalogueVersionSummary {
  catalogue_id: string;
  version: number;
  status: string;
  currency: string | null;
  uploaded_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  original_filename: string | null;
  public_title: string | null;
  total_items: number;
}

/**
 * Fetch all published catalogue versions for a supplier.
 */
export async function getCatalogueVersionHistory(slug: string): Promise<CatalogueVersionSummary[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("public_supplier_catalogue_versions", {
    p_slug: slug,
  });

  if (error || !data) {
    console.error(`[supplier-catalogue] Failed to fetch version history for "${slug}":`, error?.message);
    return [];
  }

  return data as unknown as CatalogueVersionSummary[];
}

/**
 * Fetch a specific version of a supplier's catalogue.
 */
export async function getPublicSupplierCatalogueByVersion(
  slug: string,
  version: number,
  limit = 50,
  offset = 0,
): Promise<SupplierCatalogueData | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("public_supplier_catalogue_by_version", {
    p_slug: slug,
    p_version: version,
    p_limit: limit,
    p_offset: offset,
  });

  if (error || !data) {
    console.error(`[supplier-catalogue] Failed to fetch version ${version} for "${slug}":`, error?.message);
    return null;
  }

  return data as unknown as SupplierCatalogueData;
}

/**
 * Fetch ALL items for a specific catalogue version (for CSV/JSON export).
 */
export async function getAllPublicSupplierCatalogueItemsByVersion(
  slug: string,
  version: number,
): Promise<SupplierCatalogueData | null> {
  return getPublicSupplierCatalogueByVersion(slug, version, 100000, 0);
}
