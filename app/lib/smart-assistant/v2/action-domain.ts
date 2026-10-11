/** Pure input and proof contracts. No model-generated SQL or arbitrary patches. */
import { isRecord, type AssistantSection } from '../section-permissions';
import { boundedText, isUuid, type ChangeRow, type RecordTarget } from './contracts';
export type ActionKind = 'quote_details' | 'component_change' | 'draft_create' | 'area_change' | 'library_component_change' | 'library_create';
export type ComponentChanges = {
    material_rate?: number;
    labour_rate?: number;
    waste_percent?: number;
    pitch_degrees?: number;
    raw_quantity?: number;
};
export const LIBRARY_MEASUREMENT_TYPES = ['area', 'linear', 'quantity', 'fixed', 'lineal', 'count', 'hours_days'] as const;
export const LIBRARY_PITCH_TYPES = ['none', 'rafter', 'valley_hip'] as const;
export const LIBRARY_WASTE_TYPES = ['none', 'percent', 'fixed'] as const;
export const LIBRARY_SOLD_BY = ['area', 'per_unit'] as const;
export type LibraryChanges = {
    name?: string;
    measurement_type?: typeof LIBRARY_MEASUREMENT_TYPES[number];
    material_rate?: number;
    labour_rate?: number;
    waste_type?: typeof LIBRARY_WASTE_TYPES[number];
    waste_percent?: number;
    waste_fixed?: number;
    pitch_type?: typeof LIBRARY_PITCH_TYPES[number];
    sold_by?: typeof LIBRARY_SOLD_BY[number];
    cover_width_mm?: number;
    is_active?: boolean;
};
export type LibraryCreateInput = {
    name: string;
    measurement_type: typeof LIBRARY_MEASUREMENT_TYPES[number];
    component_type: 'main' | 'extra';
    material_rate: number;
    labour_rate: number;
    waste_type: typeof LIBRARY_WASTE_TYPES[number];
    waste_percent: number;
    waste_fixed: number;
    pitch_type: typeof LIBRARY_PITCH_TYPES[number];
    sold_by: typeof LIBRARY_SOLD_BY[number] | null;
    cover_width_mm: number | null;
    collection_id: string | null;
    collection_name: string | null;
};
export type QuoteChanges = {
    customer_name?: string;
    job_name?: string;
};
export type ActionPlan = {
    kind: ActionKind;
    target: RecordTarget | null;
    targetKind: 'quote' | 'quote_component' | 'creation' | 'quote_area' | 'quote_areas' | 'library_component' | 'library';
    targetId: string | null;
    sections: AssistantSection[];
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    title: string;
    changes: ChangeRow[];
    note: string;
    permissionRevision: number;
    digest?: string;
};
export class ProposalError extends Error {
}
export function finite(value: unknown, name: string, min = 0, max = 1e9): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new ProposalError(`${name} must be a finite number from ${min} to ${max}.`);
    return value;
}
export function fieldNumber(value: unknown, name: string, fallback?: number): number {
    if (value === null || value === undefined) {
        if (fallback !== undefined)
            return fallback;
        throw new ProposalError(`Missing ${name}. Open the record to check it.`);
    }
    // Supabase numeric columns normally arrive as numbers; also accept database
    // numeric strings at this read boundary, never in model input validation.
    const num = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    return finite(num, name, -1e12, 1e12);
}
export function parseComponentChanges(value: unknown): ComponentChanges {
    if (!isRecord(value) || !Object.keys(value).length || Object.keys(value).some(k => !['material_rate', 'labour_rate', 'waste_percent', 'pitch_degrees', 'raw_quantity'].includes(k)))
        throw new ProposalError('Choose only rates, waste percentage, component pitch or one raw entry quantity.');
    const out: ComponentChanges = {};
    for (const key of ['material_rate', 'labour_rate', 'waste_percent', 'pitch_degrees', 'raw_quantity'] as const)
        if (value[key] !== undefined) {
            out[key] = finite(value[key], key, 0, key === 'pitch_degrees' ? 89 : key === 'waste_percent' ? 100 : 1e8);
        }
    return out;
}
const LIBRARY_CHANGE_KEYS = ['name', 'measurement_type', 'material_rate', 'labour_rate', 'waste_type', 'waste_percent', 'waste_fixed', 'pitch_type', 'sold_by', 'cover_width_mm', 'is_active'] as const;
export function parseLibraryChanges(value: unknown): LibraryChanges {
    if (!isRecord(value) || !Object.keys(value).length || Object.keys(value).some(k => !LIBRARY_CHANGE_KEYS.includes(k as never)))
        throw new ProposalError('Library component edits support: name, measurement type, material/labour rates, waste, pitch type, sold-by basis, cover width and active flag.');
    const out: LibraryChanges = {};
    if (value.name !== undefined) {
        const name = boundedText(value.name, 200);
        if (!name)
            throw new ProposalError('The component name must contain 1 to 200 characters.');
        out.name = name;
    }
    if (value.measurement_type !== undefined) {
        if (!LIBRARY_MEASUREMENT_TYPES.includes(value.measurement_type as never))
            throw new ProposalError(`Measurement type must be one of: ${LIBRARY_MEASUREMENT_TYPES.join(', ')}.`);
        out.measurement_type = value.measurement_type as LibraryChanges['measurement_type'];
    }
    for (const key of ['material_rate', 'labour_rate'] as const)
        if (value[key] !== undefined)
            out[key] = finite(value[key], key, 0, 1e8);
    if (value.waste_type !== undefined) {
        if (!LIBRARY_WASTE_TYPES.includes(value.waste_type as never))
            throw new ProposalError(`Waste type must be one of: ${LIBRARY_WASTE_TYPES.join(', ')}.`);
        out.waste_type = value.waste_type as LibraryChanges['waste_type'];
    }
    if (value.waste_percent !== undefined)
        out.waste_percent = finite(value.waste_percent, 'waste_percent', 0, 100);
    if (value.waste_fixed !== undefined)
        out.waste_fixed = finite(value.waste_fixed, 'waste_fixed', 0, 1e8);
    if (value.pitch_type !== undefined) {
        if (!LIBRARY_PITCH_TYPES.includes(value.pitch_type as never))
            throw new ProposalError(`Pitch type must be one of: ${LIBRARY_PITCH_TYPES.join(', ')} (rafter or valley/hip pitch factors, or none).`);
        out.pitch_type = value.pitch_type as LibraryChanges['pitch_type'];
    }
    if (value.sold_by !== undefined) {
        if (!LIBRARY_SOLD_BY.includes(value.sold_by as never))
            throw new ProposalError(`Sold-as basis must be one of: ${LIBRARY_SOLD_BY.join(', ')}.`);
        out.sold_by = value.sold_by as LibraryChanges['sold_by'];
    }
    if (value.cover_width_mm !== undefined) {
        if (value.cover_width_mm === null) { out.cover_width_mm = undefined; }
        else out.cover_width_mm = finite(value.cover_width_mm, 'cover_width_mm', 1, 10000);
    }
    if (value.is_active !== undefined) {
        if (typeof value.is_active !== 'boolean')
            throw new ProposalError('The active flag must be true or false.');
        out.is_active = value.is_active;
    }
    // A waste value needs its matching type; the type change without a value keeps the stored one.
    if (out.waste_type === 'percent' && out.waste_percent === undefined && out.waste_fixed !== undefined)
        throw new ProposalError('Percent waste needs a waste_percent value; waste_fixed applies to fixed waste.');
    if (out.waste_type === 'fixed' && out.waste_fixed === undefined && out.waste_percent !== undefined)
        throw new ProposalError('Fixed waste needs a waste_fixed value; waste_percent applies to percent waste.');
    return out;
}
export function parseLibraryCreate(value: unknown): LibraryCreateInput {
    if (!isRecord(value))
        throw new ProposalError('A new component needs at least a name and measurement type.');
    const name = boundedText(value.name, 200);
    if (!name)
        throw new ProposalError('The component name must contain 1 to 200 characters.');
    if (!LIBRARY_MEASUREMENT_TYPES.includes(value.measurement_type as never))
        throw new ProposalError(`Measurement type must be one of: ${LIBRARY_MEASUREMENT_TYPES.join(', ')}. Ask which basis the user wants if unclear (area, linear/lineal, count or hours).`);
    const component_type = value.component_type === undefined ? 'main' : value.component_type;
    if (!['main', 'extra'].includes(String(component_type)))
        throw new ProposalError('Component type must be main or extra.');
    const waste_type = value.waste_type === undefined ? 'none' : value.waste_type;
    if (!LIBRARY_WASTE_TYPES.includes(waste_type as never))
        throw new ProposalError(`Waste type must be one of: ${LIBRARY_WASTE_TYPES.join(', ')}.`);
    const pitch_type = value.pitch_type === undefined ? 'none' : value.pitch_type;
    if (!LIBRARY_PITCH_TYPES.includes(pitch_type as never))
        throw new ProposalError(`Pitch type must be one of: ${LIBRARY_PITCH_TYPES.join(', ')} (rafter or valley/hip pitch factors, or none).`);
    const sold_by = value.sold_by === undefined || value.sold_by === null ? null : value.sold_by;
    if (sold_by !== null && !LIBRARY_SOLD_BY.includes(sold_by as never))
        throw new ProposalError(`Sold-as basis must be one of: ${LIBRARY_SOLD_BY.join(', ')}.`);
    const cover = value.cover_width_mm === undefined || value.cover_width_mm === null ? null : finite(value.cover_width_mm, 'cover_width_mm', 1, 10000);
    if (sold_by === 'per_unit' && cover !== null)
        throw new ProposalError('Cover width only applies to area-sold components with a lineal display basis.');
    const collection_id = value.collection_id === undefined || value.collection_id === null ? null : value.collection_id;
    if (collection_id !== null && !isUuid(collection_id))
        throw new ProposalError('The collection must be a valid ID from the workspace library list.');
    const collection_name = value.collection_name === undefined || value.collection_name === null ? null : boundedText(value.collection_name, 160);
    if (collection_id && collection_name)
        throw new ProposalError('Pass either a collection ID or a collection name, not both.');
    return {
        name, measurement_type: value.measurement_type as LibraryCreateInput['measurement_type'],
        component_type: component_type as LibraryCreateInput['component_type'],
        material_rate: value.material_rate === undefined ? 0 : finite(value.material_rate, 'material_rate', 0, 1e8),
        labour_rate: value.labour_rate === undefined ? 0 : finite(value.labour_rate, 'labour_rate', 0, 1e8),
        waste_type: waste_type as LibraryCreateInput['waste_type'],
        waste_percent: value.waste_percent === undefined ? 0 : finite(value.waste_percent, 'waste_percent', 0, 100),
        waste_fixed: value.waste_fixed === undefined ? 0 : finite(value.waste_fixed, 'waste_fixed', 0, 1e8),
        pitch_type: pitch_type as LibraryCreateInput['pitch_type'],
        sold_by: sold_by as LibraryCreateInput['sold_by'], cover_width_mm: cover,
        collection_id: collection_id as string | null, collection_name,
    };
}
export function parseQuoteChanges(value: unknown): QuoteChanges {
    if (!isRecord(value) || !Object.keys(value).length || Object.keys(value).some(k => !['customer_name', 'job_name'].includes(k)))
        throw new ProposalError('Only customer name and job name are supported by this action.');
    const out: QuoteChanges = {};
    for (const key of ['customer_name', 'job_name'] as const)
        if (value[key] !== undefined) {
            const s = boundedText(value[key], 200);
            if (!s)
                throw new ProposalError('Names must contain 1 to 200 characters.');
            out[key] = s;
        }
    return out;
}
export function row(value: unknown, name: string): Record<string, unknown> { if (!isRecord(value))
    throw new ProposalError(`The ${name} record is unavailable.`); return value; }
export function rows(value: unknown, name: string, max = 200): Record<string, unknown>[] { if (!Array.isArray(value) || value.length > max || value.some(v => !isRecord(v)))
    throw new ProposalError(`${name} could not be read safely.`); return value as Record<string, unknown>[]; }
export function quoteSection(q: Record<string, unknown>): AssistantSection { return q.status === 'draft' ? 'draft_quotes' : 'quotes'; }
export function editableQuote(q: Record<string, unknown>): void {
    if (!isUuid(q.id) || !['draft', 'confirmed'].includes(String(q.status)) || q.accepted_at !== null || q.shared === true || q.withdrawn_at !== null)
        throw new ProposalError('Only an unsent draft or unsent confirmed quote can be changed here. Open this record to use its normal revision workflow.');
    if (q.entry_mode === 'blank')
        throw new ProposalError('Blank quotes use customer-editor lines, not the measured-component builder. Open the blank quote to edit it.');
}
/** Canonical input for SHA-256. Reject values JSON.stringify would silently lose. */
export function canonical(value: unknown): string {
    if (value === null)
        return 'null';
    if (typeof value === 'string' || typeof value === 'boolean')
        return JSON.stringify(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            throw new ProposalError('Non-finite proof value.');
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (isRecord(value)) {
        if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
            throw new ProposalError('Invalid proof object.');
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    }
    throw new ProposalError('Unsupported proof value.');
}
