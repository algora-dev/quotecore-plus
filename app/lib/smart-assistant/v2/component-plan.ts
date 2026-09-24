/** Adapter into the EXISTING engine; never a second pricing implementation. */
import { applyPitchAndWaste, type PitchType, type WasteType, type PricingStrategy } from '@/app/lib/pricing/engine';
import { traceComponentCalc, type CalcAuditOverride } from '@/app/lib/pricing/calcTracer';
import { isRecord } from '../section-permissions';
import { fieldNumber, ProposalError, row, rows, type ComponentChanges } from './action-domain';
import { storageNumber, storedMeasurement } from './storage-number';
import type { ChangeRow } from './contracts';
const pitchTypes = ['none', 'rafter', 'valley_hip'];
const wasteTypes = ['none', 'percent', 'fixed', 'fixed_per_segment'];
const strategies = ['per_unit', 'per_pack_length', 'per_pack_area', 'per_pack_coverage', 'per_pack_volume'];
export function componentResult(snapshot: Record<string, unknown>, change: ComponentChanges, userId: string) {
    change = { ...change };
    for (const key of Object.keys(change) as (keyof ComponentChanges)[]) {
        change[key] = key === 'raw_quantity' ? storedMeasurement(change[key]!) : storageNumber(change[key]!);
    }
    const c = row(snapshot.component, 'component');
    const q = row(snapshot.quote, 'quote');
    const library = snapshot.library === null ? {} : row(snapshot.library, 'library');
    if (c.component_library_id != null && snapshot.library === null)
        throw new ProposalError('The source library component is missing. Open the builder to review its pricing before changing this line.');
    const entries = rows(snapshot.entries, 'component entries');
    if (entries.length === 0)
        throw new ProposalError('This component has no source measurement entries. Open the builder to repair its measurements before changing its calculation.');
    const geometryChange = change.raw_quantity !== undefined || change.pitch_degrees !== undefined || change.waste_percent !== undefined;
    if (geometryChange && (q.entry_mode !== 'manual' || c.input_mode !== 'calculated' || entries.some(e => e.page_id !== null || e.is_combined === true || e.combined_from !== null) ||
        !['area', 'lineal', 'linear', 'count', 'quantity', 'fixed', 'hours_days'].includes(String(c.measurement_type)))) {
        throw new ProposalError('This measurement has takeoff, combined or dimensional source geometry. Use the real editor for quantity, waste or pitch changes; rates can still be reviewed here.');
    }
    if (change.raw_quantity !== undefined && entries.length !== 1)
        throw new ProposalError('Quantity replacement needs exactly one manual entry. Specify or edit individual measurements in the builder instead.');
    if (change.raw_quantity !== undefined && change.raw_quantity <= 0)
        throw new ProposalError('A measurement must be greater than zero. Removing a line is a separate action.');
    const pitchType = String(c.pitch_type ?? 'none');
    const wasteType = change.waste_percent !== undefined ? 'percent' : String(c.waste_type ?? 'none');
    const strategy = String(library.pricing_strategy ?? 'per_unit');
    if (!pitchTypes.includes(pitchType) || !wasteTypes.includes(wasteType) || !strategies.includes(strategy))
        throw new ProposalError('This component calculation variant is not supported safely.');
    if (change.material_rate !== undefined && strategy !== 'per_unit')
        throw new ProposalError('This component is priced by pack. Change its pack price in the library editor, rather than a unit rate that the engine would ignore.');
    if (change.pitch_degrees !== undefined && pitchType === 'none')
        throw new ProposalError('This component does not apply pitch. Open its settings before adding pitch.');
    const rate = change.material_rate ?? fieldNumber(c.material_rate, 'material rate', 0), labour = change.labour_rate ?? fieldNumber(c.labour_rate, 'labour rate', 0);
    const waste = change.waste_percent ?? fieldNumber(c.waste_percent, 'waste percentage', 0), fixed = fieldNumber(c.waste_fixed, 'fixed waste', 0);
    const changes: ChangeRow[] = [];
    const labels: Record<keyof ComponentChanges, string> = { material_rate: 'Material rate (quote currency per canonical unit)', labour_rate: 'Labour rate (quote currency per canonical unit)', waste_percent: 'Waste (%)', pitch_degrees: 'Component pitch (degrees)', raw_quantity: 'Raw plan quantity (canonical unit)' };
    for (const key of Object.keys(change) as (keyof ComponentChanges)[]) {
        const old = key === 'raw_quantity' ? entries[0]?.raw_value : key === 'pitch_degrees' ? (c.custom_pitch_degrees ?? c.calc_pitch_degrees ?? 0) : c[key];
        changes.push({ label: labels[key], before: String(old ?? 0), after: String(change[key]) });
    }
    const adjusted = entries.map(e => {
        const raw = change.raw_quantity ?? fieldNumber(e.raw_value, 'raw quantity');
        const deg = change.pitch_degrees ?? fieldNumber(e.pitch_degrees, 'entry pitch', fieldNumber(c.calc_pitch_degrees, 'component pitch', 0));
        const calculated = applyPitchAndWaste(raw, c.input_mode === 'calculated', pitchType as PitchType, deg, wasteType as WasteType, waste, fixed);
        // Rate-only changes preserve the authoritative measured quantities exactly.
        return { id: String(e.id), raw_value: raw, value_after_waste: geometryChange ? storageNumber(calculated.afterWaste) : fieldNumber(e.value_after_waste, 'measured quantity'),
            pitch_degrees: geometryChange ? (pitchType === 'none' ? null : deg) : (e.pitch_degrees ?? null), afterPitch: calculated.afterPitch, sortOrder: fieldNumber(e.sort_order, 'sort order', 0), isCombined: e.is_combined === true, combinedFrom: e.is_combined === true ? rows(e.combined_from, 'combined source entries').map(x => ({ raw: fieldNumber(x.raw, 'combined raw'), after: fieldNumber(x.after, 'combined measured'), sort: fieldNumber(x.sort, 'combined order', 0) })) : undefined };
    });
    const total = storageNumber(adjusted.reduce((sum, e) => sum + e.value_after_waste, 0));
    const previousAudit = isRecord(c.calc_audit) ? c.calc_audit : null;
    const overrides: CalcAuditOverride[] = Array.isArray(previousAudit?.overrides) ? previousAudit.overrides as CalcAuditOverride[] : [];
    const now = new Date().toISOString();
    const added: CalcAuditOverride[] = Object.keys(change).map(k => ({ field: k, previousValue: k === 'raw_quantity' ? String(entries[0]?.raw_value ?? '') : String(c[k] ?? ''), newValue: change[k as keyof ComponentChanges]!, timestamp: now, userId }));
    const audit = traceComponentCalc({ componentName: String(c.name), measurementType: String(c.measurement_type),
        entries: adjusted.map(e => ({ rawValue: e.raw_value, metricValue: e.raw_value, afterPitch: e.afterPitch, afterWaste: e.value_after_waste, pitchDegrees: fieldNumber(e.pitch_degrees, 'pitch', 0), sortOrder: e.sortOrder, isCombined: e.isCombined, combinedFrom: e.combinedFrom })),
        totalQuantity: total, materialRate: rate, labourRate: labour, pricingStrategy: strategy as PricingStrategy,
        packPrice: library.pack_price == null ? null : fieldNumber(library.pack_price, 'pack price'), packSize: library.pack_size == null ? null : fieldNumber(library.pack_size, 'pack size'), packCoverageM2: library.pack_coverage_m2 == null ? null : fieldNumber(library.pack_coverage_m2, 'pack coverage'),
        wasteType, wastePercent: waste, wasteFixed: fixed, pitchType, pitchDegrees: change.pitch_degrees ?? fieldNumber(c.calc_pitch_degrees, 'pitch', 0), source: 'recalc', existingOverrides: [...overrides, ...added] });
    if (audit.packDataMissing || ![audit.materialCost, audit.labourCost, total].every(Number.isFinite))
        throw new ProposalError('The library has missing pack data or this calculation is invalid. Correct it in the component editor first.');
    const fields: Record<string, unknown> = { material_rate: rate, labour_rate: labour, waste_type: wasteType, waste_percent: waste, waste_fixed: fixed,
        final_quantity: total, material_cost: storageNumber(audit.materialCost), labour_cost: storageNumber(audit.labourCost), priced_quantity: audit.pricedQuantity,
        pack_size_snapshot: strategy !== 'per_unit' && fieldNumber(library.pack_size, 'pack size', 0) > 0 ? fieldNumber(library.pack_size, 'pack size') : null,
        calc_audit: JSON.parse(JSON.stringify(audit)) as unknown, is_rate_overridden: change.material_rate !== undefined || change.labour_rate !== undefined || c.is_rate_overridden === true,
        is_quantity_overridden: change.raw_quantity !== undefined || c.is_quantity_overridden === true, is_waste_overridden: change.waste_percent !== undefined || c.is_waste_overridden === true, is_pitch_overridden: change.pitch_degrees !== undefined || c.is_pitch_overridden === true,
        use_custom_pitch: change.pitch_degrees !== undefined ? true : c.use_custom_pitch === true, custom_pitch_degrees: change.pitch_degrees ?? c.custom_pitch_degrees ?? null, calc_pitch_degrees: change.pitch_degrees ?? c.calc_pitch_degrees ?? null };
    changes.push({ label: `${q.currency ?? ''} material cost (engine)`, before: String(c.material_cost ?? 0), after: String(storageNumber(audit.materialCost)) }, { label: `${q.currency ?? ''} labour cost (engine)`, before: String(c.labour_cost ?? 0), after: String(storageNumber(audit.labourCost)) });
    return { fields, entries: geometryChange ? adjusted.map(e => ({ id: e.id, raw_value: e.raw_value, value_after_waste: e.value_after_waste, pitch_degrees: e.pitch_degrees })) : [], changes };
}
