import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isRecord } from '../section-permissions';
import { parseCard, type Access, type CardContent } from './contracts';
import { batchClient } from './database';
import { freshAccess, rpcError } from './runtime.server';
export async function attention(client: SupabaseClient, access: Access): Promise<Extract<CardContent, {
    kind: 'attention';
}>> {
    await freshAccess(client, access, 'p2');
    const { data, error } = await batchClient(client).rpc('sa_v2_attention', {});
    if (error)
        throw rpcError(error);
    if (!isRecord(data))
        throw rpcError(null);
    const content = { kind: 'attention', title: 'What needs attention', ...data };
    const parsed = parseCard({ id: '00000000-0000-0000-0000-000000000001', run_id: '00000000-0000-0000-0000-000000000002', created_at: new Date().toISOString(), content });
    if (!parsed || parsed.content.kind !== 'attention')
        throw rpcError(null);
    return parsed.content;
}
