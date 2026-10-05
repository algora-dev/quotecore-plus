import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { isRecord, type AssistantSection } from '../section-permissions';
import { batchClient, toJson } from './database';
import { canEdit, isUuid, parseActionView, type Access, type ActionView } from './contracts';
import { AssistantV2Error, freshAccess, rpcError } from './runtime.server';
import { canonical, editableQuote, parseQuoteChanges, parseComponentChanges, ProposalError, quoteSection, row, type ActionPlan } from './action-domain';
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
