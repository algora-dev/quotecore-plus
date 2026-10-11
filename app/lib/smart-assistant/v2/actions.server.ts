import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { isRecord, type AssistantSection } from '../section-permissions';
import { batchClient, toJson } from './database';
import { canEdit, isUuid, parseActionView, type Access, type ActionView, type ChangeRow } from './contracts';
import { AssistantV2Error, freshAccess, rpcError } from './runtime.server';
import { canonical, editableQuote, parseQuoteChanges, parseComponentChanges, parseLibraryChanges, parseLibraryCreate, ProposalError, quoteSection, row, type ActionPlan, type LibraryCreateInput } from './action-domain';
import { componentResult } from './component-plan';
import { areaResult, areaCreateResult, parseAreaChanges, parseAreaCreate, selectArea } from './area-plan';
import { baseUnit, canonicalChanges } from './units';
export function proof(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export async function targetSnapshot(client: SupabaseClient, access: Access, kind: string, id: unknown): Promise<Record<string, unknown>> {
    await freshAccess(client, access, 'p3');
    if (!isUuid(id))
        throw new ProposalError('Choose an exact record from search first.');
    const { data, error } = await batchClient(client).rpc('sa_v2_target_snapshot', { p_kind: kind, p_id: id });
    if (error)
        throw rpcError(error);
    if (!isRecord(data))
        throw rpcError(null);
    return data;
}
export function requireEdits(access: Access, sections: AssistantSection[]): void { if (sections.some(s => !canEdit(access, s)))
    throw new AssistantV2Error('forbidden', 'This change requires Edit permission for all affected sections.', 403); }
export async function storeProposal(access: Access, runId: string, plan: ActionPlan, keyInput: unknown): Promise<ActionView> {
    requireEdits(access, plan.sections);
    const digest = proof(plan);
    const { data, error } = await batchClient(createAdminClient()).rpc('sa_v2_action_propose', { p_run_id: runId, p_user_id: access.userId, p_key: proof(keyInput), p_action: toJson({ ...plan, digest }) });
    if (error)
        throw rpcError(error);
    const action = parseActionView(data);
    if (!action)
        throw rpcError(null);
    return action;
}
export async function proposeQuoteDetails(client: SupabaseClient, access: Access, runId: string, args: Record<string, unknown>): Promise<ActionView> {
    const changes = parseQuoteChanges(args.changes);
    const snapshot = await targetSnapshot(client, access, 'quote', args.quote_id);
    const q = row(snapshot.quote, 'quote');
    editableQuote(q);
    const sections: AssistantSection[] = [quoteSection(q)];
    if (changes.customer_name !== undefined)
        sections.push('customers');
    requireEdits(access, sections);
    const diff = Object.entries(changes).filter(([k, v]) => q[k] !== v).map(([k, v]) => ({ label: k === 'customer_name' ? 'Customer name' : 'Job name', before: String(q[k] ?? ''), after: v }));
    if (!diff.length)
        throw new ProposalError('These names already match. No change is needed.');
    return storeProposal(access, runId, { kind: 'quote_details', target: { kind: q.status === 'draft' ? 'draft_quote' : 'quote', id: String(q.id) }, targetKind: 'quote', targetId: String(q.id), sections, before: snapshot, after: changes, title: 'Review quote details', changes: diff, note: 'Not applied yet. Only these names will change. This does not update other quotes for the same customer, finalise or send the quote.', permissionRevision: access.permissionRevision }, { kind: 'quote_details', id: q.id, changes });
}
export async function proposeComponentChange(client: SupabaseClient, access: Access, runId: string, args: Record<string, unknown>, expectedQuoteId?: string): Promise<ActionView> {
    const input = parseComponentChanges(args.changes);
    const snapshot = await targetSnapshot(client, access, 'quote_component', args.component_id);
    const q = row(snapshot.quote, 'quote'), c = row(snapshot.component, 'component');
    if (expectedQuoteId !== undefined && (!isUuid(expectedQuoteId) || q.id !== expectedQuoteId || c.quote_id !== expectedQuoteId || c.id !== args.component_id))
        throw new ProposalError('The component no longer belongs to the selected quote. Nothing was proposed; resolve the current relationship again.');
    editableQuote(q);
    const sections: AssistantSection[] = [quoteSection(q), 'components'];
    requireEdits(access, sections);
    const converted = canonicalChanges(input, c.measurement_type, args.quantity_unit, args.rate_unit);
    const result = componentResult(snapshot, converted, access.userId);
    const unit = baseUnit(c.measurement_type);
    return storeProposal(access, runId, { kind: 'component_change', target: { kind: q.status === 'draft' ? 'draft_quote' : 'quote', id: String(q.id) }, targetKind: 'quote_component', targetId: String(c.id), sections, before: snapshot, after: { fields: result.fields, entries: result.entries }, title: `Review ${String(c.name).slice(0, 180)}`, changes: result.changes.map(d => ({ ...d, label: d.label.replace('canonical unit', unit) })),
        note: `Not applied yet. Only this quote component changes, not the library. Values below use ${unit} and ${String(q.currency ?? 'the quote currency')}. Costs are from the existing engine, before quote margins and taxes.`, permissionRevision: access.permissionRevision }, { kind: 'component_change', id: c.id, input, quantity_unit: args.quantity_unit ?? null, rate_unit: args.rate_unit ?? null });
}
export async function proposeAreaChange(client: SupabaseClient, access: Access, runId: string, args: Record<string, unknown>): Promise<ActionView> {
    const change = parseAreaChanges(args.changes);
    // Bound-draft navigation: resolve the targeted area inside the quote's
    // actual area list first (exact ID or unique label; otherwise the error
    // lists the areas and asks which one). Never guess an identity.
    const index = await targetSnapshot(client, access, 'quote_areas', args.quote_id);
    const { areaId } = selectArea(index, args.quote_id, args.area_id, args.area_label);
    const snapshot = await targetSnapshot(client, access, 'quote_area', areaId);
    const q = row(snapshot.quote, 'quote');
    const sections: AssistantSection[] = [quoteSection(q), 'components'];
    requireEdits(access, sections);
    const result = areaResult(snapshot, change, access.userId);
    const area = row(snapshot.area, 'roof area');
    return storeProposal(access, runId, { kind: 'area_change', target: { kind: q.status === 'draft' ? 'draft_quote' : 'quote', id: String(q.id) }, targetKind: 'quote_area', targetId: String(area.id), sections, before: snapshot,
        after: { fields: result.fields, entries: result.entries }, title: `Review area ${String(area.label).slice(0, 160)}`, changes: result.changes,
        note: 'Not applied yet. Only this roof area changes. The engine recomputes its surface; component quantities on this record are independent measurements and are not recalculated. Areas measured on a plan drawing must be edited in the takeoff editor.', permissionRevision: access.permissionRevision }, { kind: 'area_change', id: area.id, change });
}
export async function proposeAreaCreate(client: SupabaseClient, access: Access, runId: string, args: Record<string, unknown>): Promise<ActionView> {
    const input = parseAreaCreate(args);
    const snapshot = await targetSnapshot(client, access, 'quote_areas', args.quote_id);
    const q = row(snapshot.quote, 'quote');
    const sections: AssistantSection[] = [quoteSection(q), 'components'];
    requireEdits(access, sections);
    const result = areaCreateResult(snapshot, input, access.userId);
    return storeProposal(access, runId, { kind: 'area_change', target: { kind: q.status === 'draft' ? 'draft_quote' : 'quote', id: String(q.id) }, targetKind: 'quote_areas', targetId: String(q.id), sections, before: snapshot,
        after: { area: result.area }, title: `Add area ${input.label.slice(0, 160)}`, changes: result.changes,
        note: 'Not applied yet. Confirming adds one new manual roof area to this record. It does not add components or change existing areas; a future takeoff save manages areas measured on plan drawings separately.', permissionRevision: access.permissionRevision }, { kind: 'area_create', id: q.id, input });
}
const measurementLabel = (code: string): string => ({ area: 'Area (m²)', linear: 'Linear (m)', lineal: 'Lineal (m)', quantity: 'Quantity', count: 'Count', fixed: 'Fixed', hours_days: 'Hours/days' } as Record<string, string>)[code] ?? code;
const pitchLabel = (code: string): string => ({ none: 'No pitch factor', rafter: 'Rafter pitch', valley_hip: 'Valley/hip pitch' } as Record<string, string>)[code] ?? code;
const wasteLabel = (type: string, percent: unknown, fixed: unknown): string => type === 'percent' ? `${String(Number(String(percent ?? 0)))}%` : type === 'fixed' ? `Fixed ${String(Number(String(fixed ?? 0)))}` : 'None';
const plainNumber = (value: unknown): number => { const n = typeof value === 'number' ? value : Number(value); return Number.isFinite(n) ? n : 0; };
const soldLabel = (value: unknown): string => value === 'area' ? 'Area' : value === 'lineal' ? 'Lineal' : 'Per unit';
export async function proposeLibraryComponentChange(client: SupabaseClient, access: Access, runId: string, args: Record<string, unknown>): Promise<ActionView> {
    const changes = parseLibraryChanges(args.changes);
    if (!isUuid(args.component_id))
        throw new ProposalError('Choose an exact library component from search first.');
    const snapshot = await targetSnapshot(client, access, 'library', args.component_id);
    const lib = row(snapshot.library, 'library component');
    const sections: AssistantSection[] = ['components'];
    requireEdits(access, sections);
    // Merged FINAL field set under SQL column names; the atomic confirm applies
    // each column with COALESCE, so unchanged fields re-write their own value.
    const fields: Record<string, unknown> = {
        name: changes.name ?? String(lib.name ?? ''),
        measurement_type: changes.measurement_type ?? String(lib.measurement_type ?? 'area'),
        default_material_rate: changes.material_rate ?? plainNumber(lib.default_material_rate),
        default_labour_rate: changes.labour_rate ?? plainNumber(lib.default_labour_rate),
        default_waste_type: changes.waste_type ?? String(lib.default_waste_type ?? 'none'),
        default_waste_percent: changes.waste_percent ?? plainNumber(lib.default_waste_percent),
        default_waste_fixed: changes.waste_fixed ?? plainNumber(lib.default_waste_fixed),
        default_pitch_type: changes.pitch_type ?? String(lib.default_pitch_type ?? 'none'),
        sold_by: changes.sold_by ?? (lib.sold_by === null || lib.sold_by === undefined ? null : String(lib.sold_by)),
        cover_width_mm: changes.cover_width_mm ?? (lib.cover_width_mm === null || lib.cover_width_mm === undefined ? null : plainNumber(lib.cover_width_mm)),
        is_active: changes.is_active ?? lib.is_active === true,
    };
    const diff: ChangeRow[] = [];
    if (changes.name !== undefined && fields.name !== String(lib.name ?? ''))
        diff.push({ label: 'Name', before: String(lib.name ?? ''), after: String(fields.name) });
    if (changes.measurement_type !== undefined && fields.measurement_type !== String(lib.measurement_type ?? ''))
        diff.push({ label: 'Measured as', before: measurementLabel(String(lib.measurement_type ?? '')), after: measurementLabel(String(fields.measurement_type)) });
    if (changes.material_rate !== undefined && fields.default_material_rate !== plainNumber(lib.default_material_rate))
        diff.push({ label: 'Material rate', before: String(plainNumber(lib.default_material_rate)), after: String(fields.default_material_rate) });
    if (changes.labour_rate !== undefined && fields.default_labour_rate !== plainNumber(lib.default_labour_rate))
        diff.push({ label: 'Labour rate', before: String(plainNumber(lib.default_labour_rate)), after: String(fields.default_labour_rate) });
    const wasteChanged = (changes.waste_type !== undefined && fields.default_waste_type !== String(lib.default_waste_type ?? ''))
        || changes.waste_percent !== undefined && fields.default_waste_percent !== plainNumber(lib.default_waste_percent)
        || changes.waste_fixed !== undefined && fields.default_waste_fixed !== plainNumber(lib.default_waste_fixed);
    if (wasteChanged)
        diff.push({ label: 'Waste', before: wasteLabel(String(lib.default_waste_type ?? 'none'), lib.default_waste_percent, lib.default_waste_fixed), after: wasteLabel(String(fields.default_waste_type), fields.default_waste_percent, fields.default_waste_fixed) });
    if (changes.pitch_type !== undefined && fields.default_pitch_type !== String(lib.default_pitch_type ?? ''))
        diff.push({ label: 'Pitch factor', before: pitchLabel(String(lib.default_pitch_type ?? '')), after: pitchLabel(String(fields.default_pitch_type)) });
    if (changes.sold_by !== undefined && fields.sold_by !== (lib.sold_by === null || lib.sold_by === undefined ? null : String(lib.sold_by)))
        diff.push({ label: 'Sold as', before: soldLabel(lib.sold_by), after: soldLabel(fields.sold_by) });
    if (changes.cover_width_mm !== undefined && fields.cover_width_mm !== (lib.cover_width_mm === null || lib.cover_width_mm === undefined ? null : plainNumber(lib.cover_width_mm)))
        diff.push({ label: 'Cover width (mm)', before: String(plainNumber(lib.cover_width_mm)), after: String(fields.cover_width_mm) });
    if (changes.is_active !== undefined && fields.is_active !== (lib.is_active === true))
        diff.push({ label: 'Active', before: lib.is_active === true ? 'Yes' : 'No', after: fields.is_active === true ? 'Yes' : 'No' });
    if (!diff.length)
        throw new ProposalError('These library values already match. No change is needed.');
    return storeProposal(access, runId, { kind: 'library_component_change', target: { kind: 'component', id: String(lib.id) }, targetKind: 'library_component', targetId: String(lib.id), sections, before: snapshot, after: { fields },
        title: `Review library component ${String(lib.name).slice(0, 160)}`, changes: diff,
        note: 'Not applied yet. Only this reusable library component changes. Existing quotes keep their own saved values; new quotes pick up these defaults.', permissionRevision: access.permissionRevision }, { kind: 'library_component_change', id: lib.id, changes });
}
export async function proposeLibraryComponentCreate(client: SupabaseClient, access: Access, runId: string, args: Record<string, unknown>): Promise<ActionView> {
    const input = parseLibraryCreate(args);
    await freshAccess(client, access, 'p3');
    const admin = createAdminClient();
    const { data: collectionRows, error: collectionError } = await admin.from('component_collections')
        .select('id, name, is_bootstrap, created_at').eq('company_id', access.companyId).order('created_at', { ascending: true });
    if (collectionError || !Array.isArray(collectionRows) || !collectionRows.length)
        throw new ProposalError('This workspace has no component collections yet. Create a library collection in the app first.');
    let collection: { id: string; name: string } | null = null;
    if (input.collection_id)
        collection = collectionRows.find(c => c.id === input.collection_id) ?? null;
    else if (input.collection_name) {
        const wanted = input.collection_name.trim().toLowerCase();
        collection = collectionRows.find(c => String(c.name).trim().toLowerCase() === wanted) ?? null;
        if (!collection)
            throw new ProposalError(`No collection named "${input.collection_name}" was found. Available: ${collectionRows.map(c => c.name).join(', ')}.`);
    }
    else {
        const bootstrap = collectionRows.find(c => c.is_bootstrap === true);
        const chosen = bootstrap ?? collectionRows[0];
        collection = { id: String(chosen.id), name: String(chosen.name) };
    }
    if (input.collection_id && !collection)
        throw new ProposalError('That collection was not found in this workspace.');
    if (!collection)
        throw new ProposalError('No component collection could be resolved for this workspace.');
    const { data: existing, error: existingError } = await admin.from('component_library')
        .select('id, name').eq('company_id', access.companyId).eq('collection_id', collection.id);
    if (existingError || !Array.isArray(existing))
        throw new ProposalError('The library could not be read safely.');
    const duplicate = existing.find(c => String(c.name).trim().toLowerCase() === input.name.trim().toLowerCase());
    if (duplicate)
        throw new ProposalError(`A component named "${String(duplicate.name)}" already exists in ${collection.name}. Choose a different name or collection.`);
    const { data: orderRow } = await admin.from('component_library')
        .select('sort_order').eq('company_id', access.companyId).eq('collection_id', collection.id)
        .order('sort_order', { ascending: false }).limit(1);
    const nextSort = (Array.isArray(orderRow) && Number.isFinite(Number(orderRow[0]?.sort_order)) ? Number(orderRow[0].sort_order) : -1) + 1;
    const id = randomUUID();
    const component: Record<string, unknown> = {
        id, name: input.name, component_type: input.component_type, measurement_type: input.measurement_type,
        default_material_rate: input.material_rate, default_labour_rate: input.labour_rate,
        default_waste_type: input.waste_type, default_waste_percent: input.waste_percent, default_waste_fixed: input.waste_fixed,
        default_pitch_type: input.pitch_type, pricing_strategy: 'per_unit',
        sold_by: input.sold_by, cover_width_mm: input.cover_width_mm,
        collection_id: collection.id, is_active: true, sort_order: nextSort,
    };
    const changes: ChangeRow[] = [
        { label: 'Name', before: '—', after: input.name },
        { label: 'Collection', before: '—', after: collection.name },
        { label: 'Measured as', before: '—', after: measurementLabel(input.measurement_type) },
        { label: 'Material rate', before: '—', after: String(input.material_rate) },
        { label: 'Labour rate', before: '—', after: String(input.labour_rate) },
        { label: 'Waste', before: '—', after: wasteLabel(input.waste_type, input.waste_percent, input.waste_fixed) },
        { label: 'Pitch factor', before: '—', after: pitchLabel(input.pitch_type) },
    ];
    if (input.sold_by !== null)
        changes.push({ label: 'Sold as', before: '—', after: soldLabel(input.sold_by) });
    if (input.cover_width_mm !== null)
        changes.push({ label: 'Cover width (mm)', before: '—', after: String(input.cover_width_mm) });
    return storeProposal(access, runId, { kind: 'library_create', target: null, targetKind: 'library', targetId: id, sections: ['components'], before: { collection: { id: collection.id, name: collection.name }, duplicate_check: existing.length }, after: { component },
        title: `Add library component ${input.name.slice(0, 160)}`, changes,
        note: 'Not applied yet. Confirming adds this one component to your reusable library. Existing quotes are untouched.', permissionRevision: access.permissionRevision }, { kind: 'library_create', component, collection_id: collection.id });
}
export async function actionRead(client: SupabaseClient, id: string): Promise<ActionView> {
    const { data, error } = await batchClient(client).rpc('sa_v2_action_read', { p_action_id: id });
    if (error)
        throw rpcError(error);
    const a = parseActionView(data);
    if (!a)
        throw rpcError(null);
    return a;
}
export async function confirmOrCancel(client: SupabaseClient, access: Access, id: string, digest: string, version: number, command: 'confirm' | 'cancel'): Promise<ActionView> {
    await freshAccess(client, access, 'p3');
    const action = await actionRead(client, id);
    if (action.proofDigest !== digest || action.version !== version)
        throw new AssistantV2Error('conflict', 'This proposal changed. Refresh and review it again.', 409);
    if (command === 'confirm' && action.actionKind === 'draft_create') {
        const { confirmCreation } = await import('./creation.server');
        return confirmCreation(client, access, id, digest, version);
    }
    const result = command === 'cancel' ? await batchClient(client).rpc('sa_v2_action_cancel', { p_action_id: id, p_digest: digest, p_version: version })
        : await batchClient(createAdminClient()).rpc('sa_v2_action_confirm_atomic', { p_action_id: id, p_user_id: access.userId, p_digest: digest, p_version: version });
    if (result.error)
        throw rpcError(result.error);
    const parsed = parseActionView(result.data);
    if (!parsed)
        throw rpcError(null);
    return parsed;
}
