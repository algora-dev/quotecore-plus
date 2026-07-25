// Shared types for the Roof Takeoff Builder free tool

export type ComponentKind = 'roof_area' | 'ridge' | 'hip' | 'valley' | 'barge' | 'spouting';
export type InputMode = 'pitch_calculated' | 'actual';
export type PitchScope = 'master' | 'per_component' | 'per_entry';

export interface RoofComponentDef {
  id: string;
  component_kind: ComponentKind;
  name: string;
  description: string | null;
  unit: string;
  price_per_unit: number;
  pricing_strategy: string;
  pack_size: number | null;
  pack_price: number | null;
  labour_rate: number;
  labour_unit: string;
  suggested_waste_percent: number;
  pitch_type: string;
}

export interface Entry {
  id: string;
  label: string;
  inputMode: InputMode;
  planLength?: number;
  planWidth?: number;
  planLengthVal?: number;
  pitchDegrees: number;
  actualValue?: number;
  computedValue: number;
  selectedComponentId: string | null;
}

export interface ComponentSection {
  kind: ComponentKind;
  entries: Entry[];
  wastePercent: number;
}
