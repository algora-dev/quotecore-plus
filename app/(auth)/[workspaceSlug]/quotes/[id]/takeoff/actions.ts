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
  quoteRoofAreaId?: string | null; // Batch 5: area-scoped measurements
  /** P1-1a H-01: unit override for measurements loaded from DB (other pages).
   *  When set, this overrides the top-level `unit` param for this measurement. */
  measurementUnit?: string;
  /** Entry-input reference (v8, 2026-07-08): USER-entered height/depth in
   *  metric, captured at draw time (freestyle L×H height, volume_3d custom
   *  depth). Display-only - never feeds calculation (m.value is already the
   *  final product). Persisted to quote_takeoff_measurements.entry_inputs so
   *  re-entry hydration + re-save doesn't wipe it. */
  /** P3/P4 (spec 10.3): attached-area entries also carry value_basis/plan_value
   *  snapshots and the durable source_geometry_id provenance link; these DO
   *  participate in calibration recomputation (no longer display-only). */
  entryInputs?: {
    height_m?: number | null;
    depth_m?: number | null;
    value_basis?: 'pitched' | 'plan';
    plan_value?: number;
    pitch_applied?: boolean;
    source_geometry_id?: string;
  } | null;
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
  /** Canvas-rework: calibration data to persist on the takeoff_pages row.
   *  Stored in scale_calibration JSONB so re-entry can restore the scale. */
  calibrations?: unknown,
  /** P3 (spec 10.1): when true, calibration persistence is REQUIRED - a
   *  failure returns COMMIT_FAILED instead of being swallowed. Used by the
   *  AI-assisted calibration finish path so a failed commit is never
   *  reported as success (the client rolls back its session state). */
  requireCalibrationCommit?: boolean,
  /** P4 (spec 11): versioned calibration envelope (calibrationCodec v1)
   *  persisted to takeoff_pages.calibration_metadata. When supplied, the
   *  legacy scale_calibration array is STILL written alongside it (rolling
   *  deployment, spec 11.4) and the server-established image_revision is
   *  stamped on the same row update. */
  calibrationMetadata?: unknown,
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
      // Fix (2026-07-04): carry the target area id per element so the RPC
      // resolves the row directly instead of label/ordinal heuristics.
      quote_roof_area_id: m.quoteRoofAreaId ?? null,
      final_value_sqm: pitchedArea,
      computed_sqm: pitchedArea,
      calc_pitch_degrees: pitchDegrees,
    };
  });
  const firstRoofAreaPitch = roofAreaMeasurements[0]?.pitch || 0;

  // Per-area pitch fix (2026-07-08): components must be pitched at the pitch
  // of the roof area they belong to - NOT the first area measured on the page.
  // Seed from THIS save's area measurements (first measurement per area wins
  // for this page); missing areas are resolved from the DB further down.
  const areaPitchByAreaId = new Map<string, number>();
  for (const m of roofAreaMeasurements) {
    const key = m.quoteRoofAreaId ?? '';
    if (key && !areaPitchByAreaId.has(key)) areaPitchByAreaId.set(key, m.pitch || 0);
  }

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
  // Area-ownership fix (2026-07-05): group component entries by
  // (component, roof area) so the same library component drawn on two areas
  // produces TWO quote_components rows - one per area - matching how manual
  // quote-builder areas behave. Group key: componentId::quoteRoofAreaId.
  const componentGroupKeys = [...new Set(
    allMeasurementsForComponents
      .filter(m => m.componentId)
      .map(m => `${m.componentId}::${m.quoteRoofAreaId ?? ''}`)
  )];
  let componentsPayload: Array<Record<string, unknown>> = [];
  if (componentIds.length > 0) {
    const { data: libComps } = await supabase
      .from('component_library')
      .select('*')
      .in('id', componentIds);
    const libById = new Map((libComps || []).map(c => [c.id, c]));

    // Per-area pitch fix (2026-07-08, Shaun-confirmed spec): resolve the pitch
    // for every component group's roof area. Resolution order:
    //   1. Area measurement drawn in THIS save for that area (areaPitchByAreaId)
    //      - i.e. the pitch given to this area on the CURRENT plan.
    //   2. Stored quote_roof_area_entries.pitch_degrees for (area, current page)
    //      - pitch previously given on this plan.
    //   3. No pitch on this plan → the FIRST plan's pitch for this area
    //      (earliest entry with a pitch; per spec: "if there is no new pitch
    //      value added to the new plan, use the first plan's pitch value").
    //   4. Parent quote_roof_areas.calc_pitch_degrees (first-area-wins, same
    //      semantics as 3 - covers legacy areas with no stored entries).
    // Falls back to firstRoofAreaPitch only for legacy area-less groups.
    const groupAreaIds = [...new Set(
      componentGroupKeys
        .map(k => k.slice(k.indexOf('::') + 2))
        .filter((id): id is string => !!id)
    )];
    const groupPitchByAreaId = new Map<string, number>();
    for (const areaId of groupAreaIds) {
      const fromSave = areaPitchByAreaId.get(areaId);
      if (fromSave !== undefined && fromSave > 0) groupPitchByAreaId.set(areaId, fromSave);
    }
    const unresolvedAreaIds = groupAreaIds.filter(id => !groupPitchByAreaId.has(id));
    if (unresolvedAreaIds.length > 0) {
      const { data: entryPitchRows } = await supabase
        .from('quote_roof_area_entries')
        .select('quote_roof_area_id, page_id, pitch_degrees, created_at')
        .in('quote_roof_area_id', unresolvedAreaIds)
        .order('created_at', { ascending: true }) as unknown as { data: Array<{
          quote_roof_area_id: string;
          page_id: string | null;
          pitch_degrees: number | string | null;
          created_at: string;
        }> | null };
      for (const areaId of unresolvedAreaIds) {
        // Rows are ordered ASCENDING (oldest first).
        const rows = (entryPitchRows ?? []).filter(r => r.quote_roof_area_id === areaId);
        // Current plan: most recent pitch stored for this page (last match).
        const samePageRows = currentPageId
          ? rows.filter(r => r.page_id === currentPageId && Number(r.pitch_degrees ?? 0) > 0)
          : [];
        const samePage = samePageRows.length > 0 ? samePageRows[samePageRows.length - 1] : undefined;
        // Fallback: the FIRST plan's pitch = earliest entry with a pitch.
        const firstPlan = rows.find(r => Number(r.pitch_degrees ?? 0) > 0);
        if (samePage) groupPitchByAreaId.set(areaId, Number(samePage.pitch_degrees));
        else if (firstPlan) groupPitchByAreaId.set(areaId, Number(firstPlan.pitch_degrees));
      }
      const stillUnresolved = unresolvedAreaIds.filter(id => !groupPitchByAreaId.has(id));
      if (stillUnresolved.length > 0) {
        const { data: parentAreas } = await supabase
          .from('quote_roof_areas')
          .select('id, calc_pitch_degrees')
          .in('id', stillUnresolved);
        for (const a of parentAreas ?? []) {
          groupPitchByAreaId.set(a.id, Number(a.calc_pitch_degrees ?? 0));
        }
      }
    }

    componentsPayload = componentGroupKeys
      .map(groupKey => {
        const sepIdx = groupKey.indexOf('::');
        const componentId = groupKey.slice(0, sepIdx);
        const groupAreaId = groupKey.slice(sepIdx + 2) || null;
        const libComp = libById.get(componentId);
        if (!libComp) return null;
        // Current-page measurements only - no H-01 aggregation.
        const componentMeasurements = allMeasurementsForComponents.filter(
          m => m.componentId === componentId && (m.quoteRoofAreaId ?? null) === groupAreaId
        );
        const pitchType = libComp.default_pitch_type || 'none';
        // Per-area pitch fix (2026-07-08): pitch this group at ITS area's pitch.
        const groupPitch = groupAreaId
          ? (groupPitchByAreaId.get(groupAreaId) ?? firstRoofAreaPitch)
          : firstRoofAreaPitch;
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
          // v8 (2026-07-08): snapshot the input reference values used for this
          // entry so the quote builder can display them (READ-ONLY - nothing
          // reads entry_inputs for calculation).
          //  - preset height/depth: from component_library at save time
          //  - user height/depth: carried on the measurement (freestyle/volume_3d)
          let entryInputs: { height_m?: number; depth_m?: number; source?: 'preset' | 'user' } | null = null;
          if (m.type === 'multi_lineal_lxh' && heightMm && heightM > 0) {
            entryInputs = { height_m: heightM, source: 'preset' };
          } else if (m.type === 'area' && libComp.measurement_type === 'volume' && depthM) {
            entryInputs = { depth_m: depthM, source: 'preset' };
          } else if ((m.type === 'length_x_height_freestyle' || m.type === 'multi_lineal_lxh_freestyle') && m.entryInputs?.height_m) {
            entryInputs = { height_m: Number(m.entryInputs.height_m), source: 'user' };
          } else if (m.type === 'volume_3d' && m.entryInputs?.depth_m) {
            entryInputs = { depth_m: Number(m.entryInputs.depth_m), source: 'user' };
          }

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

          // 2026-09-03 (pitch-stale fix): entries attached from an existing
          // area via the "Use an existing area" dropdown now carry a
          // value_basis + plan_value snapshot. Recompute from the PLAN value
          // and re-apply the LIVE pitch for this area at save time, so a
          // pitch set/changed AFTER attaching always corrects the numbers:
          //   basis 'pitched' -> plan x live pitch factor (roof sheets etc.)
          //   basis 'plan'    -> plan, no pitch
          const ei = (m as { entryInputs?: { value_basis?: 'pitched' | 'plan'; plan_value?: number; pitch_applied?: boolean; source_geometry_id?: string } | null }).entryInputs;
          const hasLiveBasis = m.type === 'area' && ei && (ei.value_basis === 'pitched' || ei.value_basis === 'plan') && typeof ei.plan_value === 'number' && ei.plan_value > 0;
          if (hasLiveBasis) {
            metricValue = toMetricArea(ei!.plan_value!);
          }

          // Legacy (pre-2026-09-03) pitch_applied entries already carry the
          // PITCHED value baked in - never pitch twice.
          const pitchPreApplied = !hasLiveBasis && ei?.pitch_applied === true;
          // basis 'plan' explicitly opts out of pitch entirely.
          const basisPlanOnly = hasLiveBasis && ei!.value_basis === 'plan';

          const result = applyPitchAndWaste(
            metricValue,
            true,
            (pitchPreApplied || basisPlanOnly ? 'none' : pitchType) as any,
            (pitchPreApplied || basisPlanOnly) ? 0 : groupPitch,
            effectiveWasteType as any,
            wastePercent,
            effectiveWasteFixed
          );
          return {
            raw_value: metricValue,
            value_after_waste: result.afterWaste,
            sort_order: index,
            // Per-entry pitch (2026-07-08): actual pitch used for this entry so
            // the calc audit + UI can report it faithfully per page/area.
            pitch_degrees: basisPlanOnly ? 0 : groupPitch,
            // v8: input reference snapshot (display only).
            // P6 (deferred P4 item): the durable source-polygon link is preserved
            // on EVERY branch, not only the live-basis branch, so attached entries
            // keep their provenance even when the plan_value snapshot is absent
            // (legacy attached entries). Hydration + recompute already prefer it.
            entry_inputs: hasLiveBasis
              ? { ...(entryInputs ?? {}), value_basis: ei!.value_basis, plan_value: ei!.plan_value, ...(ei.source_geometry_id ? { source_geometry_id: ei.source_geometry_id } : {}) }
              : (pitchPreApplied
                ? { ...(entryInputs ?? {}), pitch_applied: true, ...(ei?.source_geometry_id ? { source_geometry_id: ei.source_geometry_id } : {}) }
                : (ei?.source_geometry_id
                  ? { ...(entryInputs ?? {}), source_geometry_id: ei.source_geometry_id }
                  : entryInputs)),
          };
        });

        const totalQuantity = entries.reduce((sum, e) => sum + e.value_after_waste, 0);
        const materialCost = totalQuantity * materialRate;
        const labourCost = totalQuantity * labourRate;

        return {
          component_library_id: componentId,
          // Area-ownership fix (2026-07-05): route this component group to its
          // owning roof area. The RPC uses this for per-area quote_components.
          quote_roof_area_id: groupAreaId,
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
          // Per-area pitch fix (2026-07-08): persist the pitch this component
          // group was calculated at (RPC v7 writes it to calc_pitch_degrees).
          calc_pitch_degrees: groupPitch,
          final_quantity: totalQuantity,
          material_cost: materialCost,
          labour_cost: labourCost,
          entries,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }

  // 3. Raw measurements list (mirrored to quote_takeoff_measurements 1:1).
  // Guard: coerce NaN/null/undefined to 0 to prevent NOT NULL constraint violations.
  const measurementsPayload = measurements.map(m => ({
    company_id: quote.company_id,
    component_library_id: m.componentId,
    measurement_type: m.type,
    measurement_value: (typeof m.value === 'number' && isFinite(m.value)) ? m.value : 0,
    measurement_unit: unit,
    canvas_points: m.points ?? null,
    is_visible: m.visible,
    // v8: user-entered height/depth passthrough (display only).
    entry_inputs: m.entryInputs ?? null,
    // Phase 7: page_id passed through when the caller supplies it (multi-page
    // takeoff). Omitted for single-page callers - RPC writes NULL.
    ...(m.pageId ? { page_id: m.pageId } : {}),
    // Phase 3: area-scoped measurement routing. Each measurement carries its
    // own quote_roof_area_id so the RPC can group by area.
    ...(m.quoteRoofAreaId ? { quote_roof_area_id: m.quoteRoofAreaId } : {}),
  }));

  // P0-3 (calibration hardening audit 2026-09-20): the AI recalibration path
  // persists measurements AND page calibration through the new
  // save_takeoff_atomic_v2 RPC in ONE database transaction, so a failed
  // calibration write can no longer leave recalibrated measurements behind.
  // Legacy path (no metadata / non-fatal calibration) keeps using
  // save_takeoff_atomic + the separate page update below, unchanged.
  const useAtomicCalibrationRpc =
    requireCalibrationCommit === true &&
    !!currentPageId &&
    calibrationMetadata != null &&
    calibrations != null;
  let calibrationBlock: Record<string, unknown> | null = null;
  if (useAtomicCalibrationRpc && currentPageId) {
    const { getCalibrationImageRevision } = await import('@/app/lib/takeoff/calibrationImageRevision');
    const imageRevision = await getCalibrationImageRevision(currentPageId);
    calibrationBlock = {
      page_id: currentPageId,
      scale_calibration: calibrations,
      calibration_metadata: calibrationMetadata,
      ...(imageRevision ? { image_revision: imageRevision } : {}),
    };
  }

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
    // P0-3: calibration block rides the same payload; v2 commits it with the
    // measurements in one transaction.
    ...(calibrationBlock ? { calibration: calibrationBlock } : {}),
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
  let rpcName = calibrationBlock ? 'save_takeoff_atomic_v2' : 'save_takeoff_atomic';
  const rpcFn = rpcName as 'save_takeoff_atomic';
  let { error: rpcError } = await supabase.rpc(rpcFn, rpcArgs);

  // Legacy fallback: when the v2 RPC is not deployed yet (migration not
  // applied), strip the calibration block and retry through the original
  // RPC + the separate (fatal-on-requireCalibrationCommit) page update.
  // This keeps the pre-migration behaviour working when args/RPC are absent.
  if (rpcError && rpcName === 'save_takeoff_atomic_v2') {
    const fnMissing =
      rpcError.code === 'PGRST202' ||
      /could not find the function|does not exist/i.test(rpcError.message ?? '');
    if (fnMissing) {
      const { calibration: _strip, ...legacyPayload } = payload as Record<string, unknown>;
      rpcName = 'save_takeoff_atomic';
      const legacyArgs = {
        p_quote_id: quoteId,
        p_payload: legacyPayload,
      } as unknown as { p_quote_id: string; p_payload: never };
      rpcError = (await supabase.rpc('save_takeoff_atomic', legacyArgs)).error;
      // Re-enable the legacy separate (fatal) page update below.
      calibrationBlock = null;
    }
  }

  if (rpcError) {
    console.error('[SaveTakeoff] RPC error:', rpcError);
    // P1-1a version guard: surface a clear reload prompt instead of a generic error.
    if (rpcError.message?.includes('STALE_TAKEOFF_VERSION')) {
      return { success: false, error: 'STALE_TAKEOFF_VERSION: Your takeoff was edited in another tab. Please reload the page to continue.' };
    }
    return { success: false, error: `Failed to save takeoff: ${rpcError.message}` };
  }

  // Canvas-rework: persist calibration data to the takeoff_pages row so
  // re-entry can restore the scale. Default NON-FATAL (legacy callers rely on
  // measurements-only saves succeeding even if this row update fails).
  // P3: with requireCalibrationCommit the failure is FATAL and surfaced as
  // COMMIT_FAILED - the client rolls back to the prior state, so a failed
  // calibration save can never be reported as success.
  if (currentPageId && calibrations != null && !calibrationBlock) {
    // Legacy path: separate page update. Skipped entirely when the v2 RPC
    // already committed the calibration atomically with the measurements.
    let calUpdateError: string | null = null;
    try {
      // P4 (spec 11.1/11.3): write the versioned envelope + server-established
      // image revision in the SAME row update as the legacy array (rolling
      // deployment: legacy readers keep working, spec 11.4). The image
      // revision is established SERVER-side (sha256 content digest) - the
      // client never supplies it. A null revision here just means the page
      // has no resolvable storage object; the metadata envelope still saves.
      let imageRevision: string | null = null;
      if (calibrationMetadata != null) {
        const { getCalibrationImageRevision } = await import('@/app/lib/takeoff/calibrationImageRevision');
        imageRevision = await getCalibrationImageRevision(currentPageId);
      }
      const calUpdate: Record<string, unknown> = {
        scale_calibration: calibrations,
      };
      if (calibrationMetadata != null) {
        calUpdate.calibration_metadata = calibrationMetadata;
        if (imageRevision) calUpdate.image_revision = imageRevision;
      }
      const { error: calError } = await supabase
        .from('takeoff_pages')
        .update(calUpdate as never)
        .eq('id', currentPageId)
        .eq('quote_id', quoteId);
      if (calError) calUpdateError = calError.message;
    } catch (err) {
      calUpdateError = err instanceof Error ? err.message : String(err);
    }
    if (calUpdateError) {
      if (requireCalibrationCommit) {
        console.error('[SaveTakeoff] COMMIT_FAILED: calibration persistence failed:', calUpdateError);
        return {
          success: false,
          error: `COMMIT_FAILED: calibration could not be persisted (${calUpdateError}). No changes were kept - please retry.`,
        };
      }
      console.warn('[SaveTakeoff] Failed to persist calibrations:', calUpdateError);
    }
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

  // revalidatePath removed: TakeoffWorkstation manages all state client-side.
  // Server re-render was causing the canvas/panels to reset during auto-save
  // on area/page switches.
  return { success: true as const };
}

// ─── P1-1a: Hydration helpers ────────────────────────────────────────────

export interface TakeoffHydrationPage {
  id: string;
  pageOrder: number;
  pageName: string | null;
  imagePath: string | null;
  imageUrl: string | null; // signed URL, minted server-side
  scaleCalibration: unknown | null; // persisted calibration data for canvas reconstruction
  /** P4 (spec 11.1): versioned calibration envelope (calibrationCodec v1).
   *  Null = legacy row - read scaleCalibration instead. */
  calibrationMetadata: unknown | null;
  /** P4 (spec 5.3): server-established immutable source-image revision
   *  (sha256 content digest + orientation version). Null = not established. */
  imageRevision: string | null;
  /** AI Takeoff: stored scan result for "Reset AI Entries". */
  aiScanResult: unknown | null;
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
  quoteRoofAreaId: string | null;
  /** Per-entry pitch (2026-07-06): true pitch this area polygon was saved
   *  with, from quote_roof_area_entries.pitch_degrees. Null for component
   *  measurements and legacy rows with no matching entry. */
  pitch: number | null;
  /** v8 (2026-07-08): user-entered height/depth reference values (metric)
   *  saved with this measurement. Display-only passthrough.
   *  P4 (spec 10.3): attached-area entries also hydrate value_basis/plan_value
   *  and the durable source_geometry_id provenance link (preferred by
   *  calibration recompute over heuristic matching). */
  entryInputs: {
    height_m?: number | null;
    depth_m?: number | null;
    value_basis?: 'pitched' | 'plan';
    plan_value?: number;
    pitch_applied?: boolean;
    source_geometry_id?: string;
  } | null;
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
  // P4: read the new columns additively. Pre-migration DBs reject the
  // expanded select (PGRST204), so fall back to the legacy select - hydration
  // then just returns null metadata/revision and the legacy path is unchanged.
  type HydratedPageRow = {
    id: string;
    page_order: number;
    page_name: string | null;
    image_storage_path: string | null;
    scale_calibration: unknown;
    calibration_metadata?: unknown;
    image_revision?: string | null;
    ai_scan_result?: unknown;
  };
  const pagesExpanded = await supabase
    .from('takeoff_pages')
    .select('id, page_order, page_name, image_storage_path, scale_calibration, calibration_metadata, image_revision, ai_scan_result')
    .eq('quote_id', quoteId)
    .order('page_order', { ascending: true });
  let pages: HydratedPageRow[] | null = null;
  if (!pagesExpanded.error) {
    pages = (pagesExpanded.data ?? null) as unknown as HydratedPageRow[] | null;
  } else if (/calibration_metadata|image_revision|Could not find|does not exist/i.test(pagesExpanded.error.message)) {
    const pagesLegacy = await supabase
      .from('takeoff_pages')
      .select('id, page_order, page_name, image_storage_path, scale_calibration, ai_scan_result')
      .eq('quote_id', quoteId)
      .order('page_order', { ascending: true });
    pages = pagesLegacy.error ? null : ((pagesLegacy.data ?? null) as unknown as HydratedPageRow[] | null);
  }

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
        scaleCalibration: p.scale_calibration ?? null,
        // P4: versioned envelope + server-established image revision. Reading
        // them is additive - pre-migration DBs return nulls for both.
        calibrationMetadata: p.calibration_metadata ?? null,
        imageRevision: p.image_revision ?? null,
        aiScanResult: p.ai_scan_result ?? null,
      };
    }),
  );

  // 3. Measurements for all pages
  const { data: measurements } = await supabase
    .from('quote_takeoff_measurements')
    .select('id, component_library_id, measurement_type, measurement_value, measurement_unit, canvas_points, is_visible, page_id, quote_roof_area_id, entry_inputs')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: true });

  // 3b. Per-entry pitch (2026-07-06): quote_takeoff_measurements has no pitch
  // column - the true pitch each polygon was saved with lives on
  // quote_roof_area_entries.pitch_degrees. Without this, re-entry hydration
  // falls back to the PARENT area's calc_pitch_degrees, and the next save
  // silently overwrites per-entry pitches (35° → 25° bug, 2026-07-06).
  //
  // Matching: the RPC inserts area entries in the same order as the payload's
  // roof_areas array, which the client builds from area measurements in draw
  // order - so within a (quote_roof_area_id, page_id) group, entries zip 1:1
  // to area-type measurements by insertion order.
  const { data: areaIdRows } = await supabase
    .from('quote_roof_areas')
    .select('id')
    .eq('quote_id', quoteId);
  const areaIds = (areaIdRows ?? []).map(a => a.id);

  const pitchQueues = new Map<string, number[]>();
  if (areaIds.length > 0) {
    const { data: areaEntries } = await supabase
      .from('quote_roof_area_entries')
      .select('quote_roof_area_id, page_id, pitch_degrees, sort_order, created_at')
      .in('quote_roof_area_id', areaIds)
      .eq('source', 'takeoff')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    (areaEntries ?? []).forEach(e => {
      const key = `${e.quote_roof_area_id}::${(e as { page_id?: string | null }).page_id ?? ''}`;
      if (!pitchQueues.has(key)) pitchQueues.set(key, []);
      const p = (e as { pitch_degrees?: number | string | null }).pitch_degrees;
      pitchQueues.get(key)!.push(p != null ? Number(p) : 0);
    });
  }

  const hydratedMeasurements: TakeoffHydrationMeasurement[] = (measurements ?? []).map(m => {
    let pitch: number | null = null;
    if (m.component_library_id === null && m.measurement_type === 'area') {
      const areaId = (m as { quote_roof_area_id?: string | null }).quote_roof_area_id ?? null;
      if (areaId) {
        const queue = pitchQueues.get(`${areaId}::${m.page_id ?? ''}`);
        if (queue && queue.length > 0) pitch = queue.shift()!;
      }
    }
    return {
      id: m.id,
      componentId: m.component_library_id,
      type: m.measurement_type,
      value: Number(m.measurement_value),
      unit: m.measurement_unit,
      points: (m.canvas_points as { x: number; y: number }[] | null),
      visible: m.is_visible ?? true,
      pageId: m.page_id,
      quoteRoofAreaId: (m as { quote_roof_area_id?: string | null }).quote_roof_area_id ?? null,
      pitch,
      // v8: display-only passthrough so re-save doesn't wipe user H/D values.
      // P4: value_basis/plan_value/source_geometry_id ride the same jsonb.
      entryInputs: (m as { entry_inputs?: {
        height_m?: number | null;
        depth_m?: number | null;
        value_basis?: 'pitched' | 'plan';
        plan_value?: number;
        pitch_applied?: boolean;
        source_geometry_id?: string;
      } | null }).entry_inputs ?? null,
    };
  });

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
/**
 * Fetch the authoritative takeoff session version from the DB.
 * Used after save chains (main save + cached-area flushes) so the client's
 * optimistic version cursor never drifts from the DB - drift caused the
 * false "Takeoff edited in another tab" (STALE_TAKEOFF_VERSION) errors.
 * Returns null when no session row exists yet.
 */
export async function getTakeoffSessionVersion(quoteId: string): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  // RLS scopes this read to the caller's company via the quotes join policy.
  const { data, error } = await supabase
    .from('takeoff_sessions')
    .select('version')
    .eq('quote_id', quoteId)
    .maybeSingle();
  if (error) return null;
  return data?.version ?? null;
}

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
 * Create a new roof area for a quote with auto-deduplicated naming.
 * When `label` is supplied, inserts with that label directly (dedup:
 * if label exists, appends " 2", " 3"…). When omitted, auto-picks the
 * next free "Area N". Returns the new area's ID + label so the client
 * can add it to the panel immediately.
 */
export async function createNewTakeoffArea(
  quoteId: string,
  label?: string,
): Promise<{ ok: boolean; areaId?: string; label?: string; error?: string }> {
  try {
    const { requireCompanyContext } = await import('@/app/lib/supabase/server');
    const profile = await requireCompanyContext();
    const admin = createAdminClient();

    // Admin writes bypass RLS, so authorise the quote explicitly first.
    const { data: ownedQuote, error: ownershipError } = await admin.from('quotes')
      .select('id').eq('id', quoteId).eq('company_id', profile.company_id).maybeSingle();
    if (ownershipError || !ownedQuote) return { ok: false, error: 'Quote not found or access denied.' };

    // Load all existing area labels for this quote.
    const { data: existing } = await admin
      .from('quote_roof_areas')
      .select('label')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });

    const existingLabels = new Set((existing ?? []).map(a => a.label));

    // Resolve the final label: user-supplied (with dedup) or auto "Area N".
    let finalLabel: string;
    if (label && label.trim()) {
      const base = label.trim();
      if (!existingLabels.has(base)) {
        finalLabel = base;
      } else {
        // Dedup: append " 2", " 3", …
        let suffix = 2;
        while (existingLabels.has(`${base} ${suffix}`)) suffix++;
        finalLabel = `${base} ${suffix}`;
      }
    } else {
      // Auto-name: find the next free "Area N".
      let n = 1;
      while (existingLabels.has(`Area ${n}`)) n++;
      finalLabel = `Area ${n}`;
    }

    const { count: areaCount } = await admin
      .from('quote_roof_areas')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', quoteId);

    const { data: newArea, error: areaError } = await admin
      .from('quote_roof_areas')
      .insert({
        quote_id: quoteId,
        label: finalLabel,
        input_mode: 'calculated' as const,
        final_value_sqm: 0,
        computed_sqm: 0,
        calc_pitch_degrees: 0,
        is_locked: false,
        sort_order: (areaCount ?? 0) + 1,
      })
      .select('id, label')
      .single();

    if (areaError || !newArea) {
      return { ok: false, error: areaError?.message ?? 'Failed to create area' };
    }

    return { ok: true, areaId: newArea.id, label: newArea.label };
  } catch (err) {
    console.error('[createNewTakeoffArea] Error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Batch 6 fix: rename a roof area in the DB so the user's chosen label
 * persists across sessions. Called from handleConfirmAreaAssignment and
 * the area switcher inline rename.
 */
export async function renameTakeoffArea(
  areaId: string,
  label: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { requireCompanyContext } = await import('@/app/lib/supabase/server');
    const profile = await requireCompanyContext();
    const admin = createAdminClient();

    // Direct ownership check: load the area's quote_id, then verify the
    // quote belongs to the caller's company. This replaces the fragile
    // `.in('quote_id', subquery)` pattern that could fail on large datasets.
    const { data: area } = await admin
      .from('quote_roof_areas')
      .select('id, quote_id')
      .eq('id', areaId)
      .maybeSingle();
    if (!area) return { ok: false, error: 'Area not found' };

    const { data: quote } = await admin
      .from('quotes')
      .select('id')
      .eq('id', area.quote_id)
      .eq('company_id', profile.company_id)
      .maybeSingle();
    if (!quote) return { ok: false, error: 'Unauthorized' };

    const { error } = await admin
      .from('quote_roof_areas')
      .update({ label: label.trim() })
      .eq('id', areaId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    console.error('[renameTakeoffArea] Error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
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

/**
 * Phase 5: Delete a takeoff area and all its associated data.
 * - Deletes quote_roof_area_entries (sub-measurements)
 * - Deletes quote_takeoff_measurements for this area
 * - Detaches quote_components (sets quote_roof_area_id = NULL)
 * - Deletes the quote_roof_areas row itself
 * - Recalculates quote component totals
 * Ownership: verified via quote → company chain.
 */
export async function deleteTakeoffArea(
  areaId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { requireCompanyContext } = await import('@/app/lib/supabase/server');
    const profile = await requireCompanyContext();
    const admin = createAdminClient();

    // Ownership check: load area's quote_id, verify quote belongs to company.
    const { data: area } = await admin
      .from('quote_roof_areas')
      .select('id, quote_id')
      .eq('id', areaId)
      .maybeSingle();
    if (!area) return { ok: false, error: 'Area not found' };

    const { data: quote } = await admin
      .from('quotes')
      .select('id')
      .eq('id', area.quote_id)
      .eq('company_id', profile.company_id)
      .maybeSingle();
    if (!quote) return { ok: false, error: 'Unauthorized' };

    const quoteId = area.quote_id;

    // 1. Delete sub-measurement entries
    await admin.from('quote_roof_area_entries').delete().eq('quote_roof_area_id', areaId);

    // 2. Delete takeoff measurements for this area
    await admin.from('quote_takeoff_measurements').delete().eq('quote_roof_area_id', areaId);

    // 3. Detach quote_components (set quote_roof_area_id = NULL, don't delete components)
    await admin.from('quote_components').update({ quote_roof_area_id: null }).eq('quote_roof_area_id', areaId);

    // 4. Detach takeoff_pages (set quote_roof_area_id = NULL)
    await admin.from('takeoff_pages').update({ quote_roof_area_id: null }).eq('quote_roof_area_id', areaId);

    // 5. Delete the area row itself
    const { error: deleteError } = await admin.from('quote_roof_areas').delete().eq('id', areaId);
    if (deleteError) return { ok: false, error: deleteError.message };

    // 6. Recalculate quote component totals
    await recalcAllQuoteComponents(quoteId);

    return { ok: true };
  } catch (err) {
    console.error('[deleteTakeoffArea] Error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * AI Takeoff: Batch-create quote_roof_areas records for AI-detected areas.
 *
 * Called during the AI Apply flow to create real DB parent area records
 * with confirmed names and pitches. Returns the created IDs so the client
 * can map AI polygons and component measurements to real parent IDs.
 */
export async function batchCreateAiRoofAreas(
  quoteId: string,
  areas: { name: string; pitch: number }[],
): Promise<{ ok: boolean; areaIds?: string[]; error?: string }> {
  try {
    const { requireCompanyContext } = await import('@/app/lib/supabase/server');
    const profile = await requireCompanyContext();

    const admin = createAdminClient();

    // Verify quote belongs to caller's company
    const { data: quote } = await admin
      .from('quotes')
      .select('id')
      .eq('id', quoteId)
      .eq('company_id', profile.company_id)
      .single();
    if (!quote) return { ok: false, error: 'Quote not found.' };

    // Insert one at a time using the Supabase client (avoids bulk insert issues)
    const areaIds: string[] = [];
    for (const area of areas) {
      const { data: newArea, error: insertError } = await admin
        .from('quote_roof_areas')
        .insert({
          quote_id: quoteId,
          label: area.name,
          input_mode: 'calculated',
          final_value_sqm: 0,
          computed_sqm: 0,
          calc_pitch_degrees: area.pitch,
          is_locked: false,
        })
        .select('id')
        .single();

      if (insertError || !newArea) {
        console.error('[batchCreateAiRoofAreas] Insert error:', insertError);
        return { ok: false, error: insertError?.message ?? 'Failed to create area' };
      }
      areaIds.push(newArea.id);
    }

    return {
      ok: true,
      areaIds,
    };
  } catch (err) {
    console.error('[batchCreateAiRoofAreas] Error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/** P3 (spec 10.1): calibration-only commit for pages with no measurements yet.
 *  The measurement save path safe-skips empty pages, so initial calibration
 *  persists through this verified, quote+page-scoped update. Unlike the legacy
 *  non-fatal calibration write inside saveTakeoffMeasurements, failures here
 *  are returned to the caller (surfaced as COMMIT_FAILED by the client).
 *  P4 (spec 11): optionally also persists the versioned calibration_metadata
 *  envelope and the server-established image_revision in the same update. */
export async function persistPageCalibration(
  quoteId: string,
  pageId: string,
  calibrations: unknown,
  calibrationMetadata?: unknown,
): Promise<{ success: true; imageRevision: string | null } | { success: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();
  if (quoteError || !quote) {
    return { success: false, error: 'Quote not found' };
  }

  // P4: server-established image revision (sha256 content digest), resolved
  // from the page's storage object. Null just means no resolvable object.
  let imageRevision: string | null = null;
  if (calibrationMetadata != null) {
    const { getCalibrationImageRevision } = await import('@/app/lib/takeoff/calibrationImageRevision');
    imageRevision = await getCalibrationImageRevision(pageId);
  }

  const pageUpdate: Record<string, unknown> = {
    scale_calibration: calibrations,
  };
  if (calibrationMetadata != null) {
    // Keep the envelope and page column on the same server-resolved frame.
    // The client must never mint an image revision from presentation state.
    pageUpdate.calibration_metadata = imageRevision && typeof calibrationMetadata === 'object' && !Array.isArray(calibrationMetadata)
      ? { ...calibrationMetadata, imageRevision }
      : calibrationMetadata;
    if (imageRevision) pageUpdate.image_revision = imageRevision;
  }

  const { data: updatedPage, error } = await supabase
    .from('takeoff_pages')
    .update(pageUpdate as never)
    .eq('id', pageId)
    .eq('quote_id', quoteId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[persistPageCalibration] Error:', error);
    return { success: false, error: error.message };
  }
  if (!updatedPage) return { success: false, error: 'The plan could not be updated. Check access and reload.' };
  return { success: true, imageRevision };
}

// -- M5: update-in-place roof-area geometry edit (patch_052) ----------------

export interface UpdateTakeoffAreaGeometryInput {
  quoteId: string;
  /** Durable quote_takeoff_measurements row id of the area-type polygon. */
  measurementId: string;
  /** Page the polygon lives on (ownership + scale resolution). */
  pageId: string;
  /** New outline points in the page's scene frame (takeoff-scene-v1). */
  points: { x: number; y: number }[];
  /** Client's last-read takeoff session version (optimistic guard, O13). */
  sessionVersion: number | null;
}

export type UpdateTakeoffAreaGeometryResult =
  | {
      success: true;
      /** Server-derived area value (measurement_value, row's unit). */
      value: number;
      sessionVersion: number | null;
    }
  | {
      success: false;
      error: string;
      /** True when the failure is a session-version conflict (O13): the
       *  client must offer reload/review and KEEP the user's draft � never
       *  force-overwrite. */
      staleVersion?: boolean;
    };

/**
 * Mobile takeoff M5 (spec �8.5/�11.3): updates an EXISTING saved roof area's
 * geometry by measurement id through the additive patch_052 RPC � never
 * delete+insert, never a duplicate row. The RPC re-validates geometry,
 * re-derives the area from the page's own calibration scale server-side,
 * recomputes source-linked dependent entries at constant scale (O07) and
 * guards concurrency with the same optimistic session-version check as every
 * other save (O13). Idempotent by construction (UPDATE by id): a retry after
 * a lost save response re-applies the same geometry (O12).
 */
export async function updateTakeoffAreaGeometry(
  input: UpdateTakeoffAreaGeometryInput,
): Promise<UpdateTakeoffAreaGeometryResult> {
  const supabase = await createSupabaseServerClient();

  // Ownership pre-check mirroring saveTakeoffMeasurements (clear error before
  // the RPC; RLS still applies inside it).
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', input.quoteId)
    .maybeSingle();
  if (!quote) {
    return { success: false, error: 'Quote not found.' };
  }

  // The generated RPC name union does not know the patch_052 function yet —
  // cast once at the boundary (same pattern as saveTakeoffMeasurements v2).
  const rpcFn = 'update_takeoff_area_geometry_v1' as 'save_takeoff_atomic';
  const { data, error } = await supabase.rpc(rpcFn, {
    p_quote_id: input.quoteId,
    p_measurement_id: input.measurementId,
    p_page_id: input.pageId,
    p_points: input.points,
    p_session_version: input.sessionVersion,
  } as unknown as { p_quote_id: string; p_payload: never });

  if (error) {
    const message = error.message ?? String(error);
    if (/STALE_TAKEOFF_VERSION/i.test(message)) {
      return {
        success: false,
        error: 'Takeoff edited elsewhere. Reload to review � your edits are kept.',
        staleVersion: true,
      };
    }
    console.error('[updateTakeoffAreaGeometry] RPC error:', message);
    return { success: false, error: message };
  }

  const result = (Array.isArray(data) ? data[0] : data) as unknown as
    | { ok?: boolean; value?: number | string; session_version?: number | null }
    | null;
  return {
    success: true,
    value: result?.value != null ? Number(result.value) : 0,
    sessionVersion:
      result?.session_version != null ? Number(result.session_version) : null,
  };
}
