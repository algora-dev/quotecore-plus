// QuoteCore+ v2 shared types
export type ComponentType = 'main' | 'extra';
export type MeasurementType = 'area' | 'lineal' | 'quantity' | 'fixed';
export type MeasurementSystem = 'metric' | 'imperial';
export type InputMode = 'final' | 'calculated';
export type WasteType = 'percent' | 'fixed' | 'none';
export type PitchType = 'none' | 'rafter' | 'valley_hip';
export type QuoteStatus = 'draft' | 'confirmed' | 'sent' | 'accepted' | 'declined' | 'expired' | 'archived';
export type LineType = 'component' | 'custom' | 'roof_area_header';

export function unitForMeasurement(mt: MeasurementType): string {
  switch (mt) {
    case 'area': return 'm²';
    case 'lineal': return 'm';
    case 'quantity': return 'each';
    case 'fixed': return 'fixed';
    default: return '';
  }
}

export function wasteAmountSuffix(wt: WasteType, mt: MeasurementType): string {
  if (wt === 'percent') return '%'; if (wt === 'fixed') return unitForMeasurement(mt); return '';
}

export function entryLabel(mt: MeasurementType): string {
  switch (mt) {
    case 'area': return 'area';
    case 'lineal': return 'length';
    case 'quantity': return 'items';
    case 'fixed': return 'value';
    default: return '';
  }
}

export function addMoreLabel(mt: MeasurementType): string {
  switch (mt) {
    case 'area': return 'Add more areas';
    case 'lineal': return 'Add more lengths';
    case 'quantity': return 'Add more items';
    case 'fixed': return 'Add entry';
    default: return 'Add entry';
  }
}

export interface ComponentLibraryRow {
  id: string; company_id: string; name: string; component_type: ComponentType; measurement_type: MeasurementType;
  default_material_rate: number; default_labour_rate: number; default_waste_type: WasteType;
  default_waste_percent: number; default_waste_fixed: number; default_pitch_type: PitchType;
  show_price_default: boolean; show_dimensions_default: boolean;
  is_active: boolean; sort_order: number; created_at: string; updated_at: string;
}

export interface ComponentLibraryInsert {
  name: string; component_type: ComponentType; measurement_type: MeasurementType;
  default_material_rate?: number; default_labour_rate?: number; default_waste_type?: WasteType;
  default_waste_percent?: number; default_waste_fixed?: number; default_pitch_type?: PitchType; sort_order?: number;
}

export interface TemplateRow {
  id: string; company_id: string; name: string; description: string | null;
  roofing_profile: string | null; is_active: boolean; created_at: string; updated_at: string;
}

export interface TemplateRoofAreaRow {
  id: string; template_id: string; label: string; default_input_mode: InputMode; sort_order: number; created_at: string;
}

export interface TemplateComponentRow {
  id: string; template_id: string; component_library_id: string; template_roof_area_id: string | null;
  component_type: ComponentType; override_material_rate: number | null; override_labour_rate: number | null;
  override_waste_type: WasteType | null; override_waste_percent: number | null; override_waste_fixed: number | null;
  override_pitch_type: PitchType | null; is_included_by_default: boolean; sort_order: number; created_at: string;
  component_library?: ComponentLibraryRow;
}

export interface QuoteRow {
  id: string; company_id: string; template_id: string | null; customer_name: string;
  customer_email: string | null; customer_phone: string | null; job_name: string | null; site_address: string | null;
  status: QuoteStatus; quote_number: number | null; entry_mode: 'manual' | 'digital' | null;
  material_margin_pct: number; labour_margin_pct: number; 
  material_margin_percent: number; labor_margin_percent: number; // Aliases for compatibility
  material_margin_enabled: boolean; labor_margin_enabled: boolean; tax_rate: number;
  global_pitch_degrees: number | null; measurement_system: MeasurementSystem; currency: string | null; notes_internal: string | null; created_by_user_id: string | null;
  cq_company_name: string | null; cq_company_address: string | null; cq_company_phone: string | null;
  cq_company_email: string | null; cq_company_logo_url: string | null; cq_footer_text: string | null;
  created_at: string; updated_at: string;
}

export interface QuoteRoofAreaRow {
  id: string; quote_id: string; template_roof_area_id: string | null; label: string; input_mode: InputMode;
  final_value_sqm: number | null; calc_width_m: number | null; calc_length_m: number | null;
  calc_plan_sqm: number | null; calc_pitch_degrees: number | null; computed_sqm: number | null;
  is_locked: boolean; sort_order: number; created_at: string; updated_at: string;
}

export interface QuoteRoofAreaEntryRow {
  id: string; quote_roof_area_id: string; width_m: number; length_m: number; sqm: number;
  sort_order: number; created_at: string; updated_at: string;
}

export interface QuoteComponentRow {
  id: string; quote_id: string; quote_roof_area_id: string | null; component_library_id: string | null;
  template_component_id: string | null; name: string; component_type: ComponentType; measurement_type: MeasurementType;
  input_mode: InputMode; final_value: number | null; calc_raw_value: number | null;
  calc_pitch_degrees: number | null; calc_pitch_factor: number | null; pitch_type: PitchType;
  use_custom_pitch: boolean; custom_pitch_degrees: number | null;
  waste_type: WasteType; waste_percent: number; waste_fixed: number; final_quantity: number | null; pricing_unit: string | null;
  material_rate: number; labour_rate: number; material_cost: number; labour_cost: number;
  is_rate_overridden: boolean; is_quantity_overridden: boolean; is_waste_overridden: boolean; is_pitch_overridden: boolean;
  is_customer_visible: boolean; sort_order: number; created_at: string; updated_at: string;
}

export interface QuoteComponentEntryRow {
  id: string; quote_component_id: string; raw_value: number; value_after_waste: number; sort_order: number; created_at: string;
}

export interface CustomerQuoteLineRow {
  id: string;
  quote_id: string;
  line_type: LineType;
  quote_component_id: string | null;
  custom_text: string | null;
  custom_amount: number | null;
  show_price: boolean;
  show_dimensions: boolean;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerQuoteTemplateRow {
  id: string;
  company_id: string;
  name: string;
  is_starter_template: boolean;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_logo_url: string | null;
  footer_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerQuoteTemplateLineRow {
  id: string;
  template_id: string;
  line_type: LineType;
  component_library_id: string | null;
  custom_text: string | null;
  custom_amount: number | null;
  show_price: boolean;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

// File Storage Types
export type FileType = 'logo' | 'plan' | 'supporting';

export interface QuoteFileRow {
  id: string;
  company_id: string;
  quote_id: string | null;
  file_type: FileType;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}
