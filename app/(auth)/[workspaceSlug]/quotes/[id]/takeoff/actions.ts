'use server';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { applyPitchAndWaste, rafterPitchFactor } from '@/app/lib/pricing/engine';
import { convertLinearToMetric, convertAreaFt2ToMetric } from '@/app/lib/measurements/conversions';
import { recalcAllQuoteComponents } from '../../actions';

interface TakeoffMeasurement {
  componentId: string | null; // null for informational roof areas
  type: 'line' | 'area' | 'point' | 'multi_lineal' | 'multi_lineal_lxh';
  value: number;
  pitch?: number; // Pitch in degrees (for roof areas)
  name?: string; // Name (for roof areas)
  points?: { x: number; y: number }[];
  visible: boolean;
  pageId?: string | null; // Phase 7: optional takeoff_pages FK
  /** P1-1a H-01: unit override for measurements loaded from DB (other pages).
   *  When set, this overrides the top-level `unit` param for this measurement. */
  measurementUnit?: string;
}

export async function saveTakeoffMeasurements(
  quoteId: string,
  measurements: TakeoffMeasurement[],
  unit: string,
  canvasImagePath?: string,
  linesImagePath?: string,
  /** Phase 7 scoped-delete: when supplied, only this page's measurements
   *  are replaced. Omit for legacy single-page callers. */
  currentPageId?: string | null,
  /** P1-1a version guard: client submits the version it last read.
   *  RPC rejects with STALE_TAKEOFF_VERSION if it has advanced. */
  sessionVersion?: number | null,
) {
  const supabase = await createSupabaseServerClient();

  // Ownership check (RLS still applies inside the RPC, but this gives us a clearer error
  // and lets us pre-fetch the company_id we need to write into quote_takeoff_measurements).
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (quoteError || !quote) {
    throw new Error('Quote not found');
  }

  // ---------------------------------------------------------------------
  // CRITICAL: Imperial calibration -> metric storage conversion.
  //
  // Takeoff calibration is captured in the user's chosen unit ('feet' or
  // 'meters'). Areas come from `pixelArea × scale²` where `scale` is
  // (real-units / pixel), so feet calibration produces sq-ft areas and
  // line measurements produce ft. The DB columns are named *_sqm / *_m
  // and the pricing engine multiplies by `material_rate` (⋅/m or ⋅/m²).
  // If we store the raw feet value, costs come out ~3× (linear) or
  // ~10.76× (area) too low.
  //
  // Solution: convert here so storage is always canonical metric, just
  // like the manual quote-builder flow already does.
  // ---------------------------------------------------------------------
  const isImperialFeet = unit === 'feet';
  const toMetricLinear = (v: number) => isImperialFeet ? convertLinearToMetric(v) : v;
  const toMetricArea = (v: number) => isImperialFeet ? convertAreaFt2ToMetric(v) : v;

  // Pre-compute everything in TS (pitch/waste math lives in pricing/engine.ts), then push
  // a single JSONB payload through the save_takeoff_atomic RPC so the delete + all inserts
  // happen inside one transaction. Replaces the previous "delete then insert" pattern that
  // could lose user data if any step failed mid-flight.

  // 1. Roof areas (informational area measurements with no componentId).
  const roofAreaMeasurements = measurements.filter(m => !m.componentId && m.type === 'area');
  const roofAreasPayload = roofAreaMeasurements.map((m, i) => {
    const pitchDegrees = m.pitch || 0;
    const pitchFactor = pitchDegrees > 0 ? rafterPitchFactor(pitchDegrees) : 1;
    const valueSqm = toMetricArea(m.value);
    const pitchedArea = valueSqm * pitchFactor;
    return {
      label: m.name || `Roof Area ${i + 1}`,
      final_value_sqm: pitchedArea,
      computed_sqm: pitchedArea,
      calc_pitch_degrees: pitchDegrees,
    };
  });
  const firstRoofAreaPitch = roofAreaMeasurements[0]?.pitch || 0;

  // 2. Components + their entries (linear measurements grouped by componentId).
  //
  // P1-1a H-01 FIX: For multi-page quotes, component totals must reflect ALL
  // pages, not just the current page's in-memory measurements. Before building
  // componentsPayload, fetch measurements from OTHER pages out of the DB and
  // merge them with the current page's in-memory measurements.
  //
  // Safety: we fetch BEFORE the RPC runs (RPC hasn't changed the DB yet),
  // so "other pages" data is the last committed state. After the RPC inserts
  // the current page's new measurements, the combined picture is correct.
  let allMeasurementsForComponents = measurements;

  if (currentPageId) {
    const { data: otherPageRows } = await supabase
      .from('quote_takeoff_measurements')
      .select('component_library_id, measurement_type, measurement_value, measurement_unit, canvas_points, is_visible, page_id')
      .eq('quote_id', quoteId)
      .neq('page_id', currentPageId)
      .not('component_library_id', 'is', null); // only component rows, not roof areas

    if (otherPageRows && otherPageRows.length > 0) {
      const otherMeasurements: TakeoffMeasurement[] = otherPageRows.map(row => ({
        componentId: row.component_library_id!,
        type: row.measurement_type as TakeoffMeasurement['type'],
        value: Number(row.measurement_value),
        points: (row.canvas_points as { x: number; y: number }[] | null) ?? undefined,
        visible: row.is_visible ?? true,
        pageId: row.page_id,
        measurementUnit: row.measurement_unit ?? unit, // use stored unit for correct metric conversion
      }));
      // Prepend other pages' measurements; current page's override on conflict.
      allMeasurementsForComponents = [...otherMeasurements, ...measurements];
    }
  }

  // We need to fetch the component_library rows up-front to compute pitch/waste correctly.
  const componentIds = [...new Set(allMeasurementsForComponents.filter(m => m.componentId).map(m => m.componentId!))];
  let componentsPayload: Array<Record<string, unknown>> = [];
  if (componentIds.length > 0) {
    const { data: libComps } = await supabase
      .from('component_library')
      .select('*')
      .in('id', componentIds);
    const libById = new Map((libComps || []).map(c => [c.id, c]));

    componentsPayload = componentIds
      .map(componentId => {
        const libComp = libById.get(componentId);
        if (!libComp) return null;
        // P1-1a H-01: use allMeasurementsForComponents (includes other pages).
        const componentMeasurements = allMeasurementsForComponents.filter(m => m.componentId === componentId);
        const pitchType = libComp.default_pitch_type || 'none';
        // Cast: database.types.ts is stale; fixed_per_segment is a valid DB value.
        const wasteType = (libComp.default_waste_type as string) || 'none';
        const wastePercent = libComp.default_waste_percent || 0;
        const wasteFixed = libComp.default_waste_fixed || 0;
        const materialRate = libComp.default_material_rate || 0;
        const labourRate = libComp.default_labour_rate || 0;
        // Phase 7+: height for multi_lineal_lxh area calculations.
        const heightMm = (libComp as unknown as Record<string, unknown>).height_value_mm as number | null;
        const heightM = heightMm ? heightMm / 1000 : 1;

        const entries = componentMeasurements.map((m, index) => {
          // P1-1a H-01: each measurement may come from a different page with its
          // own calibration unit. Use m.measurementUnit if set (DB rows from other
          // pages), otherwise fall back to the top-level `unit` param (current page).
          const mUnit = m.measurementUnit ?? unit;
          const mIsImperialFeet = mUnit === 'feet';
          const mToMetricLinear = (v: number) => mIsImperialFeet ? convertLinearToMetric(v) : v;
          const mToMetricArea = (v: number) => mIsImperialFeet ? convertAreaFt2ToMetric(v) : v;

          // Convert calibration-unit value -> canonical metric BEFORE pitch/waste
          // math, since material/labour rates are priced per metre or per m².
          let metricValue = m.value;
          if (m.type === 'line' || m.type === 'multi_lineal') {
            metricValue = mToMetricLinear(m.value);
          } else if (m.type === 'multi_lineal_lxh') {
            // multi_lineal_lxh: area = total polyline length × component height.
            // Height is constant across all segments, so sum(seg_len × h) = total × h.
            // m.value is the total polyline length in calibrated units (same as multi_lineal).
            metricValue = mToMetricLinear(m.value) * heightM;
          } else if (m.type === 'area') {
            metricValue = mToMetricArea(m.value);
          }
          // 'point' is a count (each) and never needs unit conversion.

          // fixed_per_segment (waste_type): multiply fixed waste by segment
          // count for multi_lineal / multi_lineal_lxh measurements.
          // Segment count = points.length - 1.
          let effectiveWasteType = wasteType as string;
          let effectiveWasteFixed = wasteFixed;
          if (
            wasteType === 'fixed_per_segment' &&
            (m.type === 'multi_lineal' || m.type === 'multi_lineal_lxh') &&
            m.points && m.points.length >= 2
          ) {
            effectiveWasteType = 'fixed';
            effectiveWasteFixed = wasteFixed * (m.points.length - 1);
          } else if (wasteType === 'fixed_per_segment') {
            // Non-polyline component using fixed_per_segment - treat as plain fixed.
            effectiveWasteType = 'fixed';
          }

          const result = applyPitchAndWaste(
            metricValue,
            true,
            pitchType as any,
            firstRoofAreaPitch,
            effectiveWasteType as any,
            wastePercent,
            effectiveWasteFixed
          );
          return {
            raw_value: metricValue,
            value_after_waste: result.afterWaste,
            sort_order: index,
          };
        });

        const totalQuantity = entries.reduce((sum, e) => sum + e.value_after_waste, 0);
        const materialCost = totalQuantity * materialRate;
        const labourCost = totalQuantity * labourRate;

        return {
          component_library_id: componentId,
          name: libComp.name,
          // M-02 (Gerald round-5): include the real measurement_type from
          // component_library so the RPC doesn't hardcode 'lineal' for every
          // component regardless of type.
          measurement_type: libComp.measurement_type,
          material_rate: materialRate,
          labour_rate: labourRate,
          waste_type: wasteType,
          waste_percent: wastePercent,
          waste_fixed: wasteFixed,
          pitch_type: pitchType,
          final_quantity: totalQuantity,
          material_cost: materialCost,
          labour_cost: labourCost,
          entries,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }

  // 3. Raw measurements list (mirrored to quote_takeoff_measurements 1:1).
  const measurementsPayload = measurements.map(m => ({
    company_id: quote.company_id,
    component_library_id: m.componentId,
    measurement_type: m.type,
    measurement_value: m.value,
    measurement_unit: unit,
    canvas_points: m.points ?? null,
    is_visible: m.visible,
    // Phase 7: page_id passed through when the caller supplies it (multi-page
    // takeoff). Omitted for single-page callers - RPC writes NULL.
    ...(m.pageId ? { page_id: m.pageId } : {}),
  }));

  // Pass STORAGE PATHS to the RPC (Gerald audit pass 2). The RPC keeps
  // accepting the legacy *_url keys for one release so an in-flight deploy
  // doesn't drop snapshots, but we should never send them from new code.
  const payload = {
    canvas_image_path: canvasImagePath ?? null,
    lines_image_path: linesImagePath ?? null,
    // Phase 7 scoped-delete: passed through to the RPC.
    current_page_id: currentPageId ?? null,
    // P1-1a version guard: RPC rejects if DB version has advanced.
    ...(sessionVersion != null ? { session_version: sessionVersion } : {}),
    measurements: measurementsPayload,
    roof_areas: roofAreasPayload,
    components: componentsPayload,
  };

  // The RPC's `p_payload` parameter is typed `Json` by Postgres, which
  // generates as `{ [key: string]: Json | undefined } | Json[] | ...`. Our
  // payload contains arrays of typed rows that don't widen to `Json` for
  // free. Cast the args once at the boundary; the runtime value
  // serialises to Json correctly.
  const rpcArgs = {
    p_quote_id: quoteId,
    p_payload: payload,
  } as unknown as { p_quote_id: string; p_payload: never };
  const { error: rpcError } = await supabase.rpc('save_takeoff_atomic', rpcArgs);

  if (rpcError) {
    console.error('[SaveTakeoff] RPC error:', rpcError);
    // P1-1a version guard: surface a clear reload prompt instead of a generic error.
    if (rpcError.message?.includes('STALE_TAKEOFF_VERSION')) {
      throw new Error('STALE_TAKEOFF_VERSION: Your takeoff was edited in another tab. Please reload the page to continue.');
    }
    throw new Error(`Failed to save takeoff: ${rpcError.message}`);
  }

  // Gerald round-6 H-03: save_takeoff_atomic writes material_cost as quantity × rate
  // (no pack rounding). Recalculate all components through computeMaterialCostByStrategy
  // so pack pricing (per_pack_area, per_pack_coverage, etc.) is applied before the
  // quote builder loads the stored totals.
  await recalcAllQuoteComponents(quoteId);

  revalidatePath(`/[workspaceSlug]/quotes/${quoteId}`);
  return { success: true };
}

// ─── P1-1a: Hydration helpers ────────────────────────────────────────────

export interface TakeoffHydrationPage {
  id: string;
  pageOrder: number;
  pageName: string | null;
  imagePath: string | null;
  imageUrl: string | null; // signed URL, minted server-side
}

export interface TakeoffHydrationMeasurement {
  id: string;
  componentId: string | null;
  type: string;
  value: number;
  unit: string;
  points: { x: number; y: number }[] | null;
  visible: boolean;
  pageId: string | null;
}

export interface TakeoffHydrationData {
  sessionId: string | null;
  sessionVersion: number;
  pages: TakeoffHydrationPage[];
  measurements: TakeoffHydrationMeasurement[];
}

/**
 * Load all saved takeoff state for a quote so TakeoffWorkstation can
 * initialise from DB rather than starting blank. Returns null if no
 * session exists yet (fresh takeoff).
 */
export async function loadTakeoffHydrationData(
  quoteId: string,
): Promise<TakeoffHydrationData | null> {
  const supabase = await createSupabaseServerClient();
  const { getSignedUrl } = await import('@/app/lib/storage/helpers');
  const { BUCKETS } = await import('@/app/lib/storage/buckets');

  // 1. Session
  const { data: session } = await supabase
    .from('takeoff_sessions')
    .select('id, version')
    .eq('quote_id', quoteId)
    .maybeSingle();

  if (!session) return null;

  // 2. Pages (ordered)
  const { data: pages } = await supabase
    .from('takeoff_pages')
    .select('id, page_order, page_name, image_storage_path')
    .eq('quote_id', quoteId)
    .order('page_order', { ascending: true });

  const hydratedPages: TakeoffHydrationPage[] = await Promise.all(
    (pages ?? []).map(async (p) => {
      let imageUrl: string | null = null;
      if (p.image_storage_path) {
        try {
          imageUrl = await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, p.image_storage_path);
        } catch {
          // Non-fatal: image URL generation failure
        }
      }
      return {
        id: p.id,
        pageOrder: p.page_order,
        pageName: p.page_name,
        imagePath: p.image_storage_path,
        imageUrl,
      };
    }),
  );

  // 3. Measurements for all pages
  const { data: measurements } = await supabase
    .from('quote_takeoff_measurements')
    .select('id, component_library_id, measurement_type, measurement_value, measurement_unit, canvas_points, is_visible, page_id')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: true });

  const hydratedMeasurements: TakeoffHydrationMeasurement[] = (measurements ?? []).map(m => ({
    id: m.id,
    componentId: m.component_library_id,
    type: m.measurement_type,
    value: Number(m.measurement_value),
    unit: m.measurement_unit,
    points: (m.canvas_points as { x: number; y: number }[] | null),
    visible: m.is_visible ?? true,
    pageId: m.page_id,
  }));

  return {
    sessionId: session.id,
    sessionVersion: (session as { id: string; version?: number }).version ?? 0,
    pages: hydratedPages,
    measurements: hydratedMeasurements,
  };
}

export async function loadTakeoffMeasurements(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: measurements, error } = await supabase
    .from('quote_takeoff_measurements')
    .select(`
      *,
      component_library (
        id,
        name
      )
    `)
    .eq('quote_id', quoteId)
    .order('created_at');
  
  if (error) {
    console.error('[loadTakeoffMeasurements] Error:', error);
    return [];
  }
  
  // Group by component and calculate totals
  const grouped = (measurements || []).reduce((acc, m) => {
    const compId = m.component_library_id;
    if (!compId) return acc;
    
    if (!acc[compId]) {
      acc[compId] = {
        componentId: compId,
        componentName: m.component_library?.name || 'Unknown',
        lines: [],
        areas: [],
        points: [],
        totalLength: 0,
        totalArea: 0,
        totalQuantity: 0,
        unit: m.measurement_unit,
      };
    }
    
    if (m.measurement_type === 'line') {
      acc[compId].lines.push(m);
      acc[compId].totalLength += Number(m.measurement_value);
    } else if (m.measurement_type === 'area') {
      acc[compId].areas.push(m);
      acc[compId].totalArea += Number(m.measurement_value);
    } else if (m.measurement_type === 'point') {
      acc[compId].points.push(m);
      acc[compId].totalQuantity += Number(m.measurement_value);
    }
    
    return acc;
  }, {} as Record<string, any>);
  
  return Object.values(grouped);
}

// ─── Phase 7: Multi-page takeoff server actions ───────────────────────────

import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Get or create the takeoff session for a quote (one session per quote, v1).
 * Uses service-role because takeoff_sessions RLS is company-scoped and we
 * need to upsert atomically without a race.
 */
async function ensureTakeoffSession(quoteId: string, companyId: string): Promise<string> {
  const admin = createAdminClient();
  // H-01 (Gerald round-5): verify the quote belongs to the caller's company
  // BEFORE doing any admin writes. Use admin client for the read (bypasses
  // RLS) but scope by company_id so cross-tenant access is rejected.
  const { data: quoteCheck } = await admin
    .from('quotes')
    .select('id')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!quoteCheck) throw new Error(`ensureTakeoffSession: quote ${quoteId} not found for company ${companyId}`);

  // Check for existing session first.
  const { data: existing } = await admin
    .from('takeoff_sessions')
    .select('id')
    .eq('quote_id', quoteId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // Create one.
  const { data: created, error } = await admin
    .from('takeoff_sessions')
    .insert({ quote_id: quoteId })
    .select('id')
    .single();
  if (error || !created) throw new Error(`ensureTakeoffSession: ${error?.message}`);
  return created.id;
}

/**
 * Load all takeoff pages for a quote, ordered by page_order.
 */
export async function loadTakeoffPages(quoteId: string): Promise<{
  id: string;
  session_id: string;
  quote_id: string;
  image_storage_path: string | null;
  page_order: number;
  page_name: string | null;
  scale_calibration: unknown;
}[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('takeoff_pages')
    .select('id, session_id, quote_id, image_storage_path, page_order, page_name, scale_calibration')
    .eq('quote_id', quoteId)
    .order('page_order', { ascending: true });
  if (error) {
    console.error('[loadTakeoffPages]', error);
    return [];
  }
  return data ?? [];
}

/**
 * M-04 (Gerald round-5): initialise the session + page-1 row for a quote
 * on workstation mount. Idempotent - returns the existing page id if one
 * already exists. The workstation uses the returned id to scope saves.
 */
export async function initializeTakeoffPage(
  quoteId: string,
  initialImageStoragePath?: string | null,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  try {
    const { requireCompanyContext } = await import('@/app/lib/supabase/server');
    const profile = await requireCompanyContext();
    const admin = createAdminClient();
    // H-01: ownership checked inside ensureTakeoffSession.
    const sessionId = await ensureTakeoffSession(quoteId, profile.company_id);
    // Return existing page-1 if already created.
    const { data: existing } = await admin
      .from('takeoff_pages')
      .select('id')
      .eq('quote_id', quoteId)
      .eq('page_order', 1)
      .maybeSingle();
    if (existing?.id) return { ok: true, pageId: existing.id };
    // Create page-1 with the original plan image path.
    const { data: page, error } = await admin
      .from('takeoff_pages')
      .insert({
        session_id: sessionId,
        quote_id: quoteId,
        page_order: 1,
        page_name: 'Page 1',
        image_storage_path: initialImageStoragePath ?? null,
      })
      .select('id')
      .single();
    if (error || !page) return { ok: false, error: error?.message ?? 'Page insert returned no row' };
    return { ok: true, pageId: page.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[initializeTakeoffPage]', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Create a new takeoff page (page 2+). H-01 ownership enforced via
 * ensureTakeoffSession which checks company_id before any admin write.
 */
export async function createTakeoffPage(
  quoteId: string,
  pageName?: string,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  try {
    const { requireCompanyContext } = await import('@/app/lib/supabase/server');
    const profile = await requireCompanyContext();
    const admin = createAdminClient();
    const sessionId = await ensureTakeoffSession(quoteId, profile.company_id);
    const { count: existingCount } = await admin
      .from('takeoff_pages')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', quoteId);
    const { data: page, error } = await admin
      .from('takeoff_pages')
      .insert({
        session_id: sessionId,
        quote_id: quoteId,
        page_order: (existingCount ?? 0) + 1,
        page_name: pageName ?? null,
        image_storage_path: null,
      })
      .select('id')
      .single();
    if (error || !page) return { ok: false, error: error?.message ?? 'Page insert returned no row' };
    return { ok: true, pageId: page.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[createTakeoffPage]', msg);
    return { ok: false, error: msg };
  }
}

/**
 * H-02 (Gerald round-5): after uploading a page image to storage, write
 * its path back to the takeoff_pages row so it survives reload.
 * Ownership enforced: only updates pages belonging to the caller's company.
 */
export async function finalizeTakeoffPageImage(
  pageId: string,
  storagePath: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { requireCompanyContext } = await import('@/app/lib/supabase/server');
    const profile = await requireCompanyContext();
    const admin = createAdminClient();
    // Verify ownership via quote → company chain.
    const { data: page } = await admin
      .from('takeoff_pages')
      .select('id, quote_id')
      .eq('id', pageId)
      .maybeSingle();
    if (!page) return { ok: false, error: 'Page not found' };
    const { data: quote } = await admin
      .from('quotes')
      .select('id')
      .eq('id', page.quote_id)
      .eq('company_id', profile.company_id)
      .maybeSingle();
    if (!quote) return { ok: false, error: 'Unauthorized' };
    const { error } = await admin
      .from('takeoff_pages')
      .update({ image_storage_path: storagePath })
      .eq('id', pageId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}