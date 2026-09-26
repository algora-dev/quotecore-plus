import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { batchClient } from './database';
import { parseHit, type Access, type EntityHit, type RecordTarget, type SearchKind } from './contracts';
import { AssistantV2Error, freshAccess, rpcError } from './runtime.server';
import { destinationFor, componentDestinationFor } from './navigation';
export async function searchRecords(client: SupabaseClient, access: Access, kind: SearchKind, query: string): Promise<EntityHit[]> {
    await freshAccess(client, access);
    const { data, error } = await batchClient(client).rpc('sa_v2_search', { p_kind: kind, p_query: query, p_limit: 10 });
    if (error)
        throw rpcError(error);
    if (!Array.isArray(data))
        throw rpcError(null);
    const hits = data.map(parseHit);
    if (hits.some((hit) => !hit))
        throw rpcError(null);
    return hits as EntityHit[];
}
export async function readRecord(client: SupabaseClient, access: Access, target: RecordTarget): Promise<EntityHit> {
    await freshAccess(client, access);
    const { data, error } = await batchClient(client).rpc('sa_v2_record', { p_kind: target.kind, p_id: target.id });
    if (error)
        throw rpcError(error);
    if (data === null)
        throw new AssistantV2Error('not_found', 'No accessible matching record was found.', 404);
    const hit = parseHit(data);
    if (!hit)
        throw rpcError(null);
    return hit;
}
export async function navigationDestination(client: SupabaseClient, access: Access, target: RecordTarget): Promise<string> {
    const hit = await readRecord(client, access, target);
    let destination: string | null;
    if (target.focus) {
        if (access.permissions.components === 'hidden' || !['quote', 'draft_quote'].includes(hit.kind))
            throw new AssistantV2Error('not_found', 'No accessible matching component was found.', 404);
        // Parent ownership was checked by sa_v2_record. This RLS read is also
        // explicitly constrained to that parent, so a forged child ID cannot
        // navigate to another quote/company. No admin client is used.
        const { data: component, error } = await client.from('quote_components')
            .select('id, quote_id, component_type').eq('id', target.focus.id).eq('quote_id', hit.id).maybeSingle();
        if (error) throw rpcError(error);
        if (!component || component.id !== target.focus.id || component.quote_id !== hit.id)
            throw new AssistantV2Error('not_found', 'No accessible matching component was found.', 404);
        await freshAccess(client, access);
        destination = componentDestinationFor(hit, component.id, String(component.component_type), access.workspaceSlug);
    } else destination = destinationFor(hit, access.workspaceSlug);
    if (!destination)
        throw new AssistantV2Error('destination_unavailable', 'Open this item from its normal list.', 409);
    return destination;
}
