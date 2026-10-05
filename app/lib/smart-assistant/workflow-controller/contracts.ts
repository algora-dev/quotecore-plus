import type { AssistantLibraryRole } from '../library-workflow/contracts';

export const WORKFLOW_STATES = ['collecting', 'needs_choices', 'ready_to_review', 'proposal_pending_confirmation', 'committed', 'needs_review', 'cancelled', 'closed'] as const;
export type WorkflowState = typeof WORKFLOW_STATES[number];
export type MeasurementEntry = { id: string; quantity: number; unit: string };
export type WorkingArea = {
  id: string; label: string; quantity: number; unit: 'm2' | 'ft2' | 'rs';
  basis: 'plan' | 'surface'; pitchDegrees: number | null;
};
export type WorkingMeasurement = {
  id: string; conceptKey: string; role: AssistantLibraryRole; areaId: string | null;
  entries: MeasurementEntry[]; basis: 'plan' | 'actual'; fromArea: boolean;
  /** Optional exact human product request; never treated as a SQL filter/instruction. */
  requestedProduct: string | null;
};
export type WorkingBrief = {
  version: 1;
  customerName: string; jobName: string; siteAddress: string | null;
  measurementSystem: 'metric' | 'imperial_ft' | 'imperial_rs';
  defaultPitchDegrees: number | null; trade: string;
  collectionId: string | null; collectionName: string | null;
  areas: WorkingArea[]; measurements: WorkingMeasurement[];
  selections: Record<string, string>;
  selectionSources: Record<string, 'explicit' | 'default' | 'single'>;
  /** Owner 2026-10-05 (pass 5): true when the user did not state plan vs
   *  actual; the workflow asks with buttons before any proposal is built. */
  basisPending?: boolean;
};
export type WorkflowDelta =
  | { op: 'set_job_details'; customer_name?: string; job_name?: string; site_address?: string | null; pitch_degrees?: number }
  | { op: 'add_area'; label: string; quantity: number; unit: 'm2' | 'ft2' | 'rs'; basis: 'plan' | 'surface'; pitch_degrees: number | null }
  | { op: 'change_area'; area_id: string; label?: string; quantity?: number; unit?: 'm2' | 'ft2' | 'rs'; basis?: 'plan' | 'surface'; pitch_degrees?: number | null }
  | { op: 'remove_area'; area_id: string }
  | { op: 'add_measurement'; concept: string; area_id: string | null; basis: 'plan' | 'actual'; entries: Array<{ quantity: number; unit: string }> }
  | { op: 'append_measurements'; measurement_id: string; entries: Array<{ quantity: number; unit: string }> }
  | { op: 'add_component'; concept: string; area_id: string | null; basis: 'plan' | 'actual'; entries: Array<{ quantity: number; unit: string }>; product_name?: string }
  | { op: 'change_component_context'; measurement_id: string; area_id?: string | null; basis?: 'plan' | 'actual' }
  | { op: 'assign_product'; measurement_id: string; component_id: string }
  | { op: 'change_measurement'; entry_id: string; quantity: number; unit: string }
  | { op: 'remove_measurement'; entry_id: string }
  | { op: 'remove_component'; measurement_id: string }
  | { op: 'assign_component'; concept: string; component_id: string }
  | { op: 'change_library'; collection_id: string };
