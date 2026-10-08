import { canonical, ProposalError } from '../v2/action-domain';
import type { ChangeRow } from '../v2/contracts';
import { convertAreaFt2, convertAreaRs, convertLinear } from '@/app/lib/measurements/conversions';
import { normalizeMeasurementSystem, type MeasurementSystem } from '@/app/lib/types';

type Row = Record<string, unknown> & { id: string };
export type DraftChildren = { areas: Row[]; components: Row[] };
export type PlannedDraft = { params: Record<string, unknown>; currency: string; pitch: number; children: DraftChildren };
export type RowDelta = { added: string[]; changed: string[]; removed: string[]; retained: string[] };
const SYSTEM_LABELS: Record<string, string> = { metric: 'Metric (m, m²)', imperial_ft: 'Imperial (ft, ft²)', imperial_rs: 'Roofing squares (ft, RS)' };
const AREA_TYPES = new Set(['area', 'irregular_area', 'length_x_height', 'multi_lineal_lxh', 'multi_lineal_lxh_freestyle', 'length_x_height_freestyle']);
const LINEAR_TYPES = new Set(['lineal', 'linear', 'curved_line', 'multi_lineal']);
const num = (v: number): string => v.toFixed(2).replace(/\.?0+$/, '');
/** Stored values are canonical metric; show them in the draft's measurement system. */
const measurementValue = (value: unknown, type: string, system: string): string => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (n === null) return String(value ?? '—');
  const area = AREA_TYPES.has(type), linear = LINEAR_TYPES.has(type);
  if (!area && !linear) return String(n);
  if (system === 'metric') return `${num(n)} ${area ? 'm²' : 'm'}`;
  if (area) return system === 'imperial_ft' ? `${num(convertAreaFt2(n))} ft²` : `${num(convertAreaRs(n))} RS`;
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
  return `${measurementValue(plan, 'area', system)} ${a.input_mode === 'calculated' ? 'plan' : 'surface'}; pitch ${a.calc_pitch_degrees}°; engine surface ${measurementValue(a.computed_sqm, 'area', system)}`;
}
function componentText(c: Row, system: string): string {
  const entries = (Array.isArray(c.entries) ? c.entries : [c.entry]).filter(Boolean) as Row[];
  const type = String(c.measurement_type ?? 'lineal');
  const values = entries.slice(0,12).map(e => measurementValue(e.raw_value, type, system)).join(' + ');
  return `${c.name}: ${values}${entries.length>12?` + ${entries.length-12} more entries`:''} (${entries.length} entries, ${c.input_mode === 'calculated'?'plan':'actual'}); pitch ${c.calc_pitch_degrees}°; engine quantity ${measurementValue(c.final_quantity, type, system)}; material ${c.material_cost}; labour ${c.labour_cost}`;
}
export function draftReviewDiff(before: PlannedDraft, after: PlannedDraft, collectionNames: Record<string,string> = {}): ChangeRow[] {
  const changes: ChangeRow[] = [];
  // A first proposal (nothing saved yet) is a creation summary, not a diff:
  // show each value once instead of "— → value" / "Not present → value" noise.
  const creating = !before.children.areas.length && !before.children.components.length && Object.keys(before.params).length === 0;
  const system: MeasurementSystem = normalizeMeasurementSystem(after.params.measurementSystem as MeasurementSystem | null | undefined);
  const blank = (value: string): string => creating ? '' : value;
  for (const [key,label] of [['customerName','Customer'],['jobName','Job'],['siteAddress','Site address'],['componentCollectionId','Component library'],['measurementSystem','Measurement system (locked on creation)'],['trade','Trade']] as const) {
    if (before.params[key] !== after.params[key]) {
      const render = (v: unknown) => key === 'componentCollectionId' ? collectionNames[String(v)] ?? String(v ?? '—') : key === 'measurementSystem' ? SYSTEM_LABELS[String(v)] ?? String(v ?? '—') : String(v ?? '—');
      const prior = render(before.params[key]), next = render(after.params[key]);
      if (creating && (next === '—' || next === '')) continue; // nothing to show for an unset field on creation
      changes.push({label,before:creating?'':prior,after:next});
    }
  }
  if (before.currency !== after.currency) changes.push({label:'Currency',before:creating?'':before.currency || '—',after:after.currency});
  if (before.pitch !== after.pitch) changes.push({label:'Default pitch',before:creating?'':before.pitch < 0 ? 'Not set' : `${before.pitch}°`,after:`${after.pitch}°`});
  const compare = (kind: 'areas'|'components', render: (r: Row)=>string) => {
    const old = index(before.children[kind]), next = index(after.children[kind]);
    for (const r of after.children[kind]) if (!old.has(r.id) || canonical(old.get(r.id)) !== canonical(r)) changes.push({label:`${kind==='areas'?'Area':'Component'}: ${r.label ?? r.name}`,before:old.has(r.id)?render(old.get(r.id)!):blank('Not present'),after:render(r)});
    for (const r of before.children[kind]) if (!next.has(r.id)) changes.push({label:`Remove ${kind==='areas'?'area':'component'}: ${r.label??r.name}`,before:render(r),after:'Removed'});
  };
  compare('areas',r=>areaText(r,system)); compare('components',r=>componentText(r,system));
  // Every added/changed/removed raw entry is visible, including entry 200.
  // Engine-only per-entry changes from pitch/waste are represented by the
  // explicit area/component setting and recalculated totals above.
  const oldComponents = index(before.children.components);
  for (const c of after.children.components) {
    const old = oldComponents.get(c.id);
    const previous = old ? allEntries({areas:[],components:[old]}) : [];
    const next = allEntries({areas:[],components:[c]});
    const type = String(c.measurement_type ?? 'lineal');
    const shown = (v: unknown) => measurementValue(v, type, system);
    const oldEntries = index(previous), nextEntries = index(next);
    const changed = next.filter(e => !oldEntries.has(e.id) || oldEntries.get(e.id)!.raw_value !== e.raw_value);
    const removed = previous.filter(e => !nextEntries.has(e.id));
    const edits = [
      ...changed.map(e => ({before:oldEntries.has(e.id) ? `${previous.findIndex(x=>x.id===e.id)+1}: ${shown(oldEntries.get(e.id)!.raw_value)}` : 'New entry',after:`${next.findIndex(x=>x.id===e.id)+1}: ${shown(e.raw_value)}`})),
      ...removed.map(e => ({before:`${previous.findIndex(x=>x.id===e.id)+1}: ${shown(e.raw_value)}`,after:'Removed entry'})),
    ];
    for (let offset=0;offset<edits.length;offset+=20) {
      const chunk=edits.slice(offset,offset+20);
      changes.push({label:`${c.name}: measurements ${offset+1}–${offset+chunk.length}${system==='metric'?' (m)':' (ft)'}`,before:creating && !old ? '' : chunk.map(x=>x.before).join('; '),after:chunk.map(x=>x.after).join('; ')});
    }
  }
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

