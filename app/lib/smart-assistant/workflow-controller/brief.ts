import { randomUUID } from 'node:crypto';
import { ProposalError } from '../v2/action-domain';
import { isUuid } from '../v2/contracts';
import { canonicalQuantity } from '../v2/units';
import { ROLE_PITCH_TYPE } from '../library-workflow/contracts';
import { resolveConcept, type AssistantConcept } from './vocabulary';
import type { WorkingArea, WorkingBrief, WorkingMeasurement, WorkflowDelta } from './contracts';

const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ProposalError('Expected structured draft information.');
  return v as Record<string, unknown>;
};
const own = (v: object, k: string) => Object.prototype.hasOwnProperty.call(v, k);
function text(v: unknown, max: number, label: string): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v)) throw new ProposalError(`${label} must be valid text of at most ${max} characters.`);
  return v.trim();
}
function positive(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0.000001 || v > 1e8) throw new ProposalError('Measurements must be positive finite numbers up to 100 million.');
  return v;
}
function pitch(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 89) throw new ProposalError('Pitch must be between 0 and 89 degrees.');
  return v;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], label: string): T {
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw new ProposalError(`Choose a supported ${label}.`);
  return v as T;
}
function entries(v: unknown, id: () => string) {
  if (!Array.isArray(v) || !v.length || v.length > 200) throw new ProposalError('Use between 1 and 200 separate entries per component.');
  return v.map(raw => { const e = object(raw); return { id: id(), quantity: positive(e.quantity), unit: text(e.unit, 20, 'Unit') }; });
}
function area(raw: Record<string, unknown>, id: () => string): WorkingArea {
  // Owner 2026-10-05 (pass 5): basis may be omitted when the user never stated
  // plan vs actual; 'surface' is the provisional value and the brief is marked
  // basisPending so resolution asks with buttons instead of guessing.
  const basis = raw.basis == null ? 'surface' as const : oneOf(raw.basis, ['plan','surface'], 'area basis');
  return { id: id(), label: text(raw.label, 120, 'Area label'), quantity: positive(raw.quantity), unit: oneOf(raw.unit, ['m2','ft2','rs'], 'area unit'), basis, pitchDegrees: pitch(raw.pitch_degrees) };
}
function covering(a: WorkingArea, id: () => string): WorkingMeasurement {
  return { id: id(), conceptKey: 'roof_area', role: 'roof_area', areaId: a.id, entries: [{ id: id(), quantity: a.quantity, unit: a.unit }], basis: a.basis === 'plan' ? 'plan' : 'actual', fromArea: true, requestedProduct: null };
}

export function createWorkingBrief(input: Record<string, unknown>, context: Record<string, unknown>, concepts: readonly AssistantConcept[], id: () => string = randomUUID): WorkingBrief {
  const siteAddress = input.site_address == null ? null : text(input.site_address, 500, 'Site address');
  const customerName = input.customer_name == null ? '' : text(input.customer_name, 200, 'Customer');
  // A job title is a label, not a separate identity decision. Prefer the supplied
  // title; otherwise reuse supplied address/customer rather than interrogating.
  const jobName = input.job_name == null ? (siteAddress ?? customerName).slice(0, 200) : text(input.job_name, 200, 'Job');
  if (!Array.isArray(input.areas) || input.areas.length > 12) throw new ProposalError('Use at most twelve areas.');
  const areas = input.areas.map(v => area(object(v), id));
  // Owner 2026-10-05 (pass 5): unstated plan/actual becomes a button question.
  const basisPending = input.areas.some(v => object(v).basis == null)
    || (Array.isArray(input.measurements) && input.measurements.some(v => object(v).basis == null));
  if (!Array.isArray(input.measurements) || input.measurements.length > 24) throw new ProposalError('Use at most 24 measured components.');
  const measurements: WorkingMeasurement[] = input.measurements.map(v => {
    const raw = object(v), concept = resolveConcept(String(raw.concept ?? raw.role ?? ''), concepts);
    if (!concept) throw new ProposalError(`No unambiguous workspace concept matches “${String(raw.concept ?? raw.role ?? '').slice(0, 80)}”. Use a configured concept or add its alias in settings.`);
    const index = raw.area_index == null ? null : raw.area_index;
    if (index !== null && (typeof index !== 'number' || !Number.isInteger(index) || !areas[index])) throw new ProposalError('The measurement must refer to one of the supplied areas.');
    const a = index == null ? null : areas[index as number];
    const values = entries(raw.entries, id), basis = raw.basis == null ? 'actual' as const : oneOf(raw.basis, ['plan','actual'], 'measurement basis');
    const exactArea = !!a && values.length === 1 && values[0].quantity === a.quantity && values[0].unit === a.unit && basis === (a.basis === 'plan' ? 'plan' : 'actual');
    const fromArea = raw.from_area === true || (raw.from_area !== false && concept.behavior === 'roof_area' && exactArea);
    if (fromArea && (!exactArea || !['roof_area','underlay'].includes(concept.behavior))) throw new ProposalError('An area-linked covering/underlay must match its area measurement and basis.');
    return { id: id(), conceptKey: concept.key, role: concept.behavior, areaId: a?.id ?? null, entries: values, basis, fromArea, requestedProduct: raw.product_name == null ? null : text(raw.product_name, 200, 'Requested product') };
  });
  // A described roof area means roof covering unless an explicit covering
  // measurement already represents it. Preserve a stable link for corrections.
  for (const a of areas) if (!measurements.some(m => m.role === 'roof_area' && m.areaId === a.id)) measurements.push(covering(a, id));
  const system = input.measurement_system ?? context.measurement_system ?? 'metric';
  const brief: WorkingBrief = {
    version: 1, customerName, jobName, siteAddress,
    measurementSystem: oneOf(system, ['metric','imperial_ft','imperial_rs'], 'measurement system'),
    defaultPitchDegrees: pitch(input.pitch_degrees), trade: input.trade == null ? 'roofing' : text(input.trade, 60, 'Trade'),
    collectionId: input.collection_id == null ? null : isUuid(input.collection_id) ? input.collection_id : (() => { throw new ProposalError('Invalid library identity.'); })(),
    collectionName: input.collection_name == null ? null : text(input.collection_name, 200, 'Library name'),
    areas, measurements, selections: {}, selectionSources: {},
    ...(basisPending ? { basisPending: true } : {}),
  };
  for (const key of Object.keys(brief.selections)) if (key.startsWith('measurement:') && !brief.measurements.some(m => `measurement:${m.id}` === key)) { delete brief.selections[key]; delete brief.selectionSources[key]; }
  validateWorkingBrief(brief, concepts);
  return brief;
}

export function validateWorkingBrief(brief: WorkingBrief, concepts: readonly AssistantConcept[]): void {
  if (!brief || !Array.isArray(brief.areas) || !Array.isArray(brief.measurements) || !brief.selections || !brief.selectionSources) throw new ProposalError('The saved working brief is invalid. No draft was changed.');
  if (brief.version !== 1) throw new ProposalError('This working draft needs migration before it can be revised.');
  if (brief.areas.length > 12 || brief.measurements.length > 24) throw new ProposalError('This draft exceeds the supported area/component limit.');
  if (brief.customerName) text(brief.customerName,200,'Customer');
  if (brief.jobName) text(brief.jobName,200,'Job');
  if (brief.siteAddress != null) text(brief.siteAddress,500,'Site address');
  oneOf(brief.measurementSystem,['metric','imperial_ft','imperial_rs'],'measurement system');
  text(brief.trade,60,'Trade');
  if (brief.collectionId != null && !isUuid(brief.collectionId)) throw new ProposalError('Invalid library identity.');
  if (brief.collectionName != null) text(brief.collectionName,200,'Library name');
  const ids = new Set<string>(), labels = new Set<string>();
  const identity = (id: string) => { if (!isUuid(id) || ids.has(id)) throw new ProposalError('Draft identities must be unique.'); ids.add(id); };
  let count = 0;
  for (const a of brief.areas) {
    identity(a.id); const label = text(a.label, 120, 'Area label').toLowerCase();
    if (labels.has(label)) throw new ProposalError('Use distinct area labels so corrections are unambiguous.');
    labels.add(label); positive(a.quantity); pitch(a.pitchDegrees);
    oneOf(a.basis, ['plan','surface'], 'area basis'); canonicalQuantity(a.quantity, a.unit, 'area');
  }
  for (const m of brief.measurements) {
    identity(m.id);
    const concept = concepts.find(c => c.key === m.conceptKey);
    if (!concept || concept.behavior !== m.role) throw new ProposalError('A concept changed. Review the current workspace vocabulary.');
    if (m.areaId && !brief.areas.some(a => a.id === m.areaId)) throw new ProposalError('A measured component refers to a removed area.');
    if (!m.entries.length || m.entries.length > 200) throw new ProposalError('Use 1–200 separate entries per measured component.');
    oneOf(m.basis, ['plan','actual'], 'measurement basis');
    for (const e of m.entries) { identity(e.id); positive(e.quantity); text(e.unit, 20, 'Unit'); }
    if (typeof m.fromArea !== 'boolean') throw new ProposalError('Invalid area linkage.');
    if (m.requestedProduct != null) text(m.requestedProduct,200,'Requested product');
    if (m.fromArea) {
      const a = brief.areas.find(a=>a.id === m.areaId);
      if (!a || !['roof_area','underlay'].includes(m.role) || m.entries.length !== 1 || m.entries[0].quantity !== a.quantity || m.entries[0].unit !== a.unit || m.basis !== (a.basis === 'plan' ? 'plan' : 'actual')) throw new ProposalError('An area-linked covering/underlay must exactly follow its area.');
    }
    count += m.entries.length;
  }
  if (count > 600) throw new ProposalError('Use at most 600 individual measurement entries.');
  pitch(brief.defaultPitchDegrees);
  for (const [key,value] of Object.entries(brief.selections)) {
    const validKey = key.startsWith('concept:') ? concepts.some(c => `concept:${c.key}` === key) : brief.measurements.some(m=>`measurement:${m.id}` === key);
    if (!validKey || !isUuid(value) || !['explicit','default','single'].includes(brief.selectionSources[key])) throw new ProposalError('Invalid or stale product selection.');
  }
}

export function briefIssues(brief: WorkingBrief): string[] {
  const issues: string[] = [];
  if (!brief.customerName) issues.push('What is the customer name?');
  if (!brief.jobName) issues.push('What should this job be called?');
  if (!brief.measurements.length) issues.push('Add the roof area or component measurements.');
  for (const a of brief.areas) if (a.basis === 'plan' && a.pitchDegrees == null && brief.defaultPitchDegrees == null) issues.push(`What is the pitch for ${a.label}? A flat roof is 0 degrees.`);
  for (const m of brief.measurements) if (m.basis === 'plan' && ROLE_PITCH_TYPE[m.role] !== 'none' && brief.defaultPitchDegrees == null && (!m.areaId || brief.areas.find(a => a.id === m.areaId)?.pitchDegrees == null)) {
    if (!m.areaId) issues.push(`Which pitch applies to the unassigned ${m.conceptKey.replace(/_/g, ' ')} measurements? Link them to an area or set the default pitch.`);
    else if (brief.areas.find(a => a.id === m.areaId)?.basis !== 'plan') issues.push(`Which pitch applies to the plan-basis ${m.conceptKey.replace(/_/g, ' ')} measurements in ${brief.areas.find(a => a.id === m.areaId)?.label}?`);
  }
  return [...new Set(issues)];
}

const DELTA_KEYS: Record<WorkflowDelta['op'], readonly string[]> = {
  set_job_details: ['op','customer_name','job_name','site_address','pitch_degrees'],
  add_area: ['op','label','quantity','unit','basis','pitch_degrees'],
  change_area: ['op','area_id','label','quantity','unit','basis','pitch_degrees'],
  remove_area: ['op','area_id'],
  add_measurement: ['op','concept','area_id','basis','entries'],
  append_measurements: ['op','measurement_id','entries'],
  add_component: ['op','concept','area_id','basis','entries','product_name'],
  change_component_context: ['op','measurement_id','area_id','basis'],
  assign_product: ['op','measurement_id','component_id'],
  change_measurement: ['op','entry_id','quantity','unit'],
  remove_measurement: ['op','entry_id'],
  remove_component: ['op','measurement_id'],
  assign_component: ['op','concept','component_id'],
  change_library: ['op','collection_id'],
};

/** All-or-nothing reducer: the input brief is never mutated, even on refusal. */
export function applyWorkingDeltas(original: WorkingBrief, raw: unknown, concepts: readonly AssistantConcept[], id: () => string = randomUUID): WorkingBrief {
  if (!Array.isArray(raw) || !raw.length || raw.length > 40) throw new ProposalError('Provide 1–40 typed corrections.');
  const brief = structuredClone(original);
  for (const value of raw) {
    const d = object(value), op = String(d.op) as WorkflowDelta['op'];
    const keys = Object.prototype.hasOwnProperty.call(DELTA_KEYS, op) ? DELTA_KEYS[op] : null;
    if (!keys || Object.keys(d).some(k => !keys.includes(k))) throw new ProposalError('That correction has unsupported fields. Nothing changed.');
    if (op === 'set_job_details') {
      if (Object.keys(d).length < 2) throw new ProposalError('Specify a job detail to change.');
      if (own(d,'customer_name')) brief.customerName = text(d.customer_name, 200, 'Customer');
      if (own(d,'job_name')) brief.jobName = text(d.job_name, 200, 'Job');
      if (own(d,'site_address')) brief.siteAddress = d.site_address === null ? null : text(d.site_address, 500, 'Site address');
      if (own(d,'pitch_degrees')) { if (d.pitch_degrees == null) throw new ProposalError('Specify a pitch, including 0 for flat.'); brief.defaultPitchDegrees = pitch(d.pitch_degrees); }
    } else if (op === 'add_area') {
      const a = area(d, id); brief.areas.push(a); brief.measurements.push(covering(a, id));
    } else if (op === 'change_area' || op === 'remove_area') {
      const a = brief.areas.find(a => a.id === d.area_id);
      if (!a) throw new ProposalError('Choose a current area identity from the working brief.');
      if (op === 'remove_area') {
        if (brief.measurements.some(m => m.areaId === a.id)) throw new ProposalError('Remove the components linked to this area first. Nothing was removed.');
        brief.areas = brief.areas.filter(x => x.id !== a.id);
      } else {
        if (Object.keys(d).length < 3) throw new ProposalError('Specify an area detail to change.');
        if (own(d,'label')) a.label = text(d.label, 120, 'Area label');
        if (own(d,'quantity')) a.quantity = positive(d.quantity);
        if (own(d,'unit')) a.unit = oneOf(d.unit, ['m2','ft2','rs'], 'area unit');
        if (own(d,'basis')) a.basis = oneOf(d.basis, ['plan','surface'], 'area basis');
        if (own(d,'pitch_degrees')) a.pitchDegrees = pitch(d.pitch_degrees);
        for (const m of brief.measurements.filter(m => m.areaId === a.id && m.fromArea)) {
          m.entries[0] = { ...m.entries[0], quantity: a.quantity, unit: a.unit };
          m.basis = a.basis === 'plan' ? 'plan' : 'actual';
        }
      }
    } else if (op === 'add_measurement' || op === 'add_component') {
      const concept = resolveConcept(text(d.concept, 80, 'Concept'), concepts);
      if (!concept) throw new ProposalError('Choose an unambiguous workspace concept.');
      if (d.area_id !== null && (!isUuid(d.area_id) || !brief.areas.some(a => a.id === d.area_id))) throw new ProposalError('Choose a current area, or explicitly use null for an unassigned measurement.');
      const basis = oneOf(d.basis, ['plan','actual'], 'measurement basis');
      const matching = op === 'add_component' ? [] : brief.measurements.filter(m => m.conceptKey === concept.key && m.areaId === d.area_id && m.basis === basis && !m.fromArea);
      if (matching.length > 1) throw new ProposalError('Several component groups match. Specify an existing measurement identity instead of guessing.');
      if (matching.length === 1) matching[0].entries.push(...entries(d.entries, id));
      else brief.measurements.push({ id: id(), conceptKey: concept.key, role: concept.behavior, areaId: d.area_id as string | null, basis, entries: entries(d.entries, id), fromArea: false, requestedProduct: d.product_name == null ? null : text(d.product_name,200,'Requested product') });
    } else if (op === 'append_measurements' || op === 'change_component_context' || op === 'assign_product') {
      const m = brief.measurements.find(m => m.id === d.measurement_id);
      if (!m) throw new ProposalError('Choose a current measured component identity.');
      if (op === 'assign_product') {
        if (!isUuid(d.component_id)) throw new ProposalError('Choose a real eligible product identity.');
        brief.selections[`measurement:${m.id}`] = d.component_id; brief.selectionSources[`measurement:${m.id}`] = 'explicit'; m.requestedProduct = null;
      } else {
        if (m.fromArea) throw new ProposalError('This covering/underlay follows its area. Correct the area instead.');
        if (op === 'append_measurements') m.entries.push(...entries(d.entries,id));
        else {
          if (Object.keys(d).length < 3) throw new ProposalError('Specify the area or measurement basis to change.');
          if (own(d,'area_id')) {
            if (d.area_id !== null && (!isUuid(d.area_id) || !brief.areas.some(a => a.id === d.area_id))) throw new ProposalError('Choose a current area identity or null.');
            m.areaId = d.area_id as string | null;
          }
          if (own(d,'basis')) m.basis = oneOf(d.basis,['plan','actual'],'measurement basis');
        }
      }
    } else if (op === 'change_measurement' || op === 'remove_measurement') {
      const m = brief.measurements.find(m => m.entries.some(e => e.id === d.entry_id));
      if (!m) throw new ProposalError('Choose a current individual measurement identity.');
      if (m.fromArea) throw new ProposalError('This covering/underlay follows its roof area. Change that area instead.');
      if (op === 'remove_measurement') {
        m.entries = m.entries.filter(e => e.id !== d.entry_id);
        if (!m.entries.length) brief.measurements = brief.measurements.filter(x => x.id !== m.id);
      } else { const e = m.entries.find(e => e.id === d.entry_id)!; e.quantity = positive(d.quantity); e.unit = text(d.unit, 20, 'Unit'); }
    } else if (op === 'remove_component') {
      if (!brief.measurements.some(m => m.id === d.measurement_id)) throw new ProposalError('Choose a current measured component identity.');
      brief.measurements = brief.measurements.filter(m => m.id !== d.measurement_id);
      delete brief.selections[`measurement:${String(d.measurement_id)}`];
    } else if (op === 'assign_component') {
      const concept = resolveConcept(text(d.concept, 80, 'Concept'), concepts);
      if (!concept || !isUuid(d.component_id) || !brief.measurements.some(m => m.conceptKey === concept.key)) throw new ProposalError('Choose a measured concept and a real eligible component identity.');
      brief.selections[`concept:${concept.key}`] = d.component_id;
      brief.selectionSources[`concept:${concept.key}`] = 'explicit';
      for (const m of brief.measurements.filter(m => m.conceptKey === concept.key)) { m.requestedProduct = null; delete brief.selections[`measurement:${m.id}`]; }
    } else if (op === 'change_library') {
      if (!isUuid(d.collection_id)) throw new ProposalError('Choose a real library identity.');
      brief.collectionId = d.collection_id; brief.collectionName = null; brief.selections = {}; brief.selectionSources = {};
    }
  }
  // An explicit basis delta answers the pending plan/actual question
  // (owner 2026-10-05): the button path clears basisPending, and so does a
  // typed correction that states the basis directly.
  if (raw.some((value: unknown) => { const d = value as Record<string, unknown>; return !!d && typeof d === 'object' && Object.prototype.hasOwnProperty.call(d, 'basis'); })) delete brief.basisPending;
  for (const key of Object.keys(brief.selections)) if (key.startsWith('measurement:') && !brief.measurements.some(m => `measurement:${m.id}` === key)) { delete brief.selections[key]; delete brief.selectionSources[key]; }
  validateWorkingBrief(brief, concepts);
  return brief;
}
