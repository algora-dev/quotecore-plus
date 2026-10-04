/** Roof-area create/edit adapter into the EXISTING engine (computeRoofArea /
 * rafterPitchFactor); never a second pricing or polygon implementation.
 * Mirrors component-plan.ts conventions: guarded, engine-derived values only,
 * value-first ChangeRows, no model arithmetic is trusted (surface targets are
 * back-derived here, not converted by the model).
 *
 * Scope guard (calc-audit parity, honestly scoped): takeoff-derived areas are
 * REFUSED - their geometry belongs to quote_takeoff_measurements canvas data
 * and requires the takeoff editor's calibration math. Manual/builder component
 * quantities are independent snapshots by design (the builder's
 * updateQuoteRoofArea does not recalculate them either), so no component rows
 * or calc_audit traces are modified by an area change. */
import { randomUUID } from 'node:crypto';
import { computeRoofArea, rafterPitchFactor } from '@/app/lib/pricing/engine';
import { boundedText, isUuid, type ChangeRow } from './contracts';
import { fieldNumber, finite, ProposalError, row, rows, editableQuote } from './action-domain';
import { storageNumber, storedMeasurement } from './storage-number';
import { canonicalQuantity } from './units';

export type AreaChanges = {
    label?: string;
    calc_pitch_degrees?: number;
    calc_plan_sqm?: number;
    surface_sqm?: number;
    final_value_sqm?: number;
};

const AREA_UNITS = ['m2', 'ft2', 'rs'] as const;

export function parseAreaChanges(value: unknown): AreaChanges {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new ProposalError('Choose which roof-area values to change.');
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (!keys.length || keys.some(k => !['label', 'calc_pitch_degrees', 'calc_plan_sqm', 'surface_sqm', 'final_value_sqm'].includes(k)))
        throw new ProposalError('Only the area label, pitch, plan square metres, roof surface or typed total can change here.');
    const valueKeys = keys.filter(k => ['calc_plan_sqm', 'surface_sqm', 'final_value_sqm'].includes(k));
    if (valueKeys.length > 1)
        throw new ProposalError('Choose ONE value target: plan area, pitched surface or typed total.');
    const out: AreaChanges = {};
    for (const key of keys) {
        if (key === 'label') {
            const label = boundedText(record.label, 120);
            if (!label)
                throw new ProposalError('The area label must contain 1 to 120 characters.');
            out.label = label;
        }
        else if (key === 'calc_pitch_degrees')
            out.calc_pitch_degrees = storageNumber(finite(record[key], 'pitch', 0, 89));
        else
            out[key as 'calc_plan_sqm' | 'surface_sqm' | 'final_value_sqm'] = storedMeasurement(finite(record[key], key, 0.000001, 1e8));
    }
    return out;
}

export type AreaSelection = { areaId: string };

/** Resolve the targeted area inside a bound quote/draft snapshot. Exact ID
 * wins; otherwise a unique (case-insensitive, trimmed) label match. None or
 * several label matches ask which area, listing the record's ACTUAL areas
 * value-first (same un-gating convention as bound-draft reads). */
export function selectArea(snapshot: Record<string, unknown>, expectedQuoteId: unknown, areaId: unknown, label: unknown): AreaSelection {
    const q = row(snapshot.quote, 'quote');
    if (!isUuid(expectedQuoteId) || String(q.id) !== expectedQuoteId)
        throw new ProposalError('The area no longer belongs to the selected quote. Nothing was proposed; resolve the current record again.');
    const areas = rows(snapshot.areas, 'roof areas', 48);
    if (areaId !== undefined && areaId !== null) {
        if (!isUuid(areaId) || !areas.some(a => String(a.id) === areaId))
            throw new ProposalError('That roof area is not on this record. Nothing was proposed.');
        return { areaId: String(areaId) };
    }
    const wanted = boundedText(label, 120);
    if (!wanted)
        throw new ProposalError(areaListQuestion(areas));
    const normalized = wanted.toLowerCase();
    const matches = areas.filter(a => String(a.label ?? '').trim().toLowerCase() === normalized);
    if (matches.length === 1)
        return { areaId: String(matches[0].id) };
    throw new ProposalError(areaListQuestion(areas));
}

function areaListQuestion(areas: Record<string, unknown>[]): string {
    if (!areas.length)
        return 'This record has no roof areas yet. Ask to add one if that is the intent.';
    const lines = areas.slice(0, 12).map(a => `${String(a.label)} \u2014 ${a.computed_sqm != null ? `${String(a.computed_sqm)} m2 surface` : 'no stored surface value'}${a.calc_pitch_degrees != null && Number(a.calc_pitch_degrees) > 0 ? `, ${String(a.calc_pitch_degrees)} degrees` : ''}`);
    return `Several roof areas could match (or none exactly). This record has: ${lines.join('; ')}. Ask which area the user means before proposing.`;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** EDIT: compute the new area state through the existing engine. Pure.
 * Label-only edits preserve every stored value exactly (no hidden recompute). */
export function areaResult(snapshot: Record<string, unknown>, change: AreaChanges, userId: string) {
    const q = row(snapshot.quote, 'quote');
    const area = row(snapshot.area, 'roof area');
    const entries = rows(snapshot.area_entries ?? [], 'area measurements', 60);
    if (String(area.quote_id) !== String(q.id))
        throw new ProposalError('The area no longer belongs to the selected quote. Nothing was proposed.');
    editableQuote(q);
    if (snapshot.takeoff_linked === true)
        throw new ProposalError('This roof area is measured on a plan drawing. Edit its geometry in the takeoff editor so dependent measurements stay correct.');
    const inputMode = String(area.input_mode ?? 'calculated');
    if (!['calculated', 'final'].includes(inputMode))
        throw new ProposalError('This area uses an unsupported input mode. Open the builder to change it.');
    const currentLabel = String(area.label ?? '');
    const nextLabel = change.label ?? currentLabel;
    const valueChange = change.calc_pitch_degrees !== undefined || change.calc_plan_sqm !== undefined || change.surface_sqm !== undefined || change.final_value_sqm !== undefined;
    if (!valueChange && nextLabel === currentLabel)
        throw new ProposalError('These area values already match. No change is needed.');
    const changes: ChangeRow[] = [];
    if (nextLabel !== currentLabel)
        changes.push({ label: 'Area label', before: currentLabel, after: nextLabel });
    const unchangedFields = (): Record<string, unknown> => ({ label: nextLabel, calc_pitch_degrees: area.calc_pitch_degrees ?? null, calc_plan_sqm: area.calc_plan_sqm ?? null, final_value_sqm: area.final_value_sqm ?? null, computed_sqm: area.computed_sqm ?? null });
    let fields: Record<string, unknown>;
    let entryRows: { id: string; sqm: number }[] = [];
    if (!valueChange) {
        // Label-only: preserve every stored numeric exactly.
        fields = unchangedFields();
    }
    else if (inputMode === 'final') {
        if (change.calc_pitch_degrees !== undefined || change.calc_plan_sqm !== undefined || change.surface_sqm !== undefined)
            throw new ProposalError('This area is a typed total (surface basis). Change its total, or use the builder to switch basis.');
        const beforeFinal = fieldNumber(area.final_value_sqm, 'typed total', 0);
        const nextFinal = change.final_value_sqm ?? beforeFinal;
        const computed = storageNumber(computeRoofArea({ id: String(area.id), label: nextLabel, inputMode: 'final', finalValueSqm: nextFinal, calcPitchDegrees: 0 }));
        changes.push({ label: 'Typed roof surface (m2)', before: String(beforeFinal), after: String(nextFinal) },
            { label: 'Engine roof surface (m2)', before: String(area.computed_sqm ?? beforeFinal), after: String(computed) });
        fields = { label: nextLabel, calc_pitch_degrees: area.calc_pitch_degrees ?? null, calc_plan_sqm: null, final_value_sqm: nextFinal, computed_sqm: computed };
    }
    else {
        if (change.final_value_sqm !== undefined)
            throw new ProposalError('This area is plan-based. Change its plan area or pitch; the surface follows from the engine.');
        const beforePitch = fieldNumber(area.calc_pitch_degrees, 'pitch', 0);
        const nextPitch = change.calc_pitch_degrees ?? beforePitch;
        if (entries.length > 0 && change.calc_plan_sqm !== undefined)
            throw new ProposalError('This area is built from width x length measurements. Change those rows in the builder, or re-pitch the area here.');
        if (entries.length > 0 && change.surface_sqm !== undefined)
            throw new ProposalError('This area is built from width x length measurements, so its surface follows from those rows. Re-pitch it or edit the rows in the builder.');
        const widthM = area.calc_width_m, lengthM = area.calc_length_m;
        if (change.calc_plan_sqm !== undefined && widthM != null && lengthM != null && fieldNumber(widthM, 'width', 0) > 0 && fieldNumber(lengthM, 'length', 0) > 0)
            throw new ProposalError('This area is built from width x length fields. Change those in the builder, or re-pitch the area here.');
        let plan: number | null = area.calc_plan_sqm == null ? null : fieldNumber(area.calc_plan_sqm, 'plan area', 0);
        if (change.surface_sqm !== undefined) {
            // Back-derive the plan value from the typed surface at the (new)
            // pitch using the engine's own rafter factor. The model never
            // converts numbers itself.
            const factor = rafterPitchFactor(nextPitch);
            plan = storageNumber(change.surface_sqm / factor);
            changes.push({ label: 'Roof surface target (m2)', before: String(area.computed_sqm ?? ''), after: String(change.surface_sqm) },
                { label: 'Plan area (m2, derived by engine)', before: String(area.calc_plan_sqm ?? ''), after: String(plan) });
        }
        if (change.calc_plan_sqm !== undefined) {
            plan = change.calc_plan_sqm;
            changes.push({ label: 'Plan area (m2)', before: String(area.calc_plan_sqm ?? ''), after: String(change.calc_plan_sqm) });
        }
        if (change.calc_pitch_degrees !== undefined)
            changes.push({ label: 'Pitch (degrees)', before: String(beforePitch), after: String(nextPitch) });
        let computed: number;
        if (entries.length > 0) {
            entryRows = entries.map(e => {
                const w = fieldNumber(e.width_m, 'entry width', 0), l = fieldNumber(e.length_m, 'entry length', 0);
                return { id: String(e.id), sqm: round2(w * l * rafterPitchFactor(nextPitch)) };
            });
            computed = storageNumber(entryRows.reduce((sum, e) => sum + e.sqm, 0));
        }
        else {
            const manualPlan = plan == null && widthM != null && lengthM != null ? storageNumber(fieldNumber(widthM, 'width', 0) * fieldNumber(lengthM, 'length', 0)) : null;
            const effectivePlan = plan ?? manualPlan;
            if (effectivePlan == null)
                throw new ProposalError('This area has no stored plan measurement. Open the builder to repair it before changing it here.');
            computed = storageNumber(computeRoofArea({ id: String(area.id), label: nextLabel, inputMode: 'calculated', calcPlanSqm: effectivePlan, calcPitchDegrees: nextPitch }));
        }
        changes.push({ label: 'Engine roof surface (m2)', before: String(area.computed_sqm ?? ''), after: String(computed) });
        fields = { label: nextLabel, calc_pitch_degrees: nextPitch, calc_plan_sqm: plan, final_value_sqm: null, computed_sqm: computed };
    }
    void userId; // parity with component-plan's audit signature; areas carry no calc_audit column
    return { fields, entries: entryRows, changes };
}

export type AreaCreateInput = { label: string; quantity: number; unit: string; basis: 'plan' | 'surface'; pitchDegrees: number };

export function parseAreaCreate(value: unknown): AreaCreateInput {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new ProposalError('Ask for the area label, size and basis before adding it.');
    const record = value as Record<string, unknown>;
    const label = boundedText(record.label, 120);
    if (!label)
        throw new ProposalError('The new area needs a label of 1 to 120 characters.');
    const quantity = finite(record.quantity, 'area', 0.000001, 1e8);
    if (!AREA_UNITS.includes(record.unit as typeof AREA_UNITS[number]))
        throw new ProposalError('Area sizes use m2, ft2 or roofing squares.');
    if (!['plan', 'surface'].includes(String(record.basis)))
        throw new ProposalError('Ask whether the size is a plan measurement or the finished roof surface.');
    const pitch = record.pitch_degrees === undefined || record.pitch_degrees === null
        ? undefined
        : storageNumber(finite(record.pitch_degrees, 'pitch', 0, 89));
    return { label, quantity: storedMeasurement(canonicalQuantity(quantity, record.unit, 'area')), unit: 'm2', basis: record.basis as 'plan' | 'surface', pitchDegrees: pitch as number };
}

/** CREATE: one new manual area row on an editable quote, mirroring the P4
 * draft-creation area rows exactly. Pure. */
export function areaCreateResult(snapshot: Record<string, unknown>, input: AreaCreateInput, userId: string) {
    const q = row(snapshot.quote, 'quote');
    editableQuote(q);
    const areas = rows(snapshot.areas, 'roof areas', 48);
    if (areas.length >= 12)
        throw new ProposalError('This record already has 12 roof areas. Open the builder to review them before adding more.');
    const duplicate = areas.some(a => String(a.label ?? '').trim().toLowerCase() === input.label.trim().toLowerCase());
    if (duplicate)
        throw new ProposalError('An area with this label already exists on this record. Use a different label, or change the existing area.');
    const surface = input.basis === 'surface';
    const defaultPitch = fieldNumber(q.global_pitch_degrees ?? 0, 'quote pitch', 0);
    const pitch = surface ? 0 : (input.pitchDegrees ?? defaultPitch);
    const id = randomUUID();
    const computed = storageNumber(computeRoofArea(surface
        ? { id, label: input.label, inputMode: 'final', finalValueSqm: input.quantity, calcPitchDegrees: 0 }
        : { id, label: input.label, inputMode: 'calculated', calcPlanSqm: input.quantity, calcPitchDegrees: pitch }));
    if (!Number.isFinite(computed))
        throw new ProposalError('This area calculation is invalid.');
    const sortOrder = areas.reduce((max, a) => Math.max(max, Number(a.sort_order ?? 0) || 0), -1) + 1;
    const area = { id, label: input.label, input_mode: surface ? 'final' : 'calculated', final_value_sqm: surface ? input.quantity : null, calc_plan_sqm: surface ? null : input.quantity, calc_pitch_degrees: surface ? 0 : pitch, computed_sqm: computed, sort_order: sortOrder };
    const changes: ChangeRow[] = [
        { label: `New area: ${input.label}`, before: 'New', after: `${input.quantity} m2 (${input.basis}); engine surface ${computed} m2${surface ? '' : `; ${pitch} degrees`}` },
    ];
    void userId;
    return { area, changes };
}
