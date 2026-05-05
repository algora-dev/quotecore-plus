'use server';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { applyPitchAndWaste, rafterPitchFactor } from '@/app/lib/pricing/engine';

interface TakeoffMeasurement {
  componentId: string | null; // null for informational roof areas
  type: 'line' | 'area' | 'point';
  value: number;
  pitch?: number; // Pitch in degrees (for roof areas)
  name?: string; // Name (for roof areas)
  points?: { x: number; y: number }[];
  visible: boolean;
}

export async function saveTakeoffMeasurements(
  quoteId: string,
  measurements: TakeoffMeasurement[],
  unit: string,
  canvasImageUrl?: string,
  linesImageUrl?: string
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

  // Pre-compute everything in TS (pitch/waste math lives in pricing/engine.ts), then push
  // a single JSONB payload through the save_takeoff_atomic RPC so the delete + all inserts
  // happen inside one transaction. Replaces the previous "delete then insert" pattern that
  // could lose user data if any step failed mid-flight.

  // 1. Roof areas (informational area measurements with no componentId).
  const roofAreaMeasurements = measurements.filter(m => !m.componentId && m.type === 'area');
  const roofAreasPayload = roofAreaMeasurements.map((m, i) => {
    const pitchDegrees = m.pitch || 0;
    const pitchFactor = pitchDegrees > 0 ? rafterPitchFactor(pitchDegrees) : 1;
    const pitchedArea = m.value * pitchFactor;
    return {
      label: m.name || `Roof Area ${i + 1}`,
      final_value_sqm: pitchedArea,
      computed_sqm: pitchedArea,
      calc_pitch_degrees: pitchDegrees,
    };
  });
  const firstRoofAreaPitch = roofAreaMeasurements[0]?.pitch || 0;

  // 2. Components + their entries (linear measurements grouped by componentId).
  // We need to fetch the component_library rows up-front to compute pitch/waste correctly.
  const componentIds = [...new Set(measurements.filter(m => m.componentId).map(m => m.componentId!))];
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
        const componentMeasurements = measurements.filter(m => m.componentId === componentId);
        const pitchType = libComp.default_pitch_type || 'none';
        const wasteType = libComp.default_waste_type || 'none';
        const wastePercent = libComp.default_waste_percent || 0;
        const wasteFixed = libComp.default_waste_fixed || 0;
        const materialRate = libComp.default_material_rate || 0;
        const labourRate = libComp.default_labour_rate || 0;

        const entries = componentMeasurements.map((m, index) => {
          const result = applyPitchAndWaste(
            m.value,
            true,
            pitchType as any,
            firstRoofAreaPitch,
            wasteType as any,
            wastePercent,
            wasteFixed
          );
          return {
            raw_value: m.value,
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
  }));

  const payload = {
    canvas_image_url: canvasImageUrl ?? null,
    lines_image_url: linesImageUrl ?? null,
    measurements: measurementsPayload,
    roof_areas: roofAreasPayload,
    components: componentsPayload,
  };

  const { error: rpcError } = await supabase.rpc('save_takeoff_atomic', {
    p_quote_id: quoteId,
    p_payload: payload,
  });

  if (rpcError) {
    console.error('[SaveTakeoff] RPC error:', rpcError);
    throw new Error(`Failed to save takeoff: ${rpcError.message}`);
  }

  revalidatePath(`/[workspaceSlug]/quotes/${quoteId}`);
  return { success: true };
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
