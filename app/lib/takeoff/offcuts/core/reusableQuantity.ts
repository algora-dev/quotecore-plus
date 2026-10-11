/** Final purchased-material snapshots. These are NOT roof geometry. No quote,
 * pricing, persistence or UI side effects live in this module. */
import { fingerprint } from './math';
export const OFFCUT_MEASUREMENT_OPTION = '__offcut_plan__';
export type MaterialUnit = 'm2' | 'lm';
export interface OffcutEntryProvenance {
  offcut_quantity?: number;
  offcut_unit?: MaterialUnit;
  offcut_layout_id?: string;
  offcut_source_revision?: string;
  offcut_faces_revision?: string;
  offcut_quantity_fingerprint?: string;
  offcut_page_id?: string;
  offcut_area_scope_id?: string | null;
  offcut_plan_name?: string;
}
export interface ReusableMaterialFigure {
  m2: number; purchasedLinealM: number; layoutId: string;
  sourceRevision: string; facesRevision: string;
  scope: { quoteId: string; pageId: string; areaScopeId: string | null };
  planName?: string;
}
export function materialUnitForComponent(type: string): MaterialUnit | null {
  return type === 'area' ? 'm2' : ['line', 'lineal', 'multi_lineal'].includes(type) ? 'lm' : null;
}
export function materialFigureToken(figure: ReusableMaterialFigure): string {
  return fingerprint([figure.scope, figure.layoutId, figure.sourceRevision, figure.facesRevision, figure.m2, figure.purchasedLinealM]);
}
export function materialDisplayValue(metric: number, unit: MaterialUnit, calibrationUnit: string): number {
  return calibrationUnit === 'feet' ? metric / (unit === 'm2' ? 0.09290304 : 0.3048) : metric;
}
export function materialOptionLabel(figure: ReusableMaterialFigure, type: string, calibrationUnit = 'meters'): string {
  const unit = materialUnitForComponent(type); if (!unit) return '';
  const n = materialDisplayValue(unit === 'm2' ? figure.m2 : figure.purchasedLinealM, unit, calibrationUnit);
  const suffix = calibrationUnit === 'feet' ? (unit === 'm2' ? 'ft²' : 'ft') : (unit === 'm2' ? 'm²' : 'lm');
  return `Cut plan · ${figure.planName || 'Selected plan'} · ${n.toFixed(2)} ${suffix} (purchased material)`;
}
export function materialMeasurement(figure: ReusableMaterialFigure, type: string, calibrationUnit: string, expectedToken: string) {
  if (expectedToken !== materialFigureToken(figure)) throw new Error('The selected cut plan changed. Choose its current quantity again.');
  const unit = materialUnitForComponent(type);
  if (!unit) throw new Error('Cut-plan quantities require an area or lineal component.');
  const quantity = unit === 'm2' ? figure.m2 : figure.purchasedLinealM;
  if (!Number.isFinite(quantity) || quantity <= 0 || !figure.layoutId || !figure.scope.pageId) throw new Error('A checked selected cut plan is required.');
  const value = materialDisplayValue(quantity, unit, calibrationUnit);
  return { value, type: (unit === 'm2' ? 'area' : type === 'multi_lineal' ? 'multi_lineal' : 'line') as 'area' | 'line' | 'multi_lineal',
    fromPageId: figure.scope.pageId, quoteRoofAreaId: figure.scope.areaScopeId,
    entryInputs: { value_basis: 'offcuts' as const, plan_value: value,
      offcut_quantity: quantity, offcut_unit: unit,
      offcut_layout_id: figure.layoutId, offcut_source_revision: figure.sourceRevision,
      offcut_faces_revision: figure.facesRevision, offcut_quantity_fingerprint: expectedToken,
      offcut_page_id: figure.scope.pageId, offcut_area_scope_id: figure.scope.areaScopeId,
      offcut_plan_name: figure.planName || 'Selected plan' } };
}
/** Called by the host's save path BEFORE pitch/waste. New snapshots store
 * canonical metric AND page-display values; legacy area entries remain readable.
 * Reject mismatched dimensions instead of silently pricing m² at a metre rate. */
export function finalOffcutMetric(inputs: (OffcutEntryProvenance & {value_basis?: string; plan_value?: number}) | null | undefined,
  type: string, calibrationUnit: string): number | null {
  if (inputs?.value_basis !== 'offcuts') return null;
  const unit = materialUnitForComponent(type);
  if (!unit) throw new Error('Offcut quantity has an incompatible measurement type.');
  const display = inputs.plan_value;
  if (!Number.isFinite(display) || !(display! > 0)) throw new Error('Offcut quantity is missing or invalid.');
  const converted = display! * (calibrationUnit === 'feet' ? (unit === 'm2' ? 0.09290304 : 0.3048) : 1);
  if (inputs.offcut_quantity === undefined) {
    if (unit !== 'm2' || inputs.offcut_unit !== undefined) throw new Error('Incomplete offcut quantity provenance.');
    return converted; // pre-V2.27 area-only snapshot
  }
  if (inputs.offcut_unit !== unit || !Number.isFinite(inputs.offcut_quantity) || inputs.offcut_quantity <= 0 ||
      Math.abs(converted - inputs.offcut_quantity) > Math.max(0.000001, inputs.offcut_quantity * 1e-9)) {
    throw new Error('Offcut quantity or units changed. Reattach the selected cut plan before saving.');
  }
  return inputs.offcut_quantity;
}

export interface MaterialMeasurementRow {
  id: string; type: string; fromPageId?: string | null; quoteRoofAreaId?: string | null;
  entryInputs?: (OffcutEntryProvenance & {value_basis?: string}) | null;
}
/** One explicitly chosen plan snapshot per component/page/roof/unit. Call this
 * within a single component group. Manual/drawn rows and other roofs survive. */
export function upsertMaterialMeasurement<T extends MaterialMeasurementRow>(rows: readonly T[], entry: T): T[] {
  if (entry.entryInputs?.value_basis !== 'offcuts' || !materialUnitForComponent(entry.type)) throw new Error('Expected an offcut material measurement.');
  const matches = (r: T) => r.entryInputs?.value_basis === 'offcuts' && r.fromPageId === entry.fromPageId &&
    (r.quoteRoofAreaId ?? null) === (entry.quoteRoofAreaId ?? null) && materialUnitForComponent(r.type) === materialUnitForComponent(entry.type);
  const previous = rows.find(matches);
  return [...rows.filter(r => !matches(r)), {...entry, id: previous?.id ?? entry.id}];
}
