'use server';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { applyPitchAndWaste, rafterPitchFactor } from '@/app/lib/pricing/engine';
import { convertLinearToMetric, convertAreaFt2ToMetric } from '@/app/lib/measurements/conversions';
import { recalcAllQuoteComponents } from '../../actions';

interface TakeoffMeasurement {
  componentId: string | null; // null for informational roof areas
  type: 'line' | 'area' | 'point' | 'multi_lineal' | 'multi_lineal_lxh' | 'volume_3d' | 'length_x_height_freestyle' | 'multi_lineal_lxh_freestyle';
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
  /** P1-1b: pre-created quote_roof_areas ID for new-area saves.
   *  When supplied: disables H-01 cross-page aggregation (this page's
   *  components are routed to this area only, not merged with page 1). */
  targetRoofAreaId?: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  // Ownership check (RLS still applies inside the RPC, but this gives us a clearer error
  // and lets us pre-fetch the company_id we need to write into quote_takeoff_measurements).
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (quoteError || !quote) {
    return { success: false, error: 'Quote not found' };
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

  // 2. Components + their entries (current page only).
  //
  // Gerald audit 2026-05-29 H-01: the previous H-01 cross-page aggregation
  // fetched other pages' measurements from quote_takeoff_measurements and
  // merged them into allMeasurementsForComponents. The RPC then tagged every
  // entry in the resulting payload as page_id = v_current_page_id, creating
  // duplicate entries for other pages' measurements.
  //
  // The RPC already handles cross-page total recalculation correctly:
  //   UPDATE quote_components SET final_quantity = SUM(value_after_waste)
  //     FROM quote_component_entries WHERE quote_component_id = v_existing_id
  // This sums ALL pages' entries after the current page's entries are inserted,
  // so the final totals are always cross-page accurate.
  //
  // Fix: send ONLY current-page measurements in componentsPayload.entries.
  // Do NOT fetch or merge other pages' DB rows here. recalcAllQuoteComponents
  // is called after the RPC and recalculates final_quantity from all pages.
  const allMeasurementsForComponents = measurements;

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
        // Current-page measurements only - no H-01 aggregation.
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
        // Preset depth for Volume (Preset Depth) components.
        const depthMm = (libComp as unknown as Record<string, unknown>).depth_value_mm as number | null;
        const depthM = depthMm ? depthMm / 1000 : null;

        const entries = componentMeasurements.map((m, index) => {
          // All measurements are from the current page and share the same unit.
          // (H-01 multi-page unit mixing was removed per Gerald audit 2026-05-29.)
          const mToMetricLinear = toMetricLinear;
          const mToMetricArea = toMetricArea;

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
            const areaM2 = mToMetricArea(m.value);
            // Volume (Preset Depth): multiply area by the preset depth from the component.
            if (libComp.measurement_type === 'volume' && depthM) {
              metricValue = areaM2 * depthM;
            } else {
              metricValue = areaM2;
            }
          } else if (m.type === 'volume_3d') {
            // Volume (L × W × D): value is already in m³, converted client-side.
            metricValue = m.value;
          } else if (m.type === 'length_x_height_freestyle' || m.type === 'multi_lineal_lxh_freestyle') {
            // Freestyle: area pre-calculated client-side (length × user-entered height),
            // both already converted to metric. Value is already m².
            metricValue = m.value;
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
    // P1-1b: route components to correct area for new-area saves.
    ...(targetRoofAreaId ? { target_roof_area_id: targetRoofAreaId } : {}),
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
      return { success: false, error: 'STALE_TAKEOFF_VERSION: Your takeoff was edited in another tab. Please reload the page to continue.' };
    }
    return { success: false, error: `Failed to save takeoff: ${rpcError.message}` };
  }

  // Gerald round-6 H-03: save_takeoff_atomic writes material_cost as quantity × rate
  // (no pack rounding). Recalculate all components through computeMaterialCostByStrategy
  // so pack pricing (per_pack_area, per_pack_coverage, etc.) is applied before the
  // quote builder loads the stored totals.
  await recalcAllQuoteComponents(quoteId);

  // P1-1b: create quote_files records for every canvas save so all takeoff
  // images are visible in Files & Documents and users can delete old ones.
  // We use the admin client for this since saveFileMetadata uses RLS-authed
  // client and company_id is available from the earlier ownership check.
  // P1-1b: create quote_files records so all canvas snapshots appear in
  // Files & Documents. Non-fatal - a failed record doesn't affect the save.
  if (canvasImagePath || linesImagePath) {
    const admin = createAdminClient();
    const pageLabel = currentPageId ? ` - Page ${currentPageId.slice(0, 6)}` : '';
    type QFInsert = { company_id: string; quote_id: string; file_type: string; file_name: string; storage_path: string; file_size: number; mime_type: string };
    const fileRecords: QFInsert[] = [];
    if (canvasImagePath) {
      fileRecords.push({
        company_id: quote.company_id,
        quote_id: quoteId,
        file_type: 'takeoff_canvas',
        file_name: `Digital Takeoff Canvas${pageLabel}`,
        storage_path: canvasImagePath,
        file_size: 0,
        mime_type: 'image/png',
      });
    }
    if (linesImagePath) {
      fileRecords.push({
        company_id: quote.company_id,
        quote_id: quoteId,
        file_type: 'takeoff_lines',
        file_name: 'Takeoff Lines Only (Print Ready)',
        storage_path: linesImagePath,
        file_size: 0,
        mime_type: 'image/png',
      });
    }
    // Non-fatal: a failed record doesn't affect the save result.
    try {
      await admin.from('quote_files').insert(fileRecords);
    } catch (err) {
      console.warn('[SaveTakeoff] Failed to create quote_files record:', err);
    }
  }

  revalidatePath(`/[workspaceSlug]/quotes/${quoteId}`);
  return { success: true as const };
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
 * P1-1b: Create a named takeoff page for a new quote area (Option B / C
 * re-entry flow). Accepts the area name + an optional image storage path
 * (same plan as page-1 for Option B, new upload for Option C).
 * H-01 ownership enforced via ensureTakeoffSession.
 */
export async function createTakeoffPageForArea(
  quoteId: string,
  areaName: string,
  imagePath?: string | null,
): Promise<{ ok: boolean; pageId?: string; roofAreaId?: string; error?: string }> {
  try {
    const { requireCompanyContext } = await import('@/app/lib/supabase/server');
    const profile = await requireCompanyContext();
    const admin = createAdminClient();

    // H-01: ownership checked inside ensureTakeoffSession.
    const sessionId = await ensureTakeoffSession(quoteId, profile.company_id);

    // P1-1b: create the quote_roof_areas entry FIRST so components can be
    // routed to the correct area. Before inserting, check for an existing
    // empty area with the same label (created by a previous navigation that
    // was abandoned). Reuse it to prevent duplicate empty areas accumulating.
    const { data: existingArea } = await admin
      .from('quote_roof_areas')
      .select('id')
      .eq('quote_id', quoteId)
      .eq('label', areaName)
      .eq('final_value_sqm', 0)
      .eq('is_locked', false)
      .limit(1)
      .maybeSingle();

    let roofArea: { id: string } | null = existingArea ?? null;

    // Sweep any OTHER empty unlocked areas with the same label (stranded
    // duplicates created before the dedup fix was deployed). Keep at most one.
    await admin
      .from('quote_roof_areas')
      .delete()
      .eq('quote_id', quoteId)
      .eq('label', areaName)
      .eq('final_value_sqm', 0)
      .eq('is_locked', false)
      .not('id', 'eq', existingArea?.id ?? '00000000-0000-0000-0000-000000000000');

    if (!roofArea) {
      const { count: areaCount } = await admin
        .from('quote_roof_areas')
        .select('id', { count: 'exact', head: true })
        .eq('quote_id', quoteId);
      const { data: newArea, error: areaError } = await admin
        .from('quote_roof_areas')
        .insert({
          quote_id: quoteId,
          label: areaName,
          input_mode: 'calculated' as const,
          final_value_sqm: 0,
          computed_sqm: 0,
          calc_pitch_degrees: 0,
          is_locked: false,
          sort_order: (areaCount ?? 0) + 1,
        })
        .select('id')
        .single();
      if (areaError || !newArea) {
        return { ok: false, error: areaError?.message ?? 'Roof area insert returned no row' };
      }
      roofArea = newArea;
    }

    // Create the takeoff page linked to the new roof area.
    const { count: existingCount } = await admin
      .from('takeoff_pages')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', quoteId);
    const { data: page, error: pageError } = await admin
      .from('takeoff_pages')
      .insert({
        session_id: sessionId,
        quote_id: quoteId,
        page_order: (existingCount ?? 0) + 1,
        page_name: areaName,
        image_storage_path: imagePath ?? null,
        // P1-1b: quote_roof_area_id is new - cast until database.types.ts regen.
        quote_roof_area_id: roofArea.id,
      } as any)
      .select('id')
      .single();
    if (pageError || !page) {
      return { ok: false, error: pageError?.message ?? 'Page insert returned no row' };
    }

    return { ok: true, pageId: page.id, roofAreaId: roofArea.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[createTakeoffPageForArea]', msg);
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
 * P1-3: Return the first (lowest sort_order) quote_roof_areas ID for a quote.
 * Called after saving measurements so the next page can target the same area.
 */
export async function getFirstRoofAreaId(
  quoteId: string,
): Promise<{ id: string; label: string } | null> {
  try {
    const { requireCompanyContext } = await import('@/app/lib/supabase/server');
    const profile = await requireCompanyContext();
    const admin = createAdminClient();
    // Verify quote ownership before returning area data.
    const { data: quote } = await admin
      .from('quotes')
      .select('id')
      .eq('id', quoteId)
      .eq('company_id', profile.company_id)
      .maybeSingle();
    if (!quote) return null;
    const { data: area } = await admin
      .from('quote_roof_areas')
      .select('id, label')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    return area ? { id: area.id, label: area.label } : null;
  } catch {
    return null;
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