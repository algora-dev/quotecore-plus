import { randomUUID } from 'node:crypto';
import { computeRoofArea, applyPitchAndWaste, type PitchType, type WasteType, type PricingStrategy } from '@/app/lib/pricing/engine';
import { traceComponentCalc } from '@/app/lib/pricing/calcTracer';
import { TRADE_ALLOWED_MEASUREMENT_TYPES, type Trade, type MeasurementType } from '@/app/lib/trades/measurement-type-whitelist';
import { boundedText, isUuid, type ChangeRow } from './contracts';
import { finite, fieldNumber, ProposalError, rows } from './action-domain';
import { storageNumber, storedMeasurement } from './storage-number';
import { canonicalQuantity, baseUnit } from './units';

export const MEASUREMENT_SYSTEMS = ['metric', 'imperial_ft', 'imperial_rs'] as const;
export type DraftSpec = {
  customerName: string;
  jobName: string;
  siteAddress?: string | null;
  measurementSystem: typeof MEASUREMENT_SYSTEMS[number];
  pitch: number;
  trade: Trade;
  collectionId: string;
  areas: Record<string, unknown>[];
  components: Record<string, unknown>[];
};

export function parseDraft(value: Record<string, unknown>, context: Record<string, unknown>, generic: boolean): DraftSpec {
  const customerName = boundedText(value.customer_name, 200), jobName = boundedText(value.job_name, 200);
  if (!customerName || !jobName) throw new ProposalError('Ask for the customer name and job name first.');
  const siteAddress = value.site_address == null ? null : boundedText(value.site_address, 500);
  if (value.site_address != null && !siteAddress) throw new ProposalError('Site address must be valid text of at most 500 characters.');
  if (!MEASUREMENT_SYSTEMS.includes(value.measurement_system as DraftSpec['measurementSystem'])) throw new ProposalError('Ask the user to confirm metric, square feet or roofing squares.');
  // Missing pitch is a clarification, never a silent 0: flat roofs still
  // work (the model sends 0 explicitly once the user confirms "flat").
  const pitch = storageNumber(finite(value.pitch_degrees, 'pitch', 0, 89));
  const trade = String(value.trade ?? '');
  if (!Object.prototype.hasOwnProperty.call(TRADE_ALLOWED_MEASUREMENT_TYPES, trade)) throw new ProposalError('Choose a supported trade.');
  if (!generic && trade !== 'roofing') throw new ProposalError('This workspace build does not enable generic-trade quote creation.');
  const collectionId = value.collection_id ?? context.bootstrap_collection_id;
  if (!isUuid(collectionId)) throw new ProposalError('A component collection must already exist. Open New Quote to complete the existing collection setup.');
  const collection = rows(context.collections, 'collections', 200).find(c => c.id === collectionId);
  if (!collection) throw new ProposalError('Choose a collection owned by this workspace.');
  if (!generic && collectionId !== context.bootstrap_collection_id) throw new ProposalError('This build uses the existing bootstrap collection. A different collection needs Generic Trades enabled.');
  if (collection.currency != null && collection.currency !== context.currency) throw new ProposalError('The collection and workspace currencies differ. Automatic rate conversion is not supported. Use the normal builder.');

  const areas = rows(value.areas, 'roof areas', 12), components = rows(value.components, 'components', 24);
  for (const a of areas) {
    if (!boundedText(a.label, 120) || !['plan', 'surface'].includes(String(a.basis))) throw new ProposalError('Every area needs a label and a plan/surface basis.');
    finite(a.quantity, 'area', 0.000001, 1e8);
    canonicalQuantity(Number(a.quantity), a.unit, 'area');
    if (a.pitch_degrees != null) finite(a.pitch_degrees, 'area pitch', 0, 89);
  }
  let entryCount = 0;
  for (const c of components) {
    if (!isUuid(c.library_id) || !['plan', 'actual'].includes(String(c.basis))) throw new ProposalError('Each component needs a library match and plan/actual measurement basis.');
    // Blanket pitch rule (owner 2026-10-01): optional explicit pitch type so
    // the library workflow can apply pitch by structural role regardless of
    // the library row's default configuration.
    if (c.pitch_type !== undefined && !['none', 'rafter', 'valley_hip'].includes(String(c.pitch_type))) throw new ProposalError('Component pitch type must be none, rafter or valley_hip.');
    if (c.area_index !== null && (!Number.isInteger(c.area_index) || Number(c.area_index) < 0 || Number(c.area_index) >= areas.length)) throw new ProposalError('A component area reference does not match the proposed areas.');
    if (c.entries !== undefined) {
      const entries = rows(c.entries, 'component entries', 200);
      if (!entries.length || c.quantity !== undefined || c.unit !== undefined) throw new ProposalError('Use individual entries OR a scalar quantity, not both.');
      for (const entry of entries) finite(entry.quantity, 'entry quantity', 0.000001, 1e8);
      entryCount += entries.length;
    } else {
      finite(c.quantity, 'quantity', 0.000001, 1e8);
      entryCount += 1;
    }
  }
  if (entryCount > 600) throw new ProposalError('This draft exceeds 600 measurement entries.');
  return { customerName, jobName, ...(value.site_address !== undefined ? { siteAddress } : {}), measurementSystem: value.measurement_system as DraftSpec['measurementSystem'], pitch, trade: trade as Trade, collectionId, areas, components };
}

export type DraftIdentities = { areas: string[]; components: Array<{id: string; entries: string[]}> };
export function buildDraft(spec: DraftSpec, context: Record<string, unknown>, libraries: Record<string, unknown>[], identities?: DraftIdentities, retainedComponents?: Record<string, unknown>[]) {
  if (identities && (identities.areas.length !== spec.areas.length || identities.components.length !== spec.components.length)) throw new ProposalError('The working draft identity map changed.');
  if (identities) {
    const all = [...identities.areas, ...identities.components.flatMap(c => [c.id, ...c.entries])];
    if (all.some(id => !isUuid(id)) || new Set(all).size !== all.length) throw new ProposalError('Working draft identities must be unique server-owned IDs.');
  }
  const currency = boundedText(context.currency, 8);
  if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new ProposalError('The workspace currency must be configured first.');
  const changes: ChangeRow[] = [
    { label: 'Customer', before: 'New draft', after: spec.customerName },
    { label: 'Job', before: '', after: spec.jobName },
    ...(spec.siteAddress !== undefined ? [{ label: 'Site address', before: '', after: spec.siteAddress ?? 'Not provided' }] : []),
    { label: 'Measurement system (locked on creation)', before: '', after: spec.measurementSystem },
    { label: 'Currency', before: '', after: currency },
    { label: 'Trade', before: '', after: spec.trade },
    { label: 'Component collection', before: '', after: String(rows(context.collections, 'collections', 200).find(c => c.id === spec.collectionId)?.name ?? spec.collectionId) },
    { label: 'Default pitch (degrees)', before: '', after: String(spec.pitch) },
  ];
  const areas = spec.areas.map((a, index) => {
    const id = identities?.areas[index] ?? randomUUID();
    const quantity = storedMeasurement(canonicalQuantity(Number(a.quantity), a.unit, 'area'));
    const surface = a.basis === 'surface';
    const areaPitch = a.pitch_degrees == null ? spec.pitch : storageNumber(finite(a.pitch_degrees, 'area pitch', 0, 89));
    const computed = computeRoofArea({ id, label: String(a.label), inputMode: surface ? 'final' : 'calculated', finalValueSqm: surface ? quantity : undefined, calcPlanSqm: surface ? undefined : quantity, calcPitchDegrees: areaPitch });
    if (!Number.isFinite(computed)) throw new ProposalError('This area calculation is invalid.');
    changes.push({ label: `Area: ${String(a.label)}`, before: 'New', after: `${a.quantity} ${a.unit} (${a.basis}); ${surface ? 'measured surface' : `pitch ${areaPitch}°`}; engine surface ${storageNumber(computed)} m2` });
    return { id, label: String(a.label), input_mode: surface ? 'final' : 'calculated', final_value_sqm: surface ? quantity : null, calc_plan_sqm: surface ? null : quantity, calc_pitch_degrees: surface ? 0 : areaPitch, computed_sqm: storageNumber(computed), sort_order: index };
  });

  const components = spec.components.map((input, index) => {
    const configured = libraries.find(x => x.id === input.library_id);
    if (!configured) throw new ProposalError('A chosen component is no longer available.');
    const retained = identities ? retainedComponents?.find(c => c.id === identities.components[index].id && c.library_id === input.library_id) : undefined;
    const lib = retained ? retainCalculationSettings(configured, retained) : configured;
    if (lib.is_active !== true || lib.collection_id !== spec.collectionId) throw new ProposalError('Use active components from the chosen collection.');
    if (!TRADE_ALLOWED_MEASUREMENT_TYPES[spec.trade].has(String(lib.measurement_type) as MeasurementType)) throw new ProposalError('A selected component is incompatible with this trade.');
    if (!['area', 'lineal', 'linear', 'count', 'quantity', 'fixed', 'volume_3d'].includes(String(lib.measurement_type))) throw new ProposalError('This component requires a specialised dimensional or segment editor. Open the builder for it.');

    const basis = input.basis === 'plan';
    const measurements = input.entries === undefined ? [input] : rows(input.entries, 'component entries', 200);
    const pitchType = input.pitch_type !== undefined ? String(input.pitch_type) : String(lib.default_pitch_type ?? 'none'), wasteType = String(lib.default_waste_type ?? 'none'), strategy = String(lib.pricing_strategy ?? 'per_unit');
    if (!['none', 'rafter', 'valley_hip'].includes(pitchType) || !['none', 'percent', 'fixed', 'fixed_per_segment'].includes(wasteType) || !['per_unit', 'per_pack_area', 'per_pack_length', 'per_pack_coverage', 'per_pack_volume'].includes(strategy)) throw new ProposalError('A component uses an unsupported calculation configuration.');
    const waste = fieldNumber(lib.default_waste_percent, 'waste', 0), fixed = fieldNumber(lib.default_waste_fixed, 'fixed waste', 0);
    const areaIndex = input.area_index === null ? null : Number(input.area_index);
    const linkedArea = areaIndex === null ? null : spec.areas[areaIndex];
    const linkedPitch = linkedArea?.pitch_degrees == null ? spec.pitch : Number(linkedArea.pitch_degrees);
    const explicitPitch = input.pitch_degrees == null ? linkedPitch : storageNumber(finite(input.pitch_degrees, 'component pitch', 0, 89));
    const deg = basis && pitchType !== 'none' ? explicitPitch : 0;

    const calculated = measurements.map((entry, sortOrder) => {
      const raw = storedMeasurement(canonicalQuantity(Number(entry.quantity), entry.unit, lib.measurement_type));
      const result = applyPitchAndWaste(raw, basis, pitchType as PitchType, deg, wasteType as WasteType, waste, fixed);
      return { rawValue: raw, metricValue: raw, afterPitch: result.afterPitch, afterWaste: storageNumber(result.afterWaste), pitchDegrees: deg, sortOrder };
    });
    const totalQuantity = storageNumber(calculated.reduce((sum, entry) => sum + entry.afterWaste, 0));
    const rate = fieldNumber(lib.default_material_rate, 'material rate', 0), labour = fieldNumber(lib.default_labour_rate, 'labour rate', 0);
    const audit = traceComponentCalc({ componentName: String(lib.name), measurementType: String(lib.measurement_type), entries: calculated,
      totalQuantity, materialRate: rate, labourRate: labour, pricingStrategy: strategy as PricingStrategy, packPrice: lib.pack_price == null ? null : fieldNumber(lib.pack_price, 'pack price'), packSize: lib.pack_size == null ? null : fieldNumber(lib.pack_size, 'pack size'), packCoverageM2: lib.pack_coverage_m2 == null ? null : fieldNumber(lib.pack_coverage_m2, 'pack coverage'),
      wasteType, wastePercent: waste, wasteFixed: fixed, pitchType, pitchDegrees: deg, source: 'manual' });
    if (audit.packDataMissing || ![audit.materialCost, audit.labourCost, totalQuantity].every(Number.isFinite)) throw new ProposalError('A library pack is missing its pricing data. Fix it before creating this draft.');
    const id = identities?.components[index].id ?? randomUUID(), unit = baseUnit(lib.measurement_type);
    changes.push({ label: `Component: ${String(lib.name)}`, before: 'New', after: `${measurementSummary(measurements)} (${input.basis}, ${measurements.length} ${measurements.length === 1 ? 'entry' : 'entries'}, before waste); ${deg} degrees; waste ${wasteType === 'percent' ? waste + '%' : wasteType === 'none' ? 'none' : fixed + ' ' + unit}; engine quantity ${totalQuantity} ${unit}; ${currency} material ${audit.materialCost.toFixed(2)}, labour ${audit.labourCost.toFixed(2)}` });
    if (identities && identities.components[index].entries.length !== calculated.length) throw new ProposalError('The measurement identity map changed.');
    const entries = calculated.map((e, entryIndex) => ({ id: identities?.components[index].entries[entryIndex] ?? randomUUID(), raw_value: e.rawValue, value_after_waste: e.afterWaste, pitch_degrees: deg > 0 ? deg : null, sort_order: e.sortOrder }));
    return { id, library_id: lib.id, area_id: areaIndex === null ? null : areas[areaIndex].id, name: lib.name, component_type: lib.component_type, measurement_type: lib.measurement_type === 'linear' ? 'lineal' : lib.measurement_type === 'quantity' ? 'count' : lib.measurement_type, input_mode: basis ? 'calculated' : 'final',
      material_rate: rate, labour_rate: labour, waste_type: wasteType, waste_percent: waste, waste_fixed: fixed, pitch_type: pitchType, calc_pitch_degrees: deg,
      final_quantity: totalQuantity, material_cost: storageNumber(audit.materialCost), labour_cost: storageNumber(audit.labourCost), priced_quantity: audit.pricedQuantity, pack_size_snapshot: strategy !== 'per_unit' && fieldNumber(lib.pack_size, 'pack size', 0) > 0 ? lib.pack_size : null,
      calc_audit: JSON.parse(JSON.stringify({ ...audit, ...(input.source ? { assistant_measurement_source: input.source } : {}) })) as unknown, sort_order: index, entry: entries[0], ...(input.entries === undefined ? {} : { entries }) };
  });
  const material = components.reduce((sum, c) => sum + c.material_cost, 0), labour = components.reduce((sum, c) => sum + c.labour_cost, 0);
  changes.push({ label: `Engine costs before quote margins/taxes (${currency})`, before: '', after: `Materials ${material.toFixed(2)}; labour ${labour.toFixed(2)}. Review the full total in the builder.` });
  return { params: { customerName: spec.customerName, jobName: spec.jobName, ...(spec.siteAddress !== undefined ? { siteAddress: spec.siteAddress } : {}), templateId: null, entryMode: 'manual', measurementSystem: spec.measurementSystem, trade: spec.trade, componentCollectionId: spec.collectionId },
    currency, pitch: spec.pitch, children: { areas, components }, changes };
}

function measurementSummary(entries: Record<string, unknown>[]): string {
  const groups = new Map<string, number>();
  for (const e of entries) { const key = `${e.quantity} ${e.unit}`; groups.set(key, (groups.get(key) ?? 0) + 1); }
  const labels = [...groups].map(([key, count]) => count > 1 ? `${count} × ${key}` : key);
  return labels.length <= 12 ? labels.join(' + ') : `${labels.slice(0, 12).join(' + ')}; ${labels.length - 12} more distinct measurements (${entries.length} entries in total)`;
}

/** Keep a saved draft's pricing/waste settings when only its measurements change.
 * New/reassigned products use the current library defaults. The current library
 * snapshot still supplies eligibility and is revalidated at confirmation. */
function retainCalculationSettings(current: Record<string, unknown>, previous: Record<string, unknown>): Record<string, unknown> {
  const normalize = (v: unknown) => v === 'linear' ? 'lineal' : v === 'quantity' ? 'count' : v;
  if (normalize(current.measurement_type) !== normalize(previous.measurement_type))
    throw new ProposalError('A selected product changed measurement behavior. Review it in the builder before revising this draft.');
  const audit = previous.calc_audit;
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) throw new ProposalError('The saved calculation settings need review.');
  const saved = audit as Record<string, unknown>;
  if (typeof saved.pricingStrategy !== 'string') throw new ProposalError('The saved pricing strategy is unavailable.');
  return { ...current, name: previous.name, component_type: previous.component_type,
    default_material_rate: previous.material_rate, default_labour_rate: previous.labour_rate,
    default_waste_type: previous.waste_type, default_waste_percent: previous.waste_percent, default_waste_fixed: previous.waste_fixed,
    pricing_strategy: saved.pricingStrategy, pack_size: saved.packSize ?? null, pack_price: saved.packPrice ?? null, pack_coverage_m2: saved.packCoverageM2 ?? null };
}
