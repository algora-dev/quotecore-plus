import { canonical, ProposalError } from '../v2/action-domain';
import type { ChangeRow } from '../v2/contracts';

type Row = Record<string, unknown> & { id: string };
export type DraftChildren = { areas: Row[]; components: Row[] };
export type PlannedDraft = { params: Record<string, unknown>; currency: string; pitch: number; children: DraftChildren };
export type RowDelta = { added: string[]; changed: string[]; removed: string[]; retained: string[] };

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

function areaText(a: Row): string {
  return `${a.input_mode === 'calculated' ? a.calc_plan_sqm : a.final_value_sqm} m2 ${a.input_mode === 'calculated' ? 'plan' : 'surface'}; pitch ${a.calc_pitch_degrees}°; engine surface ${a.computed_sqm} m2`;
}
function componentText(c: Row): string {
  const entries = (Array.isArray(c.entries) ? c.entries : [c.entry]).filter(Boolean) as Row[];
  const values = entries.slice(0,12).map(e => String(e.raw_value)).join(' + ');
  return `${c.name}: ${values}${entries.length>12?` + ${entries.length-12} more entries`:''} (${entries.length} entries, ${c.input_mode === 'calculated'?'plan':'actual'}); pitch ${c.calc_pitch_degrees}°; engine quantity ${c.final_quantity}; material ${c.material_cost}; labour ${c.labour_cost}`;
}
export function draftReviewDiff(before: PlannedDraft, after: PlannedDraft, collectionNames: Record<string,string> = {}): ChangeRow[] {
  const changes: ChangeRow[] = [];
  for (const [key,label] of [['customerName','Customer'],['jobName','Job'],['siteAddress','Site address'],['componentCollectionId','Component library'],['measurementSystem','Measurement system (locked on creation)'],['trade','Trade']] as const) {
    if (before.params[key] !== after.params[key]) {
      const render = (v: unknown) => key === 'componentCollectionId' ? collectionNames[String(v)] ?? String(v ?? 'Not selected') : String(v ?? 'Not provided');
      changes.push({label,before:render(before.params[key]),after:render(after.params[key])});
    }
  }
  if (before.currency !== after.currency) changes.push({label:'Currency',before:before.currency || 'Not selected',after:after.currency});
  if (before.pitch !== after.pitch) changes.push({label:'Default pitch',before:before.pitch < 0 ? 'Not set' : `${before.pitch}°`,after:`${after.pitch}°`});
  const compare = (kind: 'areas'|'components', render: (r: Row)=>string) => {
    const old = index(before.children[kind]), next = index(after.children[kind]);
    for (const r of after.children[kind]) if (!old.has(r.id) || canonical(old.get(r.id)) !== canonical(r)) changes.push({label:`${kind==='areas'?'Area':'Component'}: ${r.label ?? r.name}`,before:old.has(r.id)?render(old.get(r.id)!):'Not present',after:render(r)});
    for (const r of before.children[kind]) if (!next.has(r.id)) changes.push({label:`Remove ${kind==='areas'?'area':'component'}: ${r.label??r.name}`,before:render(r),after:'Removed'});
  };
  compare('areas',areaText); compare('components',componentText);
  // Every added/changed/removed raw entry is visible, including entry 200.
  // Engine-only per-entry changes from pitch/waste are represented by the
  // explicit area/component setting and recalculated totals above.
  const oldComponents = index(before.children.components);
  for (const c of after.children.components) {
    const old = oldComponents.get(c.id);
    const previous = old ? allEntries({areas:[],components:[old]}) : [];
    const next = allEntries({areas:[],components:[c]});
    const oldEntries = index(previous), nextEntries = index(next);
    const changed = next.filter(e => !oldEntries.has(e.id) || oldEntries.get(e.id)!.raw_value !== e.raw_value);
    const removed = previous.filter(e => !nextEntries.has(e.id));
    const edits = [
      ...changed.map(e => ({before:oldEntries.has(e.id) ? `${previous.findIndex(x=>x.id===e.id)+1}: ${oldEntries.get(e.id)!.raw_value}` : 'New entry',after:`${next.findIndex(x=>x.id===e.id)+1}: ${e.raw_value}`})),
      ...removed.map(e => ({before:`${previous.findIndex(x=>x.id===e.id)+1}: ${e.raw_value}`,after:'Removed entry'})),
    ];
    for (let offset=0;offset<edits.length;offset+=20) {
      const chunk=edits.slice(offset,offset+20);
      changes.push({label:`${c.name}: raw measurements ${offset+1}–${offset+chunk.length} (stored base units)`,before:chunk.map(x=>x.before).join('; '),after:chunk.map(x=>x.after).join('; ')});
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

