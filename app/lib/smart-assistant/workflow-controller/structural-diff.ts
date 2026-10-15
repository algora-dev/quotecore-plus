import { canonical, ProposalError } from '../v2/action-domain';
import { assistantMoney } from '../v2/money';
import type { ChangeRow } from '../v2/contracts';
import { convertAreaFt2, convertAreaRs, convertLinear, convertVolumeFt3 } from '@/app/lib/measurements/conversions';
import { normalizeMeasurementSystem, type MeasurementSystem } from '@/app/lib/types';

type Row = Record<string, unknown> & { id: string };
export type DraftChildren = { areas: Row[]; components: Row[] };
export type PlannedDraft = { params: Record<string, unknown>; currency: string; pitch: number; children: DraftChildren };
export type RowDelta = { added: string[]; changed: string[]; removed: string[]; retained: string[] };
const AREA_TYPES = new Set(['area', 'irregular_area', 'length_x_height', 'multi_lineal_lxh', 'multi_lineal_lxh_freestyle', 'length_x_height_freestyle']);
const LINEAR_TYPES = new Set(['lineal', 'linear', 'curved_line', 'multi_lineal']);
const num = (v: number): string => v.toFixed(2).replace(/\.?0+$/, '');
/** Stored values are canonical metric; show them in the draft's measurement system. */
const measurementValue = (value: unknown, type: string, system: string): string => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (n === null) return String(value ?? '—');
  const area = AREA_TYPES.has(type), linear = LINEAR_TYPES.has(type), volume = type === 'volume_3d';
  if (!area && !linear && !volume) return String(n);
  if (system === 'metric') return `${num(n)} ${area ? 'm²' : volume ? 'm³' : 'm'}`;
  if (area) return system === 'imperial_ft' ? `${num(convertAreaFt2(n))} ft²` : `${num(convertAreaRs(n))} RS`;
  if (volume) return `${num(convertVolumeFt3(n))} ft³`;
  return `${num(convertLinear(n))} ft`;
};

function index(rows: Row[]) {
  const out = new Map<string, Row>();
  for (const r of rows) { if (out.has(r.id)) throw new ProposalError('Duplicate structural identity.'); out.set(r.id, r); }
  return out;
}
export function diffRows(before: Row[], after: Row[]): RowDelta {
  const a = index(before), b = index(after);
  return { added: after.filter(r => !a.has(r.id)).map(r => r.id), removed: before.filter(r => !b.has(r.id)).map(r => r.id),
    changed: after.filter(r => a.has(r.id) && canonical(a.get(r.id)) !== canonical(r)).map(r => r.id),
    retained: after.filter(r => a.has(r.id) && canonical(a.get(r.id)) === canonical(r)).map(r => r.id) };
}
export function allEntries(children: DraftChildren): Row[] {
  return children.components.flatMap(c => (Array.isArray(c.entries) ? c.entries : [c.entry]).filter(Boolean).map(e => e as Row));
}
export function structuralDiff(before: DraftChildren, after: DraftChildren) {
  return { areas: diffRows(before.areas,after.areas), components: diffRows(before.components,after.components), entries: diffRows(allEntries(before),allEntries(after)) };
}

function areaText(a: Row, system: string): string {
  const plan = a.input_mode === 'calculated' ? a.calc_plan_sqm : a.final_value_sqm;
  return `${measurementValue(plan, 'area', system)} ${a.input_mode === 'calculated' ? 'plan' : 'surface'}; pitch ${a.calc_pitch_degrees}°`;
}
function componentText(c: Row, system: string, currency: string): string {
  const entries = (Array.isArray(c.entries) ? c.entries : [c.entry]).filter(Boolean) as Row[];
  const type = String(c.measurement_type ?? 'lineal');
  const values = entries.slice(0,12).map(e => measurementValue(e.raw_value, type, system)).join(' + ');
  const pitch = Number(c.calc_pitch_degrees ?? 0);
  const wasteType = String(c.waste_type ?? 'none');
  const wastePercent = Number(c.waste_percent ?? 0);
  const wasteFixed = Number(c.waste_fixed ?? 0);
  const wasteQuantity = measurementValue(wasteFixed, type, system);
  const waste = wasteType === 'percent' ? `${wastePercent}% waste`
    : wasteType === 'none' ? 'no waste'
      : wasteType === 'fixed_per_segment' ? `${wasteQuantity} waste per segment`
        : `${wasteQuantity} waste`;
  const quantityLabel = pitch > 0 ? 'Incl Pitch/Waste' : wasteType !== 'none' ? 'Incl waste' : 'Value';
  const valueText = values || 'No measurement value';
  const additionalEntries = entries.length > 12 ? ` + ${entries.length - 12} more entries` : '';
  return `${valueText}${additionalEntries}; ${c.input_mode === 'calculated' ? 'plan' : 'actual'}; ${pitch > 0 ? `${pitch}° pitch` : 'no pitch adjustment'}; ${waste}; ${quantityLabel}: ${measurementValue(c.final_quantity, type, system)}; cost ${assistantMoney(currency, Number(c.material_cost ?? 0) + Number(c.labour_cost ?? 0))}`;
}
export function draftReviewDiff(before: PlannedDraft, after: PlannedDraft): ChangeRow[] {
  const changes: ChangeRow[] = [];
  // A first proposal (nothing saved yet) is a creation summary, not a diff:
  // show each value once instead of "— → value" / "Not present → value" noise.
  const creating = !before.children.areas.length && !before.children.components.length && Object.keys(before.params).length === 0;
  const system: MeasurementSystem = normalizeMeasurementSystem(after.params.measurementSystem as MeasurementSystem | null | undefined);
  const blank = (value: string): string => creating ? '' : value;
  for (const [key,label] of [['customerName','Customer'],['jobName','Job'],['siteAddress','Site address']] as const) {
    if (before.params[key] !== after.params[key]) {
      const render = (v: unknown) => String(v ?? '—');
      const prior = render(before.params[key]), next = render(after.params[key]);
      if (creating && (next === '—' || next === '')) continue; // nothing to show for an unset field on creation
      changes.push({label,before:creating?'':prior,after:next});
    }
  }
  if (before.pitch !== after.pitch) changes.push({label:'Default pitch',before:creating?'':before.pitch < 0 ? 'Not set' : `${before.pitch}°`,after:`${after.pitch}°`});
  const compare = (kind: 'areas'|'components', render: (r: Row)=>string) => {
    const old = index(before.children[kind]), next = index(after.children[kind]);
    for (const r of after.children[kind]) if (!old.has(r.id) || canonical(old.get(r.id)) !== canonical(r)) changes.push({label:`${kind==='areas'?'Area':'Component'}: ${r.label ?? r.name}`,before:old.has(r.id)?render(old.get(r.id)!):blank('Not present'),after:render(r)});
    for (const r of before.children[kind]) if (!next.has(r.id)) changes.push({label:`Remove ${kind==='areas'?'area':'component'}: ${r.label??r.name}`,before:render(r),after:'Removed'});
  };
  compare('areas',r=>areaText(r,system)); compare('components',r=>componentText(r,system,after.currency));
  if (changes.length>80 || changes.some(c => c.label.length>300 || c.before.length>2000 || c.after.length>2000))
    throw new ProposalError('This change is too large to review safely on one card. Split it into smaller corrections. Nothing has been changed.');
  return changes;
}

/** A recalculation timestamp is not a business change. Reuse the EXACT previous
 * row when every other field matches so IDs, audit and updated_at survive. */
export function retainUnchangedAudits(before: DraftChildren, after: DraftChildren): DraftChildren {
  const previous=index(before.components);
  const comparable=(row: Row): Row => {
    const copy=structuredClone(row);
    if (copy.calc_audit && typeof copy.calc_audit==='object' && !Array.isArray(copy.calc_audit)) delete (copy.calc_audit as Record<string,unknown>).generatedAt;
    return copy;
  };
  return {areas:after.areas,components:after.components.map(c => {
    const old=previous.get(c.id);
    return old && canonical(comparable(old))===canonical(comparable(c)) ? structuredClone(old) : c;
  })};
}

