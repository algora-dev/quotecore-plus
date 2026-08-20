import { NextRequest } from "next/server";
import { getPublicSupplier } from "@/lib/supplier-directory";
import { getAllPublicSupplierCatalogueItems } from "@/lib/supplier-catalogue";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Verify supplier exists and is visible
  const supplierData = await getPublicSupplier(slug);
  if (!supplierData || !supplierData.eligibility.page_visible) {
    return Response.json(
      { error: "Supplier not found" },
      { status: 404 },
    );
  }

  // Fetch all catalogue items
  const catalogue = await getAllPublicSupplierCatalogueItems(slug);
  if (!catalogue) {
    // BRIEF-003 Phase 2: indexed export URLs previously 404'd for suppliers
    // without a published catalogue. Resolve them to the HTML catalogue page
    // instead of leaving dead endpoints in Google's index.
    return Response.redirect(
      new URL(`/suppliers/${slug}/catalogue`, _request.url),
      301,
    );
  }

  const s = catalogue.supplier;
  const cat = catalogue.catalogue;

  // Build JSON structure per the brief
  const output = {
    supplier: {
      id: s.id,
      name: s.name,
      slug: s.slug,
      verification_status: s.verification_status,
      website: s.website,
      country: s.country,
      service_areas: s.service_areas ?? [],
      delivery_areas: s.delivery_areas ?? [],
    },
    catalogue: {
      version: cat.version != null ? String(cat.version) : "1",
      status: cat.status,
      currency: cat.currency,
      uploaded_at: cat.uploaded_at,
      updated_at: cat.updated_at,
      valid_from: cat.valid_from,
      valid_until: cat.valid_until,
    },
    items: catalogue.items.map((item) => {
      const raw = item.raw_row;

      // Extract known fields, preserve the rest as additional_attributes
      const knownKeys = new Set([
        "supplier_product_code", "product_name", "description",
        "manufacturer", "material", "thickness", "effective_cover",
        "price", "currency",
        // Aliases
        "sku", "code", "product_code", "name", "product",
        "cost", "rate", "unit_price",
      ]);

      const result: Record<string, unknown> = {};

      // Map known fields with aliases
      const codeVal = raw.supplier_product_code ?? raw.sku ?? raw.code ?? raw.product_code ?? "";
      const nameVal = raw.product_name ?? raw.name ?? raw.product ?? "";
      const priceVal = raw.price ?? raw.cost ?? raw.rate ?? raw.unit_price ?? "";
      const currencyVal = raw.currency ?? "";

      if (codeVal) result.supplier_product_code = codeVal;
      if (nameVal) result.product_name = nameVal;
      if (raw.description) result.description = raw.description;
      if (raw.manufacturer) result.manufacturer = raw.manufacturer;
      if (raw.material) result.material = raw.material;
      if (raw.thickness) result.thickness = raw.thickness;
      if (raw.effective_cover) result.effective_cover = raw.effective_cover;
      if (priceVal) {
        const numPrice = parseFloat(String(priceVal).replace(/[^0-9.\-]/g, ""));
        result.price = isNaN(numPrice) ? priceVal : numPrice;
      }
      if (currencyVal) result.currency = currencyVal;

      // Additional attributes (unknown columns)
      const additional: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        if (!knownKeys.has(key.toLowerCase()) && value) {
          additional[key] = value;
        }
      }
      if (Object.keys(additional).length > 0) {
        result.additional_attributes = additional;
      }

      return result;
    }),
  };

  return new Response(JSON.stringify(output, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "X-Robots-Tag": "noindex",
    },
  });
}
