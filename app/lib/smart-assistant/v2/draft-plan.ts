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
    measurementSystem: typeof MEASUREMENT_SYSTEMS[number];
    pitch: number;
    trade: Trade;
    collectionId: string;
    areas: Record<string, unknown>[];
    components: Record<string, unknown>[];
};
export function parseDraft(value: Record<string, unknown>, context: Record<string, unknown>, generic: boolean): DraftSpec {
    const customerName = boundedText(value.customer_name, 200), jobName = boundedText(value.job_name, 200);
    if (!customerName || !jobName)
        throw new ProposalError('Ask for the customer name and job name first.');
    if (!MEASUREMENT_SYSTEMS.includes(value.measurement_system as DraftSpec['measurementSystem']))
        throw new ProposalError('Ask the user to confirm metric, square feet or roofing squares.');
    const pitch = storageNumber(finite(value.pitch_degrees, 'pitch', 0, 89));
    const trade = String(value.trade ?? '');
    if (!Object.prototype.hasOwnProperty.call(TRADE_ALLOWED_MEASUREMENT_TYPES, trade))
        throw new ProposalError('Choose a supported trade.');
    if (!generic && trade !== 'roofing')
        throw new ProposalError('This workspace build does not enable generic-trade quote creation.');
    const collectionId = value.collection_id ?? context.bootstrap_collection_id;
    if (!isUuid(collectionId))
        throw new ProposalError('A component collection must already exist. Open New Quote to complete the existing collection setup.');
    const collection = rows(context.collections, 'collections', 200).find(c => c.id === collectionId);
    if (!collection)
        throw new ProposalError('Choose a collection owned by this workspace.');
    if (!generic && collectionId !== context.bootstrap_collection_id)
        throw new ProposalError('This build uses the existing bootstrap collection. A different collection needs Generic Trades enabled.');
    if (collection.currency != null && collection.currency !== context.currency)
        throw new ProposalError('The collection and workspace currencies differ. Automatic rate conversion is not supported. Use the normal builder.');
    const areas = rows(value.areas, 'roof areas', 12), components = rows(value.components, 'components', 24);
    for (const a of areas) {
        if (!boundedText(a.label, 120) || !['plan', 'surface'].includes(String(a.basis)))
            throw new ProposalError('Every area needs a label and a plan/surface basis.');
        finite(a.quantity, 'area', 0.000001, 1e8);
        canonicalQuantity(Number(a.quantity), a.unit, 'area');
    }
    for (const c of components) {
        if (!isUuid(c.library_id) || !['plan', 'actual'].includes(String(c.basis)))
            throw new ProposalError('Each component needs a library match and plan/actual measurement basis.');
        finite(c.quantity, 'quantity', 0.000001, 1e8);
        if (c.area_index !== null && (!Number.isInteger(c.area_index) || Number(c.area_index) < 0 || Number(c.area_index) >= areas.length))
            throw new ProposalError('A component area reference does not match the proposed areas.');
    }
    return { customerName, jobName, measurementSystem: value.measurement_system as DraftSpec['measurementSystem'], pitch, trade: trade as Trade, collectionId, areas, components };
}
export function buildDraft(spec: DraftSpec, context: Record<string, unknown>, libraries: Record<string, unknown>[]) {
    const currency = boundedText(context.currency, 8);
    if (!currency || !/^[A-Z]{3}$/.test(currency))
        throw new ProposalError('The workspace currency must be configured first.');
    const changes: ChangeRow[] = [{ label: 'Customer', before: 'New draft', after: spec.customerName }, { label: 'Job', before: '', after: spec.jobName },
        { label: 'Measurement system (locked on creation)', before: '', after: spec.measurementSystem }, { label: 'Currency', before: '', after: currency }, { label: 'Trade', before: '', after: spec.trade }, { label: 'Component collection', before: '', after: String(rows(context.collections, 'collections', 200).find(c => c.id === spec.collectionId)?.name ?? spec.collectionId) }, { label: 'Pitch (degrees)', before: '', after: String(spec.pitch) }];
    const areas = spec.areas.map((a, index) => {
        const id = randomUUID(), quantity = storedMeasurement(canonicalQuantity(Number(a.quantity), a.unit, 'area')), surface = a.basis === 'surface';
        const computed = computeRoofArea({ id, label: String(a.label), inputMode: surface ? 'final' : 'calculated', finalValueSqm: surface ? quantity : undefined, calcPlanSqm: surface ? undefined : quantity, calcPitchDegrees: spec.pitch });
        if (!Number.isFinite(computed))
            throw new ProposalError('This area calculation is invalid.');
        changes.push({ label: `Area: ${String(a.label)}`, before: 'New', after: `${a.quantity} ${a.unit} (${a.basis}); engine surface ${storageNumber(computed)} m2` });
        return { id, label: String(a.label), input_mode: surface ? 'final' : 'calculated', final_value_sqm: surface ? quantity : null, calc_plan_sqm: surface ? null : quantity, calc_pitch_degrees: surface ? 0 : spec.pitch, computed_sqm: storageNumber(computed), sort_order: index };
    });
    const components = spec.components.map((input, index) => {
        const lib = libraries.find(x => x.id === input.library_id);
        if (!lib)
            throw new ProposalError('A chosen component is no longer available.');
        if (lib.is_active !== true || lib.collection_id !== spec.collectionId)
            throw new ProposalError('Use active components from the chosen collection.');
        if (!TRADE_ALLOWED_MEASUREMENT_TYPES[spec.trade].has(String(lib.measurement_type) as MeasurementType))
            throw new ProposalError('A selected component is incompatible with this trade.');
        // No inferred height, depth, segmentation or time unit. These remain in the
        // existing specialised builder. Simple scalar units are the safe P4 adapter.
        if (!['area', 'lineal', 'linear', 'count', 'quantity', 'fixed', 'volume_3d'].includes(String(lib.measurement_type)))
            throw new ProposalError('This component requires a specialised dimensional or segment editor. Open the builder for it.');
        const raw = storedMeasurement(canonicalQuantity(Number(input.quantity), input.unit, lib.measurement_type)), basis = input.basis === 'plan';
        const pitchType = String(lib.default_pitch_type ?? 'none'), wasteType = String(lib.default_waste_type ?? 'none'), strategy = String(lib.pricing_strategy ?? 'per_unit');
        if (!['none', 'rafter', 'valley_hip'].includes(pitchType) || !['none', 'percent', 'fixed', 'fixed_per_segment'].includes(wasteType) || !['per_unit', 'per_pack_area', 'per_pack_length', 'per_pack_coverage', 'per_pack_volume'].includes(strategy))
            throw new ProposalError('A component uses an unsupported calculation configuration.');
        const waste = fieldNumber(lib.default_waste_percent, 'waste', 0), fixed = fieldNumber(lib.default_waste_fixed, 'fixed waste', 0);
        const deg = basis && pitchType !== 'none' ? spec.pitch : 0;
        const engineResult = applyPitchAndWaste(raw, basis, pitchType as PitchType, deg, wasteType as WasteType, waste, fixed);
        const result = { ...engineResult, afterWaste: storageNumber(engineResult.afterWaste) };
        const rate = fieldNumber(lib.default_material_rate, 'material rate', 0), labour = fieldNumber(lib.default_labour_rate, 'labour rate', 0);
        const audit = traceComponentCalc({ componentName: String(lib.name), measurementType: String(lib.measurement_type), entries: [{ rawValue: raw, metricValue: raw, afterPitch: result.afterPitch, afterWaste: result.afterWaste, pitchDegrees: deg, sortOrder: 0 }],
            totalQuantity: result.afterWaste, materialRate: rate, labourRate: labour, pricingStrategy: strategy as PricingStrategy, packPrice: lib.pack_price == null ? null : fieldNumber(lib.pack_price, 'pack price'), packSize: lib.pack_size == null ? null : fieldNumber(lib.pack_size, 'pack size'), packCoverageM2: lib.pack_coverage_m2 == null ? null : fieldNumber(lib.pack_coverage_m2, 'pack coverage'),
            wasteType, wastePercent: waste, wasteFixed: fixed, pitchType, pitchDegrees: deg, source: 'manual' });
        if (audit.packDataMissing || ![audit.materialCost, audit.labourCost, result.afterWaste].every(Number.isFinite))
            throw new ProposalError('A library pack is missing its pricing data. Fix it before creating this draft.');
        const id = randomUUID();
        const unit = baseUnit(lib.measurement_type);
        changes.push({ label: `Component: ${String(lib.name)}`, before: 'New', after: `${input.quantity} ${input.unit} (${input.basis}, before waste); ${deg} degrees; waste ${wasteType === 'percent' ? waste + '%' : wasteType === 'none' ? 'none' : fixed + ' ' + unit}; engine quantity ${result.afterWaste} ${unit}; ${currency} material ${audit.materialCost.toFixed(2)}, labour ${audit.labourCost.toFixed(2)}` });
        return { id, library_id: lib.id, area_id: input.area_index === null ? null : areas[Number(input.area_index)].id, name: lib.name, component_type: lib.component_type, measurement_type: lib.measurement_type === 'linear' ? 'lineal' : lib.measurement_type === 'quantity' ? 'count' : lib.measurement_type, input_mode: basis ? 'calculated' : 'final',
            material_rate: rate, labour_rate: labour, waste_type: wasteType, waste_percent: waste, waste_fixed: fixed, pitch_type: pitchType, calc_pitch_degrees: deg,
            final_quantity: result.afterWaste, material_cost: storageNumber(audit.materialCost), labour_cost: storageNumber(audit.labourCost), priced_quantity: audit.pricedQuantity, pack_size_snapshot: strategy !== 'per_unit' && fieldNumber(lib.pack_size, 'pack size', 0) > 0 ? lib.pack_size : null,
            calc_audit: JSON.parse(JSON.stringify(audit)) as unknown, sort_order: index, entry: { id: randomUUID(), raw_value: raw, value_after_waste: result.afterWaste, pitch_degrees: deg > 0 ? deg : null } };
    });
    // The actual engine trace supplies these amounts. No tax/margin estimate here.
    const material = components.reduce((sum, c) => sum + c.material_cost, 0), labour = components.reduce((sum, c) => sum + c.labour_cost, 0);
    changes.push({ label: `Engine costs before quote margins/taxes (${currency})`, before: '', after: `Materials ${material.toFixed(2)}; labour ${labour.toFixed(2)}. Review the full total in the builder.` });
    return { params: { customerName: spec.customerName, jobName: spec.jobName, templateId: null, entryMode: 'manual', measurementSystem: spec.measurementSystem, trade: spec.trade, componentCollectionId: spec.collectionId },
        currency, pitch: spec.pitch, children: { areas, components }, changes };
}
