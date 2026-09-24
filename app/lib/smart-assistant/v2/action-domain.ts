/** Pure input and proof contracts. No model-generated SQL or arbitrary patches. */
import { isRecord, type AssistantSection } from '../section-permissions';
import { boundedText, isUuid, type ChangeRow, type RecordTarget } from './contracts';
export type ActionKind = 'quote_details' | 'component_change' | 'draft_create';
export type ComponentChanges = {
    material_rate?: number;
    labour_rate?: number;
    waste_percent?: number;
    pitch_degrees?: number;
    raw_quantity?: number;
};
export type QuoteChanges = {
    customer_name?: string;
    job_name?: string;
};
export type ActionPlan = {
    kind: ActionKind;
    target: RecordTarget | null;
    targetKind: 'quote' | 'quote_component' | 'creation';
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
