import {
  calculatePublicRoofTakeoff,
  toResultQuery,
  type PublicRoofTakeoffInput,
  type SupplierSlotMap,
} from '@/app/(public)/free-roofing-takeoff-builder/public-contract';
import { createResultToken, buildResultUrl } from '@/app/(public)/free-roofing-takeoff-builder/result-token';
import { ROOF_TAKEOFF_CALCULATION_VERSION } from '@/app/(public)/free-roofing-takeoff-builder/public-contract';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { getSupplierBySlug, getSupplierDefaultComponents, autoResolveSupplier } from '@/app/lib/supplier-pricing/supplierPricingService';

const MAX_BODY_BYTES = 32_000;

export async function POST(request: Request) {
  const clientIp = getClientIP(request.headers);
  const allowed = await checkRateLimit(`public-roof-takeoff:${clientIp}`, 120, 60 * 60 * 1000);
  if (!allowed) {
    return Response.json({ success: false, errors: [{ field: 'request', message: 'Too many calculations. Please try again later.' }] }, { status: 429 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ success: false, errors: [{ field: 'body', message: 'Request body is too large.' }] }, { status: 413 });
  }

  let input: PublicRoofTakeoffInput;
  try {
    input = await request.json() as PublicRoofTakeoffInput;
  } catch {
    return Response.json({ success: false, errors: [{ field: 'body', message: 'Request body must be valid JSON.' }] }, { status: 400 });
  }

  // Load supplier pricing - auto-resolve best supplier if none specified
  let components: Awaited<ReturnType<typeof getSupplierDefaultComponents>>['components'] = [];
  let slotMap: SupplierSlotMap = {};
  let supplierProfile: Awaited<ReturnType<typeof getSupplierBySlug>> = null;
  let autoResolved = false;

  if (input.supplier) {
    supplierProfile = await getSupplierBySlug(input.supplier);
    if (supplierProfile) {
      const result = await getSupplierDefaultComponents(supplierProfile.id);
      components = result.components;
      for (const comp of components) {
        const slot = (comp as any).takeoff_slot;
        if (slot) {
          slotMap[slot] = {
            componentId: comp.id,
            componentName: comp.name,
            componentSku: (comp as any).sku ?? null,
            unitPrice: comp.price_per_unit,
          };
        }
      }
    }
  } else {
    // Auto-resolve best supplier with live pricing
    const resolved = await autoResolveSupplier();
    if (resolved) {
      supplierProfile = resolved.profile;
      components = resolved.components;
      autoResolved = true;
      for (const comp of components) {
        const slot = (comp as any).takeoff_slot;
        if (slot) {
          slotMap[slot] = {
            componentId: comp.id,
            componentName: comp.name,
            componentSku: (comp as any).sku ?? null,
            unitPrice: comp.price_per_unit,
          };
        }
      }
    }
  }

  const result = calculatePublicRoofTakeoff(input, components, slotMap);
  if (!result.success) return Response.json(result, { status: 422 });

  const origin = new URL(request.url).origin;
  const populatedQuery = toResultQuery({ ...input, mode: result.mode, units: result.units });
  const token = createResultToken(populatedQuery, ROOF_TAKEOFF_CALCULATION_VERSION);
  result.resultUrl = buildResultUrl(token, origin);

  // Attach pricing provenance
  if (supplierProfile) {
    result.pricing = {
      supplierId: supplierProfile.id,
      supplierName: supplierProfile.supplier_name,
      country: supplierProfile.country,
      currency: supplierProfile.currency,
      taxTreatment: supplierProfile.tax_treatment,
      priceType: supplierProfile.price_type,
      pricingUpdatedAt: supplierProfile.pricing_updated_at,
      priceValidUntil: supplierProfile.price_valid_until,
      deliveryAssumptions: supplierProfile.delivery_assumptions,
      exclusions: supplierProfile.exclusions,
      estimateStatus: supplierProfile.instant_pricing_available ? 'indicative' : 'unavailable',
    };
  }

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
