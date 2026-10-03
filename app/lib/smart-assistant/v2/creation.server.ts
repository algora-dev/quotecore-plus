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
import { parseDraft, buildDraft, type DraftSpec, type DraftIdentities } from './draft-plan';
import { draftReviewDiff, retainUnchangedAudits, type PlannedDraft } from '../workflow-controller/structural-diff';
import { libraryWorkflowEnabled } from '../library-workflow/config';
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
export type WorkflowProposalMeta = {
    controllerVersion: 1; briefStateId: string; briefRevision: number; workflowEpoch: number;
    producedQuoteId: string | null; identities: DraftIdentities;
    previousPlan: PlannedDraft | null; quoteSnapshot: Record<string, unknown> | null;
};
export async function proposeDraft(client: SupabaseClient, access: Access, runId: string, args: Record<string, unknown>, meta?: WorkflowProposalMeta): Promise<ActionView> {
    const sections: AssistantSection[] = ['draft_quotes', 'customers', 'components'];
    requireEdits(access, sections);
    const { data: context, genericTradesEnabled } = await creationContext(client, access);
    const spec = parseDraft(args, context, genericTradesEnabled);
    const libraries: Record<string, unknown>[] = [];
    for (const id of [...new Set(spec.components.map(c => String(c.library_id)))]) {
        const found = await targetSnapshot(client, access, 'library', id);
        libraries.push(row(found.library, 'library'));
    }
    const editing = meta?.producedQuoteId ?? null;
    if (editing && (!isUuid(editing) || !meta?.previousPlan || !meta.quoteSnapshot))
        throw new ProposalError('The saved draft has no safe correction baseline. Review it in the builder; no new draft will be created.');
    const built = buildDraft(spec, context, libraries, meta?.identities, editing ? meta?.previousPlan?.children.components : undefined);
    const draft: PlannedDraft = { params: built.params, currency: built.currency, pitch: built.pitch,
        children: meta?.previousPlan ? retainUnchangedAudits(meta.previousPlan.children, built.children) : built.children };
    if (editing && meta?.previousPlan) {
        const quote = row(meta.quoteSnapshot?.quote, 'bound draft');
        if (quote.id !== editing || quote.company_id !== access.companyId || quote.created_by_user_id !== access.userId
            || quote.status !== 'draft' || quote.entry_mode !== 'manual' || quote.acceptance_token != null || quote.accepted_at != null || quote.withdrawn_at != null || quote.declined_at != null)
            throw new ProposalError('This draft is no longer safely editable. Review it in the builder.');
        if (quote.measurement_system !== spec.measurementSystem || quote.trade !== spec.trade || typeof quote.currency !== 'string')
            throw new ProposalError('A revision cannot change the saved measurement system, trade or currency.');
        // A workspace currency change must not silently convert/reprice a draft.
        if (built.currency !== quote.currency) throw new ProposalError('The workspace currency changed. Review this draft in the builder before revising it.');
        draft.currency = quote.currency;
    }
    const empty: PlannedDraft = {params:{},currency:'',pitch:-1,children:{areas:[],components:[]}};
    const names=Object.fromEntries(rows(context.collections,'collections',200).map(c=>[String(c.id),String(c.name)]));
    const changes=meta ? draftReviewDiff(meta.previousPlan ?? empty,draft,names) : built.changes;
    if (!changes.length) throw new ProposalError('Those details already match the saved draft. There is nothing to confirm or save.');
    const payload = { ...draft, genericTradesEnabled, briefStateId: meta?.briefStateId ?? null, editQuoteId: editing,
        ...(meta ? {controllerVersion:1,briefRevision:meta.briefRevision,workflowEpoch:meta.workflowEpoch} : {}) };
    return storeProposal(access, runId, { kind:'draft_create',target:editing?{kind:'draft_quote',id:editing}:null,targetKind:editing?'quote':'creation',targetId:editing,sections,
        before:{context,libraries,...(editing?{quote:meta!.quoteSnapshot!.quote,quoteSnapshot:meta!.quoteSnapshot,previousPlan:meta!.previousPlan}:{})},after:payload,
        title:`${editing?'Update':'Create'} draft: ${spec.jobName}`,changes,
        note:editing?'Not applied yet. Confirm updates this SAME draft using a structural diff. Unchanged rows keep their identities; existing pricing/waste settings are retained for unchanged products. It does not send, accept or finalise the quote.'
          :'Not created yet. Confirm creates one manual draft through the existing quote-creation policy. Separate measurements stay separate. Engine costs shown exclude quote margins/taxes; review the full total in the builder. It does not send, accept or finalise the quote.',
        permissionRevision:access.permissionRevision },{kind:'draft_create',spec,editQuoteId:editing,briefStateId:meta?.briefStateId??null,briefRevision:meta?.briefRevision??null});
}
function parsedAction(value: unknown): ActionView { const action = parseActionView(value); if (!action)
    throw rpcError(null); return action; }
export async function confirmCreation(client: SupabaseClient, access: Access, id: string, digest: string, version: number): Promise<ActionView> {
    await freshAccess(client, access, 'p4');
    const trusted = batchClient(createAdminClient());
    // The private row only selects a registered execution path. The RPC still
    // revalidates actor, digest, version, run, epoch, binding and all snapshots.
    const {data:stored,error:readError}=await (createAdminClient() as any).from('assistant_v2_actions').select('payload').eq('id',id).eq('company_id',access.companyId).eq('user_id',access.userId).maybeSingle();
    if(readError)throw rpcError(readError);
    if(!stored||!isRecord(stored.payload))throw rpcError({code:'P0002'});
    if(stored.payload.controllerVersion===1 && !libraryWorkflowEnabled())throw new ProposalError('The draft workflow is disabled on this deployment. Nothing was changed.');
    if(stored.payload.editQuoteId!=null){
        if(stored.payload.controllerVersion!==1 || !isUuid(stored.payload.editQuoteId))throw new ProposalError('This old draft-edit proposal is not safe to execute. Review the same draft again using the new controller.');
        if(stored.payload.genericTradesEnabled!==(process.env.GENERIC_TRADES_V1_ENABLED==='true'))throw new ProposalError('The creation configuration changed. Review a fresh proposal.');
        const outcome=await trusted.rpc('sa_v2_workflow_edit_confirm',{p_action_id:id,p_user_id:access.userId,p_digest:digest,p_version:version});
        if(outcome.error)throw rpcError(outcome.error);
        return parsedAction(outcome.data);
    }
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
        attempted = true;
        // This is still the ONLY parent creation call: preserve subscription,
        // company lock, quota reservation/admission and tax seeding behavior.
        const created = await createQuoteWithDetails({ customerName: params.customerName, jobName: params.jobName, siteAddress: typeof params.siteAddress === 'string' ? params.siteAddress : null, templateId: null, entryMode: 'manual', measurementSystem: params.measurementSystem as DraftSpec['measurementSystem'], trade: params.trade as DraftSpec['trade'], componentCollectionId: params.componentCollectionId });
        if (!created.ok) return await mark(created.code);
        if (!isUuid(created.quoteId)) return await mark('missing_created_id');
        const quoteId = created.quoteId;
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
        // The SQL finisher binds the quote and committed snapshot to the brief
        // in the SAME transaction as child creation/audit. No best-effort update.
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
