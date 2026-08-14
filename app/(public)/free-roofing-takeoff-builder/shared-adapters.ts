/**
 * QuoteCore+ adapters for the shared roof-takeoff package.
 *
 * These implement the SupplierAdapter, EnquiryAdapter, and ResultAdapter
 * interfaces from @quote-core/roof-takeoff, bridging the shared types
 * to QuoteCore+'s existing supplier directory, catalogue, and result infrastructure.
 *
 * Key design rules from the migration plan:
 * - Supplier email is NEVER sent to the browser. The server resolves it from the slug.
 * - Adapters call existing QuoteCore+ API routes - no new DB schema needed.
 * - Component normalisation happens in the adapter, not in the shared package.
 */

import type {
  SupplierAdapter,
  EnquiryAdapter,
  ResultAdapter,
  SupplierSummary,
  SupplierCatalogue,
  SupplierSearchInput,
  SharedSupplierEnquiry,
  SharedTakeoffSnapshot,
  RoofComponentDef,
  UnitSystem,
  PricingMode,
  RoofType,
} from '@quote-core/roof-takeoff';

// ─── SupplierAdapter ─────────────────────────────────

export const quoteCoreSupplierAdapter: SupplierAdapter = {
  async listSuppliers(input?: SupplierSearchInput): Promise<SupplierSummary[]> {
    const params = new URLSearchParams();
    if (input?.query) params.set('q', input.query);
    if (input?.limit) params.set('limit', String(input.limit));

    const res = await fetch(`/api/free-tools/supplier-libraries?${params}`);
    if (!res.ok) throw new Error('Failed to load supplier list');

    const data = await res.json();
    return (data.libraries || []).map((lib: any) => ({
      slug: lib.supplierSlug,
      name: lib.supplierName,
      logoUrl: null, // supplier-libraries route doesn't return logo; could be added
      branchCity: lib.branchCity ?? null,
      branchRegion: lib.branchRegion ?? null,
      currency: lib.currency ?? null,
    }));
  },

  async loadCatalogue(slug: string): Promise<SupplierCatalogue> {
    const res = await fetch(`/api/free-tools/supplier-library/${slug}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error(`Supplier "${slug}" not found or catalogue not published`);
      throw new Error('Failed to load supplier catalogue');
    }

    const data = await res.json();
    const lib = data.library;
    if (!lib) throw new Error('Invalid catalogue response');

    // Normalise library components to shared RoofComponentDef[]
    const components: RoofComponentDef[] = (lib.components || []).map((c: any, idx: number) => ({
      id: c.id || `comp-${idx}`,
      component_kind: c.component_kind || c.kind || 'custom',
      name: c.name || 'Unnamed Component',
      description: c.description ?? null,
      unit: c.unit || 'm',
      price_per_unit: c.price_per_unit ?? 0,
      pricing_strategy: c.pricing_strategy || 'per_unit',
      pack_size: c.pack_size ?? null,
      pack_price: c.pack_price ?? null,
      labour_rate: c.labour_rate ?? 0,
      labour_unit: c.labour_unit || 'per_unit',
      suggested_waste_percent: c.suggested_waste_percent ?? 5,
      pitch_type: c.pitch_type || 'none',
      is_active: c.is_active !== false,
      sort_order: c.sort_order ?? idx,
      roof_types: c.roof_types?.length ? c.roof_types : null,
    }));

    const unitSystem: UnitSystem = (lib.unitSystem as UnitSystem) || 'metric';
    const pricingModes: PricingMode[] | null = lib.pricingModes?.length ? lib.pricingModes : null;
    const roofTypeOptions: RoofType[] | null = lib.roofingTypes?.length
      ? lib.roofingTypes.filter((t: string) => t === 'new_roof' || t === 're_roof')
      : null;

    return {
      slug,
      supplierName: lib.supplierName || 'Unknown Supplier',
      supplierEmail: lib.enquiryEmail ?? null,
      currency: lib.currency || 'USD',
      currencySymbol: getCurrencySymbol(lib.currency || 'USD'),
      unitSystem,
      components,
      catalogueVersion: lib.publishedVersion != null ? String(lib.publishedVersion) : null,
      pricingModes,
      roofTypeOptions,
    };
  },
};

// ─── EnquiryAdapter ──────────────────────────────────

export const quoteCoreEnquiryAdapter: EnquiryAdapter = {
  async submit(input: SharedSupplierEnquiry): Promise<{ ok: true; enquiryId?: string }> {
    const res = await fetch('/api/free-tools/supplier-enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierSlug: input.supplierSlug,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        message: input.message,
        // Snapshot is optional - the server can regenerate it from the token if needed
        snapshot: input.snapshot ? JSON.stringify(input.snapshot) : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit enquiry');
    }

    const data = await res.json();
    return { ok: true, enquiryId: data.enquiryId };
  },
};

// ─── ResultAdapter ───────────────────────────────────

export const quoteCoreResultAdapter: ResultAdapter = {
  async createResult(input: SharedTakeoffSnapshot): Promise<{ id: string; url: string }> {
    const res = await fetch('/api/free-tools/roof-takeoff-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        measureMode: input.measureMode,
        unitSystem: input.unitSystem,
        pricingMode: input.pricingMode,
        roofType: input.roofType,
        supplierSlug: input.supplierSlug,
        catalogueVersion: input.catalogueVersion,
        sections: input.sections,
        sectionOrder: input.sectionOrder,
        masterPitchDegrees: input.masterPitchDegrees,
        calculation: input.calculation,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create result');
    }

    const data = await res.json();
    return {
      id: data.token || data.id,
      url: data.resultUrl || `/free-roofing-takeoff-builder/result/${data.token}`,
    };
  },
};

// ─── Currency symbol helper ──────────────────────────

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    NZD: '$',
    AUD: '$',
    GBP: '\u00A3',
    EUR: '\u20AC',
    CAD: '$',
    ZAR: 'R',
  };
  return symbols[currency] || '$';
}
