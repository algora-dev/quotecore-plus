'use server';

// Quote data loader - uses customer_quote_lines table (2026-04-14)

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { MeasurementSystem } from '@/app/lib/types';
import {
  convertLinearToMetric,
  convertAreaFt2ToMetric,
} from '@/app/lib/measurements/conversions';

export interface QuoteComponentData {
  id: string;
  name: string;
  component_library_id: string | null;
  final_quantity: number;
  measurement_type: string;
  sort_order: number;
  component_library?: {
    flashing_ids: string[] | null;
  } | null;
  measurements?: { measurement_value: number; measurement_unit: string }[];
}

export interface QuoteData {
  id: string;
  quote_number: string;
  job_name: string | null;
  customer_name: string | null;
  /** Quote's locked measurement system. Drives the unit labels we paint into the order form. */
  measurement_system: MeasurementSystem;
  components: QuoteComponentData[];
}

export async function loadQuoteData(quoteId: string): Promise<QuoteData | null> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();
    
    // Load quote header
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, quote_number, job_name, customer_name, measurement_system')
      .eq('id', quoteId)
      .eq('company_id', profile.company_id)
      .single();
    
    if (quoteError || !quote) {
      console.error('[QuoteLoader] Quote not found:', quoteError);
      return null;
    }
    
    // Load quote components with component_library join AND separate takeoff measurements query
    console.log('[QuoteLoader] Loading quote_components for quote:', quoteId);
    const { data: components, error: componentsError } = await supabase
      .from('quote_components')
      .select(`
        id,
        name,
        component_library_id,
        final_quantity,
        measurement_type,
        sort_order,
        component_library:component_library_id(flashing_ids)
      `)
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });
    
    // Load takeoff measurements (digital mode - linked to component_library_id)
    const { data: takeoffMeasurements } = await supabase
      .from('quote_takeoff_measurements')
      .select('id, component_library_id, measurement_value, measurement_unit')
      .eq('quote_id', quoteId)
      .eq('is_visible', true);
    
    // Load component entries (manual mode - linked to quote_component_id)
    const compIds = (components || []).map((c: any) => c.id);
    const { data: componentEntries } = compIds.length > 0
      ? await supabase
          .from('quote_component_entries')
          .select('id, quote_component_id, raw_value, value_after_waste')
          .in('quote_component_id', compIds)
      : { data: [] };
    
    if (componentsError) {
      console.error('[QuoteLoader] Components load error:', componentsError);
      console.error('[QuoteLoader] Error details:', JSON.stringify(componentsError));
      return {
        ...quote,
        components: [],
      };
    }
    
    console.log('[QuoteLoader] Loaded', components?.length || 0, 'components');
    
    // Group takeoff measurements by component_library_id (digital mode)
    const measurementsByLibraryId = new Map<string, typeof takeoffMeasurements>();
    takeoffMeasurements?.forEach(m => {
      if (m.component_library_id) {
        const existing = measurementsByLibraryId.get(m.component_library_id) || [];
        measurementsByLibraryId.set(m.component_library_id, [...existing, m]);
      }
    });
    
    // Group component entries by quote_component_id (manual mode)
    const entriesByCompId = new Map<string, typeof componentEntries>();
    componentEntries?.forEach(e => {
      if (e.quote_component_id) {
        const existing = entriesByCompId.get(e.quote_component_id) || [];
        entriesByCompId.set(e.quote_component_id, [...existing, e]);
      }
    });
    
    // Normalize components and attach measurements from BOTH sources.
    //
    // CRITICAL UNIT HANDLING:
    //   - quote_takeoff_measurements (digital mode) stores raw calibration
    //     values: feet on imperial takeoffs, metres on metric. The
    //     measurement_unit column carries the truth ('feet' or 'meters').
    //   - quote_component_entries (manual mode) stores values that are
    //     already canonical metric, since the manual builder converts on
    //     input.
    //
    // The order form below assumes `measurement_value` is canonical metric,
    // so we normalise digital-mode rows here by converting feet -> metres
    // for linear, and ft² -> m² for area. After this hop every measurement
    // out of the loader is in metric, regardless of source.
    const normalizedComponents = components?.map((comp: any) => {
      // Try takeoff measurements first (digital mode)
      const rawTakeoffMeasurements = comp.component_library_id
        ? measurementsByLibraryId.get(comp.component_library_id) || []
        : [];
      let measurements = rawTakeoffMeasurements.map((m: any) => {
        const isFeet = m.measurement_unit === 'feet';
        // 'line' / 'area' / 'point' are the only types in this table.
        // Linear (line) -> divide by 3.28084. Area -> divide by 10.7639.
        // Points pass through.
        let metricValue = Number(m.measurement_value);
        if (isFeet) {
          if (m.measurement_type === 'line') metricValue = convertLinearToMetric(metricValue);
          else if (m.measurement_type === 'area') metricValue = convertAreaFt2ToMetric(metricValue);
        }
        return {
          ...m,
          measurement_value: metricValue,
          measurement_unit: m.measurement_type === 'line' ? 'm' : m.measurement_type === 'area' ? 'm²' : (m.measurement_unit || 'pcs'),
        };
      });

      // If no takeoff measurements, use component entries (manual mode)
      if (measurements.length === 0) {
        const entries = entriesByCompId.get(comp.id) || [];
        if (entries.length > 0) {
          measurements = entries.map((e: any) => ({
            id: e.id,
            component_library_id: comp.component_library_id,
            measurement_value: e.value_after_waste,
            measurement_unit: comp.measurement_type === 'lineal' ? 'm' : comp.measurement_type === 'area' ? 'm²' : 'pcs',
          }));
        }
      }
      
      return {
        id: comp.id,
        name: comp.name,
        component_library_id: comp.component_library_id,
        final_quantity: comp.final_quantity,
        measurement_type: comp.measurement_type,
        sort_order: comp.sort_order,
        component_library: Array.isArray(comp.component_library) && comp.component_library.length > 0
          ? comp.component_library[0]
          : comp.component_library,
        measurements,
      };
    }) || [];
    
    return {
      ...quote,
      components: normalizedComponents,
    };
  } catch (error) {
    console.error('[QuoteLoader] Unexpected error:', error);
    return null;
  }
}
