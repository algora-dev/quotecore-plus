/** Local additive RPC contracts. Regenerate/compare global types on integration. */
import type { Database, Json } from '@/app/lib/supabase/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
type Rpc<A> = {
    Args: A;
    Returns: Json;
};
export type AssistantBatchDatabase = Omit<Database, 'public'> & {
    public: Omit<Database['public'], 'Functions'> & {
        Functions: Database['public']['Functions'] & {
            sa_v2_runtime: Rpc<Record<string, never>>;
            sa_v2_retrieval_capabilities: Rpc<{ p_run_id: string; p_revision: number }>;
            sa_v2_retrieval_query: Rpc<{ p_run_id: string; p_revision: number; p_plan: Json }>;
            sa_v2_retrieval_query_v17: Rpc<{ p_run_id: string; p_revision: number; p_plan: Json }>;
            sa_v2_speed_count: Rpc<{ p_run_id: string; p_revision: number; p_kind: string; p_period: string; p_owner: string }>;
            sa_v2_speed_quote_snapshot: Rpc<{ p_run_id: string; p_revision: number; p_quote_id: string }>;
            sa_v2_run_scope_add: Rpc<{
                p_run_id: string;
                p_user_id: string;
                p_revision: number;
            }>;
            sa_v2_search: Rpc<{
                p_kind: string;
                p_query: string;
                p_limit: number;
            }>;
            sa_v2_record: Rpc<{
                p_kind: string;
                p_id: string;
            }>;
            sa_v2_context_set: Rpc<{
                p_conversation_id: string;
                p_pathname: string | null;
            }>;
            sa_v2_session_read: Rpc<{
                p_conversation_id: string;
            }>;
            sa_v2_card_add: Rpc<{
                p_run_id: string;
                p_user_id: string;
                p_key: string;
                p_sections: string[];
                p_content: Json;
            }>;
            sa_v2_attention: Rpc<Record<string, never>>;
            sa_v2_target_snapshot: Rpc<{
                p_kind: string;
                p_id: string;
            }>;
            sa_v2_action_propose: Rpc<{
                p_run_id: string;
                p_user_id: string;
                p_key: string;
                p_action: Json;
            }>;
            sa_v2_action_read: Rpc<{
                p_action_id: string;
            }>;
            sa_v2_action_cancel: Rpc<{
                p_action_id: string;
                p_digest: string;
                p_version: number;
            }>;
            sa_v2_action_confirm_atomic: Rpc<{
                p_action_id: string;
                p_user_id: string;
                p_digest: string;
                p_version: number;
            }>;
            sa_v2_creation_context: Rpc<Record<string, never>>;
            sa_v2_creation_claim: Rpc<{
                p_action_id: string;
                p_user_id: string;
                p_digest: string;
                p_version: number;
            }>;
            sa_v2_creation_checkpoint: Rpc<{
                p_action_id: string;
                p_user_id: string;
                p_quote_id: string;
            }>;
            sa_v2_creation_finish: Rpc<{
                p_action_id: string;
                p_user_id: string;
                p_children: Json;
            }>;
            sa_v2_creation_uncertain: Rpc<{
                p_action_id: string;
                p_user_id: string;
                p_code: string;
            }>;
        };
    };
};
export function batchClient(client: SupabaseClient): SupabaseClient<AssistantBatchDatabase> {
    return client as unknown as SupabaseClient<AssistantBatchDatabase>;
}
export function toJson(value: unknown): Json {
    // Reject undefined, non-finite and prototype surprises at call sites first.
    return JSON.parse(JSON.stringify(value)) as Json;
}
