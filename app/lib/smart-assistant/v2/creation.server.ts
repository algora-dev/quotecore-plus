import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { createQuoteWithDetails } from '@/app/(auth)/[workspaceSlug]/quotes/new/actions';
import { updateQuoteCurrency } from '@/app/(auth)/[workspaceSlug]/quotes/actions';
import { assertComponentCompatibleWithQuote } from '@/app/lib/trades/assertCompatible';
import { TRADE_ALLOWED_MEASUREMENT_TYPES } from '@/app/lib/trades/measurement-type-whitelist';
import { isRecord, type AssistantSection } from '../section-permissions';
import { batchClient, toJson } from './database';
import { isUuid, parseActionView, type Access, type ActionView } from './contracts';
import { AssistantV2Error, freshAccess, rpcError } from './runtime.server';
import { ProposalError, row, rows } from './action-domain';
import { parseDraft, buildDraft, type DraftSpec } from './draft-plan';
import { requireEdits, storeProposal, targetSnapshot } from './actions.server';
export async function creationContext(client: SupabaseClient, access: Access) {
    await freshAccess(client, access, 'p4');
    const { data, error } = await batchClient(client).rpc('sa_v2_creation_context', {});
    if (error)
        throw rpcError(error);
    if (!isRecord(data))
        throw rpcError(null);
    return { data, genericTradesEnabled: process.env.GENERIC_TRADES_V1_ENABLED === 'true' };
}
export async function creationOptions(client: SupabaseClient, access: Access) {
    const { data, genericTradesEnabled } = await creationContext(client, access);
    return { ...data, allowedTrades: genericTradesEnabled ? Object.keys(TRADE_ALLOWED_MEASUREMENT_TYPES) : ['roofing'], note: 'Creation uses a manual draft. Confirm the unit system; it cannot be changed after creation. No currency conversion or inferred dimensions.' };
}
export async function proposeDraft(client: SupabaseClient, access: Access, runId: string, args: Record<string, unknown>, meta?: { briefStateId?: string; producedQuoteId?: string | null }): Promise<ActionView> {
    const sections: AssistantSection[] = ['draft_quotes', 'customers', 'components'];
    requireEdits(access, sections);
    const { data: context, genericTradesEnabled } = await creationContext(client, access);
    const spec = parseDraft(args, context, genericTradesEnabled);
    const libraries: Record<string, unknown>[] = [];
    for (const id of [...new Set(spec.components.map(c => String(c.library_id)))]) {
        const found = await targetSnapshot(client, access, 'library', id);
        libraries.push(row(found.library, 'library'));
    }
    const draft = buildDraft(spec, context, libraries);
    // Edit-in-place (owner 2026-10-02): when the brief already produced a
    // quote, this proposal updates that same quote on confirm.
    const editing = isUuid(meta?.producedQuoteId) ? String(meta?.producedQuoteId) : null;
    if (editing) {
        const { data: bound } = await batchClient(client).from('quotes').select('id,currency').eq('id', editing).eq('company_id', access.companyId).maybeSingle();
        if (bound && typeof bound.currency === 'string')
            draft.currency = bound.currency;
    }
    const payload = { params: draft.params, currency: draft.currency, pitch: draft.pitch, children: draft.children, genericTradesEnabled, briefStateId: meta?.briefStateId ?? null, editQuoteId: editing };
    const action = await storeProposal(access, runId, { kind: 'draft_create', target: editing ? { kind: 'draft_quote', id: editing } : null, targetKind: editing ? 'quote' : 'creation', targetId: editing, sections,
        before: { context, libraries }, after: payload, title: `${editing ? 'Update' : 'Create'} draft: ${spec.jobName}`,
        changes: draft.changes, note: editing ? 'Not applied yet. Confirming updates the existing draft in place - the same quote keeps its identity, links and review state. It does not send, accept or finalise it.' : 'Not created yet. Confirming creates a manual draft using the existing quote-creation policy. It does not send, accept or finalise it. Quantities shown are explicit measurements, not a copied takeoff drawing. Review the saved draft and its full tax/margin total in the builder.', permissionRevision: access.permissionRevision }, { kind: 'draft_create', spec, editQuoteId: editing });
    return action;
}
function parsedAction(value: unknown): ActionView { const action = parseActionView(value); if (!action)
    throw rpcError(null); return action; }
export async function confirmCreation(client: SupabaseClient, access: Access, id: string, digest: string, version: number): Promise<ActionView> {
    await freshAccess(client, access, 'p4');
    const trusted = batchClient(createAdminClient());
    const claim = await trusted.rpc('sa_v2_creation_claim', { p_action_id: id, p_user_id: access.userId, p_digest: digest, p_version: version });
    if (claim.error)
        throw rpcError(claim.error);
    if (!isRecord(claim.data))
        throw rpcError(null);
    if (claim.data.claimed !== true)
        return parsedAction(claim.data.action);
    let attempted = false;
    const mark = async (code: string) => { const outcome = await trusted.rpc('sa_v2_creation_uncertain', { p_action_id: id, p_user_id: access.userId, p_code: code }); if (outcome.error)
        throw rpcError(outcome.error); return parsedAction(outcome.data); };
    try {
        const payload = row(claim.data.payload, 'creation payload'), params = row(payload.params, 'creation parameters');
        const children = row(payload.children, 'creation children');
        const components = rows(children.components, 'components', 24);
        if (payload.genericTradesEnabled !== (process.env.GENERIC_TRADES_V1_ENABLED === 'true'))
            return await mark('pre_creation_refused');
        if (typeof params.customerName !== 'string' || typeof params.jobName !== 'string' || !['metric', 'imperial_ft', 'imperial_rs'].includes(String(params.measurementSystem)) || !isUuid(params.componentCollectionId) || typeof payload.currency !== 'string' || !Object.prototype.hasOwnProperty.call(TRADE_ALLOWED_MEASUREMENT_TYPES, String(params.trade)))
            throw new ProposalError('Stored creation parameters are invalid.');
        await freshAccess(client, access, 'p4');
        const editQuoteId = isUuid(payload.editQuoteId) ? String(payload.editQuoteId) : null;
        let quoteId: string;
        if (editQuoteId) {
            // Edit-in-place (owner 2026-10-02): write the revised brief back
            // into the quote it already produced. Strictly scoped to a manual
            // draft owned by the same user + company.
            const { data: bound } = await trusted.from('quotes').select('id,company_id,created_by_user_id,status,entry_mode').eq('id', editQuoteId).maybeSingle();
            if (!bound || bound.company_id !== access.companyId || bound.created_by_user_id !== access.userId || bound.status !== 'draft' || bound.entry_mode !== 'manual')
                return await mark('edit_target_invalid');
            attempted = true;
            await trusted.from('quotes').update({ customer_name: params.customerName, job_name: params.jobName, site_address: typeof params.siteAddress === 'string' ? params.siteAddress : null, trade: params.trade as DraftSpec['trade'], component_collection_id: params.componentCollectionId, global_pitch_degrees: payload.pitch == null ? null : Number(payload.pitch) }).eq('id', editQuoteId).eq('company_id', access.companyId);
            await (trusted as any).rpc('sa_v2_draft_edit_clear', { p_quote_id: editQuoteId, p_company_id: access.companyId });
            quoteId = editQuoteId;
        }
        else {
            attempted = true;
            // This is the only parent creation call. It preserves the existing monthly
            // quota, subscription/feature checks, company lock and tax seeding.
            const created = await createQuoteWithDetails({ customerName: params.customerName, jobName: params.jobName, siteAddress: typeof params.siteAddress === 'string' ? params.siteAddress : null, templateId: null, entryMode: 'manual', measurementSystem: params.measurementSystem as DraftSpec['measurementSystem'], trade: params.trade as DraftSpec['trade'], componentCollectionId: params.componentCollectionId });
            if (!created.ok)
                return await mark(created.code);
            if (!isUuid(created.quoteId))
                return await mark('missing_created_id');
            quoteId = created.quoteId;
        }
        const checkpointArgs = { p_action_id: id, p_user_id: access.userId, p_quote_id: quoteId };
        let checkpoint = await trusted.rpc('sa_v2_creation_checkpoint', checkpointArgs);
        // A repeated checkpoint with the SAME known parent is safe. It is never a
        // repeat of createQuoteWithDetails.
        if (checkpoint.error)
            checkpoint = await trusted.rpc('sa_v2_creation_checkpoint', checkpointArgs);
        if (checkpoint.error) {
            console.error('[sa-v2] creation checkpoint needs reconciliation', { actionId: id, quoteId });
            throw rpcError(checkpoint.error);
        }
        await freshAccess(client, access, 'p4');
        // The canonical creation wrapper currently defaults currency. Use the
        // existing draft-only currency action to apply the explicitly reviewed
        // account currency; do not alter its billing/pricing implementation.
        await updateQuoteCurrency(quoteId, payload.currency);
        for (const component of components) {
            if (!isUuid(component.library_id))
                throw new ProposalError('Invalid component identity.');
            await assertComponentCompatibleWithQuote({ quoteId, componentId: component.library_id, companyId: access.companyId });
        }
        await freshAccess(client, access, 'p4');
        const finished = await trusted.rpc('sa_v2_creation_finish', { p_action_id: id, p_user_id: access.userId, p_children: toJson(children) });
        if (finished.error)
            throw rpcError(finished.error);
        // Bind the produced quote to the brief so later change turns update
        // this quote in place instead of creating another draft (owner
        // 2026-10-02).
        if (isUuid(payload.briefStateId)) {
            await (trusted as any).from('assistant_v2_draft_briefs').update({ produced_quote_id: quoteId }).eq('id', String(payload.briefStateId)).eq('company_id', access.companyId).eq('user_id', access.userId);
        }
        return parsedAction(finished.data);
    }
    catch (error) {
        // Never delete or recreate an uncertain parent. It may have consumed a quota
        // slot and another client may already be looking at it.
        if (error instanceof AssistantV2Error && error.code === 'unavailable')
            console.error('[sa-v2] creation outcome requires review', { actionId: id });
        return await mark(attempted ? 'creation_outcome_unknown' : 'pre_creation_refused');
    }
}
